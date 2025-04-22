mod deposit;
mod swap;
mod withdrawal;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use deposit::*;
use swap::*;
use withdrawal::*;

use crate::DexError;

// NOTE: Functions
/*
 * Sets up the DEX global state with admin access and fee configuration
 * Only the designated admin can call this function
 */
pub fn initialize_dex(
    ctx: Context<Initialize>,
    fee_numerator: u64,
    fee_denominator: u64,
    protocol_fee_percentage: u8,
    fee_collector: Pubkey,
) -> Result<()> {
    // Check that fee values are valid (non-zero numerator and numerator < denominator)
    require!(
        fee_numerator != 0 && fee_numerator < fee_denominator,
        DexError::InvalidFees
    );

    // Check that protocol fee percentage is valid (0-100)
    require!(
        protocol_fee_percentage <= 100,
        DexError::InvalidFees
    );

    // Initialize the dex state
    let dex_state = &mut ctx.accounts.dex_state;
    dex_state.admin = *ctx.accounts.admin.key;
    dex_state.pools_count = 0;
    dex_state.fee_numerator = fee_numerator;
    dex_state.fee_denominator = fee_denominator;
    dex_state.protocol_fee_percentage = protocol_fee_percentage;
    dex_state.fee_collector = fee_collector;

    Ok(())
}

/*
 * Creates a new trading pair with custom LP tokens
 * Anyone can create a pool for any token pair
 */
pub fn create_liquidity_pool(ctx: Context<CreatePool>) -> Result<()> {
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
    pool.protocol_fee_percentage = dex_state.protocol_fee_percentage;
    
    // Initialize protocol fees
    pool.protocol_fees_token_a = 0;
    pool.protocol_fees_token_b = 0;

    // Increment the pools counter in DEX state
    dex_state.pools_count += 1;

    msg!("Pool created: {}", pool.key());
    msg!("Token A Mint: {}", pool.token_a_mint);
    msg!("Token B Mint: {}", pool.token_b_mint);
    msg!("LP Token Mint: {}", pool.lp_token_mint);
    msg!(
        "Owner LP Token Account: {}",
        ctx.accounts.owner_lp_token.key()
    );

    Ok(())
}

/*
 * Adds liquidity to a pool and mints LP tokens
 * The first deposit sets the initial price ratio
 */
pub fn perform_liquidity_deposit(
    ctx: Context<DepositLiquidity>,
    token_a_amount: u64,
    token_b_amount: u64,
) -> Result<()> {
    // Get references to all accounts
    let pool = &mut ctx.accounts.pool;
    let pool_token_a = &mut ctx.accounts.pool_token_a;
    let pool_token_b = &mut ctx.accounts.pool_token_b;
    let lp_token_mint = &mut ctx.accounts.lp_token_mint;
    let token_a_mint = &ctx.accounts.token_a_mint;
    let token_b_mint = &ctx.accounts.token_b_mint;
    let user_token_a = &ctx.accounts.user_token_a;
    let user_token_b = &ctx.accounts.user_token_b;
    let user_lp_token = &ctx.accounts.user_lp_token;
    let owner = &ctx.accounts.owner;
    let token_program = &ctx.accounts.token_program;

    // Get current pool reserves
    let reserve_a = pool_token_a.amount;
    let reserve_b = pool_token_b.amount;

    // Calculate LP tokens to mint based on current pool state
    let lp_tokens_to_mint = if pool.total_liquidity == 0 {
        // For first deposit, calculate using geometric mean
        calculate_initial_liquidity(token_a_amount, token_b_amount)?
    } else {
        // For subsequent deposits, calculate proportionally
        calculate_proportional_liquidity(
            token_a_amount,
            token_b_amount,
            reserve_a,
            reserve_b,
            pool.total_liquidity,
        )?
    };

    // Transfer both tokens from user to pool
    // Token A
    transfer_user_tokens_to_pool(
        token_a_mint,
        token_program,
        user_token_a,
        pool_token_a,
        owner,
        token_a_amount,
    )?;

    // Token B
    transfer_user_tokens_to_pool(
        token_b_mint,
        token_program,
        user_token_b,
        pool_token_b,
        owner,
        token_b_amount,
    )?;

    // Mint LP tokens to user
    mint_lp_tokens_to_user(
        token_program,
        lp_token_mint,
        user_lp_token,
        pool,
        lp_tokens_to_mint,
    )?;

    // Update pool total liquidity
    pool.total_liquidity = pool
        .total_liquidity
        .checked_add(lp_tokens_to_mint)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    msg!(
        "Deposited {} token A and {} token B for {} LP tokens",
        token_a_amount,
        token_b_amount,
        lp_tokens_to_mint
    );

    Ok(())
}

