use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use super::{DexError, LiquidityPool};

/// Calculates the output amount for a swap based on constant product formula (x*y=k)
/// Takes into account the fee charged by the pool
pub(crate) fn calculate_output_amount(
    input_amount: u64,
    input_reserve: u64,
    output_reserve: u64,
    fee_numerator: u64,
    fee_denominator: u64,
) -> Result<u64> {
    // Ensure there are enough reserves
    require!(
        input_reserve > 0 && output_reserve > 0,
        DexError::InsufficientLiquidity
    );

    // Calculate the input amount after fee
    // fee_amount = input_amount * fee_numerator / fee_denominator
    // input_amount_with_fee = input_amount - fee_amount
    let fee_amount = (input_amount as u128)
        .checked_mul(fee_numerator as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(fee_denominator as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    let input_amount_with_fee = input_amount
        .checked_sub(fee_amount)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Use the constant product formula: (x + dx) * (y - dy) = x * y
    // Solved for dy: dy = y * dx / (x + dx)
    // Where:
    // x = input_reserve
    // dx = input_amount_with_fee
    // y = output_reserve
    // dy = output_amount

    // Calculate numerator (y * dx)
    let numerator = (output_reserve as u128)
        .checked_mul(input_amount_with_fee as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Calculate denominator (x + dx)
    let denominator = (input_reserve as u128)
        .checked_add(input_amount_with_fee as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?;

    // Calculate output amount (dy)
    let output_amount = numerator
        .checked_div(denominator)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;

    // Ensure output amount is not zero
    require!(output_amount > 0, DexError::InsufficientLiquidity);

    // Ensure output doesn't exceed available reserves
    require!(
        output_amount <= output_reserve,
        DexError::InsufficientLiquidity
    );

    Ok(output_amount)
}

/// Transfers tokens from user to pool
pub(crate) fn transfer_source_tokens_to_pool<'info>(
    source_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    user_source_token: &InterfaceAccount<'info, TokenAccount>,
    pool_source_token: &InterfaceAccount<'info, TokenAccount>,
    owner: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    let cpi_accounts = anchor_spl::token_interface::TransferChecked {
        mint: source_mint.to_account_info(),
        from: user_source_token.to_account_info(),
        to: pool_source_token.to_account_info(),
        authority: owner.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts);

    anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, source_mint.decimals)
}

/// Transfers tokens from pool to user
pub(crate) fn transfer_destination_tokens_to_user<'info>(
    destination_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    pool_destination_token: &InterfaceAccount<'info, TokenAccount>,
    user_destination_token: &InterfaceAccount<'info, TokenAccount>,
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
        mint: destination_mint.to_account_info(),
        from: pool_destination_token.to_account_info(),
        to: user_destination_token.to_account_info(),
        authority: pool.to_account_info(),
    };

    let cpi_ctx =
        CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);

    anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, destination_mint.decimals)
}

/// Calculates the fee breakdown for a swap
/// Returns (total_fee_amount, protocol_fee_amount)
pub(crate) fn calculate_fee_breakdown(
    input_amount: u64,
    fee_numerator: u64,
    fee_denominator: u64,
    protocol_fee_percentage: u8,
) -> Result<(u64, u64)> {
    // Calculate total fee amount
    let total_fee_amount = (input_amount as u128)
        .checked_mul(fee_numerator as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(fee_denominator as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;
    
    // Calculate protocol fee portion
    let protocol_fee_amount = (total_fee_amount as u128)
        .checked_mul(protocol_fee_percentage as u128)
        .ok_or(error!(DexError::InsufficientLiquidity))?
        .checked_div(100u128)
        .ok_or(error!(DexError::InsufficientLiquidity))? as u64;
    
    Ok((total_fee_amount, protocol_fee_amount))
}

/// Transfers tokens from pool to fee collector
pub(crate) fn transfer_fee_tokens_to_collector<'info>(
    mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
    pool_token: &InterfaceAccount<'info, TokenAccount>,
    fee_collector_token: &InterfaceAccount<'info, TokenAccount>,
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
        from: pool_token.to_account_info(),
        to: fee_collector_token.to_account_info(),
        authority: pool.to_account_info(),
    };

    let cpi_ctx =
        CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);

    anchor_spl::token_interface::transfer_checked(cpi_ctx, amount, mint.decimals)
}

/// Checks if a token mint is Token A or Token B in the pool
pub(crate) fn is_token_a(pool: &Account<LiquidityPool>, mint: &Pubkey) -> bool {
    pool.token_a_mint == *mint
}
