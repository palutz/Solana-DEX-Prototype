# Solana DEX Prototype

A decentralized exchange protocol built on Solana blockchain.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

This project implements a prototype decentralized exchange on Solana with core AMM functionality, including:

- Constant product market maker (x*y=k) implementation
- Liquidity pool creation and management
- Token swapping with slippage protection
- Liquidity provider (LP) token issuance and redemption
- Fee collection mechanism with protocol fee allocation

## Features

- **Pool Creation**: Create trading pairs for any token combination
- **Liquidity Provision**: Add liquidity and receive LP tokens representing pool share
- **Token Swapping**: Exchange tokens with automatic price discovery
- **Liquidity Withdrawal**: Redeem LP tokens for underlying assets
- **Fee Structure**: Configurable trading fees with protocol revenue sharing

## Technical Architecture

The protocol is built using Anchor framework and consists of the following components:

- **State Management**: Global DEX configuration and pool tracking
- **Liquidity Pool Logic**: Deposit/withdrawal functions and LP token issuance
- **Swap Engine**: Trading logic with constant product formula
- **Fee System**: Collection and distribution of protocol fees

## Getting Started

### Prerequisites

- Solana CLI
- Anchor Framework
- Rust
- Node.js and Yarn

## Installation

1. **Install Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   Verify installation with `which cargo` and add it to your PATH if needed.

2. **Install Solana CLI**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
   ```
   Verify with `solana --version`

3. **Install Anchor Framework**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --force
   avm install latest
   avm use latest
   ```

## Building and Testing

1. **Build the project**
   ```bash
   cd dex
   anchor build
   ```

2. **Run tests**
   ```bash
   anchor test
   ```
   This executes all test cases from `dex/tests/dex.ts`

## Development Status

This project is a prototype and is not intended for production use. It demonstrates core DEX functionality but requires additional security audits and optimization before mainnet deployment.

### User Interface

A basic UI (purple-ui directory) is included in this repository, but it's currently under development and not yet complete. The interface will eventually allow for:

- Connecting wallet and viewing balances
- Creating and managing liquidity pools
- Adding and removing liquidity
- Performing token swaps
- Viewing transaction history

## Implementation Details

The DEX implements:

- **Initialization**: Admin-controlled setup with configurable fee structure
- **Pool Creation**: Permissionless creation of liquidity pools
- **Liquidity Management**: Deposit and withdrawal functions with fair LP token distribution
- **Swap Algorithm**: Constant product formula with fee calculation
- **Protocol Fees**: Mechanism for sustainable protocol economics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

This is a development prototype. Not for production use.
