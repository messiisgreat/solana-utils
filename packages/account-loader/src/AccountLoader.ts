import { AccountInfo, Connection, PublicKey } from "@solana/web3.js";
import DataLoader from "dataloader";

export class AccountLoader extends DataLoader<
  PublicKey,
  AccountInfo<Buffer> | null,
  string
> {
  constructor(
    connection: Connection,
    options?: DataLoader.Options<PublicKey, AccountInfo<Buffer> | null, string>
  ) {
    super(
      async (keys: readonly PublicKey[]) => {
        return await connection.getMultipleAccountsInfo(keys as PublicKey[]);
      },
      {
        ...options,
        cacheKeyFn: (key) => key.toString(),
        maxBatchSize: 100,
      }
    );
  }
}
