// Background Service Worker for CyberPet Companion (Manifest V3)
importScripts('config.js', 'supabase.js', 'solana-web3.min.js');

// Background Supabase Sync Logic
let bgSupabase = null;

function initBgSupabase(callback) {
  const url = CONFIG.SUPABASE_URL || "";
  const anonKey = CONFIG.SUPABASE_ANON_KEY || "";
  if (url && anonKey && typeof supabase !== "undefined") {
    try {
      const customStorage = {
        getItem: async (key) => {
          const res = await chrome.storage.local.get([key]);
          return res[key] || null;
        },
        setItem: async (key, value) => {
          await chrome.storage.local.set({ [key]: value });
        },
        removeItem: async (key) => {
          await chrome.storage.local.remove([key]);
        }
      };
      bgSupabase = supabase.createClient(url, anonKey, {
        auth: {
          storage: customStorage,
          persistSession: true,
          autoRefreshToken: true
        }
      });
    } catch (e) {
      console.error("Background Supabase client init error", e);
      bgSupabase = null;
    }
  } else {
    bgSupabase = null;
  }
  if (callback) callback();
}

// ==========================================
// 🛡️ BACKEND API HELPERS
// ==========================================
async function callBackend(endpoint, method = "POST", body = null) {
  const headers = { "Content-Type": "application/json" };

  if (bgSupabase) {
    const { data: { session } } = await bgSupabase.auth.getSession();
    if (session && session.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, options);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return data;
}

async function executeDeskTransfer(amount, userWallet) {
  const distributor = await getOrCreateDistributorWallet();
  const userPubkey = userWallet.publicKey;
  const distributorPublicKey = distributor.publicKey;

  const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const deskMintPublicKey = new solanaWeb3.PublicKey(CONFIG.DESK_MINT);

  const userDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
    [userPubkey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
    associateProgramId
  ))[0];

  const distributorDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
    [distributorPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
    associateProgramId
  ))[0];

  // Checks
  let userSolBalance = 0;
  try {
    const rawBal = await solanaRpcCall("getBalance", [userPubkey.toBase58()]);
    if (rawBal !== undefined) {
      userSolBalance = rawBal.value / solanaWeb3.LAMPORTS_PER_SOL;
    }
  } catch (e) { }

  if (userSolBalance < 0.005) {
    throw new Error(`Insufficient SOL gas. You need at least 0.005 SOL (Current: ${userSolBalance.toFixed(4)} SOL). Please click '🪂 Airdrop User SOL' first!`);
  }

  let userDeskAtaExists = false;
  let userDeskBalance = 0;
  try {
    const rawBal = await solanaRpcCall("getTokenAccountBalance", [userDeskAta.toBase58()]);
    if (rawBal !== undefined && rawBal.value) {
      userDeskAtaExists = true;
      userDeskBalance = parseFloat(rawBal.value.uiAmountString);
    }
  } catch (e) { }

  if (!userDeskAtaExists || userDeskBalance < amount) {
    throw new Error(`Insufficient $DESK. You need ${amount} $DESK (Current: ${userDeskBalance.toFixed(2)}). Please click '🪂 Airdrop User $DESK' first!`);
  }

  const transaction = new solanaWeb3.Transaction();

  let distAtaExists = false;
  try {
    const rawBal = await solanaRpcCall("getTokenAccountBalance", [distributorDeskAta.toBase58()]);
    if (rawBal !== undefined) distAtaExists = true;
  } catch (e) { }

  if (!distAtaExists) {
    transaction.add(
      new solanaWeb3.TransactionInstruction({
        keys: [
          { pubkey: userPubkey, isSigner: true, isWritable: true },
          { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
          { pubkey: distributorPublicKey, isSigner: false, isWritable: false },
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
        { pubkey: userDeskAta, isSigner: false, isWritable: true },
        { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
        { pubkey: userPubkey, isSigner: true, isWritable: false }
      ],
      programId: tokenProgramId,
      data: transferInstructionData
    })
  );

  transaction.feePayer = userPubkey;
  const blockhashObj = await solanaRpcCall("getLatestBlockhash", []);
  const blockhash = blockhashObj && (blockhashObj.value ? blockhashObj.value.blockhash : blockhashObj.blockhash);
  if (!blockhash) throw new Error("Failed to retrieve Solana blockhash");
  transaction.recentBlockhash = blockhash;

  transaction.sign(userWallet);
  const serialized = transaction.serialize();
  const base64Tx = uint8ArrayToBase64(serialized);
  const txSignature = await solanaRpcCall("sendTransaction", [base64Tx, { encoding: "base64" }]);

  await confirmTxRaw(txSignature);
  return txSignature;
}

function getRarityMultiplier(rarity) {
  if (!rarity) return 1.0;
  const r = rarity.toLowerCase();
  if (r === "rare") return 1.25;
  if (r === "epic") return 1.5;
  if (r === "legendary" || r === "treasury") return 2.0;
  return 1.0;
}

// Default Pet State (merged RPG and settings schema)
const DEFAULT_STATE = {
  petcoin: 100,
  activePetId: null,
  showFloatingPet: true,
  lastActive: Date.now(),
  lastYieldTime: Date.now(),
  lastActiveInteractTime: 0, // tracks last feed/pet/useItem time for bonding boost
  claimableYield: 0,
  stakingSlotsLimit: 1,
  ownedSkins: ["neon-cyan", "neon-gold", "neon-pink"],
  pets: {},
  inventory: {
    treat: 3,
    toy: 2,
    battery: 1,
    mutagen: 0
  },
  gearInventory: [], // Global gear bag — all found equipment stored here
  maxLevelUnlocked: false, // Set true when any pet hits Lv60
  focusSession: {
    active: false,
    startTime: 0,
    endTime: 0,
    duration: 0,
    lastActivityTime: 0,
    isPaused: false
  },
  userAccount: {
    loggedIn: false,
    email: null,
    provider: null,
    token: null
  }
};


// Broadcast state updates to UI elements
function broadcastStateUpdate(state) {
  try {
    chrome.runtime.sendMessage({ type: "STATE_UPDATED", state });
  } catch (e) { }

  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError || !tabs) return;
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "STATE_UPDATED", state }, () => {
          void chrome.runtime.lastError;
        });
      }
    }
  });
}

function createRandomOnboardingPet(index) {
  const speciesList = ["sol-cat", "astro-dog", "cyber-bunny"];
  const species = speciesList[Math.floor(Math.random() * speciesList.length)];

  const commonPrefixes = ["Cyber", "Neon", "Robo", "Quantum", "Crypto", "Byte", "Pixel", "Circuit", "Synapse"];
  const baseNames = {
    "sol-cat": ["Kitty", "Mao", "Feline", "Whiskers", "Paws"],
    "astro-dog": ["Rover", "Pup", "Canine", "Barker", "Comet"],
    "cyber-bunny": ["Floppy", "Rabbit", "Thumper", "Bouncer", "Hops"]
  };

  const prefix = commonPrefixes[Math.floor(Math.random() * commonPrefixes.length)];
  const bodyName = baseNames[species][Math.floor(Math.random() * baseNames[species].length)];
  const name = `${prefix} ${bodyName} #${Math.floor(1000 + Math.random() * 9000)}`;

  const commonSkins = ["neon-cyan", "neon-gold", "neon-pink", "neon-green", "neon-purple"];
  const skin = commonSkins[Math.floor(Math.random() * commonSkins.length)];

  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const petId = `${species}-${randomSuffix}`;

  const baseStats = {
    "sol-cat": { strength: 10, agility: 10, intelligence: 10, stamina: 10 },
    "astro-dog": { strength: 12, agility: 8, intelligence: 10, stamina: 10 },
    "cyber-bunny": { strength: 8, agility: 12, intelligence: 10, stamina: 10 }
  };

  const stats = baseStats[species];

  return {
    id: petId,
    name: name,
    species: species,
    level: 1,
    xp: 0,
    xpNeeded: species === "sol-cat" ? 100 : (species === "astro-dog" ? 120 : 90),
    baseXpNeeded: species === "sol-cat" ? 100 : (species === "astro-dog" ? 120 : 90),
    stage: "Baby",
    hunger: 80,
    happiness: 80,
    energy: 80,
    status: "idle",
    strength: stats.strength,
    agility: stats.agility,
    intelligence: stats.intelligence,
    stamina: stats.stamina,
    availableStatPoints: 0,
    equipment: { weapon: null, head: null, clothes: null, aiChip: null },
    lastPetTime: 0,
    dailyPetCount: 0,
    dailyPetDate: "",
    minted: false,
    mintAddress: null,
    skin: skin,
    staked: false,
    stakingSession: null,
    rarity: "Common"
  };
}

// Initialize State
function initStorage() {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) {
      const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      state.pets = {};
      const p1 = createRandomOnboardingPet(0);
      const p2 = createRandomOnboardingPet(1);
      const p3 = createRandomOnboardingPet(2);
      state.pets[p1.id] = p1;
      state.pets[p2.id] = p2;
      state.pets[p3.id] = p3;
      state.activePetId = p1.id;

      chrome.storage.local.set({ petState: state });
      console.log("Initialized default pet state with randomized starting companions.");
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  initStorage();
});

// Fallback: Check/init storage at script load
initStorage();
initBgSupabase();

// Alarm for periodic stat decay and growth
chrome.alarms.create("petGameLoop", { periodInMinutes: 1 }); // runs every 1 minute
chrome.alarms.create("focusHeartbeat", { periodInMinutes: 2 }); // heartbeat for anti-cheat
chrome.alarms.create("petNotifications", { periodInMinutes: 5 }); // check notification triggers

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "petGameLoop") {
    updatePetStats();
  } else if (alarm.name === "focusHeartbeat") {
    sendFocusHeartbeat();
  } else if (alarm.name === "petNotifications") {
    checkNotificationTriggers();
  }
});