/*
 * Removes liquidity from a pool by burning LP tokens
 * Returns tokens proportional to the share of the pool being withdrawn
 */
pub fn perform_liquidity_withdrawal(ctx: Context<WithdrawLiquidity>, lp_amount: u64) -> Result<()> {
    // Get references to all accounts
    let pool = &mut ctx.accounts.pool;
    let pool_token_a = &mut ctx.accounts.pool_token_a;
    let pool_token_b = &mut ctx.accounts.pool_token_b;
    let lp_token_mint = &mut ctx.accounts.lp_token_mint;
    let token_a_mint = &ctx.accounts.token_a_mint;
    let token_b_mint = &ctx.accounts.token_b_mint;
    let user_token_a = &ctx.accounts.user_token_a;
    let user_token_b = &ctx.accounts.user_token_b;
    let user_lp_token = &ctx.accounts.user_lp_token;
    let owner = &ctx.accounts.owner;
    let token_program = &ctx.accounts.token_program;

    // Get current pool reserves
    let reserve_a = pool_token_a.amount;
    let reserve_b = pool_token_b.amount;

    // Ensure user has enough LP tokens
    require!(
        user_lp_token.amount >= lp_amount,
        DexError::InsufficientLiquidity
    );

    // Ensure pool has enough total liquidity
    require!(
        pool.total_liquidity >= lp_amount,
        DexError::InsufficientLiquidity
    );

    // Calculate token amounts to withdraw based on user's share
    let (token_a_amount, token_b_amount) =
        calculate_withdrawal_amounts(lp_amount, reserve_a, reserve_b, pool.total_liquidity)?;

    // Burn user's LP tokens
    burn_lp_tokens(
        token_program,
        lp_token_mint,
        user_lp_token,
        owner,
        lp_amount,
    )?;

    // Transfer tokens from pool to user
    // Token A
    transfer_pool_tokens_to_user(
        token_a_mint,
        token_program,
        pool_token_a,
        user_token_a,
        pool,
        token_a_amount,
    )?;

    // Token B
    transfer_pool_tokens_to_user(
        token_b_mint,
        token_program,
        pool_token_b,
        user_token_b,
        pool,
        token_b_amount,
    )?;

    // Update pool total liquidity
    pool.total_liquidity = pool
        .total_liquidity
        .checked_sub(lp_amount)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    msg!(
        "Withdrawn {} token A and {} token B by burning {} LP tokens",
        token_a_amount,
        token_b_amount,
        lp_amount
    );

    Ok(())
}

/*
 * Swaps one token for another using the constant product formula
 */
