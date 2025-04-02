# DEX Integration Guide

This document outlines the integration points between the frontend and the Solana DEX smart contract. These TODOs should be implemented to replace the mocked functionality in the UI with actual blockchain interaction.

## Smart Contract Functionality

The DEX smart contract (`dex/programs/dex`) should provide the following core functionality that needs to be integrated:

1. **Initialize** - Set up the DEX with fee parameters
2. **Create Pool** - Create a new liquidity pool for a pair of tokens
3. **Deposit Liquidity** - Add liquidity to a pool and receive LP tokens
4. **Withdraw Liquidity** - Remove liquidity from a pool by burning LP tokens
5. **Swap** - Exchange one token for another through a liquidity pool

## Integration Tasks

### Token Management

- [ ] **Fetch Token List**: Replace the mocked token list in `constants/tokens.ts` with tokens supported by the DEX
- [ ] **Token Balances**: Implement token balance fetching for all tokens in a user's wallet, not just SOL
- [ ] **Token Approvals**: Implement token approval functions for DEX interactions

### Pool Management

- [ ] **Fetch Pools**: Replace mocked pool data with actual pools from the DEX contract
- [ ] **Pool Statistics**: Get real-time data for each pool (liquidity, volume, APY)
- [ ] **Create Pool UI**: Add UI for users to create new pools (admin functionality)

### Liquidity

- [ ] **Deposit Logic**: Implement actual liquidity provision
- [ ] **Withdraw Logic**: Implement actual liquidity withdrawal
- [ ] **LP Token Management**: Track and display user's LP tokens and positions
- [ ] **Pool Share Calculation**: Calculate actual share of the pool based on LP tokens

### Swap

- [ ] **Price Calculation**: Get actual token exchange rates from pools
- [ ] **Slippage Handling**: Implement minimum received amount based on slippage tolerance
- [ ] **Price Impact**: Calculate and display the price impact of a swap
- [ ] **Transaction Processing**: Handle the full swap transaction flow

### Wallet Integration

- [ ] **Extended Wallet State**: Update WalletState to include token balances
- [ ] **Transaction History**: Add functionality to view past transactions
- [ ] **Permissions**: Handle necessary token approvals for DEX interactions

### Optional: Analytics

- [ ] **Global Stats**: Implement actual TVL, transaction count, and user stats
- [ ] **User Analytics**: Display user-specific statistics and history
- [ ] **Performance Metrics**: Calculate and display actual trade fees and transaction times

## Implementation Approach

1. **Create SDK Layer**: Implement JavaScript/TypeScript wrapper functions for DEX program instructions
2. **State Management**: Set up state management for DEX interaction and data
3. **UI Integration**: Replace mocked components with live data and transaction handling
4. **Testing**: Thoroughly test all interactions on a development environment

## Resources

- DEX Program: `dex/programs/dex/src`
- DEX State Structure: See `DexState` and `LiquidityPool` in `instructions.rs`
- Solana Web3.js: For blockchain interaction
- Anchor Framework: For structured interaction with the DEX program 