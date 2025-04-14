import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Dex } from "../target/types/dex";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getMint,
  createMintToInstruction,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  RpcResponseAndContext,
  SignatureResult,
  Transaction,
} from "@solana/web3.js";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

// -------------------- Constants --------------------

// Initialize the Anchor provider using environment variables.
// This provider will be used to interact with the Solana cluster.
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

// Reference to the deployed Dex program.
const program = anchor.workspace.Dex as Program<Dex>;

// Default amount of SOL to airdrop to test accounts to cover transaction fees.
const DEFAULT_AIRDROP_SOL = 2;

// -------------------- Test Suite --------------------

describe("DEX tests", () => {
  let adminWallet: anchor.Wallet; // Admin's wallet, used to sign transactions.
  let admin: Keypair; // Keypair corresponding to the admin's wallet.
  let dexStatePda: PublicKey; // PDA for managing dex state.
  let unauthorizedAttacker: Keypair; // Keypair representing an unauthorized user attempting actions.

  // Token-related variables
  let tokenAMintKeypair: Keypair;
  let tokenBMintKeypair: Keypair;
  let tokenAMint: PublicKey;
  let tokenBMint: PublicKey;
  let poolOwner: Keypair;

  // -------------------- Hooks --------------------

  // Runs before all tests in this block.
  before(async () => {
    adminWallet = provider.wallet as anchor.Wallet;
    admin = adminWallet.payer;
    unauthorizedAttacker = Keypair.generate();
    poolOwner = Keypair.generate();

    // Derive the DexState PDA using the "dex_state" seed and admin's public key.
    dexStatePda = PublicKey.findProgramAddressSync(
      [Buffer.from("dex_state"), adminWallet.publicKey.toBuffer()],
      program.programId
    )[0];

    // airdrop sol to the admin, unauthorized attacker, and pool owner wallets. 
    await airdropIfNeeded(provider.connection, unauthorizedAttacker.publicKey, DEFAULT_AIRDROP_SOL);
    await airdropIfNeeded(provider.connection, poolOwner.publicKey, DEFAULT_AIRDROP_SOL);
  });

  // -------------------- Test Cases --------------------

  // NOTE: Test case 1
  it("Dex initialization with incorrect Admin Key is failing", async () => {
    console.log("\n");
    // Derive a Dex state PDA using an unauthorized attacker's public key.
    const unauthorizedDexStatePda = PublicKey.findProgramAddressSync(
      [Buffer.from("dex_state"), unauthorizedAttacker.publicKey.toBuffer()],
      program.programId
    )[0];

    const initializeAccounts = {
      admin: unauthorizedAttacker.publicKey,
      dexState: unauthorizedDexStatePda, // PDA for the Dex state acconnt.
      systemProgram: anchor.web3.SystemProgram.programId, // System program ID.
    };

    try {
      // Attempt to initialize Dex state with unauthorized admin credentials.
      await program.methods
        .initialize(new anchor.BN(10), new anchor.BN(1000))
        .accounts(initializeAccounts)
        .signers([unauthorizedAttacker])
        .rpc();

      // If the above transaction succeeds, the test should fail.
      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (err: any) {
      // Assert that the error code corresponds to unauthorized admin action.
      // Check for `NotAdmin` error code.
      expect(err.error.errorCode.code).to.equal("NotAdmin");
    }
  });

  // NOTE: Test case 2
  it("Dex initialization with correct Admin Key", async () => {
    // Initialize the DexState account.
    // Define the accounts required to initialize the DexState.
    const initializeAccounts = {
      admin: adminWallet.publicKey,
      dexState: dexStatePda, // PDA for the Dex state acconnt.
      systemProgram: anchor.web3.SystemProgram.programId, // System program ID.
    };

    // Initialize DEX with fee_numerator and fee_denominator.
    await program.methods
      .initialize(new anchor.BN(10), new anchor.BN(1000))
      .accounts(initializeAccounts)
      .rpc();

    try {
      // Fetch and assert the initial state of the DexState to ensure correct initialization.
      const dexStateAccount = await program.account.dexState.fetch(dexStatePda);
      expect(dexStateAccount.poolsCount.toNumber()).to.equal(0);
      expect(dexStateAccount.admin.toBase58()).to.equal(adminWallet.publicKey.toBase58()); // Admin should be correctly set.
      expect(dexStateAccount.feeNumerator.toNumber()).to.equal(10); // Fee numerator should be correctly set.
      expect(dexStateAccount.feeDenominator.toNumber()).to.equal(1000); // Fee denominator should be correctly set.

      console.log("DexState account was initialized successfully.");
    } catch (error) {
      console.error("Error in initializing DexState:", error);
      throw error; // Propagate the error to fail the tests if setup fails.
    }
  });

  // NOTE: Test case 3
  it("Creating a liquidity pool", async () => {
    try {
      // First create two token mints that will be used for the pool
      console.log("Creating token mints for the pool...");

      // Create Token A mint
      tokenAMintKeypair = Keypair.generate();
      tokenAMint = tokenAMintKeypair.publicKey;

      // Create Token B mint
      tokenBMintKeypair = Keypair.generate();
      tokenBMint = tokenBMintKeypair.publicKey;

      // Create Token A and B mints with 6 decimals
      await createMint(
        provider.connection,
        poolOwner,
        poolOwner.publicKey,
        null,
        6,
        tokenAMintKeypair,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      await createMint(
        provider.connection,
        poolOwner,
        poolOwner.publicKey,
        null,
        6,
        tokenBMintKeypair,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      console.log(`Created Token A mint: ${tokenAMint.toBase58()}`);
      console.log(`Created Token B mint: ${tokenBMint.toBase58()}`);

      // Find the pool PDA address. This is important to understand that pool PDA is derived from 2 token mints.
      const [poolPda, poolBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("liquidity_pool"),
          tokenAMint.toBuffer(),
          tokenBMint.toBuffer(),
        ],
        program.programId
      );

      // Determine LP token mint (which will be created during pool creation)
      const lpTokenMint = Keypair.generate();
      console.log(`LP token mint: ${lpTokenMint.publicKey.toBase58()}`);

      // Calculate the associated token accounts for the pool
      const poolTokenA = getAssociatedTokenAddressSync(
        tokenAMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const poolTokenB = getAssociatedTokenAddressSync(
        tokenBMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Calculate the LP token account for the pool creator
      const ownerLpToken = getAssociatedTokenAddressSync(
        lpTokenMint.publicKey,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      console.log("Creating pool token accounts...");

      // Create instructions to initialize the token accounts
      const createPoolTokenAIx = createAssociatedTokenAccountInstruction(
        poolOwner.publicKey,  // payer
        poolTokenA,           // associatedToken
        poolPda,              // owner
        tokenAMint,           // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const createPoolTokenBIx = createAssociatedTokenAccountInstruction(
        poolOwner.publicKey,  // payer
        poolTokenB,           // associatedToken
        poolPda,              // owner
        tokenBMint,           // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Create and send a transaction to initialize the token accounts
      const setupTx = new Transaction().add(
        createPoolTokenAIx,
        createPoolTokenBIx
      );

      // Send the setup transaction
      const setupTxId = await provider.sendAndConfirm(setupTx, [poolOwner]);
      console.log(`Pool token accounts created. Transaction ID: ${setupTxId}`);

      // Wait a moment to ensure accounts are created
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Now create the pool
      console.log("Setting up create pool transaction...");

      // Define the accounts for the create pool instruction
      const createPoolAccounts = {
        owner: poolOwner.publicKey,
        dexState: dexStatePda,
        tokenAMint: tokenAMint,
        tokenBMint: tokenBMint,
        pool: poolPda,
        poolTokenA: poolTokenA,
        poolTokenB: poolTokenB,
        lpTokenMint: lpTokenMint.publicKey,
        ownerLpToken: ownerLpToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Create the instruction
      const createPoolIx = await program.methods
        .createPool()
        .accounts(createPoolAccounts)
        .signers([poolOwner, lpTokenMint])
        .rpc();

      console.log(`Pool created successfully! Transaction ID: ${createPoolIx}`);

      const poolAccount = await program.account.liquidityPool.fetch(poolPda);

      // Verify pool data
      expect(poolAccount.tokenAMint.toBase58()).to.equal(tokenAMint.toBase58());
      expect(poolAccount.tokenBMint.toBase58()).to.equal(tokenBMint.toBase58());
      expect(poolAccount.tokenAAccount.toBase58()).to.equal(poolTokenA.toBase58());
      expect(poolAccount.tokenBAccount.toBase58()).to.equal(poolTokenB.toBase58());
      expect(poolAccount.lpTokenMint.toBase58()).to.equal(lpTokenMint.publicKey.toBase58());
      expect(poolAccount.bump).to.equal(poolBump);
      expect(poolAccount.totalLiquidity.toNumber()).to.equal(0);

      // Verify fees were copied from DEX state
      const dexStateAccount = await program.account.dexState.fetch(dexStatePda);
      expect(poolAccount.feeNumerator.toNumber()).to.equal(dexStateAccount.feeNumerator.toNumber());
      expect(poolAccount.feeDenominator.toNumber()).to.equal(dexStateAccount.feeDenominator.toNumber());

      // Verify pools count was incremented in DEX state
      expect(dexStateAccount.poolsCount.toNumber()).to.equal(1);

      // Verify LP token mint was created with correct decimals
      const lpMintInfo = await getMint(
        provider.connection,
        lpTokenMint.publicKey,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      expect(lpMintInfo.decimals).to.equal(6);

      console.log("Pool creation test passed with all validations");
    } catch (error) {
      console.error("Error creating pool:", error);
      throw error;
    }
  });

  // NOTE: Test case 4
  it("Depositing and withdrawing liquidity", async () => {
    try {
      // First, create token accounts for the pool owner
      console.log("Creating token accounts for the pool owner...");

      // Calculate the token accounts
      const ownerTokenA = getAssociatedTokenAddressSync(
        tokenAMint,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const ownerTokenB = getAssociatedTokenAddressSync(
        tokenBMint,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Calculate LP token account
      const [poolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("liquidity_pool"),
          tokenAMint.toBuffer(),
          tokenBMint.toBuffer(),
        ],
        program.programId
      );

      // Fetch the pool to get the LP token mint
      const poolAccount = await program.account.liquidityPool.fetch(poolPda);
      const lpTokenMint = poolAccount.lpTokenMint;

      const ownerLpToken = getAssociatedTokenAddressSync(
        lpTokenMint,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Create instructions to initialize owner token accounts
      const createOwnerTokenAIx = createAssociatedTokenAccountInstruction(
        poolOwner.publicKey,  // payer
        ownerTokenA,          // associatedToken
        poolOwner.publicKey,  // owner
        tokenAMint,           // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const createOwnerTokenBIx = createAssociatedTokenAccountInstruction(
        poolOwner.publicKey,  // payer
        ownerTokenB,          // associatedToken
        poolOwner.publicKey,  // owner
        tokenBMint,           // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Create and send a transaction to initialize the token accounts
      const setupTx = new Transaction().add(
        createOwnerTokenAIx,
        createOwnerTokenBIx
      );

      // Send the setup transaction
      const setupTxId = await provider.sendAndConfirm(setupTx, [poolOwner]);
      console.log(`Owner token accounts created. Transaction ID: ${setupTxId}`);

      // Mint some tokens to the pool owner
      // For Token A
      const mintAIx = createMintToInstruction(
        tokenAMint,             // mint
        ownerTokenA,            // destination
        poolOwner.publicKey,    // authority
        1000000,                // amount (1 token with 6 decimals)
        [],                     // multiSigners (empty array if not using multisig)
        TOKEN_2022_PROGRAM_ID   // programId
      );

      // For Token B
      const mintBIx = createMintToInstruction(
        tokenBMint,             // mint
        ownerTokenB,            // destination
        poolOwner.publicKey,    // authority
        2000000,                // amount (2 tokens with 6 decimals)
        [],                     // multiSigners (empty array if not using multisig)
        TOKEN_2022_PROGRAM_ID   // programId
      );

      // Send mint transactions
      const mintTx = new Transaction().add(mintAIx, mintBIx);
      const mintTxId = await provider.sendAndConfirm(mintTx, [poolOwner]);
      console.log(`Tokens minted to owner. Transaction ID: ${mintTxId}`);

      // Calculate the pool accounts
      const poolTokenA = getAssociatedTokenAddressSync(
        tokenAMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const poolTokenB = getAssociatedTokenAddressSync(
        tokenBMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Define deposit accounts
      const depositAccounts = {
        owner: poolOwner.publicKey,
        pool: poolPda,
        tokenAMint: tokenAMint,
        tokenBMint: tokenBMint,
        poolTokenA: poolTokenA,
        poolTokenB: poolTokenB,
        lpTokenMint: lpTokenMint,
        userTokenA: ownerTokenA,
        userTokenB: ownerTokenB,
        userLpToken: ownerLpToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Deposit liquidity
      const tokenAAmount = 500000; // 0.5 tokens
      const tokenBAmount = 1000000; // 1 token

      const depositTxId = await program.methods
        .depositLiquidity(new anchor.BN(tokenAAmount), new anchor.BN(tokenBAmount))
        .accounts(depositAccounts)
        .signers([poolOwner])
        .rpc();

      console.log(`Liquidity deposited. Transaction ID: ${depositTxId}`);

      // Check pool balances after deposit
      const poolAfterDeposit = await program.account.liquidityPool.fetch(poolPda);
      const poolTokenAAccountAfterDeposit = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBAccountAfterDeposit = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerLpTokenAccountAfterDeposit = await provider.connection.getTokenAccountBalance(ownerLpToken);

      console.log("Pool token A balance after deposit:", poolTokenAAccountAfterDeposit.value.amount);
      console.log("Pool token B balance after deposit:", poolTokenBAccountAfterDeposit.value.amount);
      console.log("Owner LP tokens after deposit:", ownerLpTokenAccountAfterDeposit.value.amount);
      console.log("Pool total liquidity after deposit:", poolAfterDeposit.totalLiquidity.toString());

      // Now withdraw half of the LP tokens
      const lpAmountToWithdraw = Math.floor(Number(ownerLpTokenAccountAfterDeposit.value.amount) / 2);

      const withdrawAccounts = {
        owner: poolOwner.publicKey,
        pool: poolPda,
        tokenAMint: tokenAMint,
        tokenBMint: tokenBMint,
        poolTokenA: poolTokenA,
        poolTokenB: poolTokenB,
        lpTokenMint: lpTokenMint,
        userTokenA: ownerTokenA,
        userTokenB: ownerTokenB,
        userLpToken: ownerLpToken,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      const withdrawTxId = await program.methods
        .withdrawLiquidity(new anchor.BN(lpAmountToWithdraw))
        .accounts(withdrawAccounts)
        .signers([poolOwner])
        .rpc();

      console.log(`Liquidity withdrawn. Transaction ID: ${withdrawTxId}`);

      // Check balances after withdrawal
      const poolAfterWithdraw = await program.account.liquidityPool.fetch(poolPda);
      const poolTokenAAccountAfterWithdraw = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBAccountAfterWithdraw = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerTokenAAccountAfterWithdraw = await provider.connection.getTokenAccountBalance(ownerTokenA);
      const ownerTokenBAccountAfterWithdraw = await provider.connection.getTokenAccountBalance(ownerTokenB);
      const ownerLpTokenAccountAfterWithdraw = await provider.connection.getTokenAccountBalance(ownerLpToken);

      console.log("Pool token A balance after withdrawal:", poolTokenAAccountAfterWithdraw.value.amount);
      console.log("Pool token B balance after withdrawal:", poolTokenBAccountAfterWithdraw.value.amount);
      console.log("Owner token A balance after withdrawal:", ownerTokenAAccountAfterWithdraw.value.amount);
      console.log("Owner token B balance after withdrawal:", ownerTokenBAccountAfterWithdraw.value.amount);
      console.log("Owner LP tokens after withdrawal:", ownerLpTokenAccountAfterWithdraw.value.amount);
      console.log("Pool total liquidity after withdrawal:", poolAfterWithdraw.totalLiquidity.toString());

      // Verify pool state after withdrawal
      expect(Number(poolAfterWithdraw.totalLiquidity.toString())).to.be.approximately(
        Number(poolAfterDeposit.totalLiquidity.toString()) - lpAmountToWithdraw,
        1 // Allow for rounding differences
      );

      // Verify LP tokens were burned
      expect(Number(ownerLpTokenAccountAfterWithdraw.value.amount)).to.be.approximately(
        Number(ownerLpTokenAccountAfterDeposit.value.amount) - lpAmountToWithdraw,
        1 // Allow for rounding differences
      );

      // Verify tokens were returned proportionally
      expect(Number(poolTokenAAccountAfterWithdraw.value.amount)).to.be.approximately(
        Number(poolTokenAAccountAfterDeposit.value.amount) / 2,
        10 // Allow for rounding differences
      );

      expect(Number(poolTokenBAccountAfterWithdraw.value.amount)).to.be.approximately(
        Number(poolTokenBAccountAfterDeposit.value.amount) / 2,
        10 // Allow for rounding differences
      );

      console.log("Withdrawal test passed with all validations");
    } catch (error) {
      console.error("Error in withdrawal test:", error);
      throw error;
    }
  });

  // NOTE: Test case 5
  it("Swapping tokens", async () => {
    try {
      // First, create a pool with liquidity if not already created
      // We'll reuse the pool and token accounts from previous tests

      // Calculate the token accounts
      const ownerTokenA = getAssociatedTokenAddressSync(
        tokenAMint,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const ownerTokenB = getAssociatedTokenAddressSync(
        tokenBMint,
        poolOwner.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Calculate LP token account
      const [poolPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("liquidity_pool"),
          tokenAMint.toBuffer(),
          tokenBMint.toBuffer(),
        ],
        program.programId
      );

      // Calculate the pool accounts
      const poolTokenA = getAssociatedTokenAddressSync(
        tokenAMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      const poolTokenB = getAssociatedTokenAddressSync(
        tokenBMint,
        poolPda,
        true,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_PROGRAM_ID
      );

      // Ensure the pool has enough liquidity
      // We'll deposit additional liquidity if needed
      const poolTokenAAccountInfo = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBAccountInfo = await provider.connection.getTokenAccountBalance(poolTokenB);

      // If pool has low liquidity, add more
      if (
        Number(poolTokenAAccountInfo.value.amount) < 100000 ||
        Number(poolTokenBAccountInfo.value.amount) < 100000
      ) {
        console.log("Adding additional liquidity to pool for swap test");

        // Mint some more tokens to the pool owner if needed
        const userTokenABalance = await provider.connection.getTokenAccountBalance(ownerTokenA);
        const userTokenBBalance = await provider.connection.getTokenAccountBalance(ownerTokenB);

        const mintTxs = new Transaction();

        // Add mint instructions if needed
        if (Number(userTokenABalance.value.amount) < 500000) {
          const mintAIx = createMintToInstruction(
            tokenAMint,             // mint
            ownerTokenA,            // destination
            poolOwner.publicKey,    // authority
            500000,                 // amount (0.5 token with 6 decimals)
            [],                     // multiSigners (empty array if not using multisig)
            TOKEN_2022_PROGRAM_ID   // programId
          );
          mintTxs.add(mintAIx);
        }

        if (Number(userTokenBBalance.value.amount) < 500000) {
          const mintBIx = createMintToInstruction(
            tokenBMint,             // mint
            ownerTokenB,            // destination
            poolOwner.publicKey,    // authority
            500000,                 // amount (0.5 token with 6 decimals)
            [],                     // multiSigners (empty array if not using multisig)
            TOKEN_2022_PROGRAM_ID   // programId
          );
          mintTxs.add(mintBIx);
        }

        // Execute mint transactions if needed
        if (mintTxs.instructions.length > 0) {
          const mintTxId = await provider.sendAndConfirm(mintTxs, [poolOwner]);
          console.log(`Additional tokens minted. Transaction ID: ${mintTxId}`);
        }

        // Define deposit accounts
        const depositAccounts = {
          owner: poolOwner.publicKey,
          pool: poolPda,
          tokenAMint: tokenAMint,
          tokenBMint: tokenBMint,
          poolTokenA: poolTokenA,
          poolTokenB: poolTokenB,
          lpTokenMint: (await program.account.liquidityPool.fetch(poolPda)).lpTokenMint,
          userTokenA: ownerTokenA,
          userTokenB: ownerTokenB,
          userLpToken: getAssociatedTokenAddressSync(
            (await program.account.liquidityPool.fetch(poolPda)).lpTokenMint,
            poolOwner.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_PROGRAM_ID
          ),
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        };

        // Deposit liquidity
        const tokenAAmount = 200000; // 0.2 tokens
        const tokenBAmount = 400000; // 0.4 tokens

        const depositTxId = await program.methods
          .depositLiquidity(new anchor.BN(tokenAAmount), new anchor.BN(tokenBAmount))
          .accounts(depositAccounts)
          .signers([poolOwner])
          .rpc();

        console.log(`Additional liquidity deposited. Transaction ID: ${depositTxId}`);
      }

      // Get pool data before swap
      const poolBeforeSwap = await program.account.liquidityPool.fetch(poolPda);
      const poolTokenABalanceBefore = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBBalanceBefore = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerTokenABalanceBefore = await provider.connection.getTokenAccountBalance(ownerTokenA);
      const ownerTokenBBalanceBefore = await provider.connection.getTokenAccountBalance(ownerTokenB);

      console.log("--- Pool State Before Swap ---");
      console.log("Pool token A balance:", poolTokenABalanceBefore.value.amount);
      console.log("Pool token B balance:", poolTokenBBalanceBefore.value.amount);
      console.log("User token A balance:", ownerTokenABalanceBefore.value.amount);
      console.log("User token B balance:", ownerTokenBBalanceBefore.value.amount);

      // Now perform a swap from token A to token B
      // Prepare the swap accounts
      const swapAccounts = {
        owner: poolOwner.publicKey,
        pool: poolPda,
        sourceMint: tokenAMint,
        destinationMint: tokenBMint,
        poolTokenA: poolTokenA,
        poolTokenB: poolTokenB,
        userSourceToken: ownerTokenA,
        userDestinationToken: ownerTokenB,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Calculate expected output using constant product formula
      // (Simple calculation to estimate the output without fees)
      const inputAmount = 50000; // 0.05 token A
      const reserveA = Number(poolTokenABalanceBefore.value.amount);
      const reserveB = Number(poolTokenBBalanceBefore.value.amount);
      const feeNumerator = poolBeforeSwap.feeNumerator.toNumber();
      const feeDenominator = poolBeforeSwap.feeDenominator.toNumber();

      // Apply fee
      const inputWithFee = inputAmount - (inputAmount * feeNumerator / feeDenominator);

      // Calculate expected output (approximate)
      const expectedOutput = Math.floor((reserveB * inputWithFee) / (reserveA + inputWithFee));

      // Set minimum output with 1% slippage tolerance
      const minimumOutputAmount = Math.floor(expectedOutput * 0.99);

      console.log(`Expected output for ${inputAmount} token A: ~${expectedOutput} token B`);
      console.log(`Minimum output with slippage: ${minimumOutputAmount} token B`);

      // Execute the swap
      const swapTxId = await program.methods
        .swap(
          new anchor.BN(inputAmount),
          new anchor.BN(minimumOutputAmount)
        )
        .accounts(swapAccounts)
        .signers([poolOwner])
        .rpc();

      console.log(`Swap executed. Transaction ID: ${swapTxId}`);

      // Get pool data after swap
      const poolAfterSwap = await program.account.liquidityPool.fetch(poolPda);
      const poolTokenABalanceAfter = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBBalanceAfter = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerTokenABalanceAfter = await provider.connection.getTokenAccountBalance(ownerTokenA);
      const ownerTokenBBalanceAfter = await provider.connection.getTokenAccountBalance(ownerTokenB);

      console.log("--- Pool State After Swap ---");
      console.log("Pool token A balance:", poolTokenABalanceAfter.value.amount);
      console.log("Pool token B balance:", poolTokenBBalanceAfter.value.amount);
      console.log("User token A balance:", ownerTokenABalanceAfter.value.amount);
      console.log("User token B balance:", ownerTokenBBalanceAfter.value.amount);

      // Verify pool token A increased by input amount
      expect(
        Number(poolTokenABalanceAfter.value.amount) - Number(poolTokenABalanceBefore.value.amount)
      ).to.equal(inputAmount);

      // Verify pool token B decreased by output amount
      const actualOutputAmount = Number(ownerTokenBBalanceAfter.value.amount) - Number(ownerTokenBBalanceBefore.value.amount);
      expect(
        Number(poolTokenBBalanceBefore.value.amount) - Number(poolTokenBBalanceAfter.value.amount)
      ).to.equal(actualOutputAmount);

      // Verify user token A decreased by input amount
      expect(
        Number(ownerTokenABalanceBefore.value.amount) - Number(ownerTokenABalanceAfter.value.amount)
      ).to.equal(inputAmount);

      // Verify actual output is at least the minimum expected
      expect(actualOutputAmount).to.be.at.least(minimumOutputAmount);

      // Verify the constant product formula approximately holds (with some tolerance for rounding)
      const productBefore = Number(poolTokenABalanceBefore.value.amount) * Number(poolTokenBBalanceBefore.value.amount);
      const productAfter = Number(poolTokenABalanceAfter.value.amount) * Number(poolTokenBBalanceAfter.value.amount);

      // The product should increase slightly due to fees
      expect(productAfter).to.be.greaterThan(productBefore * 0.99);

      console.log("Swap test passed with all validations");

      // Now try the opposite direction: token B to token A
      console.log("\nTesting swap in opposite direction (B to A)");

      // Get balances before reverse swap
      const poolTokenABalanceBeforeRev = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBBalanceBeforeRev = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerTokenABalanceBeforeRev = await provider.connection.getTokenAccountBalance(ownerTokenA);
      const ownerTokenBBalanceBeforeRev = await provider.connection.getTokenAccountBalance(ownerTokenB);

      console.log("--- Pool State Before Reverse Swap ---");
      console.log("Pool token A balance:", poolTokenABalanceBeforeRev.value.amount);
      console.log("Pool token B balance:", poolTokenBBalanceBeforeRev.value.amount);
      console.log("User token A balance:", ownerTokenABalanceBeforeRev.value.amount);
      console.log("User token B balance:", ownerTokenBBalanceBeforeRev.value.amount);

      // Prepare the reverse swap accounts
      const reverseSwapAccounts = {
        owner: poolOwner.publicKey,
        pool: poolPda,
        sourceMint: tokenBMint,
        destinationMint: tokenAMint,
        poolTokenA: poolTokenA,
        poolTokenB: poolTokenB,
        userSourceToken: ownerTokenB,
        userDestinationToken: ownerTokenA,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      };

      // Calculate expected output for reverse swap
      const reverseInputAmount = 30000; // 0.03 token B
      const reverseReserveA = Number(poolTokenABalanceBeforeRev.value.amount);
      const reverseReserveB = Number(poolTokenBBalanceBeforeRev.value.amount);

      // Apply fee
      const reverseInputWithFee = reverseInputAmount - (reverseInputAmount * feeNumerator / feeDenominator);

      // Calculate expected output (approximate)
      const reverseExpectedOutput = Math.floor((reverseReserveA * reverseInputWithFee) / (reverseReserveB + reverseInputWithFee));

      // Set minimum output with 1% slippage tolerance
      const reverseMinimumOutputAmount = Math.floor(reverseExpectedOutput * 0.99);

      console.log(`Expected output for ${reverseInputAmount} token B: ~${reverseExpectedOutput} token A`);
      console.log(`Minimum output with slippage: ${reverseMinimumOutputAmount} token A`);

      // Execute the reverse swap
      const reverseSwapTxId = await program.methods
        .swap(
          new anchor.BN(reverseInputAmount),
          new anchor.BN(reverseMinimumOutputAmount)
        )
        .accounts(reverseSwapAccounts)
        .signers([poolOwner])
        .rpc();

      console.log(`Reverse swap executed. Transaction ID: ${reverseSwapTxId}`);

      // Get pool data after reverse swap
      const poolTokenABalanceAfterRev = await provider.connection.getTokenAccountBalance(poolTokenA);
      const poolTokenBBalanceAfterRev = await provider.connection.getTokenAccountBalance(poolTokenB);
      const ownerTokenABalanceAfterRev = await provider.connection.getTokenAccountBalance(ownerTokenA);
      const ownerTokenBBalanceAfterRev = await provider.connection.getTokenAccountBalance(ownerTokenB);

      console.log("--- Pool State After Reverse Swap ---");
      console.log("Pool token A balance:", poolTokenABalanceAfterRev.value.amount);
      console.log("Pool token B balance:", poolTokenBBalanceAfterRev.value.amount);
      console.log("User token A balance:", ownerTokenABalanceAfterRev.value.amount);
      console.log("User token B balance:", ownerTokenBBalanceAfterRev.value.amount);

      // Verify pool token B increased by input amount
      expect(
        Number(poolTokenBBalanceAfterRev.value.amount) - Number(poolTokenBBalanceBeforeRev.value.amount)
      ).to.equal(reverseInputAmount);

      // Verify pool token A decreased appropriately
      const reverseActualOutputAmount = Number(ownerTokenABalanceAfterRev.value.amount) - Number(ownerTokenABalanceBeforeRev.value.amount);
      expect(
        Number(poolTokenABalanceBeforeRev.value.amount) - Number(poolTokenABalanceAfterRev.value.amount)
      ).to.equal(reverseActualOutputAmount);

      // Verify actual output is at least the minimum expected
      expect(reverseActualOutputAmount).to.be.at.least(reverseMinimumOutputAmount);

      console.log("Reverse swap test passed with all validations");
    } catch (error) {
      console.error("Error in swap test:", error);
      throw error;
    }
  });
});

/**
 * Airdrops SOL to a given public key if the balance is below a specified threshold.
 * Ensures that test accounts have sufficient funds to cover transaction fees.
 *
 * @param connection - Solana connection object.
 * @param publicKey - Public key to airdrop SOL to.
 * @param minBalanceInSol - Minimum balance required in SOL.
 */
async function airdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey,
  minBalanceInSol: number = DEFAULT_AIRDROP_SOL
): Promise<void> {
  try {
    // Retrieve the current balance of the account in lamports.
    const currentBalance = await connection.getBalance(publicKey);
    const currentBalanceInSol = currentBalance / LAMPORTS_PER_SOL;

    // Check if the current balance meets the minimum required balance.
    if (currentBalanceInSol < minBalanceInSol) {
      const requiredAirdrop = minBalanceInSol - currentBalanceInSol;

      // Request an airdrop of the required amount.
      const signature = await connection.requestAirdrop(
        publicKey,
        requiredAirdrop * LAMPORTS_PER_SOL
      );

      // Confirm the airdrop transaction.
      const latestBlockhash = await connection.getLatestBlockhash();
      const confirmationResult: RpcResponseAndContext<SignatureResult> =
        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "finalized"
        );

      // Handle any errors that occurred during the airdrop.
      if (confirmationResult.value.err) {
        throw new Error(
          `Airdrop transaction failed: ${JSON.stringify(confirmationResult.value.err)}`
        );
      }

      console.log(
        `Airdropped ${requiredAirdrop.toFixed(2)} SOL to ${publicKey.toBase58()}.`
      );
    } else {
      console.log(
        `Account ${publicKey.toBase58()} already has ${currentBalanceInSol.toFixed(
          2
        )} SOL, no airdrop needed.`
      );
    }
  } catch (error) {
    console.error("Error in airdropIfNeeded function:", error);
    throw error;
  }
}