pub fn swap_tokens(
    ctx: Context<Swap>,
    input_amount: u64,
    minimum_output_amount: u64,
) -> Result<()> {
    // Get references to all accounts
    let pool = &mut ctx.accounts.pool;
    let source_mint = &ctx.accounts.source_mint;
    let destination_mint = &ctx.accounts.destination_mint;
    let user_source_token = &ctx.accounts.user_source_token;
    let user_destination_token = &ctx.accounts.user_destination_token;
    let owner = &ctx.accounts.owner;
    let token_program = &ctx.accounts.token_program;

    // Determine which token is being swapped in/out
    let is_source_token_a = is_token_a(pool, &source_mint.key());

    // Get pool token accounts based on source/destination
    let (pool_source_token, pool_destination_token) = if is_source_token_a {
        (&ctx.accounts.pool_token_a, &ctx.accounts.pool_token_b)
    } else {
        (&ctx.accounts.pool_token_b, &ctx.accounts.pool_token_a)
    };

    // Get current reserves
    let source_reserve = pool_source_token.amount;
    let destination_reserve = pool_destination_token.amount;

    // Calculate fee breakdown (total fee and protocol portion)
    let (total_fee, protocol_fee) = calculate_fee_breakdown(
        input_amount,
        pool.fee_numerator,
        pool.fee_denominator,
        pool.protocol_fee_percentage,
    )?;

    // Update accumulated protocol fees
    if is_source_token_a {
        pool.protocol_fees_token_a = pool.protocol_fees_token_a
            .checked_add(protocol_fee)
            .ok_or(error!(DexError::InsufficientLiquidity))?;
    } else {
        pool.protocol_fees_token_b = pool.protocol_fees_token_b
            .checked_add(protocol_fee)
            .ok_or(error!(DexError::InsufficientLiquidity))?;
    }

    // Calculate input amount after fee
    let input_amount_with_fee = input_amount
        .checked_sub(total_fee)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Calculate output amount using constant product formula
    // Use existing function but pass 0/1 for fee params to avoid double-charging fees
    let output_amount = calculate_output_amount(
        input_amount_with_fee,
        source_reserve,
        destination_reserve,
        0, // No additional fee should be charged
        1,
    )?;

    // Check slippage tolerance
    require!(
        output_amount >= minimum_output_amount,
        DexError::SlippageExceeded
    );

    // Perform the swap:
    // 1. Transfer source tokens from user to pool
    transfer_source_tokens_to_pool(
        source_mint,
        token_program,
        user_source_token,
        pool_source_token,
        owner,
        input_amount,
    )?;

    // 2. Transfer destination tokens from pool to user
    transfer_destination_tokens_to_user(
        destination_mint,
        token_program,
        pool_destination_token,
        user_destination_token,
        pool,
        output_amount,
    )?;

    // Log swap details
    msg!(
        "Swapped {} tokens for {} tokens (protocol fee: {})",
        input_amount,
        output_amount,
        protocol_fee
    );

    Ok(())
}

/// Collects protocol fees from a pool and sends them to the fee collector account
pub fn collect_protocol_fees(ctx: Context<CollectProtocolFees>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let token_a_mint = &ctx.accounts.token_a_mint;
    let token_b_mint = &ctx.accounts.token_b_mint;
    let pool_token_a = &ctx.accounts.pool_token_a;
    let pool_token_b = &ctx.accounts.pool_token_b;
    let fee_collector_token_a = &ctx.accounts.fee_collector_token_a;
    let fee_collector_token_b = &ctx.accounts.fee_collector_token_b;
    let token_program = &ctx.accounts.token_program;
    
    // Get accumulated protocol fees
    let token_a_fee_amount = pool.protocol_fees_token_a;
    let token_b_fee_amount = pool.protocol_fees_token_b;
    
    // Reset protocol fee accumulators (do this before transfers to prevent reentrancy issues)
    pool.protocol_fees_token_a = 0;
    pool.protocol_fees_token_b = 0;
    
    // Transfer token A fees if any
    if token_a_fee_amount > 0 {
        transfer_fee_tokens_to_collector(
            token_a_mint,
            token_program,
            pool_token_a,
            fee_collector_token_a,
            pool,
            token_a_fee_amount,
        )?;
    }
    
    // Transfer token B fees if any
    if token_b_fee_amount > 0 {
        transfer_fee_tokens_to_collector(
            token_b_mint,
            token_program,
            pool_token_b,
            fee_collector_token_b,
            pool,
            token_b_fee_amount,
        )?;
    }
    
    // Log collected fees
    msg!(
        "Collected protocol fees: {} token A, {} token B",
        token_a_fee_amount,
        token_b_fee_amount
    );
    
    Ok(())
}

