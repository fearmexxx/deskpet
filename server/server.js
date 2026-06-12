import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as solanaWeb3 from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();

// CORS: restrict to extension origin in production
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ==========================================
// 🏥 HEALTH CHECK ENDPOINT
// ==========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'deskpet-server',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fqnnxtzuocsdhmvmltje.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com";
const DESK_MINT = "AtdpNbFfYWqaE4bVrwh7mP3jE7K2NSJCiCodvbxGXJt2";

// Initialize Supabase Admin client
let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
} else {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment. Database features will be limited.");
}

// Initialize Solana Connection
const connection = new solanaWeb3.Connection(HELIUS_RPC_URL, "confirmed");

// Load Distributor Keypair
let distributorKeypair = null;
if (process.env.DISTRIBUTOR_SECRET) {
  try {
    const secret = JSON.parse(process.env.DISTRIBUTOR_SECRET);
    distributorKeypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secret));
    console.log("Distributor Keypair loaded from env. Pubkey:", distributorKeypair.publicKey.toBase58());
  } catch (err) {
    console.error("Failed to load distributor keypair from env:", err.message);
  }
}

if (!distributorKeypair) {
  try {
    const filePath = path.resolve('../distributor-keypair.json');
    if (fs.existsSync(filePath)) {
      const secret = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      distributorKeypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(secret));
      console.log("Loaded distributor keypair from local file. Pubkey:", distributorKeypair.publicKey.toBase58());
    }
  } catch (err) {
    console.error("Failed to load distributor keypair from local file:", err.message);
  }
}

// ==========================================
// 🛡️ AUTHENTICATION MIDDLEWARE
// ==========================================
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase client not initialized');
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    }
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: ' + err.message });
  }
}

// Helper to verify on-chain $DESK transfer to distributor
async function verifyDeskTransfer(txSig, expectedAmount, expectedSender) {
  const tx = await connection.getTransaction(txSig, { 
    commitment: "confirmed", 
    maxSupportedTransactionVersion: 0 
  });
  if (!tx) {
    throw new Error("Transaction signature not found on-chain");
  }
  if (tx.meta?.err) {
    throw new Error("Transaction failed on-chain");
  }

  // Verify fee payer is the user's wallet
  // staticAccountKeys may be a getter on legacy messages; fall back to accountKeys
  const signers = tx.transaction.message.staticAccountKeys
    || tx.transaction.message.accountKeys
    || [];
  const senderPubkey = signers[0]?.toBase58?.() || signers[0];
  if (senderPubkey !== expectedSender) {
    throw new Error(`Transaction fee payer (${senderPubkey}) does not match authenticated wallet (${expectedSender})`);
  }

  // Check token balance changes
  // NOTE: Solana RPC nests the amount under uiTokenAmount, not at root level
  const preBalances = tx.meta?.preTokenBalances || [];
  const postBalances = tx.meta?.postTokenBalances || [];
  const distributorOwner = distributorKeypair.publicKey.toBase58();

  console.log(`[verifyDeskTransfer] Distributor owner: ${distributorOwner}`);
  console.log(`[verifyDeskTransfer] postBalances: ${JSON.stringify(postBalances)}`);
  
  let distributorReceived = 0;
  for (const post of postBalances) {
    if (post.owner === distributorOwner && post.mint === DESK_MINT) {
      const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
      // Amounts are nested under uiTokenAmount
      const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || pre.uiAmountString || "0") : 0;
      const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || post.uiAmountString || "0");
      distributorReceived += (postAmount - preAmount);
    }
  }

  console.log(`[verifyDeskTransfer] distributorReceived=${distributorReceived}, expected=${expectedAmount}`);

  if (Math.abs(distributorReceived - expectedAmount) > 0.001) {
    throw new Error(`Distributor received ${distributorReceived} $DESK, but expected ${expectedAmount}`);
  }

  return true;
}

