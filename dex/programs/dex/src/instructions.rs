use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::DexError;

pub fn _initialize(
    ctx: Context<Initialize>,
    fee_numerator: u64,
    fee_denominator: u64,
) -> Result<()> {
    // Check that fee values are valid (non-zero numerator and numerator < denominator)
    require!(
        fee_numerator != 0 && fee_numerator < fee_denominator,
        DexError::InvalidFees
    );

    // Initialize the dex state
    let dex_state = &mut ctx.accounts.dex_state;
    dex_state.admin = *ctx.accounts.admin.key;
    dex_state.pools_count = 0;
    dex_state.fee_numerator = fee_numerator;
    dex_state.fee_denominator = fee_denominator;

    Ok(())
}

pub fn _create_pool(ctx: Context<CreatePool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let dex_state = &mut ctx.accounts.dex_state;
    
    // Initialize pool data
    pool.token_a_mint = ctx.accounts.token_a_mint.key();
    pool.token_b_mint = ctx.accounts.token_b_mint.key();
    pool.token_a_account = ctx.accounts.pool_token_a.key();
    pool.token_b_account = ctx.accounts.pool_token_b.key();
    pool.lp_token_mint = ctx.accounts.lp_token_mint.key();
    
    // Save the PDA bump for future references
    pool.bump = ctx.bumps.pool;
    
    // Initialize liquidity
    pool.total_liquidity = 0;
    
    // Copy fee settings from DEX state
    pool.fee_numerator = dex_state.fee_numerator;
    pool.fee_denominator = dex_state.fee_denominator;
    
    // Increment the pools counter in DEX state
    dex_state.pools_count += 1;
    
    msg!("Pool created: {}", pool.key());
    msg!("Token A Mint: {}", pool.token_a_mint);
    msg!("Token B Mint: {}", pool.token_b_mint);
    msg!("LP Token Mint: {}", pool.lp_token_mint);
    msg!("Owner LP Token Account: {}", ctx.accounts.owner_lp_token.key());
    
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
    #[account(
        mut,
        // Check that the signer is the admin.
        constraint = admin.key() == crate::ADMIN_PUBKEY @ DexError::NotAdmin
    )]
    pub admin: Signer<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + DexState::LEN,
        seeds = [
            b"dex_state",
            admin.key().as_ref(),
        ],
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
    pub token_b_mint: InterfaceAccount<'info, Mint>,

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

    // Create an LP token account for the pool creator automatically
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub owner_lp_token: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct DexState {
    pub admin: Pubkey,
    /// Incremented each time a new trading pair is created
    pub pools_count: u64,
    /// Using two integers to represent a fraction allows for exact calculations using only integer
    /// math, which is more deterministic.
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

    // Need to add the actual mint accounts
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = token_a_mint.key() == pool.token_a_mint
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = token_b_mint.key() == pool.token_b_mint
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    // Now correctly reference the actual account mint fields
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_a_mint,
        associated_token::authority = owner,
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_b_mint,
        associated_token::authority = owner,
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    // Add the required programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    // Add mint accounts
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = token_a_mint.key() == pool.token_a_mint
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = token_b_mint.key() == pool.token_b_mint
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    // Correctly reference the actual account mint fields
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_a_mint,
        associated_token::authority = owner,
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_b_mint,
        associated_token::authority = owner,
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    // Add the required programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    
    // We need to specify which token we're swapping from and to
    // This can be either token_a_mint or token_b_mint
    pub source_mint: InterfaceAccount<'info, Mint>,
    pub destination_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = (source_mint.key() == pool.token_a_mint || 
                     destination_mint.key() == pool.token_a_mint)
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = (source_mint.key() == pool.token_b_mint || 
                     destination_mint.key() == pool.token_b_mint)
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // Use the actual mint references for the user accounts
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = source_mint,
        associated_token::authority = owner,
    )]
    pub user_source_token: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = destination_mint,
        associated_token::authority = owner,
    )]
    pub user_destination_token: InterfaceAccount<'info, TokenAccount>,

    // Add the required programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
