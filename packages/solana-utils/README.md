# @nazaire/solana-utils

A collection of helpers for working with Solana

## Usage

### createGetConnection

Create a `getConnection` function that resolves the rpc endpoint from default cluster url mappings.

`getConnection` can take a `rateLimitOpts` parameter that implements a [TokenBucket](https://github.com/jhurliman/node-rate-limiter) that will rate limit all outgoing connections. See `limiter` for more options.
```
const { getConnection } = createGetConnection({
  defaultCluster: "devnet",
  clusterUrlDefaults: {
    // localnet: string,
    // testnet: string,

    // (commonly used) set default to env variable
    devnet: process.env.DEVNET_URL,

    "mainnet-beta": "https://ssc-dao.genesysgo.net",
  },
});


// The default connection to use throughout the application
// rate limited to 1 request per second
const connection = getConnection({
  cluster: "devnet",
  commitment: "confirmed",
  rateLimitOpts: {
    bucketSize: 1,
    tokensPerInterval: 1,
    interval: "second",
  },
})
```
