use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

pub fn _initialize(ctx: Context<Initialize>) -> Result<()> {
    todo!();
    Ok(())
}

pub fn _create_pool(ctx: Context<CreatePool>) -> Result<()> {
    todo!();
    Ok(())
}

pub fn _deposit_liquidity(ctx: Context<DepositLiquidity>) -> Result<()> {
    todo!();
    Ok(())
}

pub fn _withdraw_liquidity(ctx: Context<WithdrawLiquidity>) -> Result<()> {
    todo!();
    Ok(())
}

pub fn _swap(ctx: Context<Swap>) -> Result<()> {
    todo!();
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + DexState::LEN,
        seeds = [b"dex_state"],
        bump
    )]
    pub dex_state: Account<'info, DexState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub dex_state: Account<'info, DexState>,

    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>, // Added this missing field

    #[account(
        init,
        payer = owner,
        space = 8 + LiquidityPool::LEN,
        seeds = [
            b"liquidity_pool",
            token_a_mint.key().as_ref(),
            token_b_mint.key().as_ref(),
        ],
        bump
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        init,
        payer = owner,
        token::mint = token_a_mint,
        token::authority = pool,
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        token::mint = token_b_mint,
        token::authority = pool,
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = owner,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_token_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct DexState {
    pub admin: Pubkey,
    pub pools_count: u64,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
}

impl DexState {
    pub const LEN: usize = 32 + 8 + 8 + 8; // admin + pools_count + fee_numerator + fee_denominator
}

#[account]
pub struct LiquidityPool {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
    pub lp_token_mint: Pubkey,
    pub bump: u8,
    pub total_liquidity: u64,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
}

impl LiquidityPool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 1 + 8 + 8 + 8; // token_a_mint + token_b_mint + token_a_account + token_b_account + lp_token_mint + bump +
                                                                   // total_liquidity + fees
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token_a.owner == owner.key()
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_b.owner == owner.key()
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_lp_token.owner == owner.key()
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        constraint = user_token_a.owner == owner.key()
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_token_b.owner == owner.key()
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_lp_token.owner == owner.key()
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_source_token.owner == user.key()
    )]
    pub user_source_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_destination_token.owner == user.key()
    )]
    pub user_destination_token: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}
