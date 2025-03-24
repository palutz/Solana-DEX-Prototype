import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Dex } from "../target/types/dex";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  RpcResponseAndContext,
  SignatureResult,
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

  // -------------------- Hooks --------------------

  // Runs before all tests in this block.
  before(async () => {
    adminWallet = provider.wallet as anchor.Wallet;
    admin = adminWallet.payer;
    unauthorizedAttacker = Keypair.generate();

    // Derive the DexState PDA using the "dex_state" seed and admin's public key.
    dexStatePda = PublicKey.findProgramAddressSync(
      [Buffer.from("dex_state"), adminWallet.publicKey.toBuffer()],
      program.programId
    )[0];

    // airdrop sol to the admin and unauthorized attacker wallet. 
    await airdropIfNeeded(provider.connection, unauthorizedAttacker.publicKey, DEFAULT_AIRDROP_SOL);
  });

  // -------------------- Test Cases --------------------

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
      // // Attempt to initialize Dex state with unauthorized admin credentials.
      await program.methods
        .initialize(new anchor.BN(10), new anchor.BN(1000))
        .accounts(initializeAccounts)
        .signers([unauthorizedAttacker])
        .rpc();

      // // If the above transaction succeeds, the test should fail.
      throw new Error("Expected transaction to fail, but it succeeded");
    } catch (err: any) {
      // Assert that the error code corresponds to unauthorized admin action.
      // Check for `NotAdmin` error code.
      expect(err.error.errorCode.code).to.equal("NotAdmin");
    }
  });

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
      console.error("Error in beforeEach hook:", error);
      throw error; // Propagate the error to fail the tests if setup fails.
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
