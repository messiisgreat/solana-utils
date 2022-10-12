import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";
import { AccountLoader } from "./AccountLoader";
import { AccountParsersMap } from "./types";

export class ParsedAccountLoader<AccountParsers extends {}> {
  private _parsers: AccountParsersMap<AccountParsers>;
  private _loader: AccountLoader;

  constructor(
    connection: Connection,
    parsers: AccountParsersMap<AccountParsers>,
    options?: DataLoader.Options<PublicKey, AccountInfo<Buffer> | null, string>
  ) {
    this._loader = new AccountLoader(connection, options);
    this._parsers = { ...parsers };
  }

  /**
   * Loads a key, returning a `Promise` for the value represented by that key.
   */
  async load<T extends keyof AccountParsers | undefined>(
    publicKey: PublicKey,
    type: T
  ) {
    const account = await this._loader.load(publicKey);
    if (!account) return null;
    if (type) return this._parsers[type](account, publicKey);
    else return account;
  }

  /**
   * Loads multiple keys, promising an array of values:
   *
   *     var [ a, b ] = await myLoader.loadMany([ [PublicKey, 'mint'], [PublicKey, 'metadata'] ]);
   *
   * This is equivalent to the more verbose:
   *
   *     var [ a, b ] = await Promise.all([
   *       myLoader.load(PublicKey, 'mint'),
   *       myLoader.load(PublicKey, 'metatadat')
   *     ]);
   *
   */
  async loadMany<
    Keys extends readonly (readonly [
      PublicKey,
      keyof AccountParsers | undefined
    ])[]
  >(keys: Keys) {
    var loadPromises = [];

    for (var i = 0; i < keys.length; i++) {
      loadPromises.push(
        this.load(keys[i]![0], keys[i]![1])["catch"](function (error) {
          return error;
        })
      );
    }

    return Promise.all(loadPromises) as {
      [K in keyof Keys]: Keys[K][1] extends keyof AccountParsers
        ? AccountParsers[Keys[K][1]] | Error | null
        : AccountInfo<Buffer> | Error | null;
    };
  }

  /**
   * Clears the value at `key` from the cache, if it exists. Returns itself for
   * method chaining.
   */
  clear(key: PublicKey): this {
    this._loader.clear(key);
    return this;
  }

  /**
   * Clears the entire cache. To be used when some event results in unknown
   * invalidations across this particular `DataLoader`. Returns itself for
   * method chaining.
   */
  clearAll(): this {
    this._loader.clearAll();
    return this;
  }

  /**
   * Adds the provided key and value to the cache. If the key already exists, no
   * change is made. Returns itself for method chaining.
   */
  prime(key: PublicKey, value: AccountInfo<Buffer> | Error): this {
    this._loader.prime(key, value);
    return this;
  }
}
