#![allow(unexpected_cfgs)]

#[allow(unused_imports)]
use solana_security_txt::security_txt;
#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Solana-DEX-prototype",
    project_url: "http://example.com",
    contacts: "email:nickshv13@icloud.com",
    policy: "https://github.com/anza-xyz/agave/blob/master/SECURITY.mdhttps://github.com/anza-xyz/agave/blob/master/SECURITY.md"
}

use anchor_lang::prelude::*;

pub mod instructions;
pub use instructions::*;

declare_id!("Ge4hd4p2D7Y5D9hZCabgXCGk6zpgPbHNC7fv2gsWAZrX");

/// This key is used to authenticate administrative actions within the governance contract.
pub const ADMIN_PUBKEY: Pubkey = pubkey!("E88MCgENj4uksz3QX9DUYRKqM8sJfqHGxCueWDnTPDep");

// This module defines the main instruction handlers for the DEX program
// Each function corresponds to a different instruction that can be invoked
#[program]
pub mod dex {
    use super::*;

    /// Initializes the DEX with the specified fee structure
    /// fee_numerator/fee_denominator represents the percentage fee (e.g., 10/1000 = 1%)
    // ┌───────────┐    ┌───────┐     ┌───────────────┐      ┌────────────────┐
    // │ Admin/Dev │───►│ Start │────►│ Admin Signer? │──No─►│ Error:NotAdmin │
    // └───────────┘    └───────┘     └───────┬───────┘      └────────────────┘
    //                                        │
    //                                       Yes
    //                                        │
    //                                        ▼
    //                                  ┌────────────┐      ┌───────────────────┐
    //                                  │ Check Fees │──No─►│ Error:InvalidFees │
    //                                  └─────┬──────┘      └───────────────────┘
    //                                        │
    //                                       Yes
    //                                        │
    //                                        ▼
    //     ┌─────────────────────┐     ┌─────────────┐     ┌────────────────────┐
    //     │ Set Admin,Pools,Fee │◄────│ Get DEX PDA │◄────│ DEX Initialization │
    //     └─────────────────────┘     └─────────────┘     └────────────────────┘
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_numerator: u64,
        fee_denominator: u64,
        protocol_fee_percentage: u8,
        fee_collector: Pubkey,
    ) -> Result<()> {
        instructions::initialize_dex(
            ctx,
            fee_numerator,
            fee_denominator,
            protocol_fee_percentage,
            fee_collector,
        )
    }

    /// Creates a new liquidity pool for a token pair
    /// The pool is identified by the token A and token B mints
    // ┌──────────────┐     ┌──────────────────┐      ┌────────────────────┐
    // │ Pool Creator │────►│ Create Liquidity │─────►│ Set Up Token A & B │
    // └──────────────┘     │  Pool Account    │      │  Reserve Accounts  │
    //                      └──────────────────┘      └─────────┬──────────┘
    //                                                          │
    //                                                          ▼
    // ┌──────────────┐      ┌───────────────────┐      ┌──────────────────┐
    // │ Creator's LP │◄─────│  Create LP Token  │◄─────│   Set Initial    │
    // │   Account    │      │ Mint (6 decimals) │      │   Liquidity = 0  │
    // └──────────────┘      └───────────────────┘      └────────┬─────────┘
    //                                                           │
    //                                                           ▼
    //                                                ┌───────────────────┐
    //                                                │ Copy Fee Settings │
    //                                                │  from DEX State   │
    //                                                └─────────┬─────────┘
    //                                                          │
    //                                                          ▼
    //                                                 ┌─────────────────┐
    //                                                 │  Increment DEX  │
    //                                                 │  Pools Counter  │
    //                                                 └─────────────────┘
    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        instructions::create_liquidity_pool(ctx)
    }

    /// Adds liquidity to an existing pool
    /// Deposits specified amounts of both tokens and mints LP tokens in return
    // ┌────────┐     ┌───────────────┐     ┌───────────────┐
    // │  User  │────►│ User's TokenA │────►│ Pool's TokenA │
    // └────────┘     │ User's TokenB │     │   Reserve     │
    //                └───────────────┘     └───────┬───────┘
    //                                              │
    //                                              ▼
    //                                      ┌────────────────┐
    //                               yes────│ First Deposit? ├─────no
    //                                │     └────────────────┘      │
    //                                ▼                             ▼
    //                        ┌───────────────┐            ┌─────────────────┐
    //                        │ Calculate LP: │            │ Calculate LP:   │
    //                        │ sqrt(TokenA * │            │ Proportional to │
    //                        │ TokenB)       │            │ Existing Ratio  │
    //                        └───────┬───────┘            └────────┬────────┘
    //                                │                             │
    //                                └─────────────┬───────────────┘
    //                                              │
    //                                              ▼
    //                                      ┌────────────────┐     ┌───────────┐
    //                                      │ Mint LP Tokens │────►│ User's LP │
    //                                      └────────────────┘     │  Tokens   │
    //                                              │              └───────────┘
    //                                              ▼
    //                                       ┌──────────────┐
    //                                       │ Update Total │
    //                                       │  Liquidity   │
    //                                       └──────────────┘
    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        token_a_amount: u64,
        token_b_amount: u64,
    ) -> Result<()> {
        instructions::perform_liquidity_deposit(ctx, token_a_amount, token_b_amount)
    }

    /// Removes liquidity from a pool by burning LP tokens
    /// Returns both tokens to the user proportional to their share
    // ┌────────┐     ┌─────────────┐     ┌───────────────┐     ┌───────────────────┐
    // │  User  │────►│ Provide LP  │────►│  Verify User  │────►│  Verify Pool Has  │
    // └────────┘     │   Tokens    │     │ Has Enough LP │     │ Sufficient Tokens │
    //                └─────────────┘     └───────────────┘     └────────┬──────────┘
    //                                                                   │
    //                                                                   ▼
    //     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
    //     │ Calculate Share: │◄────┤ Burn LP Tokens  │◄────┤ Calculate User's Share: │
    //     │  TokenA Amount   │     │  (remove from   │     │  LP Amount / Total LP   │
    //     └────────┬─────────┘     │  circulation)   │     └────────────┬────────────┘
    //              │               └─────────────────┘                  │
    //              │                                                    ▼
    //              │                                          ┌──────────────────┐
    //              │                                          │ Calculate Share: │
    //              │                                          │  TokenB Amount   │
    //              │                                          └─────────┬────────┘
    //              │                                                    │
    //              │                                                    ▼
    //              ▼                                           ┌─────────────────┐
    //     ┌─────────────────┐                                  │ Transfer TokenB │
    //     │ Transfer TokenA │                                  │     to User     │
    //     │     to User     │                                  └────────┬────────┘
    //     └───────┬─────────┘                                           │
    //             │                                                     ▼
    //             ▼                                            ┌─────────────────┐
    //     ┌─────────────────┐                                  │ Decrease TokenB │
    //     │ Decrease TokenA │                                  │     Reserve     │
    //     │     Reserve     │                                  └────────┬────────┘
    //     └───────┬─────────┘                                           │
    //             │                                                     │
    //             └─────────────────────────┬───────────────────────────┘
    //                                       │
    //                                       ▼
    //                              ┌────────────────┐
    //                              │ Decrease Total │
    //                              │   Liquidity    │
    //                              └────────────────┘
    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, lp_amount: u64) -> Result<()> {
        instructions::perform_liquidity_withdrawal(ctx, lp_amount)
    }

    /// Swaps between the two tokens in a pool
    /// Uses constant product formula (x*y=k) to determine exchange rate
    // ┌────────┐     ┌────────────┐     ┌───────────────┐     ┌──────────────────┐
    // │  User  │────►│ User Token │────►│ Verify Pool   │────►│ Calculate Output │
    // └────────┘     │    A/B     │     │ Has Liquidity │     │ Amount (x*y=k)   │
    //                └────────────┘     └──────┬────────┘     └────────┬─────────┘
    //                                          │                       │
    //                                          ▼                       ▼
    // ┌────────────────┐              ┌─────────────────┐     ┌─────────────────┐
    // │ User Receives  │◄─────────────┤ Apply Fee to    │◄────┤ Check Slippage  │
    // │ Output Tokens  │              │  Input Amount   │     │ Tolerance       │
    // └────────────────┘              └─────────────────┘     └─────────────────┘
    //                                           │
    //                                           ▼
    //                                ┌──────────────────────┐
    //                                │ Transfer Input Token │
    //                                │ From User to Pool    │
    //                                └──────────┬───────────┘
    //                                           │
    //                                           ▼
    //                                ┌──────────────────────┐
    //                                │ Transfer Output Token│
    //                                │ From Pool to User    │
    //                                └──────────────────────┘
    pub fn swap(ctx: Context<Swap>, input_amount: u64, minimum_output_amount: u64) -> Result<()> {
        instructions::swap_tokens(ctx, input_amount, minimum_output_amount)
    }

    /// Collects accumulated protocol fees and sends them to the designated collector
    /// Only callable by admin
    // ┌─────────┐     ┌───────┐     ┌───────────────┐      ┌────────────────┐
    // │  Admin  │────►│ Start │────►│ Admin Signer? │──No─►│ Error:NotAdmin │
    // └─────────┘     └───────┘     └───────┬───────┘      └────────────────┘
    //                                       │
    //                                      Yes
    //                                       │
    //                                       ▼
    //                               ┌────────────────┐      ┌───────────────────────┐
    //                               │  Get Protocol  │──No─►│ Error:NoFeesToCollect │
    //                               │  Fee Amounts   │      └───────────────────────┘
    //                               └───────┬────────┘
    //                                       │
    //                                       ▼
    //                               ┌────────────────┐
    //                               │  Reset Pool's  │
    //                               │  Fee Counters  │
    //                               └───────┬────────┘
    //                                       │
    //                                       ▼
    //                          ┌───────────────────────────┐
    //                          │ Transfer Token A Protocol │
    //                          │    Fees to Collector      │
    //                          └────────────┬──────────────┘
    //                                       │
    //                                       │
    //                                       ▼
    //                          ┌───────────────────────────┐
    //                          │ Transfer Token B Protocol │
    //                          │    Fees to Collector      │
    //                          └───────────────────────────┘
    pub fn collect_fees(ctx: Context<CollectProtocolFees>) -> Result<()> {
        instructions::collect_protocol_fees(ctx)
    }
}

/// Defines custom error codes for the DEX program.
#[error_code]
pub enum DexError {
    // Triggered when a non-admin attempts an admin-only action (dex initialization).
    #[msg("DEX should be initialized by admin.")]
    NotAdmin,
    // Triggered when the fee numerator is greater than or equal to the fee denominator.
    #[msg("Invalid fees.")]
    InvalidFees,
    // Triggered when liquidity is insufficient for an operation
    #[msg("Insufficient liquidity.")]
    InsufficientLiquidity,
    // Triggered when slippage tolerance is exceeded during a swap
    #[msg("Slippage tolerance exceeded.")]
    SlippageExceeded,
    // Triggered when there are no fees to collect
    #[msg("No fees to collect.")]
    NoFeesToCollect,
}
