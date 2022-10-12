import { AccountLoader } from "@nazaire/account-loader";
import { AccountInfo, Cluster, Connection, PublicKey } from "@solana/web3.js";
import DataLoader, { CacheMap } from "dataloader";
import { IDBPDatabase, openDB } from "idb";
import { catchAsValue } from "./utils";

class ExpiringAccountMap
  implements CacheMap<[PublicKey, number], Promise<AccountInfo<Buffer> | null>>
{
  private _map = new Map<
    string,
    [Promise<AccountInfo<Buffer> | null>, number]
  >();

  get(key: [PublicKey, number]) {
    const value = this._map.get(key[0].toString());
    if (value && value[1] > Date.now() - key[1]) return value[0];
    return undefined;
  }

  set(key: [PublicKey, number], value: Promise<AccountInfo<Buffer> | null>) {
    this._map.set(key[0].toString(), [value, Date.now()]);
  }

  delete(key: [PublicKey, number]) {
    this._map.delete(key[0].toString());
  }

  clear() {
    this._map.clear();
  }
}

type SerializedAccountInfo = {
  /** `true` if this account's data contains a loaded program */
  executable: boolean;
  /** Identifier of the program that owns the account */
  owner: string;
  /** Number of lamports assigned to the account */
  lamports: number;
  /** Optional data assigned to the account */
  data: Uint8Array;
  /** Optional rent epoch info for account */
  rentEpoch?: number;
};

const serializeAccount = (
  data: AccountInfo<Buffer> | null
): SerializedAccountInfo | null => {
  if (!data) return null;
  return {
    ...data,
    owner: data.owner.toString(),
  };
};

const deserializeAccount = (
  data: SerializedAccountInfo | null
): AccountInfo<Buffer> | null => {
  if (!data) return null;
  return {
    ...data,
    data: Buffer.from(data.data),
    owner: new PublicKey(data.owner),
  };
};

export class AccountCache<AccountParsers extends {}> {
  private _loader: DataLoader<[PublicKey, number], AccountInfo<Buffer> | null>;

  /**
   * An Account DataLoader with no in-memory cache
   */
  private _rpcLoader = new AccountLoader(this.connection, {
    cache: false,
  });

  private _parsers: {
    [K in keyof AccountParsers]: (
      account: AccountInfo<Buffer>,
      publicKey: PublicKey
    ) => AccountParsers[K];
  };

  constructor(
    /**
     * Provide the current cluster the accounts are sourced from
     */
    public readonly cluster: string,
    public readonly connection: Connection,
    /**
     * Define account parsers
     */
    parsers: {
      [K in keyof AccountParsers]: (
        account: AccountInfo<Buffer>,
        publicKey: PublicKey
      ) => AccountParsers[K];
    }
  ) {
    this._parsers = { ...parsers };
    this._loader = new DataLoader(
      async (keys) => {
        const results: (AccountInfo<Buffer> | null | Error)[] = [];

        const stored = await Promise.all(
          keys.map(async ([publicKey, age], index) => {
            return {
              publicKey: publicKey,
              index,
              value: await this._get(publicKey, age),
            };
          })
        );

        const missing: { publicKey: PublicKey; index: number }[] = [];

        for (let i = 0; i < stored.length; i++) {
          const item = stored[i]!;

          if (item.value !== undefined) {
            results[item.index] = item.value;
          } else {
            missing.push(item);
          }
        }

        const loaded = await this._rpcLoader.loadMany(
          missing.map((item) => item.publicKey)
        );

        const putPromises: Promise<void>[] = [];

        for (let i = 0; i < loaded.length; i++) {
          const { publicKey, index } = missing[i]!;
          const result = loaded[i] as AccountInfo<Buffer> | Error | null;

          // store result at correct index

          results[index] = result;

          // save new results to cache
          if (!(result instanceof Error))
            putPromises.push(this._put(publicKey, result));
        }

        // wait for put promises to resolve
        await Promise.all(putPromises);

        return results;
      },
      {
        cacheMap: new ExpiringAccountMap(),
      }
    );
  }

  private _db:
    | IDBPDatabase<{
        accounts: {
          key: string;
          value: {
            publicKey: string;
            data: SerializedAccountInfo | null;
            ts: number;
          };
        };
      }>
    | undefined;

  public async getDb() {
    if (this._db) return this._db;
    else
      return (this._db = await openDB(`solana_${this.cluster}_accounts`, 1, {
        upgrade(db) {
          db.createObjectStore("accounts", {
            keyPath: "publicKey",
          });
        },
      }));
  }

  private async _get(
    publicKey: PublicKey,
    maxAge: number
  ): Promise<AccountInfo<Buffer> | null | undefined> {
    const db = await this.getDb();

    const stored = await db.get("accounts", publicKey.toString());

    if (stored && stored.ts > Date.now() - maxAge)
      return deserializeAccount(stored.data);

    return undefined;
  }

  private async _put(publicKey: PublicKey, data: AccountInfo<Buffer> | null) {
    const db = await this.getDb();

    await db.put("accounts", {
      publicKey: publicKey.toString(),
      data: serializeAccount(data),
      ts: Date.now(),
    });
  }

  /**
   * Load an account
   * @param publicKey The public key of the account to load
   * @param type The parsing function to use, or use `undefined` to return the account unparsed
   * @param maxAge Only return cached items less than the maxAge, defaults to `Infinity`
   */
  async load<K extends keyof AccountParsers>(
    publicKey: PublicKey,
    type: K,
    maxAge?: number
  ): Promise<AccountParsers[K] | Error | null>;
  async load<K extends keyof AccountParsers>(
    publicKey: PublicKey,
    type: undefined,
    maxAge?: number
  ): Promise<AccountInfo<Buffer> | Error | null>;
  async load(
    publicKey: PublicKey,
    type?: keyof AccountParsers,
    maxAge: number = Infinity
  ) {
    const account = await this._loader.load([publicKey, maxAge]);
    if (!account) return null;
    if (!type) return account;
    return catchAsValue(() => this._parsers[type](account, publicKey));
  }

  // loadMany(queries: { publicKey: PublicKey; maxAge: number }[]) {
  //   return this._loader.loadMany(queries);
  // }

  async clear(publicKey: PublicKey) {
    await this.getDb().then((db) =>
      db.delete("accounts", publicKey.toString())
    );
    this._loader.clear([publicKey, 0]);
  }

  async clearAll() {
    await this.getDb().then((db) => db.clear("accounts"));
    this._loader.clearAll();
  }
}
