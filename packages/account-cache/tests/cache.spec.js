require("mocha");
require("fake-indexeddb/auto");
const chai = require("chai");
const { AccountCache } = require("../dist/cjs");
const { Connection, PublicKey } = require("@solana/web3.js");
const { IDBPDatabase } = require("idb");

describe("Test cache", () => {
  let totalRequestsMade = 0;

  const connection = new Connection("https://api.devnet.solana.com", {
    fetchMiddleware: (info, init, fetch) => {
      totalRequestsMade++;
      return fetch(info, init);
    },
  });

  const devnetAccount = {
    string: "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo",
    publicKey: new PublicKey("9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"),
  };

  let cache = new AccountCache(connection);

  /** @type {IDBPDatabase} */
  let indexeddb;

  before(async () => {
    indexeddb = await cache.getDb();
  });

  beforeEach(async () => {
    totalRequestsMade = 0;
    await cache.clearAll();
  });

  it("get account", async () => {
    const result = await cache.load(devnetAccount.publicKey);

    chai.should().exist(result);

    const record = await indexeddb.get("accounts", devnetAccount.string);

    chai.should().exist(record);
  });

  it("account is cached", async () => {
    const result = await cache.load(devnetAccount.publicKey);

    const result2 = await cache.load(devnetAccount.publicKey);

    chai.expect(totalRequestsMade).to.equal(1);
  });

  it("clear cache", async () => {
    const result = await cache.load(devnetAccount.publicKey);

    await cache.clear(devnetAccount.publicKey);

    const record = await indexeddb.get("accounts", devnetAccount.string);

    chai.should().equal(record, undefined);

    const result2 = await cache.load(devnetAccount.publicKey);

    chai.expect(totalRequestsMade).to.equal(2);
  });

  it("satisfies max age", async () => {
    // fake db entry
    await indexeddb.put("accounts", {
      publicKey: devnetAccount.string,
      data: true,
      ts: Date.now() - 5_000, // 5 seconds ago
    });

    const result = await cache.load(devnetAccount.publicKey, 10_000);

    chai.should().exist(result);

    chai.expect(totalRequestsMade).to.equal(0);
  });

  it("not satisfies max age", async () => {
    await indexeddb.put("accounts", {
      publicKey: devnetAccount.string,
      data: true,
      ts: Date.now() - 30_000, // 30 seconds ago
    });

    const result = await cache.load(devnetAccount.publicKey, 10_000);

    chai.should().exist(result);

    chai.expect(totalRequestsMade).to.equal(1);
  });

  it("in-memory cache", async () => {
    await indexeddb.put("accounts", {
      publicKey: devnetAccount.string,
      data: "before",
      ts: Date.now(),
    });

    // loader will store in mem cache
    const resultBefore = await cache.load(devnetAccount.publicKey);

    // overwrite cache
    await indexeddb.put("accounts", {
      publicKey: devnetAccount.string,
      data: "after",
      ts: Date.now(),
    });

    // should return the value from mem cache and not the database
    const resultAfter = await cache.load(devnetAccount.publicKey, 10_000);

    chai.expect(totalRequestsMade).to.equal(0);
    chai.expect(resultAfter).to.equal(resultBefore);
  });
});
