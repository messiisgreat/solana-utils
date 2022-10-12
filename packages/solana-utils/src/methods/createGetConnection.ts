import {
  Cluster as SolanaCluster,
  clusterApiUrl,
  Connection,
  ConnectionConfig,
  FetchMiddleware,
} from "@solana/web3.js";
import { TokenBucket, TokenBucketOpts } from "limiter";

export type Cluster = SolanaCluster | "localnet";
export type GetConnectionConfig = {
  cluster?: Cluster;
  endpoint?: string;
  rateLimitOpts?: TokenBucketOpts;
} & ConnectionConfig;

/**
 * Create a getConnection function using provided defaults
 * @param config
 * @returns
 */
export function createGetConnection(config: {
  defaultCluster?: Cluster;
  clusterUrlDefaults?: { [P in Cluster]?: string };
}) {
  const defaultCluster = config.defaultCluster || "devnet";
  const getClusterApiUrl = (value: Cluster = defaultCluster) => {
    switch (value) {
      case "localnet":
        return config.clusterUrlDefaults?.localnet || "http://localhost:8899";
      case "devnet":
        return config.clusterUrlDefaults?.devnet || clusterApiUrl(value);
      case "testnet":
        return config.clusterUrlDefaults?.testnet || clusterApiUrl(value);
      case "mainnet-beta":
        return (
          config.clusterUrlDefaults?.["mainnet-beta"] || clusterApiUrl(value)
        );
      default:
        return clusterApiUrl(value);
    }
  };

  /**
   * Get a new `Connection` instance
   * @param options
   * @returns
   */
  const getConnection = (options?: GetConnectionConfig) => {
    const cluster = options?.cluster || defaultCluster;
    const endpoint = options?.endpoint || getClusterApiUrl(cluster);

    const tokenBucket = options?.rateLimitOpts
      ? new TokenBucket(options.rateLimitOpts)
      : null;
    const fetchMiddleware: FetchMiddleware | undefined = options?.rateLimitOpts
      ? async (info, init, fetch) => {
          await tokenBucket!.removeTokens(1);
          return await fetch(info, init);
        }
      : undefined;

    return new Connection(endpoint, {
      fetchMiddleware,
      ...options,
    });
  };

  return { getConnection, getClusterApiUrl, defaultCluster };
}
