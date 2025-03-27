import { Token, Pool } from "@/types";

export const TOKENS: Token[] = [
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    logoURI: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    decimals: 9,
    address: "So11111111111111111111111111111111111111112"
  },
  {
    id: "usd-coin",
    symbol: "USDC",
    name: "USD Coin",
    logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    decimals: 6,
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  },
  {
    id: "jupiter",
    symbol: "JUP",
    name: "Jupiter",
    logoURI: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
    decimals: 6,
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
  },
  {
    id: "raydium",
    symbol: "RAY",
    name: "Raydium",
    logoURI: "https://assets.coingecko.com/coins/images/13928/small/photo_2021-09-22_10-39-44.jpg",
    decimals: 6,
    address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
  }
];

export const POOLS: Pool[] = [
  {
    id: "sol-usdc",
    name: "SOL-USDC",
    tokens: [TOKENS[0], TOKENS[1]],
    liquidity: 2500000,
    volume24h: 750000,
    fee: 0.3,
    apy: 8.2
  },
  {
    id: "sol-jup",
    name: "SOL-JUP",
    tokens: [TOKENS[0], TOKENS[2]],
    liquidity: 850000,
    volume24h: 320000,
    fee: 0.3,
    apy: 12.5
  },
  {
    id: "usdc-ray",
    name: "USDC-RAY",
    tokens: [TOKENS[1], TOKENS[3]],
    liquidity: 650000,
    volume24h: 180000,
    fee: 0.3,
    apy: 9.7
  },
  {
    id: "sol-ray",
    name: "SOL-RAY",
    tokens: [TOKENS[0], TOKENS[3]],
    liquidity: 920000,
    volume24h: 285000,
    fee: 0.3,
    apy: 8.5
  }
];

export const getTokenBySymbol = (symbol: string): Token | undefined => {
  return TOKENS.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
};

export const getTokenById = (id: string): Token | undefined => {
  return TOKENS.find(token => token.id === id);
};

export const getPoolById = (id: string): Pool | undefined => {
  return POOLS.find(pool => pool.id === id);
};
