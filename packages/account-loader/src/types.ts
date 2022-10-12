import { AccountInfo, PublicKey } from "@solana/web3.js";

export type AccountParsersMap<AccountParsers extends {}> = {
  [K in keyof AccountParsers]: (
    account: AccountInfo<Buffer>,
    publicKey: PublicKey
  ) => AccountParsers[K];
};