// ==========================================
// 📡 FOCUS HEARTBEAT (Anti-Cheat)
// ==========================================
function sendFocusHeartbeat() {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) return;
    const state = result.petState;
    if (state.focusSession && state.focusSession.active && !state.focusSession.isPaused) {
      if (bgSupabase && state.userAccount && state.userAccount.loggedIn) {
        callBackend("/api/state/sync-action", "POST", {
          action: "focusHeartbeat",
          payload: {}
        }).catch(err => console.log("[Heartbeat] Failed:", err.message));
      }
    }
  });
}

// ==========================================
// 🔔 CHROME NOTIFICATIONS (Stream E)
// ==========================================
function sendNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "assets/icon.png",
    title: title,
    message: message,
    priority: 1
  }, () => { void chrome.runtime.lastError; });
}

function checkNotificationTriggers() {
  chrome.storage.local.get(["petState", "notifState"], (result) => {
    if (!result.petState) return;
    const state = result.petState;
    const notifState = result.notifState || {};
    const now = Date.now();
    const activeId = state.activePetId;
    const pet = activeId ? state.pets[activeId] : null;

    // 1. Pet hunger critical (<20)
    if (pet && pet.hunger < 20 && (!notifState.lastHungerAlert || now - notifState.lastHungerAlert > 30 * 60 * 1000)) {
      sendNotification("hunger-alert", `🍖 ${pet.name} is Starving!`, `${pet.name}'s hunger is at ${Math.round(pet.hunger)}%. Feed them before they faint!`);
      notifState.lastHungerAlert = now;
    }

    // 2. Staking expedition completed
    if (state.pets) {
      for (const petId in state.pets) {
        const p = state.pets[petId];
        if (p.staked && p.stakingSession && p.stakingSession.completed) {
          const alertKey = `stakeComplete_${petId}`;
          if (!notifState[alertKey]) {
            sendNotification(`staking-${petId}`, `⚔️ Expedition Complete!`, `${p.name} has returned from their ${p.stakingSession.type.toUpperCase()} raid! Claim your rewards.`);
            notifState[alertKey] = true;
          }
        } else if (!p.staked) {
          // Reset the alert when unstaked
          delete notifState[`stakeComplete_${petId}`];
        }
      }
    }

    // 3. Focus session completed
    if (state.focusSession && !state.focusSession.active && notifState.focusWasActive) {
      sendNotification("focus-complete", `⏱️ Focus Session Complete!`, `Great work! Your $PETCOIN rewards have been claimed.`);
      notifState.focusWasActive = false;
    }
    if (state.focusSession && state.focusSession.active) {
      notifState.focusWasActive = true;
    }

    chrome.storage.local.set({ notifState });
  });
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
  if (!pet) {
    state.lastYieldTime = now;
    return;
  }

  const baseRateHr = 10;

  // Calculate active pet rate (only if not staked)
  let activeRate = 0;
  if (!pet.staked) {
    const levelMultiplier = 1 + (pet.level * 0.05);
    const statsMultiplier = 1 + ((pet.intelligence || 10) * 0.02);
    const rarityMultiplier = getRarityMultiplier(pet.rarity);
    activeRate = baseRateHr * levelMultiplier * statsMultiplier * rarityMultiplier;
  }

  // Calculate inactive pet contributions (25% each, only if not staked)
  let inactiveRateSum = 0;
  if (state.pets) {
    for (const petId in state.pets) {
      if (petId !== activeId) {
        const ip = state.pets[petId];
        if (!ip.staked) {
          const ipLevelMult = 1 + (ip.level * 0.05);
          const ipStatsMult = 1 + ((ip.intelligence || 10) * 0.02);
          const ipRarityMult = getRarityMultiplier(ip.rarity);
          const ipRate = baseRateHr * ipLevelMult * ipStatsMult * ipRarityMult;
          inactiveRateSum += (ipRate * 0.25);
        }
      }
    }
  }

  let ratePerHour = activeRate + inactiveRateSum;

  // Active Bonding Boost (1.5x if petted/fed in last 15 minutes)
  const bondingCooldown = 15 * 60 * 1000;
  const isBonded = state.lastActiveInteractTime && (now - state.lastActiveInteractTime < bondingCooldown);
  if (isBonded) {
    ratePerHour *= 1.5;
  }

  const ratePerMs = ratePerHour / (3600 * 1000);

  let elapsedMs = now - state.lastYieldTime;
  // Capped at 8 hours of inactivity
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

function updatePetStats() {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) return;

    let state = JSON.parse(JSON.stringify(result.petState));

    // Accumulate yield and update staking progress
    accumulatePassiveYield(state);
    updateStakingProgress(state);


    // Check Focus timer status and idle state
    if (state.focusSession && state.focusSession.active) {
      if (state.focusSession.isPaused) {
        state.focusSession.endTime += 60000;
        const pet = state.pets[state.activePetId];
        if (pet && pet.status !== "sleep") {
          pet.status = "sleep";
        }
      } else {
        const idleTime = Date.now() - (state.focusSession.lastActivityTime || Date.now());
        if (idleTime > 180000) {
          state.focusSession.isPaused = true;
          const pet = state.pets[state.activePetId];
          if (pet) {
            pet.status = "sleep";
          }
        } else if (Date.now() >= state.focusSession.endTime) {
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
    const pet = state.pets[activeId];

    if (!pet) {
      chrome.storage.local.set({ petState: state });
      return;
    }

    // 1. Decay Hunger & Happiness if not sleeping
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

    // 2. Perform growth/XP calculations if stats are high
    if (pet.hunger > 50 && pet.happiness > 50 && pet.status !== "sleep") {
      gainXP(state, pet, 2);
    }

    state.lastActive = Date.now();

    // 3. Save and broadcast state
    chrome.storage.local.set({ petState: state }, () => {
      broadcastStateUpdate(state);
      syncStateToSupabase(state);
    });
  });
}

const MAX_PET_LEVEL = 60;

/**
 * Grants XP to a pet, handling level-ups with the new linear curve.
 * XP Formula: xpNeeded(L) = floor(baseXP + L * 2.5)
 * Targets ~3 days of hardcore grinding to reach max level (Lv60).
 * Total XP to Lv60 ≈ 9,800–10,200 depending on pet type.
 */
function gainXP(state, pet, amount) {
  if ((pet.level || 1) >= MAX_PET_LEVEL) return; // Already at max — no-op

  const mult = getRarityMultiplier(pet.rarity);
  const scaledAmount = Math.max(1, Math.round(amount * mult));
  pet.xp = (pet.xp || 0) + scaledAmount;

  // Level-up loop: supports multi-level gains from large XP bursts
  while (pet.xp >= pet.xpNeeded && pet.level < MAX_PET_LEVEL) {
    pet.xp -= pet.xpNeeded;
    pet.level += 1;

    // New XP Curve: linear-ish growth per level
    const baseXp = pet.baseXpNeeded || 100;
    pet.xpNeeded = Math.floor(baseXp + pet.level * 2.5);

    pet.availableStatPoints = (pet.availableStatPoints || 0) + 5;
    state.petcoin = (state.petcoin || 0) + (pet.level * 20);

    // Growth stages: expanded for Lv60 cap
    if (pet.level >= 30) {
      pet.stage = "Adult";
    } else if (pet.level >= 10) {
      pet.stage = "Teen";
    } else {
      pet.stage = "Baby";
    }

    // Max level reached — lock and unlock stables progression
    if (pet.level >= MAX_PET_LEVEL) {
      pet.xp = 0;
      pet.xpNeeded = 0;
      state.maxLevelUnlocked = true;
      console.log(`[CyberPet] ${pet.name} reached MAX LEVEL ${MAX_PET_LEVEL}! Stables expansion unlocked!`);
      break;
    }
  }
}

// Handle actions from Popup or Content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE" || message.action === "getState") {
    chrome.storage.local.get(["petState"], (result) => {
      let state = result.petState ? JSON.parse(JSON.stringify(result.petState)) : JSON.parse(JSON.stringify(DEFAULT_STATE));
      accumulatePassiveYield(state);
      updateStakingProgress(state);
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse(state);
      });
    });
    return true;
  }

  if (message.type === "UPDATE_STATE") {
    chrome.storage.local.get(["petState"], (result) => {
      let state = result.petState ? JSON.parse(JSON.stringify(result.petState)) : JSON.parse(JSON.stringify(DEFAULT_STATE));

      const prevShowPet = state.showFloatingPet;
      const updatedState = { ...state, ...message.updates };

      chrome.storage.local.set({ petState: updatedState }, () => {
        broadcastStateUpdate(updatedState);
        sendResponse(updatedState);

        // Script injection fallback if pet toggled on
        if (prevShowPet === false && updatedState.showFloatingPet === true) {
          chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
            if (!tabs) return;
            for (const tab of tabs) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["pet-engine.js", "content.js"]
              }, () => { void chrome.runtime.lastError; });
              chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["content.css"]
              }, () => { void chrome.runtime.lastError; });
            }
          });
        }
      });
    });
    return true;
  }

  if (message.type === "OPEN_DASHBOARD") {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.query({ url: url }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
      } else {
        chrome.tabs.create({ url: url });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  // Handle all gameplay API requests
  chrome.storage.local.get(["petState"], (result) => {
    let state = result.petState ? JSON.parse(JSON.stringify(result.petState)) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    const activeId = state.activePetId;
    const pet = activeId ? state.pets[activeId] : null;

    const activePetRequiredActions = [
      "feed", "play", "sleep", "rename", "allocateStat", "addXpDirect",
      "payoutTokens", "focusPayout", "startFocus", "stopFocus",
      "completeFocus", "userActivity", "distractionPenalty"
    ];

    if (activePetRequiredActions.includes(message.action) && !pet) {
      sendResponse({ success: false, error: "Active companion pet not found" });
      return;
    }

    // INTERCEPT ONLINE/LOGGED IN PLAYERS GAMEPLAY ACTIONS
    const stateSyncActions = [
      "feed", "pet", "sleep", "changePet", "renamePet", "changeSkin",
      "buyItem", "useItem", "allocateStat", "startFocus", "stopFocus",
      "completeFocus", "focusHeartbeat", "startStaking", "claimStakingReward",
      "ascendStage", "resetAttributes",
      "deletePet", "equipGear", "unequipGear"
    ];

    if (stateSyncActions.includes(message.action) && bgSupabase && state.userAccount.loggedIn) {
      (async () => {
        try {
          const data = await callBackend("/api/state/sync-action", "POST", {
            action: message.action,
            payload: message
          });
          chrome.storage.local.set({ petState: data.state }, () => {
            broadcastStateUpdate(data.state);

            // Re-apply temporary status updates like original code
            if (message.action === "feed" || (message.action === "useItem" && message.itemType === "treat")) {
              setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
            } else if (message.action === "pet" || (message.action === "useItem" && (message.itemType === "toy" || message.itemType === "mutagen"))) {
              setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
            } else if (message.action === "distractionPenalty") {
              setTimeout(() => { resetPetStatus(activeId, "distracted"); }, 3000);
            }

            if (message.action === "claimStakingReward") {
              sendResponse({ success: true, rewardMsg: data.payload?.rewardMsg || "Claimed!", state: data.state });
            } else if (message.action === "pet") {
              const petObj = data.state.pets[activeId];
              const PET_DAILY_MAX = 10;
              sendResponse({ success: true, state: data.state, petsRemaining: PET_DAILY_MAX - (petObj?.dailyPetCount || 0) });
            } else {
              sendResponse({ success: true, state: data.state });
            }
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return;
    }

    if (message.action === "feed") {
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('secure_use_item', { item_type: 'treat' });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                broadcastStateUpdate(data);
                setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        if (state.inventory.treat > 0) {
          state.inventory.treat -= 1;
          pet.hunger = Math.min(100, pet.hunger + 25);
          pet.status = "eat";
          gainXP(state, pet, 15);
          state.lastActiveInteractTime = Date.now();
          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
            sendResponse({ success: true, state });
          });
        } else {
          sendResponse({ success: false, error: "No treats remaining" });
        }
      }
    } else if (message.action === "pet") {
      // ── Rate-limiting: 15-minute cooldown + max 10 pettings per day ──
      const PET_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
      const PET_DAILY_MAX = 10;
      const nowMs = Date.now();
      const todayStr = new Date().toDateString();

      // Reset daily counter on a new calendar day
      if (pet.dailyPetDate !== todayStr) {
        pet.dailyPetCount = 0;
        pet.dailyPetDate = todayStr;
      }

      if ((pet.dailyPetCount || 0) >= PET_DAILY_MAX) {
        sendResponse({ success: false, error: `${pet.name} has hit the daily petting limit! (10/day max) Come back tomorrow! 🌙` });
        return;
      }
      const msSinceLastPet = nowMs - (pet.lastPetTime || 0);
      if (msSinceLastPet < PET_COOLDOWN_MS) {
        const remaining = Math.ceil((PET_COOLDOWN_MS - msSinceLastPet) / 60000);
        sendResponse({ success: false, error: `${pet.name} needs ${remaining} more minute(s) to recover! ⏳` });
        return;
      }

      pet.lastPetTime = nowMs;
      pet.dailyPetCount = (pet.dailyPetCount || 0) + 1;
      pet.happiness = Math.min(100, pet.happiness + 20);
      pet.status = "happy";
      gainXP(state, pet, 10);
      state.lastActiveInteractTime = Date.now();
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
        sendResponse({ success: true, state, petsRemaining: PET_DAILY_MAX - pet.dailyPetCount });
      });
    } else if (message.action === "sleep") {
      pet.status = pet.status === "sleep" ? "idle" : "sleep";
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "changePet") {
      if (state.pets[message.petId]) {
        state.activePetId = message.petId;
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "renamePet") {
      const activePet = state.pets[state.activePetId];
      if (activePet) {
        activePet.name = message.name;
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "changeSkin") {
      const activePet = state.pets[state.activePetId];
      if (activePet) {
        activePet.skin = message.skin;
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "registerMintedNFT") {
      (async () => {
        try {
          const { petId, mintAddress, txSignature } = message;
          const targetPet = state.pets[petId];
          if (!targetPet) {
            sendResponse({ success: false, error: "Pet not found" });
            return;
          }

          targetPet.minted = true;
          targetPet.mintAddress = mintAddress;
          targetPet.lastMintTxSignature = txSignature;

          gainXP(state, targetPet, 50);

          if (bgSupabase && state.userAccount.loggedIn) {
            await syncStateToSupabase(state);
          }

          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state, txSignature });
          });
        } catch (err) {
          console.error("NFT registration failed:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "buyItem") {
      const cost = message.cost;
      const itemType = message.itemType;
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('buy_shop_item_secure', { item_key: itemType, quantity: 1, skin_name: null });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                broadcastStateUpdate(data);
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        if ((state.petcoin || 0) >= cost) {
          state.petcoin -= cost;
          state.inventory[itemType] = (state.inventory[itemType] || 0) + 1;
          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state });
          });
        } else {
          sendResponse({ success: false, error: "Insufficient $PETCOIN" });
        }
      }
    } else if (message.action === "useItem") {
      const itemType = message.itemType;
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('secure_use_item', { item_type: itemType });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                broadcastStateUpdate(data);
                if (itemType === "treat") {
                  setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
                } else if (itemType === "toy" || itemType === "mutagen") {
                  setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
                }
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        if (state.inventory[itemType] > 0) {
          state.inventory[itemType] -= 1;
          state.lastActiveInteractTime = Date.now();
          if (itemType === "treat") {
            pet.hunger = Math.min(100, pet.hunger + 25);
            pet.status = "eat";
            gainXP(state, pet, 15);
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
              sendResponse({ success: true, state });
            });
          } else if (itemType === "toy") {
            pet.happiness = Math.min(100, pet.happiness + 30);
            pet.status = "happy";
            gainXP(state, pet, 15);
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
              sendResponse({ success: true, state });
            });
          } else if (itemType === "battery") {
            pet.energy = Math.min(100, pet.energy + 40);
            gainXP(state, pet, 10);
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              sendResponse({ success: true, state });
            });
          } else if (itemType === "mutagen") {
            const stats = ["strength", "agility", "intelligence"];
            const chosen = stats[Math.floor(Math.random() * stats.length)];
            const added = Math.floor(Math.random() * 3) + 1;
            pet[chosen] = (pet[chosen] || 10) + added;
            gainXP(state, pet, 25);
            pet.status = "happy";
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
              sendResponse({ success: true, state });
            });
          }
        } else {
          sendResponse({ success: false, error: "Item not in inventory" });
        }
      }
    } else if (message.action === "allocateStat") {
      const statName = message.statName;
      if (pet.availableStatPoints > 0) {
        pet.availableStatPoints -= 1;
        pet[statName] = (pet[statName] || 10) + 1;
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          syncStateToSupabase(state);
          sendResponse({ success: true, state });
        });
      } else {
        sendResponse({ success: false, error: "No available stat points" });
      }
    } else if (message.action === "addXpDirect") {
      gainXP(state, pet, message.amount);
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "payoutTokens") {
      state.petcoin = (state.petcoin || 0) + message.amount;
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "focusPayout") {
      const reward = message.reward;
      state.petcoin = (state.petcoin || 0) + reward;
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "startFocus") {
      const duration = message.duration;
      state.focusSession = {
        active: true,
        startTime: Date.now(),
        duration: duration,
        endTime: Date.now() + duration * 60 * 1000,
        lastActivityTime: Date.now(),
        isPaused: false
      };
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        if (bgSupabase && state.userAccount.loggedIn) {
          bgSupabase.rpc('start_focus_session', { duration: duration });
        }
        sendResponse({ success: true, state });
      });
    } else if (message.action === "stopFocus") {
      if (state.focusSession) {
        state.focusSession.active = false;
        state.focusSession.isPaused = false;
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "completeFocus") {
      if (state.focusSession && state.focusSession.active) {
        state.focusSession.active = false;
        state.focusSession.isPaused = false;
        if (bgSupabase && state.userAccount.loggedIn) {
          (async () => {
            try {
              const { data, error } = await bgSupabase.rpc('claim_focus_reward');
              if (error) {
                sendResponse({ success: false, error: error.message });
              } else {
                chrome.storage.local.set({ petState: data }, () => {
                  broadcastStateUpdate(data);
                  setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
                  sendResponse({ success: true, state: data });
                });
              }
            } catch (err) {
              sendResponse({ success: false, error: err.message });
            }
          })();
          return;
        } else {
          const pet = state.pets[state.activePetId];
          const mult = pet ? getRarityMultiplier(pet.rarity) : 1.0;
          const reward = Math.round(state.focusSession.duration * 20 * mult);
          state.petcoin = (state.petcoin || 0) + reward;
          if (pet) {
            pet.status = "happy";
            gainXP(state, pet, state.focusSession.duration * 2);
            setTimeout(() => { resetPetStatus(state.activePetId, "happy"); }, 3000);
          }
          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state });
          });
        }
      }
    } else if (message.action === "userActivity") {
      if (state.focusSession && state.focusSession.active) {
        state.focusSession.lastActivityTime = Date.now();
        if (state.focusSession.isPaused) {
          state.focusSession.isPaused = false;
          const pet = state.pets[state.activePetId];
          if (pet && pet.status === "sleep") {
            pet.status = "idle";
          }
        }
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "distractionPenalty") {
      const pet = state.pets[state.activePetId];
      if (pet) {
        pet.happiness = Math.max(0, pet.happiness - 15);
        pet.xp = Math.max(0, pet.xp - 10);
        pet.status = "distracted";
      }
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        setTimeout(() => { resetPetStatus(state.activePetId, "distracted"); }, 3000);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "privy_login") {
      (async () => {
        try {
          const { privyUserId, email, walletAddress, token } = message;

          // Generate derived credentials for Supabase Auth
          const sbEmail = privyUserId.replace(/[^a-zA-Z0-9]/g, "_") + "@deskpet.internal";
          const sbPassword = "PrivyPass_" + privyUserId.replace(/[^a-zA-Z0-9]/g, "");

          if (!bgSupabase) {
            initBgSupabase();
          }

          if (bgSupabase) {
            try {
              // Attempt to login to Supabase
              let { data, error } = await bgSupabase.auth.signInWithPassword({ email: sbEmail, password: sbPassword });

              if (error && error.message.includes("Invalid login credentials")) {
                console.log("Registering new Supabase companion profile for Privy user...");
                const signUpRes = await bgSupabase.auth.signUp({ email: sbEmail, password: sbPassword });
                if (!signUpRes.error) {
                  const retry = await bgSupabase.auth.signInWithPassword({ email: sbEmail, password: sbPassword });
                  if (!retry.error) {
                    data = retry.data;
                  }
                }
              } else if (error) {
                console.warn("Supabase signin warning:", error.message);
              }

              if (data && data.user) {
                console.log("Supabase companion session established successfully.");
                const { data: petRow, error: selectErr } = await bgSupabase
                  .from('pet_state')
                  .select('state_data')
                  .eq('user_id', data.user.id)
                  .maybeSingle();

                if (!selectErr && petRow && petRow.state_data) {
                  console.log("Discovered existing online state. Merging state down...");
                  state = petRow.state_data;
                }
              }
            } catch (sbErr) {
              console.error("Supabase auth sync warning (continuing locally):", sbErr);
            }
          }

          if (!state.pets || Object.keys(state.pets).length === 0) {
            state.pets = {};
            const p1 = createRandomOnboardingPet(0);
            const p2 = createRandomOnboardingPet(1);
            const p3 = createRandomOnboardingPet(2);
            state.pets[p1.id] = p1;
            state.pets[p2.id] = p2;
            state.pets[p3.id] = p3;
            state.activePetId = p1.id;
            console.log("Onboarded new Privy user with 3 starter pets.");
          }

          state.userAccount = {
            loggedIn: true,
            email: email || "privy-user",
            provider: "privy",
            privyUserId: privyUserId,
            token: token,
            walletAddress: walletAddress
          };

          // Keep solanaWalletPubkey as the local extension wallet
          const localWallet = await getOrCreateSolanaWallet();
          state.solanaWalletPubkey = localWallet.publicKey.toBase58();
          await chrome.storage.local.set({ solanaWalletPubkey: state.solanaWalletPubkey });

          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state });
          });
        } catch (err) {
          console.error("Privy background login exception:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return;
    } else if (message.action === "logout") {
      (async () => {
        if (bgSupabase) {
          await bgSupabase.auth.signOut();
        }
        await chrome.storage.local.remove(["solanaWalletPubkey"]);
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        state.userAccount = {
          loggedIn: false,
          email: null,
          provider: null,
          token: null
        };
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, state });
        });
      })();
      return;
    } else if (message.action === "syncStats") {
      state.lastSynced = Date.now();
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "claimYield") {
      (async () => {
        try {
          if (bgSupabase && state.userAccount.loggedIn) {
            const resData = await callBackend("/api/state/sync-action", "POST", {
              action: "claimYield",
              payload: {}
            });
            state = resData.state;
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              sendResponse({ success: true, state });
            });
          } else {
            accumulatePassiveYield(state);
            const amount = state.claimableYield || 0;
            if (amount <= 0) {
              sendResponse({ success: false, error: "No claimable yield available" });
              return;
            }
            state.petcoin = (state.petcoin || 0) + amount;
            state.claimableYield = 0;
            state.lastYieldTime = Date.now();
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              sendResponse({ success: true, state });
            });
          }
        } catch (err) {
          console.error("claimYield action failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "startStaking") {
      const { petId, expeditionType, durationHours } = message;
      const targetPet = state.pets[petId];
      if (!targetPet) {
        sendResponse({ success: false, error: "Pet not found" });
        return;
      }
      if (targetPet.staked) {
        sendResponse({ success: false, error: "Pet is already staked" });
        return;
      }
      if (state.activePetId === petId) {
        sendResponse({ success: false, error: "Cannot stake the active companion pet" });
        return;
      }

      // 8h Deep Raid requires Lv30+ OR Epic/Legendary rarity
      if (durationHours >= 8) {
        const rarityOk = ["Epic", "Legendary"].includes(targetPet.rarity || "Common");
        if ((targetPet.level || 1) < 30 && !rarityOk) {
          sendResponse({ success: false, error: "8h Deep Raid requires Level 30+ or Epic/Legendary rarity! ⚠️" });
          return;
        }
      }

      let stakedCount = 0;
      for (const pId in state.pets) {
        if (state.pets[pId].staked) stakedCount++;
      }
      if (stakedCount >= (state.stakingSlotsLimit || 1)) {
        sendResponse({ success: false, error: "No available staking slots. Upgrade your stable!" });
        return;
      }

      // Charge entrant fee locally
      const fees = { 2: 0, 4: 20, 8: 50 };
      const fee = fees[durationHours] || 0;
      if ((state.petcoin || 0) < fee) {
        sendResponse({ success: false, error: `Insufficient $PETCOIN. Entrant fee is ${fee} $PETCOIN.` });
        return;
      }
      state.petcoin -= fee;

      const baseDuration = durationHours * 3600 * 1000;
      const agility = targetPet.agility || 10;
      const reduction = Math.min(0.5, agility * 0.005); // AGI reduces raid time, max 50%
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

      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "claimStakingReward") {
      const { petId } = message;
      const targetPet = state.pets[petId];
      if (!targetPet || !targetPet.staked || !targetPet.stakingSession) {
        sendResponse({ success: false, error: "Pet is not staked" });
        return;
      }

      const session = targetPet.stakingSession;
      const elapsed = Date.now() - session.startedAt;
      if (elapsed < session.duration && !session.completed) {
        const remaining = Math.ceil((session.duration - elapsed) / 60000);
        sendResponse({ success: false, error: `Expedition still in progress! ${remaining} minute(s) remaining. ⏳` });
        return;
      }

      const raidHours = session.hours || 2;

      // Premium staker path: call backend to claim on-chain $DESK
      if (targetPet.minted && bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            console.log(`[ClaimStakingReward] Calling claim-premium backend for minted pet ${petId}...`);
            const resData = await callBackend("/api/staking/claim-premium", "POST", { petId });
            if (resData && resData.success) {
              const premiumMsg = `🏆 Premium Expedition Succeeded! Earned +${resData.rewardAmount} $DESK (On-chain Devnet). Tx: ${resData.txSignature.substring(0, 12)}...`;
              state = resData.state;
              chrome.storage.local.set({ petState: state }, () => {
                broadcastStateUpdate(state);
                sendResponse({ success: true, rewardMsg: premiumMsg, state });
              });
            } else {
              sendResponse({ success: false, error: resData.error || "Failed to claim premium rewards." });
            }
          } catch (err) {
            console.error("Premium staking claim failed:", err.message);
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      }

      let rewardMsg = "";
      let gearDrop = null;

      // Expedition Obstacle check locally
      const strength = targetPet.strength || 10;
      const successChance = Math.min(0.95, 0.80 + strength * 0.003);
      const isSuccess = Math.random() < successChance;

      if (!isSuccess) {
        const xpGained = Math.round((raidHours * 30) * 0.2); // 20% XP
        gainXP(state, targetPet, xpGained);
        rewardMsg = `⚠️ Expedition Failed! ${targetPet.name} encountered wild obstacles, returned safely with ${xpGained} XP but 0 resources.`;
        
        targetPet.staked = false;
        targetPet.stakingSession = null;
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, rewardMsg, state });
        });
        return;
      }

      // ── Base resource rewards (unchanged from original system) ──
      if (session.type === "cpu") {
        const reward = raidHours * 50 * (1 + (targetPet.intelligence || 10) * 0.02);
        state.petcoin = (state.petcoin || 0) + reward;
        rewardMsg = `⚡ CPU Mining done! Earned ${Math.floor(reward)} $PETCOIN.`;
      } else if (session.type === "ram") {
        const rolls = Math.max(1, Math.floor(raidHours / 2));
        let foundItems = { treat: 0, toy: 0, battery: 0 };
        const successChanceVal = Math.min(0.95, 0.5 + (targetPet.strength || 10) * 0.01);
        for (let i = 0; i < rolls; i++) {
          if (Math.random() < successChanceVal) {
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

      // ── GEAR DROP SYSTEM ──
      if (targetPet.level >= 60) {
        (async () => {
          try {
            const res = await fetch(`${CONFIG.BACKEND_URL}/api/generate-gear`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success && data.gear) {
              gearDrop = data.gear;
              if (!state.gearInventory) state.gearInventory = [];
              gearDrop.earnedByPetId = petId;
              state.gearInventory.push(gearDrop);
              const rarityEmoji = { common: "⚪", blue: "🔵", epic: "🟣", legendary: "🟡", mythic: "🔴" }[gearDrop.rarity] || "";
              rewardMsg += ` ${rarityEmoji} Rare Gear Drop: [${gearDrop.rarity.toUpperCase()}] ${gearDrop.name}!`;
            }
          } catch (err) {
            console.error("Failed to fetch authoritative gear from server, falling back to local generation", err);
            gearDrop = generateGearDrop(raidHours, targetPet.strength || 10);
            if (gearDrop) {
              if (!state.gearInventory) state.gearInventory = [];
              gearDrop.earnedByPetId = petId;
              state.gearInventory.push(gearDrop);
              const rarityEmoji = { Common: "⚪", Rare: "🔵", Epic: "🟣", Legendary: "🟡" }[gearDrop.rarity] || "";
              rewardMsg += ` Local Gear Drop: [${gearDrop.rarity}] ${gearDrop.name}!`;
            }
          }
          targetPet.staked = false;
          targetPet.stakingSession = null;
          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, rewardMsg, state });
          });
        })();
      } else {
        gearDrop = generateGearDrop(raidHours, targetPet.strength || 10);
        if (gearDrop) {
          if (!state.gearInventory) state.gearInventory = [];
          gearDrop.earnedByPetId = petId;
          state.gearInventory.push(gearDrop);
          const rarityEmoji = { Common: "⚪", Rare: "🔵", Epic: "🟣", Legendary: "🟡" }[gearDrop.rarity] || "";
          rewardMsg += ` ${rarityEmoji} Gear Drop: [${gearDrop.rarity}] ${gearDrop.name}!`;
        }
        targetPet.staked = false;
        targetPet.stakingSession = null;
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, rewardMsg, state });
        });
      }
    // NOTE: upgradeRarity action was removed in Phase 7 (Launch Readiness).
    // Rarity is determined exclusively by the server-side roll at purchase time.
    } else if (message.action === "ascendStage") {
      const { petId } = message;
      const targetPet = state.pets[petId];
      if (!targetPet) {
        sendResponse({ success: false, error: "Pet not found" });
        return;
      }

      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('evolve_stage_secure', { pet_id: petId });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              state = data;
              chrome.storage.local.set({ petState: state }, () => {
                broadcastStateUpdate(state);
                sendResponse({ success: true, state });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        const currentStage = targetPet.stage || "Baby";
        if (currentStage === "Baby") {
          if (targetPet.level < 10) {
            sendResponse({ success: false, error: "Requires Level 10 to evolve to Teen" });
            return;
          }
          const cost = 1500;
          if ((state.petcoin || 0) < cost) {
            sendResponse({ success: false, error: "Insufficient $PETCOIN. Cost: 1,500" });
            return;
          }
          state.petcoin -= cost;
          targetPet.stage = "Teen";
        } else if (currentStage === "Teen") {
          if (targetPet.level < 30) {
            sendResponse({ success: false, error: "Requires Level 30 to evolve to Adult" });
            return;
          }
          const cost = 100000;
          if ((state.petcoin || 0) < cost) {
            sendResponse({ success: false, error: "Insufficient $PETCOIN. Cost: 100,000" });
            return;
          }
          state.petcoin -= cost;
          targetPet.stage = "Adult";
        } else if (currentStage === "Adult") {
          if (targetPet.level < 60) {
            sendResponse({ success: false, error: "Requires Level 60 to evolve to Legendary" });
            return;
          }
          const cost = 100000;
          if ((state.petcoin || 0) < cost) {
            sendResponse({ success: false, error: "Insufficient $PETCOIN. Cost: 100,000" });
            return;
          }
          if ((state.inventory.mutagen || 0) < 1) {
            sendResponse({ success: false, error: "Requires 1 Neon Mutagen in inventory" });
            return;
          }
          state.petcoin -= cost;
          state.inventory.mutagen -= 1;
          targetPet.stage = "Legendary";
        } else {
          sendResponse({ success: false, error: "Pet is already at the final Legendary stage!" });
          return;
        }

        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, state });
        });
      }
    } else if (message.action === "resetAttributes") {
      const { petId } = message;
      const targetPet = state.pets[petId];
      if (!targetPet) {
        sendResponse({ success: false, error: "Pet not found" });
        return;
      }

      const cost = 10000;
      if ((state.petcoin || 0) < cost) {
        sendResponse({ success: false, error: "Insufficient $PETCOIN. Cost: 10,000" });
        return;
      }

      let baseStr = 10, baseAgi = 10, baseInt = 10;
      if (petId === "astro-dog") {
        baseStr = 12; baseAgi = 8; baseInt = 10;
      } else if (petId === "cyber-bunny") {
        baseStr = 8; baseAgi = 12; baseInt = 10;
      }

      const currentStr = targetPet.strength || baseStr;
      const currentAgi = targetPet.agility || baseAgi;
      const currentInt = targetPet.intelligence || baseInt;

      const pointsSpent = (currentStr - baseStr) + (currentAgi - baseAgi) + (currentInt - baseInt);
      if (pointsSpent <= 0) {
        sendResponse({ success: false, error: "No stat points have been allocated to reset" });
        return;
      }

      state.petcoin -= cost;
      targetPet.strength = baseStr;
      targetPet.agility = baseAgi;
      targetPet.intelligence = baseInt;
      targetPet.availableStatPoints = (targetPet.availableStatPoints || 0) + pointsSpent;

      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "buyExtraStakingSlot") {
      // ── Requires Lv60 pet + max 5 slots ──
      const hasMaxLevelPet = Object.values(state.pets || {}).some(p => (p.level || 1) >= MAX_PET_LEVEL);
      if (!hasMaxLevelPet) {
        sendResponse({ success: false, error: "You need at least one Level 60 pet to unlock additional staking slots! 🔒" });
        return;
      }
      if ((state.stakingSlotsLimit || 1) >= 5) {
        sendResponse({ success: false, error: "Maximum staking slots reached! (5/5) 🏆" });
        return;
      }

      // Tiered costs: Slot 2=10k, 3=25k, 4=50k, 5=100k
      const slotCosts = [0, 0, 10000, 25000, 50000, 100000];
      const nextSlot = (state.stakingSlotsLimit || 1) + 1;
      const cost = slotCosts[nextSlot] || 100000;

      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const nextSlot = (state.stakingSlotsLimit || 1) + 1;
            const deskCosts = [0, 0, 0, 300, 500, 1000];
            const deskCost = deskCosts[nextSlot] || 0;

            let txSignature = null;
            let playerWallet = null;

            if (deskCost > 0) {
              const userWallet = await getOrCreateSolanaWallet();
              playerWallet = userWallet.publicKey.toBase58();

              console.log(`Paying ${deskCost} $DESK on-chain for Staking Slot ${nextSlot}...`);
              txSignature = await executeDeskTransfer(deskCost, userWallet);
            }

            const data = await callBackend("/api/state/sync-action", "POST", {
              action: "buyExtraStakingSlot",
              payload: {
                txSignature,
                playerWallet
              }
            });

            chrome.storage.local.set({ petState: data.state }, () => {
              broadcastStateUpdate(data.state);
              sendResponse({ success: true, state: data.state });
            });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        if ((state.petcoin || 0) < cost) {
          sendResponse({ success: false, error: `Insufficient $PETCOIN. Cost for Slot ${nextSlot}: ${cost.toLocaleString()}` });
          return;
        }
        state.petcoin -= cost;
        state.stakingSlotsLimit = nextSlot;
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, state });
        });
      }
    } else if (message.action === "buyCosmeticSkin") {
      const { skinName } = message;
      const cost = 5000;
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('buy_shop_item_secure', { item_key: 'skin', quantity: 1, skin_name: skinName });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              state = data;
              chrome.storage.local.set({ petState: state }, () => {
                broadcastStateUpdate(state);
                sendResponse({ success: true, state });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return;
      } else {
        if ((state.petcoin || 0) < cost) {
          sendResponse({ success: false, error: "Insufficient $PETCOIN. Cost: 5,000" });
          return;
        }
        state.ownedSkins = state.ownedSkins || ["neon-cyan", "neon-gold", "neon-pink"];
        if (state.ownedSkins.includes(skinName)) {
          sendResponse({ success: false, error: "Skin already unlocked!" });
          return;
        }
        state.petcoin -= cost;
        state.ownedSkins.push(skinName);
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, state });
        });
      }
    } else if (message.action === "pullUserState") {
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data: { session } } = await bgSupabase.auth.getSession();
            if (session) {
              const { data: petRow } = await bgSupabase
                .from('pet_state')
                .select('state_data')
                .eq('user_id', session.user.id)
                .maybeSingle();

              if (petRow && petRow.state_data) {
                state = petRow.state_data;
                chrome.storage.local.set({ petState: state }, () => {
                  broadcastStateUpdate(state);
                  sendResponse({ success: true, state });
                });
                return;
              }
            }
            sendResponse({ success: false, error: "Failed to pull session state" });
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        })();
        return;
      } else {
        sendResponse({ success: false, error: "Not logged in" });
      }
    } else if (message.action === "getWallet") {
      (async () => {
        try {
          const wallet = await getOrCreateSolanaWallet();
          sendResponse({ success: true, publicKey: wallet.publicKey.toBase58() });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return;
    } else if (message.action === "getWalletBalances") {
      (async () => {
        try {
          const distributor = await getOrCreateDistributorWallet();

          const userWallet = await getOrCreateSolanaWallet();
          const userPubkeyStr = userWallet.publicKey.toBase58();

          let userBalance = null;
          let distributorBalance = null;
          let deskBalance = 0.0000;

          try {
            const rawUser = await solanaRpcCall("getBalance", [userPubkeyStr]);
            userBalance = rawUser.value / solanaWeb3.LAMPORTS_PER_SOL;
          } catch (e) {
            console.error("Failed to fetch user wallet balance:", e.message);
          }

          try {
            const rawDist = await solanaRpcCall("getBalance", [distributor.publicKey.toBase58()]);
            distributorBalance = rawDist.value / solanaWeb3.LAMPORTS_PER_SOL;
          } catch (e) {
            console.error("Failed to fetch distributor balance:", e.message);
          }

          try {
            const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
            const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
            const mintPublicKey = new solanaWeb3.PublicKey(CONFIG.DESK_MINT);
            const userPublicKey = new solanaWeb3.PublicKey(userPubkeyStr);

            const ata = (await solanaWeb3.PublicKey.findProgramAddress(
              [
                userPublicKey.toBuffer(),
                tokenProgramId.toBuffer(),
                mintPublicKey.toBuffer()
              ],
              associateProgramId
            ))[0];

            const rawBalance = await solanaRpcCall("getTokenAccountBalance", [ata.toBase58()]);
            if (rawBalance && rawBalance.value) {
              deskBalance = parseFloat(rawBalance.value.uiAmountString);
            }
          } catch (e) {
            // ATA does not exist or has zero balance, defaults to 0.0000
          }

          sendResponse({
            success: true,
            userBalance,
            distributorBalance,
            deskBalance,
            userPubkey: userPubkeyStr,
            distributorPubkey: distributor.publicKey.toBase58()
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "requestAirdrop") {
      (async () => {
        try {
          const target = message.target; // "user" or "distributor"
          let targetPubkeyStr;
          if (target === "distributor") {
            const wallet = await getOrCreateDistributorWallet();
            targetPubkeyStr = wallet.publicKey.toBase58();
          } else {
            const wallet = await getOrCreateSolanaWallet();
            targetPubkeyStr = wallet.publicKey.toBase58();
          }

          const amountLamports = (target === "distributor" ? 2 : 1) * solanaWeb3.LAMPORTS_PER_SOL;

          console.log(`Requesting manual airdrop for ${target}:`, targetPubkeyStr);
          const airdropSig = await solanaRpcCall("requestAirdrop", [targetPubkeyStr, amountLamports]);

          try {
            await confirmTxRaw(airdropSig);
          } catch (confirmErr) {
            console.warn("Failed to confirm airdrop, but proceeding to check balance:", confirmErr.message);
          }

          const rawBal = await solanaRpcCall("getBalance", [targetPubkeyStr]);
          const newBalance = rawBal.value / solanaWeb3.LAMPORTS_PER_SOL;

          sendResponse({ success: true, balance: newBalance });
        } catch (err) {
          console.error("Manual airdrop request failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
    } else if (message.action === "requestDeskFaucet") {
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const userWallet = await getOrCreateSolanaWallet();
            const userPubkeyStr = userWallet.publicKey.toBase58();
            const data = await callBackend("/api/faucet/claim", "POST", { walletAddress: userPubkeyStr });
            sendResponse({ success: true, txSignature: data.deskTxSignature, message: data.message });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      }
      (async () => {
        try {
          const distributor = await getOrCreateDistributorWallet();

          const userWallet = await getOrCreateSolanaWallet();
          const userPubkeyStr = userWallet.publicKey.toBase58();

          const userPubkey = new solanaWeb3.PublicKey(userPubkeyStr);
          const distributorPublicKey = distributor.publicKey;

          const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
          const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
          const mintPublicKey = new solanaWeb3.PublicKey(CONFIG.DESK_MINT);

          const userAtaAddress = (await solanaWeb3.PublicKey.findProgramAddress(
            [
              userPubkey.toBuffer(),
              tokenProgramId.toBuffer(),
              mintPublicKey.toBuffer()
            ],
            associateProgramId
          ))[0];

          const transaction = new solanaWeb3.Transaction();

          let ataExists = false;
          try {
            const rawBal = await solanaRpcCall("getTokenAccountBalance", [userAtaAddress.toBase58()]);
            if (rawBal !== undefined) ataExists = true;
          } catch (e) {
            // ATA does not exist
          }

          if (!ataExists) {
            transaction.add(
              new solanaWeb3.TransactionInstruction({
                keys: [
                  { pubkey: distributorPublicKey, isSigner: true, isWritable: true },
                  { pubkey: userAtaAddress, isSigner: false, isWritable: true },
                  { pubkey: userPubkey, isSigner: false, isWritable: false },
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

          const decimalsMultiplier = Math.pow(10, 9); // 9 decimals
          const amountTokens = 10000;
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
                { pubkey: distributorPublicKey, isSigner: true, isWritable: false },
              ],
              programId: tokenProgramId,
              data: mintToInstructionData,
            })
          );

          transaction.feePayer = distributorPublicKey;
          const blockhashObj = await solanaRpcCall("getLatestBlockhash", []);
          const blockhash = blockhashObj && (blockhashObj.value ? blockhashObj.value.blockhash : blockhashObj.blockhash);
          if (!blockhash) throw new Error("Failed to retrieve Solana blockhash");
          transaction.recentBlockhash = blockhash;

          transaction.sign(distributor);

          const serialized = transaction.serialize();
          const base64Tx = uint8ArrayToBase64(serialized);
          const txSignature = await solanaRpcCall("sendTransaction", [base64Tx, { encoding: "base64" }]);

          try {
            await confirmTxRaw(txSignature);
          } catch (confirmErr) {
            console.warn("Failed to confirm $DESK faucet transaction:", confirmErr.message);
          }

          sendResponse({ success: true, txSignature });
        } catch (err) {
          console.error("$DESK faucet failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "buyStoreItem") {
      (async () => {
        try {
          const { itemType } = message;
          const price = itemType === "egg" ? 500 : 5000;

          const distributor = await getOrCreateDistributorWallet();
          const userWallet = await getOrCreateSolanaWallet();

          const userPubkey = userWallet.publicKey;
          const distributorPublicKey = distributor.publicKey;

          const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
          const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
          const deskMintPublicKey = new solanaWeb3.PublicKey(CONFIG.DESK_MINT);

          const userDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
            [userPubkey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
            associateProgramId
          ))[0];

          const distributorDeskAta = (await solanaWeb3.PublicKey.findProgramAddress(
            [distributorPublicKey.toBuffer(), tokenProgramId.toBuffer(), deskMintPublicKey.toBuffer()],
            associateProgramId
          ))[0];

          // ── VALIDATION CHECKS ──
          // 1. Check user SOL balance
          let userSolBalance = 0;
          try {
            const rawBal = await solanaRpcCall("getBalance", [userPubkey.toBase58()]);
            if (rawBal !== undefined) {
              userSolBalance = rawBal.value / solanaWeb3.LAMPORTS_PER_SOL;
            }
          } catch (e) {
            console.error("Failed to fetch user SOL balance for store buy validation:", e);
          }
          if (userSolBalance < 0.005) {
            throw new Error(`Insufficient SOL gas. You need at least 0.005 SOL (Current: ${userSolBalance.toFixed(4)} SOL). Please click '🪂 Airdrop User SOL' first!`);
          }

          // 2. Check user $DESK balance
          let userDeskAtaExists = false;
          let userDeskBalance = 0;
          try {
            const rawBal = await solanaRpcCall("getTokenAccountBalance", [userDeskAta.toBase58()]);
            if (rawBal !== undefined && rawBal.value) {
              userDeskAtaExists = true;
              userDeskBalance = parseFloat(rawBal.value.uiAmountString);
            }
          } catch (e) {
            // ATA does not exist
          }
          if (!userDeskAtaExists || userDeskBalance < price) {
            throw new Error(`Insufficient $DESK. You need ${price} $DESK (Current: ${userDeskBalance.toFixed(2)}). Please click '🪂 Airdrop User $DESK' first!`);
          }

          const transaction = new solanaWeb3.Transaction();

          let distAtaExists = false;
          try {
            const rawBal = await solanaRpcCall("getTokenAccountBalance", [distributorDeskAta.toBase58()]);
            if (rawBal !== undefined) distAtaExists = true;
          } catch (e) {
            // ATA does not exist
          }

          if (!distAtaExists) {
            transaction.add(
              new solanaWeb3.TransactionInstruction({
                keys: [
                  { pubkey: userPubkey, isSigner: true, isWritable: true },
                  { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
                  { pubkey: distributorPublicKey, isSigner: false, isWritable: false },
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

          // 1. $DESK payment transfer
          const decimalsMultiplier = Math.pow(10, 9);
          const rawAmount = price * decimalsMultiplier;

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
                { pubkey: userDeskAta, isSigner: false, isWritable: true },
                { pubkey: distributorDeskAta, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: false }
              ],
              programId: tokenProgramId,
              data: transferInstructionData
            })
          );

          // 2. Generate NFT Mint
          const mintKeypair = solanaWeb3.Keypair.generate();
          const nftAtaAddress = (await solanaWeb3.PublicKey.findProgramAddress(
            [userPubkey.toBuffer(), tokenProgramId.toBuffer(), mintKeypair.publicKey.toBuffer()],
            associateProgramId
          ))[0];

          const rentExempt = await solanaRpcCall("getMinimumBalanceForRentExemption", [82]);

          const initMintData = new Uint8Array(35);
          initMintData[0] = 0;
          initMintData[1] = 0;
          initMintData.set(userPubkey.toBytes(), 2);
          initMintData[34] = 0;

          const mintToData = new Uint8Array(9);
          mintToData[0] = 7;
          mintToData[1] = 1;

          const setAuthData = new Uint8Array(3);
          setAuthData[0] = 6;
          setAuthData[1] = 0;
          setAuthData[2] = 0;

          transaction.add(
            solanaWeb3.SystemProgram.createAccount({
              fromPubkey: userPubkey,
              newAccountPubkey: mintKeypair.publicKey,
              lamports: rentExempt,
              space: 82,
              programId: tokenProgramId
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
              ],
              programId: tokenProgramId,
              data: initMintData
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: userPubkey, isSigner: true, isWritable: true },
                { pubkey: nftAtaAddress, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: false, isWritable: false },
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: tokenProgramId, isSigner: false, isWritable: false },
                { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
              ],
              programId: associateProgramId,
              data: new Uint8Array(0)
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: nftAtaAddress, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: false }
              ],
              programId: tokenProgramId,
              data: mintToData
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: false }
              ],
              programId: tokenProgramId,
              data: setAuthData
            })
          );

          transaction.feePayer = userPubkey;
          const blockhashObj = await solanaRpcCall("getLatestBlockhash", []);
          const blockhash = blockhashObj && (blockhashObj.value ? blockhashObj.value.blockhash : blockhashObj.blockhash);
          if (!blockhash) throw new Error("Failed to retrieve Solana blockhash");
          transaction.recentBlockhash = blockhash;

          transaction.sign(userWallet, mintKeypair);

          const serialized = transaction.serialize();
          const base64Tx = uint8ArrayToBase64(serialized);
          const txSignature = await solanaRpcCall("sendTransaction", [base64Tx, { encoding: "base64" }]);

          await confirmTxRaw(txSignature);

          if (bgSupabase && state.userAccount.loggedIn) {
            const data = await callBackend("/api/store/verify-purchase", "POST", {
              txSignature,
              itemType,
              playerWallet: userPubkey.toBase58(),
              mintAddress: mintKeypair.publicKey.toBase58()
            });

            chrome.storage.local.set({ petState: data.state }, () => {
              broadcastStateUpdate(data.state);
              sendResponse({ success: true, state: data.state, txSignature, name: data.name });
            });
            return;
          }

          // Specs
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
            // Egg roll based on rarity
            if (rarity === "Common") {
              const commonSkins = ["neon-cyan", "neon-pink", "neon-green"];
              skin = commonSkins[Math.floor(Math.random() * commonSkins.length)];
            } else if (rarity === "Rare") {
              const rareSkins = ["neon-gold", "neon-purple"];
              skin = rareSkins[Math.floor(Math.random() * rareSkins.length)];
            } else if (rarity === "Epic") {
              const epicSkins = ["neon-purple", "neon-matrix"];
              skin = epicSkins[Math.floor(Math.random() * epicSkins.length)];
            } else { // Legendary
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
            mintAddress: mintKeypair.publicKey.toBase58(),
            lastMintTxSignature: txSignature,
            skin: skin,
            staked: false, stakingSession: null, rarity: rarity
          };

          state.pets[petId] = newPetObj;
          state.activePetId = petId;

          // Update global configuration counter for treasury if relevant
          if (itemType === "treasury" && bgSupabase) {
            try {
              const { data: countData } = await bgSupabase.from('global_config').select('value').eq('key', 'treasury_mint_count').maybeSingle();
              const currentCount = countData ? (countData.value.count || 0) : 0;
              await bgSupabase.from('global_config').upsert({ key: 'treasury_mint_count', value: { count: currentCount + 1 } });
            } catch (dbErr) {
              console.error("Failed to increment treasury count:", dbErr);
            }
          }

          if (bgSupabase && state.userAccount.loggedIn) {
            const { data: { session } } = await bgSupabase.auth.getSession();
            if (session) {
              await bgSupabase.from('pet_state').upsert({
                user_id: session.user.id,
                state_data: state,
                updated_at: new Date().toISOString()
              });
            }
          }

          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state, txSignature, name });
          });
        } catch (err) {
          console.error("buyStoreItem background failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "breedPets") {
      (async () => {
        try {
          const { parentAId, parentBId } = message;
          const parentA = state.pets[parentAId];
          const parentB = state.pets[parentBId];
          if (!parentA || !parentB) {
            throw new Error("Parents not found in stables");
          }
          if (parentA.level < 60 || parentB.level < 60) {
            throw new Error("Both parents must be level 60 to breed!");
          }
          if ((state.petcoin || 0) < 100000) {
            throw new Error("Insufficient $PETCOIN. Cost: 100,000");
          }

          if (bgSupabase && state.userAccount.loggedIn) {
            const userWallet = await getOrCreateSolanaWallet();
            const playerWallet = userWallet.publicKey.toBase58();

            console.log("Executing 5,000 $DESK on-chain transfer for breeding...");
            const txSignature = await executeDeskTransfer(5000, userWallet);

            console.log("Submitting breeding gene fusion request to backend...");
            const data = await callBackend("/api/breed", "POST", {
              parentAId,
              parentBId,
              playerWallet,
              txSignature
            });

            chrome.storage.local.set({ petState: data.state }, () => {
              broadcastStateUpdate(data.state);
              sendResponse({ success: true, babyPet: data.babyPet, state: data.state });
            });
          } else {
            // Local fallback
            state.petcoin -= 100000;
            const parentType = parentA.id.includes("cat") ? "sol-cat" : (parentA.id.includes("dog") ? "astro-dog" : "cyber-bunny");
            const babyName = `Baby-${parentA.name.split(' ')[0]}`;

            let babySkin = parentA.skin;
            const mutateRoll = Math.random();
            if (mutateRoll < 0.15) {
              const premiumSkins = ["neon-purple", "neon-matrix", "neon-rainbow"];
              babySkin = premiumSkins[Math.floor(Math.random() * premiumSkins.length)];
            } else {
              babySkin = Math.random() > 0.5 ? parentA.skin : parentB.skin;
            }

            const strength = Math.floor((parentA.strength + parentB.strength) / 2) + Math.floor(Math.random() * 5) + 1;
            const agility = Math.floor((parentA.agility + parentB.agility) / 2) + Math.floor(Math.random() * 5) + 1;
            const intelligence = Math.floor((parentA.intelligence + parentB.intelligence) / 2) + Math.floor(Math.random() * 5) + 1;
            const stamina = Math.floor((parentA.stamina + parentB.stamina) / 2) + Math.floor(Math.random() * 5) + 1;

            let rarity = "Common";
            const rarityRoll = Math.random();
            if (rarityRoll < 0.60) rarity = "Common";
            else if (rarityRoll < 0.85) rarity = "Rare";
            else if (rarityRoll < 0.97) rarity = "Epic";
            else rarity = "Legendary";

            const babyId = `baby-${Math.random().toString(36).substring(2, 10)}`;
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

            state.pets[babyId] = babyPet;
            chrome.storage.local.set({ petState: state }, () => {
              broadcastStateUpdate(state);
              sendResponse({ success: true, babyPet, state });
            });
          }
        } catch (err) {
          console.error("Breeding action failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "mintPetNFT") {
      (async () => {
        try {
          const { petId } = message;
          const targetPet = state.pets[petId];
          if (!targetPet) {
            sendResponse({ success: false, error: "Pet not found in stable." });
            return;
          }

          const userWallet = await getOrCreateSolanaWallet();
          const userPubkey = userWallet.publicKey;

          const tokenProgramId = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
          const associateProgramId = new solanaWeb3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

          const mintKeypair = solanaWeb3.Keypair.generate();
          const ataAddress = (await solanaWeb3.PublicKey.findProgramAddress(
            [userPubkey.toBuffer(), tokenProgramId.toBuffer(), mintKeypair.publicKey.toBuffer()],
            associateProgramId
          ))[0];

          // ── VALIDATION CHECKS ──
          // 1. Check user SOL balance
          let userSolBalance = 0;
          try {
            const rawBal = await solanaRpcCall("getBalance", [userPubkey.toBase58()]);
            if (rawBal !== undefined) {
              userSolBalance = rawBal.value / solanaWeb3.LAMPORTS_PER_SOL;
            }
          } catch (e) {
            console.error("Failed to fetch user SOL balance for mint validation:", e);
          }
          if (userSolBalance < 0.005) {
            throw new Error(`Insufficient SOL gas. You need at least 0.005 SOL to mint your NFT (Current: ${userSolBalance.toFixed(4)} SOL). Please click '🪂 Airdrop User SOL' first!`);
          }

          const rentExempt = await solanaRpcCall("getMinimumBalanceForRentExemption", [82]);

          const initMintData = new Uint8Array(35);
          initMintData[0] = 0;
          initMintData[1] = 0;
          initMintData.set(userPubkey.toBytes(), 2);
          initMintData[34] = 0;

          const mintToData = new Uint8Array(9);
          mintToData[0] = 7;
          mintToData[1] = 1;

          const setAuthData = new Uint8Array(3);
          setAuthData[0] = 6;
          setAuthData[1] = 0;
          setAuthData[2] = 0;

          const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.createAccount({
              fromPubkey: userPubkey,
              newAccountPubkey: mintKeypair.publicKey,
              lamports: rentExempt,
              space: 82,
              programId: tokenProgramId,
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
              ],
              programId: tokenProgramId,
              data: initMintData,
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: userPubkey, isSigner: true, isWritable: true },
                { pubkey: ataAddress, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: false, isWritable: false },
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: false },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: tokenProgramId, isSigner: false, isWritable: false },
                { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
              ],
              programId: associateProgramId,
              data: new Uint8Array(0),
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: ataAddress, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: false },
              ],
              programId: tokenProgramId,
              data: mintToData,
            }),
            new solanaWeb3.TransactionInstruction({
              keys: [
                { pubkey: mintKeypair.publicKey, isSigner: false, isWritable: true },
                { pubkey: userPubkey, isSigner: true, isWritable: false },
              ],
              programId: tokenProgramId,
              data: setAuthData,
            })
          );

          transaction.feePayer = userPubkey;
          const blockhashObj = await solanaRpcCall("getLatestBlockhash", []);
          const blockhash = blockhashObj && (blockhashObj.value ? blockhashObj.value.blockhash : blockhashObj.blockhash);
          if (!blockhash) throw new Error("Failed to retrieve Solana blockhash");
          transaction.recentBlockhash = blockhash;

          transaction.sign(userWallet, mintKeypair);

          const serialized = transaction.serialize();
          const base64Tx = uint8ArrayToBase64(serialized);
          const txSignature = await solanaRpcCall("sendTransaction", [base64Tx, { encoding: "base64" }]);

          await confirmTxRaw(txSignature);

          targetPet.minted = true;
          targetPet.mintAddress = mintKeypair.publicKey.toBase58();
          targetPet.lastMintTxSignature = txSignature;
          targetPet.obtainedAt = Date.now();

          if (bgSupabase && state.userAccount.loggedIn) {
            const { data: { session } } = await bgSupabase.auth.getSession();
            if (session) {
              await bgSupabase.from('pet_state').upsert({
                user_id: session.user.id,
                state_data: state,
                updated_at: new Date().toISOString()
              });
            }
          }

          chrome.storage.local.set({ petState: state }, () => {
            broadcastStateUpdate(state);
            sendResponse({ success: true, state, txSignature });
          });
        } catch (err) {
          console.error("mintPetNFT background failed:", err.message);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    } else if (message.action === "equipGear") {
      // Equip a gear item from gearInventory onto a pet
      const { gearId, petId: targetPetId } = message;
      if (!state.gearInventory) state.gearInventory = [];
      const gearIdx = state.gearInventory.findIndex(g => g.id === gearId);
      if (gearIdx === -1) {
        sendResponse({ success: false, error: "Gear item not found in inventory" });
        return;
      }
      const gear = state.gearInventory[gearIdx];
      const equipTarget = state.pets[targetPetId];
      if (!equipTarget) {
        sendResponse({ success: false, error: "Pet not found" });
        return;
      }
      if (!equipTarget.equipment) equipTarget.equipment = { weapon: null, head: null, clothes: null, aiChip: null };

      // Unequip any existing gear in that slot back to inventory
      const slotKey = gear.type === "aiChip" ? "aiChip" : gear.type;
      const currentEquipped = equipTarget.equipment[slotKey];
      if (currentEquipped) {
        currentEquipped.equippedBy = null;
        state.gearInventory.push(currentEquipped);
      }

      // Equip the new gear
      gear.equippedBy = targetPetId;
      equipTarget.equipment[slotKey] = gear;
      state.gearInventory.splice(gearIdx, 1);

      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state, equippedGear: gear });
      });
    } else if (message.action === "unequipGear") {
      // Unequip a gear slot from a pet back to inventory
      const { slot, petId: targetPetId } = message;
      const equipTarget = state.pets[targetPetId];
      if (!equipTarget || !equipTarget.equipment) {
        sendResponse({ success: false, error: "Pet has no equipment" });
        return;
      }
      const gear = equipTarget.equipment[slot];
      if (!gear) {
        sendResponse({ success: false, error: "No gear equipped in that slot" });
        return;
      }
      gear.equippedBy = null;
      if (!state.gearInventory) state.gearInventory = [];
      state.gearInventory.push(gear);
      equipTarget.equipment[slot] = null;

      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "deletePet") {
      const { petId } = message;
      if (state.pets[petId]) {
        if (state.activePetId === petId) {
          sendResponse({ success: false, error: "Cannot delete/release your active companion pet!" });
          return;
        }
        delete state.pets[petId];
        chrome.storage.local.set({ petState: state }, () => {
          broadcastStateUpdate(state);
          sendResponse({ success: true, state });
        });
      } else {
        sendResponse({ success: false, error: "Pet not found in stables." });
      }
    }
  });

  return true; // Keep channel open
});

function resetPetStatus(petId, statusToReset) {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) return;
    let state = JSON.parse(JSON.stringify(result.petState));
    if (state.pets[petId] && state.pets[petId].status === statusToReset) {
      state.pets[petId].status = "idle";
      chrome.storage.local.set({ petState: state }, () => {
        broadcastStateUpdate(state);
      });
    }
  });
}

