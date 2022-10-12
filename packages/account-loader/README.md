# @nazaire/account-loader

Solana Account [DataLoader](https://github.com/graphql/dataloader) for batching getAccountInfo requests

## Usage

### AccountLoader

Uses [DataLoader](https://github.com/graphql/dataloader) to batch getAccountInfo requests into one get getMultipleAccountsInfo request. Out of the box in-memory cache to re-use results from previous requests.
Returns raw account data.

```
const loader = new AccountLoader(connection, {
  // optional DataLoader options

  // for example, disable the in-memory cache with:
  // cache: false

  // see DataLoader for more options
});

const account = await loader.load(publicKey);

const accounts = await loader.loadMany([publicKey1, publicKey2])
```

### ParsedAccountLoader

Extends `AccountLoader` with account parsing functions to simplify reading & parsing raw account data.

```
const loader = new ParsedAccountLoader(connection, {
  // from @solana/spl-token
  token: (account, pubkey) => unpackAccount(pubkey, account),

  // from @solana/spl-token
  mint: (account, pubkey) => unpackMint(pubkey, account),

  // from @metaplex-foundation/js
  metadata: (account, publicKey) =>
    parseMetadataAccount(Object.assign({ publicKey }, account)),
})

const mint = await loader.load(mintPk, "mint")
const token = await loader.load(tokenPk, "token")
```