// Helper to transfer $DESK from distributor wallet to user's wallet
async function transferDeskFromDistributor(recipientPubkeyStr, amount) {
  const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const deskMintPublicKey = new solanaWeb3.PublicKey(DESK_MINT);
  const distributorPublicKey = distributorKeypair.publicKey;
  const recipientPublicKey = new solanaWeb3.PublicKey(recipientPubkeyStr);

  const distributorDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
    [distributorPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
    associateProgramId
  ))[0];

  const recipientDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
    [recipientPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
    associateProgramId
  ))[0];

  const transaction = new solanaWeb3.Transaction();

  // Create recipient ATA if it doesn't exist
  let recipientAtaExists = false;
  try {
    const rawBal = await connection.getTokenAccountBalance(recipientDeskAta);
    if (rawBal !== undefined) recipientAtaExists = true;
  } catch (e) { }

  if (!recipientAtaExists) {
    transaction.add(
      new solanaWeb3.TransactionInstruction({
        keys: [
          { pubkey: distributorPublicKey, isSigner: true, isWritable: true },
          { pubkey: recipientDeskAta, isSigner: false, isWritable: true },
          { pubkey: recipientPublicKey, isSigner: false, isWritable: false },
          { pubkey: deskMintPublicKey, isSigner: false, isWritable: false },
          { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: tokenProgramId, isSigner: false, isWritable: false },
          { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: associateProgramId,
        data: new Uint8Array(0),
      })
    );
  }

  // Add transfer instruction
  const decimalsMultiplier = Math.pow(10, 9);
  const rawAmount = amount * decimalsMultiplier;

  const transferInstructionData = new Uint8Array(9);
  transferInstructionData[0] = 3;
  let temp = BigInt(rawAmount);
  for (let i = 1; i <= 8; i++) {
    transferInstructionData[i] = Number(temp & BigInt(0xff));
    temp = temp >> BigInt(8);
  }

  transaction.add(
    new solanaWeb3.TransactionInstruction({
      keys: [
        { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
        { pubkey: recipientDeskAta, isSigner: false, isWritable: true },
        { pubkey: distributorPublicKey, isSigner: true, isWritable: false }
      ],
      programId: tokenProgramId,
      data: transferInstructionData
    })
  );

  transaction.feePayer = distributorPublicKey;
  const blockhashObj = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhashObj.blockhash;

  transaction.sign(distributorKeypair);
  const serialized = transaction.serialize();
  const txSignature = await connection.sendRawTransaction(serialized);
  await connection.confirmTransaction(txSignature, "confirmed");

  return txSignature;
}

// Helper to burn $DESK from the distributor's ATA (for deflationary sinks)
async function burnDistributorDesk(amount) {
  try {
    const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    const deskMintPublicKey = new solanaWeb3.PublicKey(DESK_MINT);
    const distributorPublicKey = distributorKeypair.publicKey;

    const distributorDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
      [distributorPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
      new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    ))[0];

    const transaction = new solanaWeb3.Transaction();
    const decimalsMultiplier = Math.pow(10, 9);
    const rawAmount = amount * decimalsMultiplier;

    const burnInstructionData = new Uint8Array(9);
    burnInstructionData[0] = 8;
    let temp = BigInt(rawAmount);
    for (let i = 1; i <= 8; i++) {
      burnInstructionData[i] = Number(temp & BigInt(0xff));
      temp = temp >> BigInt(8);
    }

    transaction.add(
      new solanaWeb3.TransactionInstruction({
        keys: [
          { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
          { pubkey: deskMintPublicKey, isSigner: false, isWritable: true },
          { pubkey: distributorPublicKey, isSigner: true, isWritable: false }
        ],
        programId: tokenProgramId,
        data: burnInstructionData
      })
    );

    transaction.feePayer = distributorPublicKey;
    const blockhashObj = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhashObj.blockhash;

    transaction.sign(distributorKeypair);
    const txSig = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(txSig, "confirmed");
    console.log(`[Burn] Successfully burned ${amount} $DESK on-chain. Tx: ${txSig}`);
  } catch (e) {
    console.error("Failed to burn distributor $DESK:", e.message);
  }
}

// ==========================================
// 🛡️ RPG GEAR GENERATOR
// ==========================================
const GEAR_PREFIXES = ["Overclocked", "Corrupted", "Quantum", "Neon-Forged", "Glitched", "Prototype", "Salvaged", "Hardened"];
const GEAR_NAMES = {
  weapon: [
    "Plasma Railcannon", "Ion Disruptor", "Photon Katana", "Volt Hammer", "Neural Lash",
    "Cryo Piercer", "Arc Glaive", "Fusion Maul", "Pulse Scythe", "Null Blade"
  ],
  head: [
    "Cortex Visor", "Synaptic Crown", "Holo-Helm", "Signal Jammer Cowl",
    "Neuro-Link Circlet", "EMP Shielded Headgear"
  ],
  clothes: [
    "Reactive Nanoweave", "Titanium Exoplate", "Stealth Mesh Suit",
    "Ablative Core Vest", "Drift Runner Jacket", "Photovoltaic Shroud"
  ],
  aiChip: [
    "Zero-Day Exploit Core", "Quantum Entangler", "Deep-Learning Shard",
    "Predictive Cortex Module", "Overclock Gem", "Entropy Stabilizer"
  ]
};
const GEAR_SUFFIXES = ["of the Void", "of the Mainframe", "of Latency", "of the Quickblade", "of Shadow", "of Net-Runners", "of the Grid"];

function generateRandomGear(rarityOverride = null) {
  const slots = ["weapon", "head", "clothes", "aiChip"];
  const slot = slots[Math.floor(Math.random() * slots.length)];

  // Rarity roll based on gears.md updated rates: Common (80%), Blue (15%), Epic (4.5%), Legendary (0.5%)
  const rarities = ["common", "blue", "epic", "legendary"];
  let rarity = rarityOverride;
  if (!rarity) {
    const roll = Math.random();
    if (roll < 0.80) rarity = "common";
    else if (roll < 0.95) rarity = "blue";
    else if (roll < 0.995) rarity = "epic";
    else rarity = "legendary";
  }

  let primaryRange = [1, 5];
  let secondaryRange = [0, 0];
  let multiplier = 1.0;
  let color = "#808080";

  switch (rarity) {
    case "common":
      primaryRange = [1, 5];
      color = "#808080";
      break;
    case "blue":
      primaryRange = [6, 12];
      secondaryRange = [1, 3];
      multiplier = 1.2;
      color = "#00c0ff";
      break;
    case "epic":
      primaryRange = [13, 22];
      secondaryRange = [4, 8];
      multiplier = 1.5;
      color = "#bd00ff";
      break;
    case "legendary":
      primaryRange = [23, 35];
      secondaryRange = [9, 15];
      multiplier = 2.0;
      color = "#ffb700";
      break;
  }

  const rollStatValue = (range) => {
    if (range[0] === 0 && range[1] === 0) return 0;
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  };

  let primaryStat = "strength";
  let secondaryStat = "stamina";

  if (slot === "weapon") {
    primaryStat = Math.random() > 0.5 ? "strength" : "intelligence";
    secondaryStat = "agility";
  } else if (slot === "head") {
    primaryStat = Math.random() > 0.5 ? "stamina" : "intelligence";
    secondaryStat = "strength";
  } else if (slot === "clothes") {
    primaryStat = Math.random() > 0.5 ? "stamina" : "agility";
    secondaryStat = "intelligence";
  } else {
    primaryStat = Math.random() > 0.5 ? "agility" : "intelligence";
    secondaryStat = "stamina";
  }

  const primaryValue = Math.floor(rollStatValue(primaryRange) * multiplier);
  const secondaryValue = Math.floor(rollStatValue(secondaryRange) * multiplier);

  const prefix = GEAR_PREFIXES[Math.floor(Math.random() * GEAR_PREFIXES.length)];
  const nameBase = GEAR_NAMES[slot][Math.floor(Math.random() * GEAR_NAMES[slot].length)];
  const suffix = GEAR_SUFFIXES[Math.floor(Math.random() * GEAR_SUFFIXES.length)];
  const displayName = `${prefix} ${nameBase} ${suffix}`;

  const stats = {};
  stats[primaryStat] = primaryValue;
  if (secondaryValue > 0) {
    stats[secondaryStat] = secondaryValue;
  }

  return {
    id: crypto.randomUUID(),
    name: displayName,
    slot,
    rarity: rarity.charAt(0).toUpperCase() + rarity.slice(1),
    stats,
    color
  };
}

// HTTP API: Gear generator endpoint
app.post('/api/generate-gear', (req, res) => {
  const { rarity } = req.body;
  try {
    const gear = generateRandomGear(rarity);
    res.json({ success: true, gear });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 🛡️ SECURE TESTNET AIRDROP FAUCET
// ==========================================
app.post('/api/faucet/claim', authenticateUser, async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, error: "walletAddress is required" });
  }

  try {
    const userId = req.userId;
    
    // Check if user has claimed within 24 hours
    const { data: claimData, error: fetchError } = await supabaseAdmin
      .from('faucet_claims')
      .select('last_claimed_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (claimData) {
      const lastClaimed = new Date(claimData.last_claimed_at).getTime();
      const elapsed = Date.now() - lastClaimed;
      const cooldown = 24 * 60 * 60 * 1000;
      if (elapsed < cooldown) {
        const remaining = Math.ceil((cooldown - elapsed) / 1000 / 60);
        const remainingHours = (remaining / 60).toFixed(1);
        return res.status(429).json({ 
          success: false, 
          error: `Faucet on cooldown. Please wait ${remainingHours} hour(s) before claiming again. ⏳` 
        });
      }
    }

    // 1. Mint 30,000 $DESK to user's ATA
    let mintTxSignature = null;
    if (distributorKeypair) {
      const userPublicKey = new solanaWeb3.PublicKey(walletAddress);
      const mintPublicKey = new solanaWeb3.PublicKey(DESK_MINT);
      const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

      const userAtaAddress = (await solanaWeb3.PublicKey.findProgramAddress(
        [userPublicKey.toBuffer(), tokenProgramId.toBuffer(), mintPublicKey.toBuffer()],
        associateProgramId
      ))[0];

      const transaction = new solanaWeb3.Transaction();

      let ataExists = false;
      try {
        const rawBal = await connection.getTokenAccountBalance(userAtaAddress);
        if (rawBal !== undefined && rawBal.value) ataExists = true;
      } catch (e) {
        // ATA does not exist
      }

      if (!ataExists) {
        transaction.add(
          new solanaWeb3.TransactionInstruction({
            keys: [
              { pubkey: distributorKeypair.publicKey, isSigner: true, isWritable: true },
              { pubkey: userAtaAddress, isSigner: false, isWritable: true },
              { pubkey: userPublicKey, isSigner: false, isWritable: false },
              { pubkey: mintPublicKey, isSigner: false, isWritable: false },
              { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: tokenProgramId, isSigner: false, isWritable: false },
              { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            programId: associateProgramId,
            data: new Uint8Array(0),
          })
        );
      }

      const decimalsMultiplier = Math.pow(10, 9);
      const amountTokens = 30000;
      const rawAmount = amountTokens * decimalsMultiplier;

      const mintToInstructionData = new Uint8Array(9);
      mintToInstructionData[0] = 7; // MintTo index
      let temp = BigInt(rawAmount);
      for (let i = 1; i <= 8; i++) {
        mintToInstructionData[i] = Number(temp & BigInt(0xff));
        temp = temp >> BigInt(8);
      }

      transaction.add(
        new solanaWeb3.TransactionInstruction({
          keys: [
            { pubkey: mintPublicKey, isSigner: false, isWritable: true },
            { pubkey: userAtaAddress, isSigner: false, isWritable: true },
            { pubkey: distributorKeypair.publicKey, isSigner: true, isWritable: false },
          ],
          programId: tokenProgramId,
          data: mintToInstructionData,
        })
      );

      transaction.feePayer = distributorKeypair.publicKey;
      const blockhashObj = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhashObj.blockhash;

      transaction.sign(distributorKeypair);
      const rawTx = transaction.serialize();
      mintTxSignature = await connection.sendRawTransaction(rawTx);

      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature: mintTxSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      }, "confirmed");
    } else {
      throw new Error("Distributor keypair not loaded on server");
    }

    // Log the claim in the database
    await supabaseAdmin
      .from('faucet_claims')
      .upsert({
        user_id: userId,
        last_claimed_at: new Date().toISOString()
      });

    res.json({
      success: true,
      message: "Faucet claimed successfully! 30,000 $DESK sent. 🪂",
      deskTxSignature: mintTxSignature
    });
  } catch (err) {
    console.error("Faucet claim error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🏪 STORE PURCHASE VERIFICATION ENDPOINT
// ==========================================
app.post('/api/store/verify-purchase', authenticateUser, async (req, res) => {
  const { txSignature, itemType, mintAddress, playerWallet } = req.body;
  
  if (!txSignature || !itemType || !playerWallet) {
    return res.status(400).json({ success: false, error: "Missing purchase parameters" });
  }

  try {
    const userId = req.userId;
    const price = itemType === "egg" ? 500 : 5000;

    // Check signature
    const { data: existingTx } = await supabaseAdmin
      .from('processed_transactions')
      .select('signature')
      .eq('signature', txSignature)
      .maybeSingle();

    if (existingTx) {
      return res.status(400).json({ success: false, error: "Transaction already processed." });
    }

    // Verify transfer
    await verifyDeskTransfer(txSignature, price, playerWallet);

    // Burn 30% of the purchase price on-chain (70% recycled to staking rewards)
    await burnDistributorDesk(price * 0.3);

    // Fetch user's current state
    const { data: petRow } = await supabaseAdmin
      .from('pet_state')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();

    let state = petRow ? petRow.state_data : null;
    if (!state) {
      state = {
        petcoin: 100,
        activePetId: null,
        showFloatingPet: true,
        lastActive: Date.now(),
        lastYieldTime: Date.now(),
        claimableYield: 0,
        stakingSlotsLimit: 1,
        ownedSkins: ["neon-cyan", "neon-gold", "neon-pink"],
        pets: {},
        inventory: { treat: 3, toy: 2, battery: 1, mutagen: 0 },
        gearInventory: [],
        maxLevelUnlocked: false,
        focusSession: { active: false, startTime: 0, endTime: 0, duration: 0, lastActivityTime: 0, isPaused: false },
        userAccount: { loggedIn: true, email: req.userEmail, provider: "privy", token: "" }
      };
    }

    state.solanaWalletPubkey = playerWallet;

    if (itemType === "treasury") {
      const { data: countData } = await supabaseAdmin.from('global_config').select('value').eq('key', 'treasury_mint_count').maybeSingle();
      const currentCount = countData ? (countData.value.count || 0) : 0;
      if (currentCount >= 5000) {
        return res.status(400).json({ success: false, error: "All 5,000 Limited Treasury Level 60 Pets have been minted!" });
      }
      await supabaseAdmin.from('global_config').upsert({ key: 'treasury_mint_count', value: { count: currentCount + 1 } });
    }

    const speciesList = ["sol-cat", "astro-dog", "cyber-bunny"];
    const species = speciesList[Math.floor(Math.random() * speciesList.length)];
    const commonPrefixes = itemType === "egg" ? 
      ["Cyber", "Neon", "Robo", "Quantum", "Crypto", "Byte", "Pixel", "Circuit", "Synapse"] :
      ["Treasury", "Imperial", "Vanguard", "Sentinel", "Apex", "Overlord", "Elite"];
    const baseNames = {
      "sol-cat": ["Kitty", "Mao", "Feline", "Whiskers", "Paws"],
      "astro-dog": ["Rover", "Pup", "Canine", "Barker", "Comet"],
      "cyber-bunny": ["Floppy", "Rabbit", "Thumper", "Bouncer", "Hops"]
    };
    const prefix = commonPrefixes[Math.floor(Math.random() * commonPrefixes.length)];
    const bodyName = baseNames[species][Math.floor(Math.random() * baseNames[species].length)];
    const name = itemType === "egg" ? `${prefix} ${bodyName} #${Math.floor(1000 + Math.random() * 9000)}` : `Treasury ${bodyName} #${Math.floor(100 + Math.random() * 900)}`;
    
    let level = 1;
    let rarity = "Common";
    
    if (itemType === "egg") {
      const roll = Math.random();
      if (roll < 0.60) {
        rarity = "Common";
      } else if (roll < 0.85) {
        rarity = "Rare";
      } else if (roll < 0.97) {
        rarity = "Epic";
      } else {
        rarity = "Legendary";
      }
    } else if (itemType === "treasury") {
      level = 60;
      rarity = "Treasury";
    }

    let skin = "neon-cyan";
    if (itemType === "treasury") {
      const premiumSkins = ["neon-purple", "neon-matrix", "neon-rainbow"];
      skin = premiumSkins[Math.floor(Math.random() * premiumSkins.length)];
    } else {
      if (rarity === "Common") {
        const commonSkins = ["neon-cyan", "neon-pink", "neon-green"];
        skin = commonSkins[Math.floor(Math.random() * commonSkins.length)];
      } else if (rarity === "Rare") {
        const rareSkins = ["neon-gold", "neon-purple"];
        skin = rareSkins[Math.floor(Math.random() * rareSkins.length)];
      } else if (rarity === "Epic") {
        const epicSkins = ["neon-purple", "neon-matrix"];
        skin = epicSkins[Math.floor(Math.random() * epicSkins.length)];
      } else {
        const legendarySkins = ["neon-rainbow"];
        skin = legendarySkins[Math.floor(Math.random() * legendarySkins.length)];
      }
    }

    const baseStats = {
      "sol-cat": { strength: 10, agility: 10, intelligence: 10, stamina: 10 },
      "astro-dog": { strength: 12, agility: 8, intelligence: 10, stamina: 10 },
      "cyber-bunny": { strength: 8, agility: 12, intelligence: 10, stamina: 10 }
    };
    const stats = baseStats[species];
    
    let strength = stats.strength, agility = stats.agility, intelligence = stats.intelligence, stamina = stats.stamina;
    
    if (itemType === "treasury") {
      let points = 295;
      while (points > 0) {
        const roll = Math.floor(Math.random() * 4);
        if (roll === 0) strength++;
        else if (roll === 1) agility++;
        else if (roll === 2) intelligence++;
        else stamina++;
        points--;
      }
    }
    
    const petId = `${species}-${Math.random().toString(36).substring(2, 10)}`;
    const newPetObj = {
      id: petId,
      name: name,
      species: species,
      level: level,
      xp: 0,
      xpNeeded: species === "sol-cat" ? 100 : (species === "astro-dog" ? 120 : 90),
      baseXpNeeded: species === "sol-cat" ? 100 : (species === "astro-dog" ? 120 : 90),
      stage: itemType === "egg" ? "Baby" : "Adult",
      hunger: 80, happiness: 80, energy: 80, status: "idle",
      strength, agility, intelligence, stamina,
      availableStatPoints: 0,
      equipment: { weapon: null, head: null, clothes: null, aiChip: null },
      lastPetTime: 0, dailyPetCount: 0, dailyPetDate: "",
      minted: true,
      mintAddress: mintAddress,
      lastMintTxSignature: txSignature,
      skin: skin,
      staked: false, stakingSession: null, rarity: rarity
    };
    
    state.pets[petId] = newPetObj;
    state.activePetId = petId;
    
    await supabaseAdmin.from('pet_state').upsert({
      user_id: userId,
      state_data: state,
      updated_at: new Date().toISOString()
    });

    await supabaseAdmin.from('processed_transactions').insert({
      signature: txSignature,
      user_id: userId
    });

    res.json({
      success: true,
      state: state,
      name: name,
      pet: newPetObj
    });
  } catch (err) {
    console.error("Verify purchase error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 📈 AUTHORITATIVE STATE ACTION ENGINE
// ==========================================
function getRarityMultiplier(rarity) {
  if (!rarity) return 1.0;
  const r = rarity.toLowerCase();
  if (r === "rare") return 1.25;
  if (r === "epic") return 1.5;
  if (r === "legendary" || r === "treasury") return 2.0;
  return 1.0;
}

const MAX_PET_LEVEL = 60;

function gainXP(state, pet, amount) {
  if ((pet.level || 1) >= MAX_PET_LEVEL) return;

  const mult = getRarityMultiplier(pet.rarity);
  const scaledAmount = Math.max(1, Math.round(amount * mult));
  pet.xp = (pet.xp || 0) + scaledAmount;

  while (pet.xp >= pet.xpNeeded && pet.level < MAX_PET_LEVEL) {
    pet.xp -= pet.xpNeeded;
    pet.level += 1;

    const baseXp = pet.baseXpNeeded || 100;
    pet.xpNeeded = Math.floor(baseXp + pet.level * 2.5);

    pet.availableStatPoints = (pet.availableStatPoints || 0) + 5;
    state.petcoin = (state.petcoin || 0) + (pet.level * 20);

    if (pet.level >= 30) {
      pet.stage = "Adult";
    } else if (pet.level >= 10) {
      pet.stage = "Teen";
    } else {
      pet.stage = "Baby";
    }

    if (pet.level >= MAX_PET_LEVEL) {
      pet.xp = 0;
      pet.xpNeeded = 0;
      state.maxLevelUnlocked = true;
      break;
    }
  }
}

function accumulatePassiveYield(state) {
  if (!state) return;
  const now = Date.now();
  if (!state.lastYieldTime) {
    state.lastYieldTime = now;
    state.claimableYield = state.claimableYield || 0;
    return;
  }

  const activeId = state.activePetId || "sol-cat";
  const pet = state.pets ? state.pets[activeId] : null;
  if (!pet || pet.staked) {
    state.lastYieldTime = now;
    return;
  }

  const baseRateHr = 10;
  const levelMultiplier = 1 + (pet.level * 0.05);
  const statsMultiplier = 1 + ((pet.intelligence || 10) * 0.02);
  const rarityMultiplier = getRarityMultiplier(pet.rarity);

  const ratePerHour = baseRateHr * levelMultiplier * statsMultiplier * rarityMultiplier;
  const ratePerMs = ratePerHour / (3600 * 1000);

  let elapsedMs = now - state.lastYieldTime;
  const maxElapsedMs = 8 * 3600 * 1000;
  if (elapsedMs > maxElapsedMs) {
    elapsedMs = maxElapsedMs;
  }

  if (elapsedMs > 0) {
    const yieldGained = elapsedMs * ratePerMs;
    state.claimableYield = (state.claimableYield || 0) + yieldGained;
  }
  state.lastYieldTime = now;
}

function updateStakingProgress(state) {
  if (!state || !state.pets) return;
  const now = Date.now();
  for (const petId in state.pets) {
    const pet = state.pets[petId];
    if (pet.staked && pet.stakingSession && !pet.stakingSession.completed) {
      const elapsed = now - pet.stakingSession.startedAt;
      if (elapsed >= pet.stakingSession.duration) {
        pet.stakingSession.completed = true;
      }
    }
  }
}

function applyVitalsDecay(state) {
  const now = Date.now();
  if (!state.lastActive) {
    state.lastActive = now;
    return;
  }

  const elapsedMs = now - state.lastActive;
  const elapsedMins = Math.floor(elapsedMs / 60000);

  if (elapsedMins <= 0) return;

  accumulatePassiveYield(state);
  updateStakingProgress(state);

  if (state.focusSession && state.focusSession.active) {
    if (state.focusSession.isPaused) {
      state.focusSession.endTime += elapsedMins * 60000;
      const pet = state.pets[state.activePetId];
      if (pet && pet.status !== "sleep") {
        pet.status = "sleep";
      }
    } else {
      const idleTime = now - (state.focusSession.lastActivityTime || now);
      if (idleTime > 180000) {
        state.focusSession.isPaused = true;
        const pet = state.pets[state.activePetId];
        if (pet) {
          pet.status = "sleep";
        }
      } else if (now >= state.focusSession.endTime) {
        state.focusSession.active = false;
        
        const pet = state.pets[state.activePetId];
        const mult = pet ? getRarityMultiplier(pet.rarity) : 1.0;
        const reward = Math.round(state.focusSession.duration * 20 * mult); 
        state.petcoin = (state.petcoin || 0) + reward;
        
        if (pet) {
          pet.status = "happy";
          gainXP(state, pet, state.focusSession.duration * 2);
        }
      }
    }
  }

  const activeId = state.activePetId;
  const pet = activeId ? state.pets[activeId] : null;

  if (pet) {
    for (let m = 0; m < elapsedMins; m++) {
      if (pet.status !== "sleep") {
        pet.hunger = Math.max(0, pet.hunger - 1);
        pet.happiness = Math.max(0, pet.happiness - 1);
        pet.energy = Math.max(0, pet.energy - 1);
      } else {
        pet.energy = Math.min(100, pet.energy + 5);
        pet.hunger = Math.max(0, pet.hunger - 0.5);
        if (pet.energy >= 100) {
          pet.status = "idle";
        }
      }

      if (pet.hunger > 50 && pet.happiness > 50 && pet.status !== "sleep") {
        gainXP(state, pet, 2);
      }
    }
  }

  state.lastActive = now;
}

async function getStakingConfig() {
  try {
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.from('global_config').select('value').eq('key', 'staking_config').maybeSingle();
      if (data && data.value) {
        return data.value;
      }
    }
  } catch (e) {
    console.error("Failed to fetch staking config:", e.message);
  }
  return { fee_2h: 0, fee_4h: 20, fee_8h: 50 };
}

// ==========================================
// 🛡️ IN-MEMORY RATE LIMITER (per-user)
// ==========================================
const rateLimitMap = new Map(); // key: userId, value: { count, resetAt }
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per user

function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(userId, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// Cleanup stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

app.post('/api/state/sync-action', authenticateUser, async (req, res) => {
  const { action, payload } = req.body;
  if (!action) {
    return res.status(400).json({ success: false, error: "action is required" });
  }

  // Rate limit check
  if (!checkRateLimit(req.userId)) {
    return res.status(429).json({ success: false, error: "Rate limit exceeded. Please slow down." });
  }

  if (["feed", "pet", "useItem"].includes(action)) {
    req.updateInteractTime = true;
  }

  try {
    const userId = req.userId;

    const { data: petRow } = await supabaseAdmin
      .from('pet_state')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!petRow || !petRow.state_data) {
      return res.status(400).json({ success: false, error: "Pet state not found. Open Dashboard to initialize starter pets." });
    }

    const state = petRow.state_data;

    applyVitalsDecay(state);

    if (req.updateInteractTime) {
      state.lastActiveInteractTime = Date.now();
    }

    const activeId = state.activePetId;
    const pet = activeId ? state.pets[activeId] : null;

    if (action === "claimYield") {
      accumulatePassiveYield(state);
      const amount = state.claimableYield || 0;
      if (amount <= 0) {
        return res.status(400).json({ success: false, error: "No claimable yield available" });
      }
      state.petcoin = (state.petcoin || 0) + amount;
      state.claimableYield = 0;
      state.lastYieldTime = Date.now();
    } else if (action === "feed") {
      if (state.inventory.treat > 0) {
        state.inventory.treat -= 1;
        if (pet) {
          pet.hunger = Math.min(100, pet.hunger + 25);
          pet.status = "eat";
          gainXP(state, pet, 15);
        }
      } else {
        return res.status(400).json({ success: false, error: "No treats remaining" });
      }
    } else if (action === "pet") {
      if (!pet) return res.status(400).json({ success: false, error: "No active companion pet." });
      
      const PET_COOLDOWN_MS = 15 * 60 * 1000;
      const PET_DAILY_MAX = 10;
      const nowMs = Date.now();
      const todayStr = new Date().toDateString();

      if (pet.dailyPetDate !== todayStr) {
        pet.dailyPetCount = 0;
        pet.dailyPetDate = todayStr;
      }

      if ((pet.dailyPetCount || 0) >= PET_DAILY_MAX) {
        return res.status(400).json({ success: false, error: `${pet.name} has hit the daily petting limit! (10/day max) 🌙` });
      }
      const msSinceLastPet = nowMs - (pet.lastPetTime || 0);
      if (msSinceLastPet < PET_COOLDOWN_MS) {
        const remaining = Math.ceil((PET_COOLDOWN_MS - msSinceLastPet) / 60000);
        return res.status(400).json({ success: false, error: `${pet.name} needs ${remaining} more minute(s) to recover! ⏳` });
      }

      pet.lastPetTime = nowMs;
      pet.dailyPetCount = (pet.dailyPetCount || 0) + 1;
      pet.happiness = Math.min(100, pet.happiness + 20);
      pet.status = "happy";
      gainXP(state, pet, 10);
    } else if (action === "sleep") {
      if (pet) {
        pet.status = pet.status === "sleep" ? "idle" : "sleep";
      }
    } else if (action === "changePet") {
      const targetPetId = payload?.petId;
      if (state.pets[targetPetId]) {
        state.activePetId = targetPetId;
      } else {
        return res.status(400).json({ success: false, error: "Pet not found." });
      }
    } else if (action === "renamePet") {
      const newName = payload?.name;
      if (pet && newName) {
        pet.name = newName;
      }
    } else if (action === "changeSkin") {
      const newSkin = payload?.skin;
      if (pet && newSkin) {
        state.ownedSkins = state.ownedSkins || ["neon-cyan", "neon-gold", "neon-pink"];
        if (state.ownedSkins.includes(newSkin)) {
          pet.skin = newSkin;
        } else {
          return res.status(400).json({ success: false, error: "Skin not unlocked." });
        }
      }
    } else if (action === "buyItem") {
      const itemType = payload?.itemType;
      const costs = { treat: 20, toy: 30, battery: 50, mutagen: 200 };
      const cost = costs[itemType];
      if (!cost) {
        return res.status(400).json({ success: false, error: "Invalid item type" });
      }
      if ((state.petcoin || 0) >= cost) {
        state.petcoin -= cost;
        state.inventory[itemType] = (state.inventory[itemType] || 0) + 1;
      } else {
        return res.status(400).json({ success: false, error: "Insufficient $PETCOIN" });
      }
    } else if (action === "useItem") {
      const itemType = payload?.itemType;
      if (state.inventory[itemType] > 0) {
        state.inventory[itemType] -= 1;
        if (pet) {
          if (itemType === "treat") {
            pet.hunger = Math.min(100, pet.hunger + 25);
            pet.status = "eat";
            gainXP(state, pet, 15);
          } else if (itemType === "toy") {
            pet.happiness = Math.min(100, pet.happiness + 30);
            pet.status = "happy";
            gainXP(state, pet, 15);
          } else if (itemType === "battery") {
            pet.energy = Math.min(100, pet.energy + 40);
            gainXP(state, pet, 10);
          } else if (itemType === "mutagen") {
            const stats = ["strength", "agility", "intelligence"];
            const chosen = stats[Math.floor(Math.random() * stats.length)];
            const added = Math.floor(Math.random() * 3) + 1;
            pet[chosen] = (pet[chosen] || 10) + added;
            gainXP(state, pet, 25);
            pet.status = "happy";
          }
        }
      } else {
        return res.status(400).json({ success: false, error: "Item not in inventory" });
      }
    } else if (action === "allocateStat") {
      const statName = payload?.statName;
      if (pet && pet.availableStatPoints > 0) {
        pet.availableStatPoints -= 1;
        pet[statName] = (pet[statName] || 10) + 1;
      } else {
        return res.status(400).json({ success: false, error: "No available stat points" });
      }
    } else if (action === "startFocus") {
      const duration = payload?.duration;
      if (!duration || duration < 1 || duration > 120) {
        return res.status(400).json({ success: false, error: "Invalid focus duration (1-120 min)" });
      }

      // Daily focus cap: 180 minutes per day
      const DAILY_FOCUS_CAP_MINUTES = 180;
      const todayStr = new Date().toDateString();
      if (!state.dailyFocusMinutes || state.dailyFocusDate !== todayStr) {
        state.dailyFocusMinutes = 0;
        state.dailyFocusDate = todayStr;
      }
      if (state.dailyFocusMinutes + duration > DAILY_FOCUS_CAP_MINUTES) {
        const remaining = DAILY_FOCUS_CAP_MINUTES - state.dailyFocusMinutes;
        return res.status(400).json({ success: false, error: `Daily focus cap reached! Only ${remaining} min remaining today. 🌙` });
      }

      state.focusSession = {
        active: true,
        startTime: Date.now(),
        duration: duration,
        endTime: Date.now() + duration * 60 * 1000,
        lastActivityTime: Date.now(),
        lastHeartbeat: Date.now(),
        isPaused: false
      };
    } else if (action === "focusHeartbeat") {
      // Client must send this every 2 minutes during active focus
      if (state.focusSession && state.focusSession.active) {
        state.focusSession.lastHeartbeat = Date.now();
        state.focusSession.lastActivityTime = Date.now();
        if (state.focusSession.isPaused) {
          state.focusSession.isPaused = false;
        }
      }
    } else if (action === "stopFocus") {
      if (state.focusSession) {
        state.focusSession.active = false;
        state.focusSession.isPaused = false;
      }
    } else if (action === "completeFocus") {
      if (state.focusSession && state.focusSession.active) {
        const elapsedMinsActual = (Date.now() - state.focusSession.startTime) / 60000;
        if (elapsedMinsActual < state.focusSession.duration - 0.1) {
          return res.status(400).json({ success: false, error: "Focus session completed too quickly!" });
        }

        // Heartbeat validation: reject if no heartbeat in last 5 minutes
        const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;
        if (state.focusSession.lastHeartbeat && (Date.now() - state.focusSession.lastHeartbeat) > HEARTBEAT_TIMEOUT_MS) {
          state.focusSession.active = false;
          state.focusSession.isPaused = false;
          return res.status(400).json({ success: false, error: "Focus session expired due to inactivity. No heartbeat received." });
        }
        
        state.focusSession.active = false;
        state.focusSession.isPaused = false;

        // Track daily focus usage
        const todayStr = new Date().toDateString();
        if (!state.dailyFocusMinutes || state.dailyFocusDate !== todayStr) {
          state.dailyFocusMinutes = 0;
          state.dailyFocusDate = todayStr;
        }
        state.dailyFocusMinutes += state.focusSession.duration;
        
        const mult = pet ? getRarityMultiplier(pet.rarity) : 1.0;
        const reward = Math.round(state.focusSession.duration * 20 * mult);
        state.petcoin = (state.petcoin || 0) + reward;
        if (pet) {
          pet.status = "happy";
          gainXP(state, pet, state.focusSession.duration * 2);
        }
      } else {
        return res.status(400).json({ success: false, error: "No active focus session to complete" });
      }
    } else if (action === "startStaking") {
      const targetPetId = payload?.petId;
      const expeditionType = payload?.expeditionType;
      const durationHours = payload?.durationHours;

      const targetPet = state.pets[targetPetId];
      if (!targetPet) return res.status(400).json({ success: false, error: "Pet not found" });
      if (targetPet.staked) return res.status(400).json({ success: false, error: "Pet already staked" });
      if (state.activePetId === targetPetId) return res.status(400).json({ success: false, error: "Cannot stake active companion" });

      if (durationHours >= 8) {
        const rarityOk = ["Epic", "Legendary", "Treasury"].includes(targetPet.rarity || "Common");
        if ((targetPet.level || 1) < 30 && !rarityOk) {
          return res.status(400).json({ success: false, error: "8h Deep Raid requires Level 30+ or Epic/Legendary rarity!" });
        }
      }

      let stakedCount = 0;
      for (const pId in state.pets) {
        if (state.pets[pId].staked) stakedCount++;
      }
      if (stakedCount >= (state.stakingSlotsLimit || 1)) {
        return res.status(400).json({ success: false, error: "No available staking slots. Upgrade your stable!" });
      }

      // Charge entrant fee based on global configuration
      const config = await getStakingConfig();
      const fees = { 2: config.fee_2h || 0, 4: config.fee_4h || 20, 8: config.fee_8h || 50 };
      const fee = fees[durationHours] || 0;
      if ((state.petcoin || 0) < fee) {
        return res.status(400).json({ success: false, error: `Insufficient $PETCOIN. Entrant fee is ${fee} $PETCOIN.` });
      }
      state.petcoin -= fee;

      const baseDuration = durationHours * 3600 * 1000;
      const agility = targetPet.agility || 10;
      const reduction = Math.min(0.5, agility * 0.005);
      const actualDuration = baseDuration * (1 - reduction);

      targetPet.staked = true;
      targetPet.status = "sleep";
      targetPet.stakingSession = {
        type: expeditionType,
        startedAt: Date.now(),
        duration: actualDuration,
        hours: durationHours,
        completed: false
      };
    } else if (action === "claimStakingReward") {
      const targetPetId = payload?.petId;
      const targetPet = state.pets[targetPetId];
      if (!targetPet || !targetPet.staked || !targetPet.stakingSession) {
        return res.status(400).json({ success: false, error: "Pet is not staked" });
      }

      const session = targetPet.stakingSession;
      const elapsed = Date.now() - session.startedAt;
      if (elapsed < session.duration && !session.completed) {
        return res.status(400).json({ success: false, error: "Expedition still in progress" });
      }

      const raidHours = session.hours || 2;
      let rewardMsg = "";
      
      // Expedition Obstacle RNG check (based on Strength attribute)
      const strength = targetPet.strength || 10;
      const successChance = Math.min(0.95, 0.80 + strength * 0.003);
      const isSuccess = Math.random() < successChance;

      if (!isSuccess) {
        const xpGained = Math.round((raidHours * 30) * 0.2); // 20% XP for effort
        gainXP(state, targetPet, xpGained);
        rewardMsg = `⚠️ Expedition Failed! ${targetPet.name} encountered wild obstacles, returned safely with ${xpGained} XP but 0 resources.`;
      } else {
        if (session.type === "cpu") {
          const reward = raidHours * 50 * (1 + (targetPet.intelligence || 10) * 0.02);
          state.petcoin = (state.petcoin || 0) + reward;
          rewardMsg = `⚡ CPU Mining done! Earned ${Math.floor(reward)} $PETCOIN.`;
        } else if (session.type === "ram") {
          const rolls = Math.max(1, Math.floor(raidHours / 2));
          let foundItems = { treat: 0, toy: 0, battery: 0 };
          const successChanceRoll = Math.min(0.95, 0.5 + (targetPet.strength || 10) * 0.01);
          for (let i = 0; i < rolls; i++) {
            if (Math.random() < successChanceRoll) {
              const pool = ["treat", "toy", "battery"];
              const rolled = pool[Math.floor(Math.random() * pool.length)];
              foundItems[rolled]++;
              state.inventory[rolled] = (state.inventory[rolled] || 0) + 1;
            }
          }
          rewardMsg = `🗄️ RAM Salvage done! Found: ${foundItems.treat} treats, ${foundItems.toy} toys, ${foundItems.battery} batteries.`;
        } else if (session.type === "net") {
          const xpGained = raidHours * 30;
          gainXP(state, targetPet, xpGained);
          let mutagenFound = false;
          if (Math.random() < 0.5) {
            state.inventory.mutagen = (state.inventory.mutagen || 0) + 1;
            mutagenFound = true;
          }
          rewardMsg = `🌐 Network Scan done! Gained ${xpGained} XP.` + (mutagenFound ? " 🧬 Found 1 Neon Mutagen!" : "");
        }

        if (targetPet.level >= 60) {
          const gear = generateRandomGear();
          if (gear) {
            if (!state.gearInventory) state.gearInventory = [];
            gear.earnedByPetId = targetPetId;
            state.gearInventory.push(gear);
            const rarityEmoji = { Common: "⚪", Blue: "🔵", Epic: "🟣", Legendary: "🟡" }[gear.rarity] || "";
            rewardMsg += ` ${rarityEmoji} Rare Gear Drop: [${gear.rarity.toUpperCase()}] ${gear.name}!`;
          }
        }
      }

      targetPet.staked = false;
      targetPet.stakingSession = null;
      payload.rewardMsg = rewardMsg; 
    } else if (action === "buyExtraStakingSlot") {
      const hasMaxLevelPet = Object.values(state.pets || {}).some(p => (p.level || 1) >= MAX_PET_LEVEL);
      if (!hasMaxLevelPet) {
        return res.status(400).json({ success: false, error: "You need at least one Level 60 pet to unlock additional staking slots! 🔒" });
      }
      if ((state.stakingSlotsLimit || 1) >= 5) {
        return res.status(400).json({ success: false, error: "Maximum staking slots reached! (5/5)" });
      }

      const nextSlot = (state.stakingSlotsLimit || 1) + 1;
      const petcoinCosts = [0, 0, 10000, 25000, 50000, 100000];
      const deskCosts = [0, 0, 0, 300, 500, 1000];

      const petcoinCost = petcoinCosts[nextSlot];
      const deskCost = deskCosts[nextSlot];

      if ((state.petcoin || 0) < petcoinCost) {
        return res.status(400).json({ success: false, error: `Insufficient $PETCOIN. Cost: ${petcoinCost}` });
      }

      if (deskCost > 0) {
        const { txSignature, playerWallet } = payload;
        if (!txSignature || !playerWallet) {
          return res.status(400).json({ success: false, error: `This slot unlock requires ${deskCost} $DESK. Please sign the transaction.` });
        }

        const { data: existingTx } = await supabaseAdmin
          .from('processed_transactions')
          .select('signature')
          .eq('signature', txSignature)
          .maybeSingle();

        if (existingTx) {
          return res.status(400).json({ success: false, error: "Transaction already processed." });
        }

        await verifyDeskTransfer(txSignature, deskCost, playerWallet);

        await supabaseAdmin.from('processed_transactions').insert({
          signature: txSignature,
          user_id: userId
        });
      }

      state.petcoin -= petcoinCost;
      state.stakingSlotsLimit = nextSlot;
    } else if (action === "buyCosmeticSkin") {
      const skinName = payload?.skinName;
      const cost = 5000;
      if ((state.petcoin || 0) < cost) {
        return res.status(400).json({ success: false, error: "Insufficient $PETCOIN. Cost: 5,000" });
      }
      state.ownedSkins = state.ownedSkins || ["neon-cyan", "neon-gold", "neon-pink"];
      if (state.ownedSkins.includes(skinName)) {
        return res.status(400).json({ success: false, error: "Skin already unlocked!" });
      }
      state.petcoin -= cost;
      state.ownedSkins.push(skinName);
    // NOTE: upgradeRarity action was removed in Phase 7 (Launch Readiness).
    // Rarity is determined exclusively by the server-side roll at purchase time.
    } else if (action === "ascendStage") {
      const targetPetId = payload?.petId;
      const targetPet = state.pets[targetPetId];
      if (!targetPet) return res.status(400).json({ success: false, error: "Pet not found" });

      const currentStage = targetPet.stage || "Baby";
      if (currentStage === "Baby") {
        if (targetPet.level < 10) return res.status(400).json({ success: false, error: "Requires Level 10 to evolve to Teen" });
        const cost = 1500;
        if ((state.petcoin || 0) < cost) return res.status(400).json({ success: false, error: "Insufficient $PETCOIN. Cost: 1,500" });
        state.petcoin -= cost;
        targetPet.stage = "Teen";
      } else if (currentStage === "Teen") {
        if (targetPet.level < 30) return res.status(400).json({ success: false, error: "Requires Level 30 to evolve to Adult" });
        const cost = 100000;
        if ((state.petcoin || 0) < cost) return res.status(400).json({ success: false, error: "Insufficient $PETCOIN. Cost: 100,000" });
        state.petcoin -= cost;
        targetPet.stage = "Adult";
      } else if (currentStage === "Adult") {
        if (targetPet.level < 60) return res.status(400).json({ success: false, error: "Requires Level 60 to evolve to Legendary" });
        const cost = 100000;
        if ((state.petcoin || 0) < cost) return res.status(400).json({ success: false, error: "Insufficient $PETCOIN. Cost: 100,000" });
        if ((state.inventory.mutagen || 0) < 1) return res.status(400).json({ success: false, error: "Requires 1 Neon Mutagen in inventory" });
        state.petcoin -= cost;
        state.inventory.mutagen -= 1;
        targetPet.stage = "Legendary";
      } else {
        return res.status(400).json({ success: false, error: "Pet is already at maximum Legendary stage!" });
      }
    } else if (action === "resetAttributes") {
      const targetPetId = payload?.petId;
      const targetPet = state.pets[targetPetId];
      if (!targetPet) return res.status(400).json({ success: false, error: "Pet not found" });

      const cost = 10000;
      if ((state.petcoin || 0) < cost) {
        return res.status(400).json({ success: false, error: "Insufficient $PETCOIN. Cost: 10,000" });
      }

      // Resolve species from pet.species field, falling back to ID prefix parsing
      const species = targetPet.species || (targetPet.id.includes("dog") ? "astro-dog" : (targetPet.id.includes("bunny") ? "cyber-bunny" : "sol-cat"));
      const speciesBaseStats = BASE_STATS[species] || { strength: 10, agility: 10, intelligence: 10, stamina: 10 };
      const baseStr = speciesBaseStats.strength;
      const baseAgi = speciesBaseStats.agility;
      const baseInt = speciesBaseStats.intelligence;

      const currentStr = targetPet.strength || baseStr;
      const currentAgi = targetPet.agility || baseAgi;
      const currentInt = targetPet.intelligence || baseInt;

      const pointsSpent = (currentStr - baseStr) + (currentAgi - baseAgi) + (currentInt - baseInt);
      if (pointsSpent <= 0) {
        return res.status(400).json({ success: false, error: "No stat points spent to reset" });
      }

      state.petcoin -= cost;
      targetPet.strength = baseStr;
      targetPet.agility = baseAgi;
      targetPet.intelligence = baseInt;
      targetPet.availableStatPoints = (targetPet.availableStatPoints || 0) + pointsSpent;
    } else if (action === "deletePet") {
      const targetPetId = payload?.petId;
      if (targetPetId && state.pets[targetPetId]) {
        if (state.activePetId === targetPetId) {
          return res.status(400).json({ success: false, error: "Cannot delete the active companion pet!" });
        }
        delete state.pets[targetPetId];
      } else {
        return res.status(400).json({ success: false, error: "Pet not found" });
      }
    } else if (action === "equipGear") {
      const { gearId, petId } = payload;
      const targetPet = state.pets[petId];
      if (!targetPet) return res.status(400).json({ success: false, error: "Pet not found" });
      if (!state.gearInventory) state.gearInventory = [];
      const gearIndex = state.gearInventory.findIndex(g => g.id === gearId);
      if (gearIndex === -1) return res.status(400).json({ success: false, error: "Gear not found in inventory" });

      const gear = state.gearInventory[gearIndex];
      const slot = gear.slot || gear.type;

      targetPet.equipment = targetPet.equipment || { weapon: null, head: null, clothes: null, aiChip: null };
      const currentlyEquipped = targetPet.equipment[slot];

      if (currentlyEquipped) {
        state.gearInventory.push(currentlyEquipped);
      }

      targetPet.equipment[slot] = gear;
      state.gearInventory.splice(gearIndex, 1);
    } else if (action === "unequipGear") {
      const { slot, petId } = payload;
      const targetPet = state.pets[petId];
      if (!targetPet) return res.status(400).json({ success: false, error: "Pet not found" });
      
      targetPet.equipment = targetPet.equipment || { weapon: null, head: null, clothes: null, aiChip: null };
      const gear = targetPet.equipment[slot];
      if (gear) {
        state.gearInventory = state.gearInventory || [];
        state.gearInventory.push(gear);
        targetPet.equipment[slot] = null;
      } else {
        return res.status(400).json({ success: false, error: "No gear equipped in this slot" });
      }
    } else if (action === "sync") {
      // no-op, decays already applied
    }

    await supabaseAdmin.from('pet_state').upsert({
      user_id: userId,
      state_data: state,
      updated_at: new Date().toISOString()
    });

    res.json({
      success: true,
      state: state,
      payload: payload
    });
  } catch (err) {
    console.error("Sync action error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🧬 CYBERPET BREEDING ENGINE (SECURED)
// ==========================================
const PET_MUTATION_SKINS = ["neon-purple", "neon-matrix", "neon-rainbow"];
const BASE_STATS = {
  "sol-cat": { strength: 10, agility: 10, intelligence: 10, stamina: 10 },
  "astro-dog": { strength: 12, agility: 8, intelligence: 10, stamina: 10 },
  "cyber-bunny": { strength: 8, agility: 12, intelligence: 10, stamina: 10 }
};

app.post('/api/breed', authenticateUser, async (req, res) => {
  const { parentAId, parentBId, playerWallet, txSignature } = req.body;

  if (!parentAId || !parentBId || !playerWallet || !txSignature) {
    return res.status(400).json({ success: false, error: "parentAId, parentBId, playerWallet, and txSignature are required." });
  }

  try {
    const userId = req.userId;

    const { data: existingTx } = await supabaseAdmin
      .from('processed_transactions')
      .select('signature')
      .eq('signature', txSignature)
      .maybeSingle();

    if (existingTx) {
      return res.status(400).json({ success: false, error: "Transaction already processed." });
    }

    // Verify 5,000 $DESK breeding tax on-chain
    await verifyDeskTransfer(txSignature, 5000, playerWallet);

    // Burn 30% of breeding tax on-chain (70% recycled to staking rewards)
    await burnDistributorDesk(5000 * 0.3);

    const { data: petRow } = await supabaseAdmin
      .from('pet_state')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!petRow || !petRow.state_data) {
      return res.status(400).json({ success: false, error: "User state not found." });
    }

    const state = petRow.state_data;
    const parentA = state.pets[parentAId];
    const parentB = state.pets[parentBId];

    if (!parentA || !parentB) {
      return res.status(400).json({ success: false, error: "Parents not found in stable." });
    }

    if (parentA.level < 60 || parentB.level < 60) {
      return res.status(400).json({ success: false, error: "Both parents must be Level 60 to breed." });
    }

    if ((state.petcoin || 0) < 100000) {
      return res.status(400).json({ success: false, error: "Insufficient balance. Breeding requires 100,000 $PETCOIN." });
    }

    let babySkin = parentA.skin;
    const mutateRoll = Math.random();
    if (mutateRoll < 0.15) {
      babySkin = PET_MUTATION_SKINS[Math.floor(Math.random() * PET_MUTATION_SKINS.length)];
    } else {
      babySkin = Math.random() > 0.5 ? parentA.skin : parentB.skin;
    }

    const strength = Math.floor((parentA.strength + parentB.strength) / 2) + Math.floor(Math.random() * 5) + 1;
    const agility = Math.floor((parentA.agility + parentB.agility) / 2) + Math.floor(Math.random() * 5) + 1;
    const intelligence = Math.floor((parentA.intelligence + parentB.intelligence) / 2) + Math.floor(Math.random() * 5) + 1;
    const stamina = Math.floor((parentA.stamina + parentB.stamina) / 2) + Math.floor(Math.random() * 5) + 1;

    const parentType = parentA.species || (parentA.id.includes("cat") ? "sol-cat" : (parentA.id.includes("dog") ? "astro-dog" : "cyber-bunny"));
    const babyName = `Baby-${parentA.name.split(' ')[0]}`;

    let rarity = "Common";
    const rarityRoll = Math.random();
    if (rarityRoll < 0.60) rarity = "Common";
    else if (rarityRoll < 0.85) rarity = "Rare";
    else if (rarityRoll < 0.97) rarity = "Epic";
    else rarity = "Legendary";

    const babyId = `baby-${crypto.randomBytes(4).toString('hex')}`;
    const babyPet = {
      id: babyId,
      name: babyName,
      species: parentType,
      level: 1,
      xp: 0,
      xpNeeded: parentType === "sol-cat" ? 100 : (parentType === "astro-dog" ? 120 : 90),
      baseXpNeeded: parentType === "sol-cat" ? 100 : (parentType === "astro-dog" ? 120 : 90),
      stage: "Baby",
      hunger: 100,
      happiness: 100,
      energy: 100,
      status: "idle",
      strength,
      agility,
      intelligence,
      stamina,
      availableStatPoints: 0,
      equipment: { weapon: null, head: null, clothes: null, aiChip: null },
      lastPetTime: 0,
      dailyPetCount: 0,
      dailyPetDate: "",
      minted: false,
      mintAddress: null,
      skin: babySkin,
      staked: false,
      stakingSession: null,
      rarity: rarity
    };

    state.petcoin -= 100000;
    state.pets[babyId] = babyPet;

    // High stakes RNG burn of a premium parent if both parents are minted
    let burnedParentName = null;
    if (parentA.minted && parentB.minted) {
      const burnA = Math.random() > 0.5;
      const burnId = burnA ? parentAId : parentBId;
      burnedParentName = state.pets[burnId].name;
      delete state.pets[burnId];
      console.log(`[Breeding] High Stakes Burn selected parent: ${burnedParentName} (${burnId})`);
    }

    await supabaseAdmin.from('pet_state').upsert({
      user_id: userId,
      state_data: state,
      updated_at: new Date().toISOString()
    });

    await supabaseAdmin.from('processed_transactions').insert({
      signature: txSignature,
      user_id: userId
    });

    res.json({
      success: true,
      babyPet,
      burnedParentName,
      state: state
    });
  } catch (err) {
    console.error("Breeding error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ⚔️ REAL-TIME MULTIPLAYER LOBBY & ARENA
// ==========================================
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Connected lobby players list
const lobbyPlayers = new Map(); // key: walletAddress, value: { socket, walletAddress, username, activePet, status }

function broadcastLobbyState() {
  const playersList = Array.from(lobbyPlayers.values()).map(p => ({
    walletAddress: p.walletAddress,
    username: p.username,
    activePet: p.activePet,
    status: p.status
  }));

  const msg = JSON.stringify({
    type: "lobby_update",
    players: playersList
  });

  lobbyPlayers.forEach(p => {
    if (p.socket.readyState === 1) {
      p.socket.send(msg);
    }
  });
}

function sendToPlayer(walletAddress, data) {
  const player = lobbyPlayers.get(walletAddress);
  if (player && player.socket.readyState === 1) {
    player.socket.send(JSON.stringify(data));
  }
}

// Battle simulation math engine
function simulatePvPBattle(playerA, playerB) {
  const petA = { ...playerA.activePet, ownerName: playerA.username, ownerWallet: playerA.walletAddress };
  const petB = { ...playerB.activePet, ownerName: playerB.username, ownerWallet: playerB.walletAddress };

  // Helper to add gear bonus stats
  const getFullStat = (pet, statName) => {
    let base = pet[statName] || 10;
    if (pet.equipment) {
      Object.values(pet.equipment).forEach(item => {
        if (item && item.stats && item.stats[statName]) {
          base += item.stats[statName];
        }
      });
    }
    return base;
  };

  // Compute absolute combat specs
  const combatA = {
    name: petA.name,
    ownerName: petA.ownerName,
    hp: getFullStat(petA, "stamina") * 15 + 100,
    maxHp: getFullStat(petA, "stamina") * 15 + 100,
    strength: getFullStat(petA, "strength"),
    agility: getFullStat(petA, "agility"),
    intelligence: getFullStat(petA, "intelligence"),
    type: (petA.species || petA.id).includes("cat") ? "cat" : ((petA.species || petA.id).includes("dog") ? "dog" : "bunny")
  };

  const combatB = {
    name: petB.name,
    ownerName: petB.ownerName,
    hp: getFullStat(petB, "stamina") * 15 + 100,
    maxHp: getFullStat(petB, "stamina") * 15 + 100,
    strength: getFullStat(petB, "strength"),
    agility: getFullStat(petB, "agility"),
    intelligence: getFullStat(petB, "intelligence"),
    type: (petB.species || petB.id).includes("cat") ? "cat" : ((petB.species || petB.id).includes("dog") ? "dog" : "bunny")
  };

  // Evasion Cap: 30%, Crit Cap: 40%, Skill Chance Cap: 45%
  const getEvasion = (agi) => Math.min(0.30, agi / (agi + 150));
  const getCritChance = (agi) => Math.min(0.40, agi / (agi + 200));
  const getSkillChance = (intVal) => Math.min(0.45, 0.15 + (intVal / (intVal + 120)) * 0.30);

  const logs = [];
  let turn = 0;
  let stunA = 0;
  let stunB = 0;

  logs.push({
    type: "start",
    petA: { name: combatA.name, owner: combatA.ownerName, hp: combatA.hp },
    petB: { name: combatB.name, owner: combatB.ownerName, hp: combatB.hp }
  });

  while (combatA.hp > 0 && combatB.hp > 0 && turn < 50) {
    turn++;

    // Determine speed and turn order
    const speedA = combatA.agility + Math.floor(Math.random() * 5);
    const speedB = combatB.agility + Math.floor(Math.random() * 5);

    const roundQueue = speedA >= speedB ? [combatA, combatB] : [combatB, combatA];

    for (let i = 0; i < roundQueue.length; i++) {
      const attacker = roundQueue[i];
      const defender = attacker === combatA ? combatB : combatA;

      if (attacker.hp <= 0 || defender.hp <= 0) continue;

      // Check stun
      if (attacker === combatA && stunA > 0) {
        stunA--;
        logs.push({
          type: "action",
          turn,
          attacker: attacker.name,
          message: `${attacker.name} is stunned and skips their action!`,
          hpA: combatA.hp,
          hpB: combatB.hp
        });
        continue;
      }
      if (attacker === combatB && stunB > 0) {
        stunB--;
        logs.push({
          type: "action",
          turn,
          attacker: attacker.name,
          message: `${attacker.name} is stunned and skips their action!`,
          hpA: combatA.hp,
          hpB: combatB.hp
        });
        continue;
      }

      // Check for skill triggers
      const skillChance = getSkillChance(attacker.intelligence);
      const skillRoll = Math.random();
      let damage = 0;
      let actionText = "";
      let isDodge = false;
      let isCrit = false;

      // Roll evasion
      const dodgeChance = getEvasion(defender.agility);
      if (Math.random() < dodgeChance) {
        isDodge = true;
      }

      if (skillRoll < skillChance) {
        // Skill triggered (Skills cannot be dodged!)
        isDodge = false;
        const spellPower = attacker.intelligence * 3;

        if (attacker.type === "cat") {
          damage = Math.floor(spellPower * 1.3);
          actionText = `casts 🔥 FIREBALL! A blazing wave engulfs ${defender.name}`;
        } else if (attacker.type === "dog") {
          damage = Math.floor(spellPower * 0.9);
          actionText = `howls a 🌀 SONIC BLAST! ${defender.name} is shocked and stunned for 1 turn`;
          if (defender === combatA) stunA = 1;
          else stunB = 1;
        } else if (attacker.type === "bunny") {
          // Bunny heals self and deals light hit
          const heal = Math.floor(spellPower * 1.1);
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
          damage = Math.floor(spellPower * 0.6);
          actionText = `activates 💚 REJUVENATE! Heals for ${heal} HP and zaps ${defender.name}`;
        } else {
          damage = Math.floor(spellPower * 1.5);
          actionText = `executes a ⚡ CHIP OVERCLOCK!`;
        }
      } else {
        // Basic Attack (can be dodged, can crit)
        if (isDodge) {
          actionText = `lunges at ${defender.name} but they 💨 EVADED the strike`;
          damage = 0;
        } else {
          const baseDamage = attacker.strength * 2.5;
          const variance = (Math.random() * 0.2 - 0.1) * baseDamage; // +/- 10%
          damage = Math.floor(baseDamage + variance);

          const critChance = getCritChance(attacker.agility);
          if (Math.random() < critChance) {
            isCrit = true;
            damage = Math.floor(damage * 1.75);
            actionText = `strikes ${defender.name} with a heavy CRITICAL hit! 💥`;
          } else {
            actionText = `bites ${defender.name} ⚔️`;
          }
        }
      }

      if (damage > 0) {
        defender.hp = Math.max(0, defender.hp - damage);
      }

      logs.push({
        type: "action",
        turn,
        attacker: attacker.name,
        message: `${attacker.name} ${actionText}! (${damage > 0 ? `${damage} dmg` : 'No damage'})`,
        isCrit,
        isDodge,
        hpA: combatA.hp,
        hpB: combatB.hp
      });
    }
  }

  const winnerName = combatA.hp > 0 ? combatA.name : combatB.name;
  const winnerWallet = combatA.hp > 0 ? petA.ownerWallet : petB.ownerWallet;

  logs.push({
    type: "end",
    winner: winnerName,
    winnerWallet: winnerWallet
  });

  return { logs, winnerWallet };
}

// Handle WebSocket connection routing
wss.on('connection', (ws) => {
  let playerWallet = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "init":
          playerWallet = data.walletAddress;
          lobbyPlayers.set(playerWallet, {
            socket: ws,
            walletAddress: playerWallet,
            username: data.username || "Guest Finder",
            activePet: data.activePet,
            status: "idle"
          });
          broadcastLobbyState();
          break;

        case "chat":
          if (playerWallet) {
            const sender = lobbyPlayers.get(playerWallet);
            const chatMsg = JSON.stringify({
              type: "chat_broadcast",
              sender: sender.username,
              wallet: playerWallet,
              text: data.text
            });
            lobbyPlayers.forEach(p => {
              if (p.socket.readyState === 1) p.socket.send(chatMsg);
            });
          }
          break;

        case "challenge":
          if (playerWallet) {
            const challenger = lobbyPlayers.get(playerWallet);
            const target = lobbyPlayers.get(data.targetWallet);
            if (target && target.status === "idle") {
              challenger.status = "busy";
              target.status = "busy";
              sendToPlayer(data.targetWallet, {
                type: "challenge_received",
                challengerName: challenger.username,
                challengerWallet: playerWallet,
                challengerPet: challenger.activePet
              });
              broadcastLobbyState();
            }
          }
          break;

        case "challenge_respond":
          if (playerWallet) {
            const responder = lobbyPlayers.get(playerWallet);
            const challenger = lobbyPlayers.get(data.challengerWallet);

            if (data.accepted && challenger) {
              responder.status = "battle";
              challenger.status = "battle";
              broadcastLobbyState();

              // Run Battle authoritative simulation
              const result = simulatePvPBattle(challenger, responder);

              const battleStartMsg = {
                type: "battle_start",
                opponent: {
                  walletAddress: responder.walletAddress,
                  username: responder.username,
                  activePet: responder.activePet
                },
                logs: result.logs,
                winnerWallet: result.winnerWallet
              };

              const battleStartMsgForResponder = {
                type: "battle_start",
                opponent: {
                  walletAddress: challenger.walletAddress,
                  username: challenger.username,
                  activePet: challenger.activePet
                },
                logs: result.logs,
                winnerWallet: result.winnerWallet
              };

              sendToPlayer(challenger.walletAddress, battleStartMsg);
              sendToPlayer(responder.walletAddress, battleStartMsgForResponder);

              // Set back to idle after 10 seconds of mock animation completion
              setTimeout(() => {
                if (lobbyPlayers.has(challenger.walletAddress)) {
                  lobbyPlayers.get(challenger.walletAddress).status = "idle";
                }
                if (lobbyPlayers.has(responder.walletAddress)) {
                  lobbyPlayers.get(responder.walletAddress).status = "idle";
                }
                broadcastLobbyState();
              }, 12000);

            } else {
              // Denied or Challenger disconnected
              if (challenger) challenger.status = "idle";
              responder.status = "idle";
              sendToPlayer(data.challengerWallet, {
                type: "challenge_declined",
                responderName: responder.username
              });
              broadcastLobbyState();
            }
          }
          break;

        case "join_queue":
          if (playerWallet) {
            const queuePlayer = lobbyPlayers.get(playerWallet);
            queuePlayer.status = "queue";
            broadcastLobbyState();

            // Look for another queue player
            let matchOpponent = null;
            for (const p of lobbyPlayers.values()) {
              if (p.walletAddress !== playerWallet && p.status === "queue") {
                matchOpponent = p;
                break;
              }
            }

            if (matchOpponent) {
              // Trigger battle
              queuePlayer.status = "battle";
              matchOpponent.status = "battle";
              broadcastLobbyState();

              const result = simulatePvPBattle(queuePlayer, matchOpponent);

              const battleStartMsgA = {
                type: "battle_start",
                opponent: {
                  walletAddress: matchOpponent.walletAddress,
                  username: matchOpponent.username,
                  activePet: matchOpponent.activePet
                },
                logs: result.logs,
                winnerWallet: result.winnerWallet
              };

              const battleStartMsgB = {
                type: "battle_start",
                opponent: {
                  walletAddress: queuePlayer.walletAddress,
                  username: queuePlayer.username,
                  activePet: queuePlayer.activePet
                },
                logs: result.logs,
                winnerWallet: result.winnerWallet
              };

              sendToPlayer(queuePlayer.walletAddress, battleStartMsgA);
              sendToPlayer(matchOpponent.walletAddress, battleStartMsgB);

              setTimeout(() => {
                if (lobbyPlayers.has(queuePlayer.walletAddress)) {
                  lobbyPlayers.get(queuePlayer.walletAddress).status = "idle";
                }
                if (lobbyPlayers.has(matchOpponent.walletAddress)) {
                  lobbyPlayers.get(matchOpponent.walletAddress).status = "idle";
                }
                broadcastLobbyState();
              }, 12000);
            }
          }
          break;

        case "leave_queue":
          if (playerWallet) {
            const qPlayer = lobbyPlayers.get(playerWallet);
            if (qPlayer.status === "queue") {
              qPlayer.status = "idle";
              broadcastLobbyState();
            }
          }
          break;
      }
    } catch (e) {
      console.error("Lobby message error", e);
    }
  });

  ws.on('close', () => {
    if (playerWallet) {
      lobbyPlayers.delete(playerWallet);
      broadcastLobbyState();
    }
  });
});

// ==========================================
// 💎 PREMIUM STAKING REWARDS CLAIM ENDPOINT
// ==========================================
app.post('/api/staking/claim-premium', authenticateUser, async (req, res) => {
  const { petId } = req.body;
  const userId = req.userId;
  if (!petId) {
    return res.status(400).json({ success: false, error: "petId is required" });
  }
  try {
    const { data: petRow } = await supabaseAdmin
      .from('pet_state')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (!petRow || !petRow.state_data) {
      return res.status(400).json({ success: false, error: "User state not found." });
    }

    const state = petRow.state_data;
    const pet = state.pets[petId];
    if (!pet) return res.status(400).json({ success: false, error: "Pet not found." });
    if (!pet.staked || !pet.stakingSession) {
      return res.status(400).json({ success: false, error: "Pet is not staked." });
    }
    if (!pet.minted || !state.solanaWalletPubkey) {
      return res.status(400).json({ success: false, error: "Pet must be minted and wallet connected to claim premium rewards." });
    }

    const session = pet.stakingSession;
    const elapsed = Date.now() - session.startedAt;
    if (elapsed < session.duration && !session.completed) {
      return res.status(400).json({ success: false, error: "Expedition still in progress." });
    }

    const raidHours = session.hours || 2;
    const baseRewards = { 2: 10, 4: 25, 8: 60 };
    let rewardAmount = baseRewards[raidHours] || 10;

    // Dynamic Halving based on distributor wallet balance
    let distributorBalance = 0;
    try {
      const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
      const deskMintPublicKey = new solanaWeb3.PublicKey(DESK_MINT);
      const distributorPublicKey = distributorKeypair.publicKey;

      const distributorDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
        [distributorPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
        associateProgramId
      ))[0];

      const rawBal = await connection.getTokenAccountBalance(distributorDeskAta);
      distributorBalance = parseFloat(rawBal.value.uiAmountString || "0");
    } catch (e) {
      console.error("Failed to fetch distributor token balance for halving logic:", e.message);
    }

    // Dynamic Halving (50% capacity = 15M, 25% capacity = 7.5M)
    if (distributorBalance < 7500000) {
      rewardAmount = Math.round(rewardAmount * 0.5);
      console.log(`[Halving] Distributor balance low (${distributorBalance}). Halving reward to ${rewardAmount}`);
    } else if (distributorBalance < 15000000) {
      rewardAmount = Math.round(rewardAmount * 0.75);
      console.log(`[Halving] Distributor balance medium (${distributorBalance}). Reducing reward by 25% to ${rewardAmount}`);
    }

    // Daily Limit of 150 $DESK per wallet
    const todayStr = new Date().toDateString();
    if (!state.dailyDeskClaimed || state.dailyDeskClaimed.date !== todayStr) {
      state.dailyDeskClaimed = { date: todayStr, amount: 0 };
    }

    if (state.dailyDeskClaimed.amount >= 150) {
      return res.status(400).json({ success: false, error: "Daily wallet reward cap of 150 $DESK reached! 🌙" });
    }

    if (state.dailyDeskClaimed.amount + rewardAmount > 150) {
      rewardAmount = 150 - state.dailyDeskClaimed.amount;
    }

    // Execute on-chain transfer
    console.log(`[ClaimPremiumStaking] Paying out ${rewardAmount} $DESK to player wallet ${state.solanaWalletPubkey}...`);
    const txSignature = await transferDeskFromDistributor(state.solanaWalletPubkey, rewardAmount);

    // Save state
    state.dailyDeskClaimed.amount += rewardAmount;
    pet.staked = false;
    pet.stakingSession = null;

    await supabaseAdmin.from('pet_state').upsert({
      user_id: userId,
      state_data: state,
      updated_at: new Date().toISOString()
    });

    res.json({
      success: true,
      rewardAmount,
      txSignature,
      state
    });
  } catch (err) {
    console.error("Staking claim-premium endpoint error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Set up server upgrade listener for websockets
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/lobby') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start listening
server.listen(PORT, () => {
  console.log(`DeskPet Authoritative Game Server running on port ${PORT}`);
});
