use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use super::{DexError, LiquidityPool};

/// Transfers tokens from user to pool
pub(crate) fn transfer_user_tokens_to_pool<'info>(
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    from_account: &InterfaceAccount<'info, TokenAccount>,
    to_account: &InterfaceAccount<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = anchor_spl::token_interface::TransferChecked {
        mint: mint.to_account_info(),
        from: from_account.to_account_info(),
        to: to_account.to_account_info(),
        authority: authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts);

    anchor_spl::token_interface::transfer_checked(
        cpi_ctx,
        amount,
        0
    )
}

/// Mints LP tokens to the user
pub(crate) fn mint_lp_tokens_to_user<'info>(
    token_program: &Interface<'info, TokenInterface>,
    lp_token_mint: &InterfaceAccount<'info, Mint>,
    user_lp_token: &InterfaceAccount<'info, TokenAccount>,
    pool: &Account<'info, LiquidityPool>,
    amount: u64,
) -> Result<()> {
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
        amount,
    )
}

/// Calculates initial liquidity tokens for the first deposit using geometric mean
pub(crate) fn calculate_initial_liquidity(token_a_amount: u64, token_b_amount: u64) -> Result<u64> {
    // Calculate product of token amounts
    let product = (token_a_amount as u128)
        .checked_mul(token_b_amount as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Calculate square root using binary search approach
    let sqrt_result = calculate_sqrt(product)?;

    // Make sure we're minting a non-zero amount
    require!(sqrt_result > 0, DexError::InsufficientLiquidity);

    Ok(sqrt_result as u64)
}

/// Calculates liquidity tokens for subsequent deposits proportionally
pub(crate) fn calculate_proportional_liquidity(
    token_a_amount: u64,
    token_b_amount: u64,
    reserve_a: u64,
    reserve_b: u64,
    total_liquidity: u64,
) -> Result<u64> {
    // Calculate LP tokens based on token A proportion
    let lp_tokens_by_a = (token_a_amount as u128)
        .checked_mul(total_liquidity as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(reserve_a as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    // Calculate LP tokens based on token B proportion
    let lp_tokens_by_b = (token_b_amount as u128)
        .checked_mul(total_liquidity as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(reserve_b as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    // Use the minimum to maintain the price ratio
    let lp_tokens = std::cmp::min(lp_tokens_by_a, lp_tokens_by_b);

    // Make sure we're minting a non-zero amount
    require!(lp_tokens > 0, DexError::InsufficientLiquidity);

    Ok(lp_tokens)
}
/// Calculate square root of a u128 value using binary search
fn calculate_sqrt(value: u128) -> Result<u64> {
    let mut result: u128 = 0;
    let mut a = 0;
    let mut b = value;

    while a <= b {
        let mid = a
            .checked_add(b)
            .ok_or(error!(DexError::InsufficientLiquidity))?
            / 2;

        let mid_squared = mid
            .checked_mul(mid)
            .ok_or(error!(DexError::InsufficientLiquidity))?;

        match mid_squared.cmp(&value) {
            std::cmp::Ordering::Equal => {
                result = mid;
                break;
            }
            std::cmp::Ordering::Less => {
                a = mid
                    .checked_add(1)
                    .ok_or(error!(DexError::InsufficientLiquidity))?;
                result = mid;
            }
            std::cmp::Ordering::Greater => {
                b = mid
                    .checked_sub(1)
                    .ok_or(error!(DexError::InsufficientLiquidity))?;
            }
        }
    }

    Ok(result as u64)
}
