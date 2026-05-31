// Controller script for the CyberPet Companion Dashboard

document.addEventListener("DOMContentLoaded", () => {
  // Main Elements
  const activePetRender = document.getElementById("active-pet-render");
  const petName = document.getElementById("pet-name");
  const petStage = document.getElementById("pet-stage");
  const petLevel = document.getElementById("pet-level");
  const petXp = document.getElementById("pet-xp");
  const petXpNeeded = document.getElementById("pet-xp-needed");
  const petXpBar = document.getElementById("pet-xp-bar");

  // Vitals Elements
  const statHunger = document.getElementById("stat-hunger");
  const statHappiness = document.getElementById("stat-happiness");
  const statEnergy = document.getElementById("stat-energy");
  const valHunger = document.getElementById("val-hunger");
  const valHappiness = document.getElementById("val-happiness");
  const valEnergy = document.getElementById("val-energy");

  // Subheader Elements
  const valPetcoin = document.getElementById("val-petcoin");
  const btnSleep = document.getElementById("btn-sleep");
  const sleepIcon = document.getElementById("sleep-icon");
  const sleepText = document.getElementById("sleep-text");

  // RPG Stat Elements
  const pointsAlert = document.getElementById("points-alert");
  const valPoints = document.getElementById("val-points");
  const valStrText = document.getElementById("val-str");
  const valAgiText = document.getElementById("val-agi");
  const valIntText = document.getElementById("val-int");

  // Inventory Qty Elements
  const invTreat = document.getElementById("inv-treat");
  const invToy = document.getElementById("inv-toy");
  const invBattery = document.getElementById("inv-battery");
  const invMutagen = document.getElementById("inv-mutagen");

  // Stable Elements
  const stableItems = document.querySelectorAll(".stable-item");

  // Web3 Elements
  const walletConnect = document.getElementById("wallet-connect");
  const walletStatus = document.getElementById("wallet-status");
  const btnMintNft = document.getElementById("btn-mint-nft");
  const nftMintStatus = document.getElementById("nft-mint-status");
  const btnToggleWeb3 = document.getElementById("btn-toggle-web3");
  const web3Drawer = document.getElementById("web3-drawer");
  const metadataPreview = document.getElementById("metadata-preview");
  const btnCopyMeta = document.getElementById("btn-copy-meta");

  // Focus Timer Elements
  const focusTimerText = document.getElementById("focus-timer-text");
  const focusStatusText = document.getElementById("focus-status-text");
  const focusDuration = document.getElementById("focus-duration");
  const btnFocusToggle = document.getElementById("btn-focus-toggle");
  const valReward = document.getElementById("val-reward");

  // Custom Modal Elements
  const customAlertModal = document.getElementById("custom-alert-modal");
  const customModalIcon = document.getElementById("custom-modal-icon");
  const customModalTitle = document.getElementById("custom-modal-title");
  const customModalMessage = document.getElementById("custom-modal-message");
  const btnCloseModal = document.getElementById("btn-close-modal");

  // Social Auth Elements
  const authGateway = document.getElementById("auth-gateway");
  const userProfileBadge = document.getElementById("user-profile-badge");
  const userEmail = document.getElementById("user-email");
  const btnLogout = document.getElementById("btn-logout");
  const authCredentialForm = document.getElementById("auth-credential-form");
  const authEmailInput = document.getElementById("auth-email-input");
  const authPasswordInput = document.getElementById("auth-password-input");
  const btnSignin = document.getElementById("btn-signin");
  const btnSignup = document.getElementById("btn-signup");

  // API Sync Console Elements
  const btnToggleSync = document.getElementById("btn-toggle-sync");
  const syncDrawer = document.getElementById("sync-drawer");
  const syncConsoleLogs = document.getElementById("sync-console-logs");
  const valLastSync = document.getElementById("val-last-sync");
  const valServerStatus = document.getElementById("val-server-status");

  // Internal State Tracker
  let isWalletConnected = false;
  let mockWalletAddress = null;
  let timerInterval = null;
  let lastSessionActive = false;
  let previousSyncFingerprint = "";
  let isCompletingFocus = false;

  // Supabase Client Wrapper
  let supabase = null;

  // Custom Alert Show Helper
  function showCustomAlert(title, message, icon = "⚠️") {
    customModalIcon.textContent = icon;
    customModalTitle.textContent = title;
    customModalMessage.textContent = message;
    customAlertModal.classList.remove("hidden");
  }

  // Custom Alert Close
  btnCloseModal.addEventListener("click", () => {
    customAlertModal.classList.add("hidden");
  });

  // Append Log Line to Sync Console
  function addConsoleLog(text, type = "info") {
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${timestamp}] ${text}`;
    syncConsoleLogs.appendChild(line);
    syncConsoleLogs.scrollTop = syncConsoleLogs.scrollHeight;
  }

  // Initialize Supabase client using configuration
  function initSupabase(callback) {
    const url = CONFIG.SUPABASE_URL || "";
    const anonKey = CONFIG.SUPABASE_ANON_KEY || "";

    if (url && anonKey && window.supabase) {
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
        supabase = window.supabase.createClient(url, anonKey, {
          auth: {
            storage: customStorage,
            persistSession: true,
            autoRefreshToken: true
          }
        });
        valServerStatus.textContent = "ONLINE";
        valServerStatus.className = "online";
        authCredentialForm.classList.remove("hidden");
      } catch (e) {
        console.error("Supabase client init error", e);
        valServerStatus.textContent = "CONFIG ERR";
        valServerStatus.className = "offline";
      }
    } else {
      supabase = null;
      valServerStatus.textContent = "OFFLINE";
      valServerStatus.className = "offline";
      authCredentialForm.classList.add("hidden");
    }
    if (callback) callback();
  }

  // Sync UI state
  function syncUI() {
    chrome.storage.local.get(["petState"], (result) => {
      if (!result.petState) return;
      const state = result.petState;
      
      // 1. Social Auth Gate Handling
      const auth = state.userAccount || { loggedIn: false };
      if (!auth.loggedIn) {
        authGateway.classList.remove("hidden");
        userProfileBadge.classList.add("hidden");
        walletConnect.classList.add("hidden");
        return;
      } else {
        authGateway.classList.add("hidden");
        userProfileBadge.classList.remove("hidden");
        walletConnect.classList.remove("hidden");
        userEmail.textContent = auth.email;
      }

      if (!state || !state.pets) return;
      const activeId = state.activePetId;
      const pet = state.pets[activeId];

      if (!pet) return;

      // 2. Render Active Pet SVG
      if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[activeId]) {
        activePetRender.innerHTML = PET_ASSETS[activeId].render(pet.status, pet.stage, pet.skin);
      }

      // 3. Name, Stage, Level, and XP
      petName.textContent = pet.name;
      petStage.textContent = pet.stage;
      petLevel.textContent = pet.level;
      petStage.className = `stage-tag ${pet.stage.toLowerCase()}`;

      petXp.textContent = pet.xp;
      petXpNeeded.textContent = pet.xpNeeded;
      const xpPct = Math.min(100, (pet.xp / pet.xpNeeded) * 100);
      petXpBar.style.width = `${xpPct}%`;

      // 4. Vitals Meters
      statHunger.style.width = `${pet.hunger}%`;
      statHappiness.style.width = `${pet.happiness}%`;
      statEnergy.style.width = `${pet.energy}%`;

      valHunger.textContent = `${Math.floor(pet.hunger)}/100`;
      valHappiness.textContent = `${Math.floor(pet.happiness)}/100`;
      valEnergy.textContent = `${Math.floor(pet.energy)}/100`;

      // 5. Subheader: $PETCOIN & Sleep
      valPetcoin.textContent = Math.floor(state.petcoin || 0);
      if (pet.status === "sleep") {
        btnSleep.classList.add("sleeping");
        sleepIcon.textContent = "☀️";
        sleepText.textContent = "Wake";
      } else {
        btnSleep.classList.remove("sleeping");
        sleepIcon.textContent = "🌙";
        sleepText.textContent = "Sleep";
      }

      // 6. RPG Stats & Points Allocation
      if (valStrText) valStrText.textContent = pet.strength || 10;
      if (valAgiText) valAgiText.textContent = pet.agility || 10;
      if (valIntText) valIntText.textContent = pet.intelligence || 10;

      const pts = pet.availableStatPoints || 0;
      if (pts > 0) {
        pointsAlert.classList.remove("hidden");
        valPoints.textContent = pts;
        document.querySelectorAll(".allocate-btn").forEach(btn => btn.classList.remove("hidden"));
      } else {
        pointsAlert.classList.add("hidden");
        document.querySelectorAll(".allocate-btn").forEach(btn => btn.classList.add("hidden"));
      }

      // 7. Shop & Inventory Counts
      invTreat.textContent = state.inventory.treat || 0;
      invToy.textContent = state.inventory.toy || 0;
      invBattery.textContent = state.inventory.battery || 0;
      invMutagen.textContent = state.inventory.mutagen || 0;

      // Handle item button disable states if none in inventory
      document.querySelectorAll(".use-btn").forEach(btn => {
        const itemType = btn.getAttribute("data-item");
        if ((state.inventory[itemType] || 0) <= 0) {
          btn.style.opacity = "0.4";
          btn.style.pointerEvents = "none";
        } else {
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
        }
      });

      // 8. Stable grid active selector
      stableItems.forEach(item => {
        if (item.getAttribute("data-pet-id") === activeId) {
          item.classList.add("active");
        } else {
          item.classList.remove("active");
        }
      });

      // 9. Focus Session Monitor
      syncFocusTimer(state.focusSession);

      // 10. Web3 Metadata Schema Compilation
      updateMetadataSchema(pet);

      // 11. Auto-Sync Off-Chain Database (Supabase PostgreSQL)
      const currentFingerprint = `${pet.level}-${pet.xp}-${state.petcoin}-${pet.strength}-${pet.agility}-${pet.intelligence}-${state.inventory.treat}-${state.inventory.toy}-${state.inventory.battery}-${state.inventory.mutagen}`;
      if (currentFingerprint !== previousSyncFingerprint) {
        previousSyncFingerprint = currentFingerprint;
        triggerDatabaseSync(state);
      }

      // 12. Display last synced date
      if (state.lastSynced) {
        valLastSync.textContent = new Date(state.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    });
  }

  // Trigger Database Sync to live Supabase Instance
  async function triggerDatabaseSync(state) {
    if (!supabase) return;
    
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
      addConsoleLog("Sync failed: User session not verified.", "info");
      return;
    }

    addConsoleLog(`POST /rest/v1/pet_state payload...`, "post");
    
    // Write full client state to PostgreSQL row indexed by authenticated user_id
    const { error } = await supabase
      .from('pet_state')
      .upsert({ 
        user_id: session.user.id, 
        state_data: state, 
        updated_at: new Date().toISOString() 
      });

    if (error) {
      addConsoleLog(`Sync error: ${error.message}`, "info");
    } else {
      addConsoleLog(`Database synced successfully to Supabase!`, "success");
      chrome.runtime.sendMessage({ action: "syncStats" });
    }
  }

  // Focus Timer Countdown Loop
  function syncFocusTimer(session) {
    clearInterval(timerInterval);

    const activeNow = session && session.active;
    if (activeNow) {
      focusDuration.disabled = true;
      btnFocusToggle.textContent = "Stop Focus";
      btnFocusToggle.classList.add("active");
      focusStatusText.textContent = session.isPaused ? "PAUSED (Idle)" : "Focusing...";

      const rewardVal = session.duration * 20;
      valReward.textContent = rewardVal;
      lastSessionActive = true;

      function tick() {
        const remaining = Math.max(0, Math.floor((session.endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(timerInterval);
          focusTimerText.textContent = "00:00";
          focusStatusText.textContent = "Claiming rewards...";
          
          if (!isCompletingFocus) {
            isCompletingFocus = true;
            chrome.runtime.sendMessage({ action: "completeFocus" }, (res) => {
              isCompletingFocus = false;
              lastSessionActive = false;
              syncUI();
              if (res && res.success) {
                showCustomAlert("Focus Completed!", `Awesome job focusing! You received +${session.duration * 20} $PETCOIN and bonus XP!`, "🎉");
              }
            });
          }
        } else {
          const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
          const secs = (remaining % 60).toString().padStart(2, "0");
          focusTimerText.textContent = `${mins}:${secs}`;
        }
      }

      tick();
      timerInterval = setInterval(tick, 1000);
    } else {
      if (lastSessionActive || document.activeElement !== focusDuration) {
        focusDuration.disabled = false;
        btnFocusToggle.textContent = "Start Focus";
        btnFocusToggle.classList.remove("active");
        focusStatusText.textContent = "Ready to Focus";

        const selectedMin = parseInt(focusDuration.value);
        focusTimerText.textContent = `${selectedMin.toString().padStart(2, "0")}:00`;
        valReward.textContent = selectedMin * 20;
        
        lastSessionActive = false;
      }
    }
  }

  // Update Focus Reward display when select option changes
  focusDuration.addEventListener("change", () => {
    const selectedMin = parseInt(focusDuration.value);
    focusTimerText.textContent = `${selectedMin.toString().padStart(2, "0")}:00`;
    valReward.textContent = selectedMin * 20;
  });

  // Focus Toggle Action
  btnFocusToggle.addEventListener("click", () => {
    chrome.storage.local.get(["petState"], (result) => {
      const session = result.petState?.focusSession;
      if (session && session.active) {
        chrome.runtime.sendMessage({ action: "stopFocus" }, () => {
          lastSessionActive = true;
          syncUI();
          showCustomAlert("Session Cancelled", "Focus timer was stopped. No rewards earned.", "⚠️");
        });
      } else {
        const duration = parseInt(focusDuration.value);
        chrome.runtime.sendMessage({ action: "startFocus", duration }, () => {
          lastSessionActive = true;
          syncUI();
        });
      }
    });
  });

  authCredentialForm.addEventListener("submit", (e) => {
    e.preventDefault();
  });

  // Email/Password Log In Triggers
  btnSignin.addEventListener("click", async () => {
    if (!supabase) return;
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();

    if (!email || !password) {
      showCustomAlert("Missing Credentials", "Please supply both email and password.", "❌");
      return;
    }

    addConsoleLog(`POST /auth/v1/token (Signing In)`, "post");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showCustomAlert("Authentication Failed", error.message, "❌");
      addConsoleLog(`Auth Error: ${error.message}`, "info");
    } else {
      addConsoleLog(`Session authenticated for: ${email}`, "success");
      
      // Pull user's existing pet state from table (if it exists) to enable cross-computer syncing
      const { data: petRow, error: selectErr } = await supabase
        .from('pet_state')
        .select('state_data')
        .eq('user_id', data.user.id)
        .single();

      if (!selectErr && petRow && petRow.state_data) {
        addConsoleLog(`Discovered existing online state. Syncing down to this browser...`, "success");
        
        // Sync local storage state to matching database rows
        const mergedState = petRow.state_data;
        mergedState.userAccount = {
          loggedIn: true,
          email: email,
          provider: "supabase",
          token: data.session.access_token
        };
        chrome.storage.local.set({ petState: mergedState }, () => {
          syncUI();
        });
      } else {
        // Otherwise, sync current local state up as the primary starting checkpoint
        addConsoleLog(`No online record found. Syncing current local progress up to database...`, "success");
        chrome.runtime.sendMessage({ action: "login", email, provider: "supabase", resetState: true }, () => {
          chrome.storage.local.get(["petState"], (res) => {
            triggerDatabaseSync(res.petState);
          });
        });
      }
    }
  });

  // Email/Password Sign Up Triggers
  btnSignup.addEventListener("click", async () => {
    if (!supabase) return;
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();

    if (!email || !password) {
      showCustomAlert("Missing Credentials", "Please supply both email and password.", "❌");
      return;
    }

    addConsoleLog(`POST /auth/v1/signup (Registering)`, "post");
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      showCustomAlert("Registration Failed", error.message, "❌");
      addConsoleLog(`Registration Error: ${error.message}`, "info");
    } else {
      showCustomAlert("Registration Successful", "Confirm your email if verification is enabled, or sign in now!", "🎉");
      addConsoleLog(`Account successfully created: ${email}`, "success");
    }
  });

  // Logout Trigger
  btnLogout.addEventListener("click", async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    chrome.runtime.sendMessage({ action: "logout" }, () => {
      addConsoleLog("Session terminated.", "info");
      previousSyncFingerprint = "";
      syncUI();
    });
  });

  // Expandable Sync Drawer toggler
  btnToggleSync.addEventListener("click", () => {
    const isHidden = syncDrawer.classList.contains("hidden");
    if (isHidden) {
      syncDrawer.classList.remove("hidden");
      btnToggleSync.textContent = "Hide";
    } else {
      syncDrawer.classList.add("hidden");
      btnToggleSync.textContent = "Show";
    }
  });



  // Load and subscribe
  initSupabase(() => {
    syncUI();
  });

  // Sleep Action
  btnSleep.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "sleep" }, () => syncUI());
  });

  // RPG Stat point allocation
  document.querySelectorAll(".allocate-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const statName = btn.getAttribute("data-stat");
      chrome.runtime.sendMessage({ action: "allocateStat", statName }, () => syncUI());
    });
  });

  // Shop purchase actions
  document.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemType = btn.getAttribute("data-item");
      const cost = parseInt(btn.getAttribute("data-cost"));
      chrome.runtime.sendMessage({ action: "buyItem", itemType, cost }, (res) => {
        if (res && !res.success) {
          showCustomAlert("Transaction Failed", res.error, "❌");
        }
        syncUI();
      });
    });
  });

  // Inventory usage actions
  document.querySelectorAll(".use-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemType = btn.getAttribute("data-item");
      chrome.runtime.sendMessage({ action: "useItem", itemType }, (res) => {
        if (res && !res.success) {
          showCustomAlert("Action Failed", res.error, "❌");
        }
        syncUI();
      });
    });
  });

  // Stable Switcher
  stableItems.forEach(item => {
    item.addEventListener("click", () => {
      const petId = item.getAttribute("data-pet-id");
      chrome.runtime.sendMessage({ action: "changePet", petId }, () => {
        syncUI();
      });
    });
  });

  // Web3 Wallet mock toggler
  walletConnect.addEventListener("click", () => {
    if (isWalletConnected) {
      isWalletConnected = false;
      mockWalletAddress = null;
      walletStatus.textContent = "Connect Wallet";
      walletConnect.classList.remove("connected");
      btnMintNft.classList.add("disabled");
      nftMintStatus.textContent = "Connect wallet to mint NFT";
    } else {
      isWalletConnected = true;
      mockWalletAddress = "Sol" + Math.random().toString(36).substring(2, 6).toUpperCase() + "..." + Math.random().toString(36).substring(2, 6).toUpperCase();
      walletStatus.textContent = mockWalletAddress;
      walletConnect.classList.add("connected");
      btnMintNft.classList.remove("disabled");
      
      chrome.storage.local.get(["petState"], (result) => {
        if (result.petState) {
          const pet = result.petState.pets[result.petState.activePetId];
          if (pet.minted) {
            btnMintNft.textContent = "Sync State to Solana";
            nftMintStatus.textContent = `Dynamic NFT synced: ${pet.mintAddress}`;
          } else {
            btnMintNft.textContent = "Mint Solana NFT";
            nftMintStatus.textContent = "Ready to mint dynamic NFT";
          }
        }
      });
    }
    syncUI();
  });

  // Web3 Panel toggler
  btnToggleWeb3.addEventListener("click", () => {
    const isHidden = web3Drawer.classList.contains("hidden");
    if (isHidden) {
      web3Drawer.classList.remove("hidden");
      btnToggleWeb3.textContent = "Hide";
    } else {
      web3Drawer.classList.add("hidden");
      btnToggleWeb3.textContent = "Show";
    }
  });

  // Mint / Sync action
  btnMintNft.addEventListener("click", () => {
    if (!isWalletConnected) return;

    chrome.runtime.sendMessage({ action: "mintNFT" }, (response) => {
      if (response && response.success) {
        btnMintNft.textContent = "Sync State to Solana";
        const newPet = response.state.pets[response.state.activePetId];
        nftMintStatus.textContent = `Successfully synced! Mint: ${newPet.mintAddress}`;
        syncUI();
      }
    });
  });

  // Clipboard copy
  btnCopyMeta.addEventListener("click", () => {
    navigator.clipboard.writeText(metadataPreview.textContent).then(() => {
      btnCopyMeta.textContent = "Copied!";
      setTimeout(() => {
        btnCopyMeta.textContent = "Copy";
      }, 1500);
    });
  });

  // Metaplex Standard metadata display
  function updateMetadataSchema(pet) {
    const metadata = {
      name: `CyberPet: ${pet.name}`,
      symbol: "CPET",
      description: `A dynamic level ${pet.level} RPG companion pet. Strength: ${pet.strength}, Agility: ${pet.agility}, Intelligence: ${pet.intelligence}.`,
      image: pet.minted 
        ? `ipfs://bafybeihy...cyberpet/${pet.id}_${pet.stage.toLowerCase()}.png`
        : "unminted_companion_draft",
      attributes: [
        { trait_type: "Species", value: pet.name },
        { trait_type: "Level", value: pet.level },
        { trait_type: "Stage", value: pet.stage },
        { trait_type: "Strength", value: pet.strength || 10 },
        { trait_type: "Agility", value: pet.agility || 10 },
        { trait_type: "Intelligence", value: pet.intelligence || 10 },
        { trait_type: "Mint Status", value: pet.minted ? "Active NFT" : "Draft" },
        { trait_type: "Solana Address", value: pet.mintAddress || "Not Minted" }
      ],
      properties: {
        files: [
          {
            uri: `https://arweave.net/mock-rendering-${pet.id}`,
            type: "image/png"
          }
        ],
        category: "image",
        creators: [
          {
            address: mockWalletAddress || "Unconnected",
            share: 100
          }
        ]
      }
    };

    metadataPreview.textContent = JSON.stringify(metadata, null, 2);
  }
});
