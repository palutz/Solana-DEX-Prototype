#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod instructions;
pub use instructions::*;

declare_id!("Ge4hd4p2D7Y5D9hZCabgXCGk6zpgPbHNC7fv2gsWAZrX");

/// This key is used to authenticate administrative actions within the governance contract.
pub const ADMIN_PUBKEY: Pubkey = pubkey!("E88MCgENj4uksz3QX9DUYRKqM8sJfqHGxCueWDnTPDep");

#[program]
pub mod dex {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fee_numerator: u64,
        fee_denominator: u64,
    ) -> Result<()> {
        instructions::initialize_dex(ctx, fee_numerator, fee_denominator)
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        instructions::create_liquidity_pool(ctx)
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        token_a_amount: u64,
        token_b_amount: u64,
    ) -> Result<()> {
        instructions::perform_liquidity_deposit(ctx, token_a_amount, token_b_amount)
    }

    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>) -> Result<()> {
        instructions::perform_liquidity_widthdrawal(ctx)
    }

    pub fn swap(ctx: Context<Swap>) -> Result<()> {
        instructions::swap_tokens(ctx)
    }
}

/// Defines custom error codes for the DEX program.
#[error_code]
pub enum DexError {
    // Triggered when a non-admin attempts an admin-only action.
    #[msg("DEX should be initialized by admin.")]
    NotAdmin,
    // Triggered when the fee numerator is greater than or equal to the fee denominator.
    #[msg("Invalid fees.")]
    InvalidFees,
    // Triggered when an amount is zero or otherwise invalid
    // #[msg("Invalid amount.")]
    // InvalidAmount,
    // Triggered when liquidity is insufficient for an operation
    #[msg("Insufficient liquidity.")]
    InsufficientLiquidity,
}
