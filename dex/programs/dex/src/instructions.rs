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

pub fn _deposit_liquidity(ctx: Context<DepositLiquidity>, token_a_amount: u64, token_b_amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let pool_token_a = &mut ctx.accounts.pool_token_a;
    let pool_token_b = &mut ctx.accounts.pool_token_b;
    let lp_token_mint = &mut ctx.accounts.lp_token_mint;
    let user_token_a = &ctx.accounts.user_token_a;
    let user_token_b = &ctx.accounts.user_token_b;
    let user_lp_token = &ctx.accounts.user_lp_token;
    let owner = &ctx.accounts.owner;
    let token_program = &ctx.accounts.token_program;

    // Get current pool reserves
    let reserve_a = pool_token_a.amount;
    let reserve_b = pool_token_b.amount;
    
    // Calculate LP tokens to mint
    let lp_tokens_to_mint: u64;
    
    // If this is the first deposit (pool is empty), use the geometric mean of the deposits
    if pool.total_liquidity == 0 {
        // Calculate initial liquidity as the geometric mean of token amounts
        // This helps prevent price manipulation on the first deposit
        // Since there's no checked_sqrt for u128, we'll implement a safe square root calculation
        let product = (token_a_amount as u128)
            .checked_mul(token_b_amount as u128)
            .unwrap();
            
        // Manual square root calculation (binary search approach)
        let mut result: u128 = 0;
        let mut a = 0;
        let mut b = product;
        
        while a <= b {
            let mid = a.checked_add(b).unwrap() / 2;
            let mid_squared = mid.checked_mul(mid).unwrap();
            
            match mid_squared.cmp(&product) {
                std::cmp::Ordering::Equal => {
                    result = mid;
                    break;
                },
                std::cmp::Ordering::Less => {
                    a = mid.checked_add(1).unwrap();
                    result = mid;
                },
                std::cmp::Ordering::Greater => {
                    b = mid.checked_sub(1).unwrap();
                }
            }
        }
        
        lp_tokens_to_mint = result as u64;
        
        // Make sure we're minting a non-zero amount
        require!(lp_tokens_to_mint > 0, DexError::InsufficientLiquidity);
    } else {
        // For subsequent deposits, LP tokens are minted proportionally to the existing reserves
        // Use the smaller of the two proportions to prevent price manipulation
        let lp_tokens_by_a = (token_a_amount as u128)
            .checked_mul(pool.total_liquidity as u128)
            .unwrap()
            .checked_div(reserve_a as u128)
            .unwrap() as u64;
            
        let lp_tokens_by_b = (token_b_amount as u128)
            .checked_mul(pool.total_liquidity as u128)
            .unwrap()
            .checked_div(reserve_b as u128)
            .unwrap() as u64;
            
        // Use the minimum to maintain the price ratio
        lp_tokens_to_mint = std::cmp::min(lp_tokens_by_a, lp_tokens_by_b);
        
        // Make sure we're minting a non-zero amount
        require!(lp_tokens_to_mint > 0, DexError::InsufficientLiquidity);
    }
    
    // Transfer tokens from user to pool
    anchor_spl::token_interface::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            anchor_spl::token_interface::Transfer {
                from: user_token_a.to_account_info(),
                to: pool_token_a.to_account_info(),
                authority: owner.to_account_info(),
            },
        ),
        token_a_amount,
    )?;
    
    anchor_spl::token_interface::transfer(
        CpiContext::new(
            token_program.to_account_info(),
            anchor_spl::token_interface::Transfer {
                from: user_token_b.to_account_info(),
                to: pool_token_b.to_account_info(),
                authority: owner.to_account_info(),
            },
        ),
        token_b_amount,
    )?;
    
    // Mint LP tokens to user
    // Create the PDA signer for the mint operation
    let pool_seeds = &[
        b"liquidity_pool",
        pool.token_a_mint.as_ref(),
        pool.token_b_mint.as_ref(),
        &[pool.bump],
    ];
    let signer = &[&pool_seeds[..]];
    
    anchor_spl::token_interface::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            anchor_spl::token_interface::MintTo {
                mint: lp_token_mint.to_account_info(),
                to: user_lp_token.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer,
        ),
        lp_tokens_to_mint,
    )?;
    
    // Update pool total liquidity
    pool.total_liquidity = pool.total_liquidity.checked_add(lp_tokens_to_mint).unwrap();
    
    msg!(
        "Deposited {} token A and {} token B for {} LP tokens",
        token_a_amount,
        token_b_amount,
        lp_tokens_to_mint
    );
    
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

// This struct defines all the accounts needed to create a new trading pool
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
    // - seeds: Generate a deterministic address from these values
    //   (ensures unique address for this token pair)
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
        // payer = owner,
        token::mint = token_a_mint,
        token::authority = pool,
    )]
    pub pool_token_a: InterfaceAccount<'info, TokenAccount>,

    // Create a token account to hold the pool's reserves of Token B
    // - The pool itself has control over this account
    #[account(
        // init_if_needed,
        // payer = owner,
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
