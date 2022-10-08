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
    const result = await cache.load({
      publicKey: new PublicKey("9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"),
      maxAge: 10_000,
    });

    chai.should().exist(result);

    const record = await indexeddb.get(
      "accounts",
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    chai.should().exist(record);
  });

  it("account is cached", async () => {
    const publicKey = new PublicKey(
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    const result = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    const result2 = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    chai.expect(totalRequestsMade).to.equal(1);
  });

  it("clear cache", async () => {
    const publicKey = new PublicKey(
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    const result = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    await cache.clear(publicKey);

    const record = await indexeddb.get(
      "accounts",
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    chai.should().equal(record, undefined);

    const result2 = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    chai.expect(totalRequestsMade).to.equal(2);
  });

  it("satisfies max age", async () => {
    const publicKey = new PublicKey(
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    await indexeddb.put("accounts", {
      publicKey: "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo",
      data: true,
      ts: Date.now() - 5_000,
    });

    const result = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    chai.should().exist(result);

    chai.expect(totalRequestsMade).to.equal(0);
  });

  it("not satisfies max age", async () => {
    const publicKey = new PublicKey(
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    await indexeddb.put("accounts", {
      publicKey: "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo",
      data: true,
      ts: Date.now() - 30_000,
    });

    const result = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    chai.should().exist(result);

    chai.expect(totalRequestsMade).to.equal(1);
  });

  it("in-memory cache", async () => {
    const publicKey = new PublicKey(
      "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo"
    );

    await indexeddb.put("accounts", {
      publicKey: "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo",
      data: "before",
      ts: Date.now(),
    });

    // it will stay in in-memory cache now
    const resultBefore = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    await indexeddb.put("accounts", {
      publicKey: "9nZAY25ud4HA5yMMpS73bWmBLi5UNBs7PaCb5uwbWVeo",
      data: "after",
      ts: Date.now(),
    });

    const resultAfter = await cache.load({
      publicKey,
      maxAge: 10_000,
    });

    chai.expect(totalRequestsMade).to.equal(0);
    chai.expect(resultAfter).to.equal(resultBefore);
  });
});
