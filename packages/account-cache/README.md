# @nazaire/account-cache

Solana Account batch loader & cache leveraging the browser's indexedDB.

`AccountCache` will store all account data in an indexedDB database so raw account data can persist across multiple sessions.

Load strategy:

1. Get from in-memory DataLoader cache
2. Load from the browser's indexedDB storage
3. (Batch) fetch the account from an RPC using the provided `Connection`

## Usage

```
const accounts = new AccountCache(cluster, connection, {
  // from @solana/spl-token
  token: (account, pubkey) => unpackAccount(pubkey, account),

  // from @solana/spl-token
  mint: (account, pubkey) => unpackMint(pubkey, account),

   // from @metaplex-foundation/js
  metadata: (account, pubkey) =>
    parseMetadataAccount(Object.assign({ publicKey: pubkey }, account)),
});

const mint = await accounts.load(mintPk, "mint")
const token = await accounts.load(tokenPk, "token")

// utilise batching with concurrent promises

const [mint, token] = await Promise.all([
  accounts.load(mintPk, "mint"),
  accounts.load(tokenPk, "token")
])
```
