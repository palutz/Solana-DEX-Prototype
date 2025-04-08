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

      // Find the pool PDA address
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