// NOTE: Types
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

/// This struct defines all the accounts needed to create a new trading pool
#[derive(Accounts)]
pub struct CreatePool<'info> {
    // The person creating the pool - needs to be mutable because they'll pay for account creation
    #[account(mut)]
    pub owner: Signer<'info>,

    // The main DEX configuration - mutable because we'll update the pools counter
    #[account(mut)]
    pub dex_state: Account<'info, DexState>,

    // The two token definitions for this trading pair
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    // The pool account that stores all information about this trading pair
    // - init: Create a new account
    // - payer = owner: The creator pays for account creation
    // - space: Allocate enough storage for the account data
    // - seeds: Generate a deterministic address from these values (ensures unique address for this
    //   token pair)
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

    // Create a token account to hold the pool's reserves of Token A
    // - The pool itself has control over this account
    #[account(
        mut,
        token::mint = token_a_mint,
        token::authority = pool,
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Create a token account to hold the pool's reserves of Token B
    // - The pool itself has control over this account
    #[account(
        mut,
        token::mint = token_b_mint,
        token::authority = pool,
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // Create a new token type that represents shares in this pool
    // - 6 decimal places for precision
    // - The pool has authority to mint these tokens
    #[account(
        init,
        payer = owner,
        mint::decimals = 6,
        mint::authority = pool,
    )]
    pub lp_token_mint: InterfaceAccount<'info, Mint>,

    // Create a token account for the pool creator to receive LP tokens
    // - Only created if it doesn't exist already
    // - The owner has control over this account
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub owner_lp_token: InterfaceAccount<'info, TokenAccount>,

    // Required Solana programs for handling tokens and accounts
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
    /// Protocol fee as a percentage of the total fee
    /// protocol_fee_percentage is a number between 0 and 100
    /// If set to 30, it means 30% of fees go to protocol, 70% to LPs
    pub protocol_fee_percentage: u8,
    /// Account that collects protocol fees
    pub fee_collector: Pubkey,
}

impl DexState {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 1 + 32; // admin + pools_count + fee_numerator + fee_denominator + protocol_fee_percentage + fee_collector
}

#[account]
pub struct LiquidityPool {
    // Token A mint address
    pub token_a_mint: Pubkey,
    // Token B mint address
    pub token_b_mint: Pubkey,
    // Pool's token A account holding reserves
    pub token_a_account: Pubkey,
    // Pool's token B account holding reserves
    pub token_b_account: Pubkey,
    // LP token mint issued to liquidity providers
    pub lp_token_mint: Pubkey,
    // Bump seed for PDA derivation
    pub bump: u8,
    // Total LP tokens minted for this pool
    pub total_liquidity: u64,
    // Fee numerator (e.g. 10 for a 1% fee)
    pub fee_numerator: u64,
    // Fee denominator (e.g. 1000 for a 1% fee)
    pub fee_denominator: u64,
    // Protocol fee percentage (0-100)
    pub protocol_fee_percentage: u8,
    // Accumulated fees for token A (for protocol)
    pub protocol_fees_token_a: u64,
    // Accumulated fees for token B (for protocol)
    pub protocol_fees_token_b: u64,
}