/**
 * Generates a random gear drop from an exploration raid.
 * Slot restrictions: Weapons & AI Chips only from 4h/8h raids.
 * Rarity is influenced by raid duration and pet's Strength stat.
 * @param {number} raidHours - Duration of the raid (2, 4, or 8).
 * @param {number} petStrength - Pet's Strength stat for rarity bias.
 * @returns {object|null} A gear item object, or null if no drop.
 */
function generateGearDrop(raidHours, petStrength) {
  // Drop chance by duration
  const dropChance = raidHours >= 8 ? 1.0 : raidHours >= 4 ? 0.60 : 0.30;
  if (Math.random() > dropChance) return null;

  // Slot pool: Weapons & AI Chips locked to 4h+ raids
  const shortRaidSlots = ["head", "clothes"];
  const longRaidSlots = ["weapon", "head", "clothes", "aiChip"];
  const slotPool = raidHours >= 4 ? longRaidSlots : shortRaidSlots;
  const slot = slotPool[Math.floor(Math.random() * slotPool.length)];

  // Rarity roll — Strength above 10 gives small bonus
  const strBonus = Math.min(0.15, Math.max(0, (petStrength - 10) * 0.005));
  const roll = Math.random();
  let rarity;

  if (raidHours >= 8) {
    // 8h: Legendary 10%, Epic 35%, Rare 40%, Common 15%
    if (roll < 0.10 + strBonus) rarity = "Legendary";
    else if (roll < 0.45 + strBonus) rarity = "Epic";
    else if (roll < 0.85) rarity = "Rare";
    else rarity = "Common";
  } else if (raidHours >= 4) {
    // 4h: Legendary 3%, Epic 12%, Rare 35%, Common 50%
    if (roll < 0.03 + strBonus) rarity = "Legendary";
    else if (roll < 0.15 + strBonus) rarity = "Epic";
    else if (roll < 0.50) rarity = "Rare";
    else rarity = "Common";
  } else {
    // 2h: Rare 20%, Common 80%
    rarity = (roll < 0.20 + strBonus) ? "Rare" : "Common";
  }

  // Stat value ranges per rarity tier
  const statRanges = {
    Common: { min: 1, max: 5 },
    Rare: { min: 6, max: 12 },
    Epic: { min: 13, max: 22 },
    Legendary: { min: 23, max: 35 }
  };
  const { min, max } = statRanges[rarity];
  const randStat = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

  // Primary and secondary stat pools per slot type
  const statPools = {
    weapon: ["strength", "intelligence"],
    head: ["stamina", "intelligence"],
    clothes: ["stamina", "agility"],
    aiChip: ["agility", "intelligence", "stamina"]
  };
  const poolStats = statPools[slot] || ["strength"];
  const primaryStat = { name: poolStats[0], value: randStat(Math.ceil(min * 0.8), max) };
  const secondaryStats = [];
  for (let i = 1; i < Math.min(poolStats.length, 3); i++) {
    secondaryStats.push({ name: poolStats[i], value: randStat(min, Math.ceil(max * 0.55)) });
  }

  // Gear name tables
  const gearNames = {
    weapon: {
      Common: ["Rusted Blade", "Iron Staff", "Dull Claw", "Wire Whip"],
      Rare: ["Neon Saber", "Plasma Rod", "Cyber Fang", "Data Lance"],
      Epic: ["Void Reaver", "Quantum Claw", "Ghost Spike", "Entropy Blade"],
      Legendary: ["OMEGA Protocol", "Genesis Shard", "Abyssal Edge", "The Final Byte"]
    },
    head: {
      Common: ["Basic Helm", "Wire Headset", "Camo Cap", "Signal Visor"],
      Rare: ["Neural Visor", "Data Helmet", "Cyber Goggles", "Reflex Mask"],
      Epic: ["Mindcore Crown", "Aether Visor", "Ghost Mask", "Synaptic Hood"],
      Legendary: ["Overmind Helm", "Eternal Crown", "Singularity Mask", "The All-Seeing"]
    },
    clothes: {
      Common: ["Patched Jacket", "Worn Vest", "Circuit Hoodie", "Signal Coat"],
      Rare: ["Stealth Suit", "Nano Fiber Vest", "Plasma Coat", "Phase Jacket"],
      Epic: ["Ghost Weave", "Dark Matter Cloak", "Void Mantle", "Shadow Shroud"],
      Legendary: ["Celestial Armor", "Infinity Cloak", "Abyssal Shell", "OMEGA Exosuit"]
    },
    aiChip: {
      Common: ["Basic Chip v1", "Logic Wafer", "Cache Module", "Tick Core"],
      Rare: ["Neural Core B", "Reflex Chip", "Overclock Module", "Sync Array"],
      Epic: ["Synaptic Core", "Quantum Processor", "Hive Mind Chip", "Resonance Core"],
      Legendary: ["OMEGA Core", "Genesis Processor", "Singularity Chip", "The Overmind Wafer"]
    }
  };
  const namePool = gearNames[slot]?.[rarity] || ["Unknown Artifact"];
  const name = namePool[Math.floor(Math.random() * namePool.length)];

  return {
    id: `gear_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    type: slot,
    rarity,
    name,
    primaryStat,
    secondaryStats,
    obtainedAt: Date.now(),
    equippedBy: null
  };
}

async function syncStateToSupabase(state) {
  if (!state || !state.userAccount || !state.userAccount.loggedIn) return;

  if (!bgSupabase) {
    initBgSupabase(async () => {
      if (bgSupabase) {
        await executeSync(state);
      }
    });
  } else {
    await executeSync(state);
  }
}

async function executeSync(state) {
  try {
    const { data: { session }, error: sessionErr } = await bgSupabase.auth.getSession();
    if (sessionErr || !session) {
      console.log("Background Sync failed: User session not verified.");
      return;
    }

    const { error } = await bgSupabase
      .from('pet_state')
      .upsert({
        user_id: session.user.id,
        state_data: state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("Background sync error:", error.message);
    } else {
      console.log("Background Database synced successfully to Supabase!");
      state.lastSynced = Date.now();
      chrome.storage.local.set({ petState: state });
    }
  } catch (err) {
    console.error("Background sync exception:", err);
  }
}

// Solana Devnet Integrations: Wallet & Token Claim Manager
async function getOrCreateSolanaWallet() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["solanaWalletSecret"], async (result) => {
      let keypair;
      if (result.solanaWalletSecret) {
        keypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(result.solanaWalletSecret));
      } else {
        keypair = solanaWeb3.Keypair.generate();
        await chrome.storage.local.set({
          solanaWalletSecret: Array.from(keypair.secretKey),
          solanaWalletPubkey: keypair.publicKey.toBase58()
        });
      }
      resolve(keypair);
    });
  });
}

async function getOrCreateDistributorWallet() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["solanaDistributorSecret"], async (result) => {
      let keypair;
      if (result.solanaDistributorSecret) {
        keypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(result.solanaDistributorSecret));
      } else {
        const hardcodedSecret = [153, 140, 68, 139, 239, 90, 229, 191, 107, 178, 83, 219, 78, 124, 140, 142, 38, 233, 218, 56, 183, 207, 221, 159, 76, 185, 174, 233, 247, 76, 44, 65, 123, 220, 158, 186, 91, 5, 254, 14, 56, 226, 99, 46, 206, 205, 99, 41, 229, 190, 14, 29, 224, 221, 87, 127, 80, 142, 190, 174, 47, 149, 137, 155];
        keypair = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(hardcodedSecret));
        await chrome.storage.local.set({
          solanaDistributorSecret: hardcodedSecret
        });
      }
      resolve(keypair);
    });
  });
}

async function solanaRpcCall(method, params) {
  try {
    const response = await fetch("https://api.devnet.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1000000),
        method: method,
        params: params
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }
    return json.result;
  } catch (err) {
    console.error(`Solana RPC Call failed for ${method}:`, err.message);
    throw err;
  }
}

async function confirmTxRaw(signature) {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const statuses = await solanaRpcCall("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
      if (statuses && statuses.value && statuses.value[0]) {
        const status = statuses.value[0];
        if (status.confirmations > 0 || status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return true;
        }
        if (status.err) {
          throw new Error(`Tx Error: ${JSON.stringify(status.err)}`);
        }
      }
    } catch (e) {
      console.warn("Retrying confirmTxRaw error:", e.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Transaction confirmation timeout");
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

