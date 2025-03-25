# DEX Project Setup Guide

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
   This executes all test cases from `DEX-group-5/dex/tests/dex.ts`

## Debugging Tips

### Viewing Program Logs

Use the `msg!` macro (Anchor-specific) to log information from your program:

1. Start a local Solana test validator in one terminal:
   ```bash
   solana-test-validator -r
   ```

2. View filtered logs in another terminal:
   ```bash
   solana logs -ul | grep -i <search_term>
   ```
   - `-ul` specifies the local cluster (use `-um` for mainnet, `-ud` for devnet)

3. Run tests using the local validator:
   ```bash
   anchor test --skip-local-validator
   ```

### Managing Account Balance

Each account must be rent-exempt (have minimum SOL balance). To fund accounts on your local cluster:

```bash
solana airdrop 100 <wallet_address> -ul
```

# Roadmap

## Week 1: Environment Setup & Core Program Structure

- [x] Set up Solana development environment
- [x] Create program skeleton with state and instruction definitions
- [x] Implement initialization logic
- [ ] Implement basic user token account management
- [x] Create test framework

## Week 2: Deposit, Withdrawal & Pool Management

- [ ] Implement deposit/withdrawal functions
- [ ] Implement pool initialization logic
- [ ] Develop liquidity provision/withdrawal functions
- [ ] Write tests for these functions
- [ ] Start building simple client integration

## Week 3: Swap Functionality & Testing

- [ ] Implement swap function with constant product formula
- [ ] Add fee calculation and distribution
- [ ] Complete end-to-end testing on Solana devnet
- [ ] Refine error handling and input validation

## Week 4: (?Frontend & Integration)

- [ ] Build React frontend with wallet connection
- [ ] Create swap interface component
- [ ] Add deposit/withdrawal interface
- [ ] Integrate client library with frontend
- [ ] Test complete flow from UI to on-chain program

## Test coverage

- Dex initialization with incorrect Admin Key is failing
- Dex initialization with correct Admin Key
