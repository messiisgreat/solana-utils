import { AccountLoader } from "@nazaire/account-loader";
import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { IDBPDatabase, openDB } from "idb";

export class AccountCache {
  private _loader: DataLoader<
    { publicKey: PublicKey; maxAge: number },
    AccountInfo<Buffer> | null,
    string
  >;

  constructor(
    public readonly connection: Connection,
    /**
     * An Account DataLoader with no in-memory cache
     */
    private _rpcLoader = new AccountLoader(connection, {
      cache: false,
    })
  ) {
    this._loader = new DataLoader<
      { publicKey: PublicKey; maxAge: number },
      AccountInfo<Buffer> | null,
      string
    >(
      async (keys) => {
        const results: (AccountInfo<Buffer> | null | Error)[] = [];

        const stored = await Promise.all(
          keys.map(async (key, index) => {
            return {
              publicKey: key.publicKey,
              index,
              value: await this._get(key),
            };
          })
        );

        const missing: { publicKey: PublicKey; index: number }[] = [];

        for (let i = 0; i < stored.length; i++) {
          const item = stored[i]!;

          if (item.value !== undefined) {
            results[item.index] = item.value.data;
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
        cacheKeyFn: ({ publicKey }) => publicKey.toString(),
      }
    );
  }

  private _db:
    | IDBPDatabase<{
        accounts: {
          key: string;
          value: {
            publicKey: string;
            data: AccountInfo<Buffer> | null;
            ts: number;
          };
        };
      }>
    | undefined;

  public async getDb() {
    if (this._db) return this._db;
    else
      return (this._db = await openDB("solana-web-utils", 1, {
        upgrade(db) {
          db.createObjectStore("accounts", {
            keyPath: "publicKey",
          });
        },
      }));
  }

  private async _get({
    publicKey,
    maxAge,
  }: {
    publicKey: PublicKey;
    maxAge: number;
  }) {
    const db = await this.getDb();

    const stored = await db.get("accounts", publicKey.toString());

    if (stored && stored.ts > Date.now() - maxAge) return stored;

    return undefined;
  }

  private async _put(publicKey: PublicKey, data: AccountInfo<Buffer> | null) {
    const db = await this.getDb();

    await db.put("accounts", {
      publicKey: publicKey.toString(),
      data,
      ts: Date.now(),
    });
  }

  load(publicKey: PublicKey, opts: { maxAge: number }) {
    return this._loader.load({ publicKey, maxAge: opts.maxAge });
  }

  // loadMany(queries: { publicKey: PublicKey; maxAge: number }[]) {
  //   return this._loader.loadMany(queries);
  // }

  async clear(publicKey: PublicKey) {
    await (await this.getDb()).delete("accounts", publicKey.toString());
    this._loader.clear({ publicKey, maxAge: 0 });
  }

  async clearAll() {
    await (await this.getDb()).clear("accounts");
    this._loader.clearAll();
  }
}
