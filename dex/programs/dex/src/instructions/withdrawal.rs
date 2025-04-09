use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, transfer_checked, Mint, TokenAccount, TokenInterface};

use super::{DexError, LiquidityPool};

/// Burns LP tokens from the user
pub(crate) fn burn_lp_tokens<'info>(
    token_program: &Interface<'info, TokenInterface>,
    lp_token_mint: &InterfaceAccount<'info, Mint>,
    user_lp_token: &InterfaceAccount<'info, TokenAccount>,
    owner: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    burn(
        CpiContext::new(
            token_program.to_account_info(),
            anchor_spl::token_interface::Burn {
                mint: lp_token_mint.to_account_info(),
                from: user_lp_token.to_account_info(),
                authority: owner.to_account_info(),
            },
        ),
        amount,
    )
}

/// Transfers tokens from pool to user
pub(crate) fn transfer_pool_tokens_to_user<'info>(
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    from_account: &InterfaceAccount<'info, TokenAccount>,
    to_account: &InterfaceAccount<'info, TokenAccount>,
    pool: &Account<'info, LiquidityPool>,
    amount: u64,
) -> Result<()> {
    // Create the PDA signer for the transfer operation
    let pool_seeds = &[
        b"liquidity_pool",
        pool.token_a_mint.as_ref(),
        pool.token_b_mint.as_ref(),
        &[pool.bump],
    ];
    let signer = &[&pool_seeds[..]];

    let cpi_accounts = anchor_spl::token_interface::TransferChecked {
        mint: mint.to_account_info(),
        from: from_account.to_account_info(),
        to: to_account.to_account_info(),
        authority: pool.to_account_info(),
    };

    let cpi_ctx =
        CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);

    transfer_checked(cpi_ctx, amount, mint.decimals)
}

/// Calculates token amounts to withdraw based on LP tokens amount
pub(crate) fn calculate_withdrawal_amounts(
    lp_amount: u64,
    reserve_a: u64,
    reserve_b: u64,
    total_liquidity: u64,
) -> Result<(u64, u64)> {
    // Proportion of the pool the user is withdrawing
    let proportion = (lp_amount as u128)
        .checked_mul(u128::pow(10, 18)) // Scale up for precision
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(total_liquidity as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Calculate token amounts based on proportion
    let token_a_amount = proportion
        .checked_mul(reserve_a as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(u128::pow(10, 18)) // Scale back down
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    let token_b_amount = proportion
        .checked_mul(reserve_b as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(u128::pow(10, 18)) // Scale back down
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    // Make sure we're withdrawing non-zero amounts
    require!(
        token_a_amount > 0 && token_b_amount > 0,
        DexError::InsufficientLiquidity
    );

    Ok((token_a_amount, token_b_amount))
}
