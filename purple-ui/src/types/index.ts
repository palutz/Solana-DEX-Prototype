
export interface Token {
  id: string;
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
  address: string;
}

export interface Pool {
  id: string;
  name: string;
  tokens: [Token, Token];
  liquidity: number;
  volume24h: number;
  fee: number;
  apy: number;
}

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number;
}

export interface SwapState {
  tokenFrom: Token | null;
  tokenTo: Token | null;
  amountFrom: string;
  amountTo: string;
}

export interface PoolState {
  pool: Pool | null;
  depositAmount1: string;
  depositAmount2: string;
  withdrawAmount: string;
  sharePercentage: number;
}
