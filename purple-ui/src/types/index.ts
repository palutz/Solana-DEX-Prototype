// TODO: Update these types to match the actual implementation in the DEX smart contract
// These interfaces will need to be aligned with the data structures in the Solana programs

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
  // TODO: Add token balances to track all tokens owned by the wallet
}

// TODO: Add interface for tracking user's LP tokens and positions

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
