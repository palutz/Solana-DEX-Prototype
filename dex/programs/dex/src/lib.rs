#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod instructions;
pub use instructions::*;

declare_id!("76FoAxFGis6DJZYskaij151pWoiTTDvW2fPQEUP1fiLZ");

#[program]
pub mod dex {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::_initialize(ctx)
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
