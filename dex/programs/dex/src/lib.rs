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
        instructions::_initialize(ctx, fee_numerator, fee_denominator)
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        instructions::_create_pool(ctx)
    }

    pub fn deposit_liquidity(ctx: Context<DepositLiquidity>) -> Result<()> {
        instructions::_deposit_liquidity(ctx)
    }

    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>) -> Result<()> {
        instructions::_withdraw_liquidity(ctx)
    }

    pub fn swap(ctx: Context<Swap>) -> Result<()> {
        instructions::_swap(ctx)
    }
}

/// Defines custom error codes for the DEX program.
/// Provides clear and descriptive error messages for various failure scenarios.
#[error_code]
pub enum DexError {
    // Triggered when a non-admin attempts an admin-only action.
    #[msg("DEX should be initialized by admin.")]
    NotAdmin,
    // Triggered when the fee numerator is greater than or equal to the fee denominator.
    #[msg("Invalid fees.")]
    InvalidFees,
}