impl LiquidityPool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 8; // token_a_mint + token_b_mint + token_a_account + token_b_account + lp_token_mint + bump +
                                                                               // total_liquidity + fees + protocol_fee_percentage + protocol_fees
}

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    // Liquidity provider
    #[account(mut)]
    pub owner: Signer<'info>,

    // Target pool for deposit
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    // Token mint definitions
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    // Pool's token A reserve account
    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = token_a_mint.key() == pool.token_a_mint
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Pool's token B reserve account
    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = token_b_mint.key() == pool.token_b_mint
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // LP token mint to issue shares
    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    // User's token A source account
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_a_mint,
        associated_token::authority = owner,
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    // User's token B source account
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_b_mint,
        associated_token::authority = owner,
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    // User's account to receive LP tokens
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    // Required programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    // LP owner removing liquidity
    #[account(mut)]
    pub owner: Signer<'info>,

    // Pool to withdraw from
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    // Token mint addresses
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    // Pool's token A reserve account
    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = token_a_mint.key() == pool.token_a_mint
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Pool's token B reserve account
    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = token_b_mint.key() == pool.token_b_mint
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // LP token mint to burn from
    #[account(
        mut,
        constraint = lp_token_mint.key() == pool.lp_token_mint
    )]
    pub lp_token_mint: Box<InterfaceAccount<'info, Mint>>,

    // User's token A account to receive funds
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_a_mint,
        associated_token::authority = owner,
    )]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,

    // User's token B account to receive funds
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_b_mint,
        associated_token::authority = owner,
    )]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,

    // User's LP tokens to burn
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = lp_token_mint,
        associated_token::authority = owner,
    )]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,

    // Required programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    // User swapping tokens and paying for tx fees
    #[account(mut)]
    pub owner: Signer<'info>,

    // Pool that contains the trading pair
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    // Token the user is swapping from
    pub source_mint: InterfaceAccount<'info, Mint>,

    // Token the user is swapping to
    pub destination_mint: InterfaceAccount<'info, Mint>,

    // Pool's token A account
    // Verifies account matches pool record and is part of the swap
    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = (source_mint.key() == pool.token_a_mint || 
                     destination_mint.key() == pool.token_a_mint)
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Pool's token B account
    // Verifies account matches pool record and is part of the swap
    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = (source_mint.key() == pool.token_b_mint || 
                     destination_mint.key() == pool.token_b_mint)
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // User's source token account (where tokens come from)
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = source_mint,
        associated_token::authority = owner,
    )]
    pub user_source_token: InterfaceAccount<'info, TokenAccount>,

    // User's destination token account (where tokens go)
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = destination_mint,
        associated_token::authority = owner,
    )]
    pub user_destination_token: InterfaceAccount<'info, TokenAccount>,

    // Required program references
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Defines the accounts required for collecting protocol fees
#[derive(Accounts)]
pub struct CollectProtocolFees<'info> {
    // Only the admin can collect fees
    #[account(
        mut,
        constraint = admin.key() == dex_state.admin @ DexError::NotAdmin
    )]
    pub admin: Signer<'info>,

    // DEX state to verify admin and fee collector
    #[account(mut)]
    pub dex_state: Account<'info, DexState>,

    // The pool to collect fees from
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,

    // Token A mint info
    pub token_a_mint: InterfaceAccount<'info, Mint>,

    // Token B mint info
    pub token_b_mint: InterfaceAccount<'info, Mint>,

    // Pool's token A account holding reserves
    #[account(
        mut,
        constraint = pool_token_a.key() == pool.token_a_account,
        constraint = token_a_mint.key() == pool.token_a_mint
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Pool's token B account holding reserves
    #[account(
        mut,
        constraint = pool_token_b.key() == pool.token_b_account,
        constraint = token_b_mint.key() == pool.token_b_mint
    )]
    pub pool_token_b: InterfaceAccount<'info, TokenAccount>,

    // Fee collector's token A account
    #[account(
        mut,
        constraint = fee_collector_token_a.owner == dex_state.fee_collector,
        constraint = fee_collector_token_a.mint == pool.token_a_mint
    )]
    pub fee_collector_token_a: InterfaceAccount<'info, TokenAccount>,

    // Fee collector's token B account
    #[account(
        mut, 
        constraint = fee_collector_token_b.owner == dex_state.fee_collector,
        constraint = fee_collector_token_b.mint == pool.token_b_mint
    )]
    pub fee_collector_token_b: InterfaceAccount<'info, TokenAccount>,

    // Required for token operations
    pub token_program: Interface<'info, TokenInterface>,
}
