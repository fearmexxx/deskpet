// DeskPet - Dashboard Controller

document.addEventListener("DOMContentLoaded", () => {
  let state = null;
  let currentAction = "idle";
  let actionTimeout = null;
  let playpenX = 80;
  let playpenTargetX = null;
  let playpenDir = 1;

  // DOM Elements
  const activePetRender = document.getElementById("active-pet-render");
  const arenaPetName = document.getElementById("arena-pet-name");
  const arenaPetLevel = document.getElementById("arena-pet-level");
  const arenaSleepScreen = document.getElementById("arena-sleep-screen");

  const arenaBtnPet = document.getElementById("arena-btn-pet");
  const arenaBtnFeed = document.getElementById("arena-btn-feed");
  const arenaBtnSleep = document.getElementById("arena-btn-sleep");
  const btnShareX = document.getElementById("btn-share-x");

  const inputRename = document.getElementById("input-rename");
  const btnRename = document.getElementById("btn-rename");

  const statStrVal = document.getElementById("stat-str-val");
  const statAgiVal = document.getElementById("stat-agi-val");
  const statIntVal = document.getElementById("stat-int-val");
  const statStaVal = document.getElementById("stat-sta-val");
  const statPointsPool = document.getElementById("stat-points-pool");
  const hudXpRatio = document.getElementById("hud-xp-ratio");
  const hudXpBar = document.getElementById("hud-xp-bar");

  // Wallet
  const btnWalletConnect = document.getElementById("btn-wallet-connect");
  const petcoinBalanceEl = document.getElementById("petcoin-balance");
  const deskBalanceEl = document.getElementById("desk-balance");
  const hudWalletDot = document.getElementById("hud-wallet-dot");
  const hudWalletText = document.getElementById("hud-wallet-text");
  const walletPubkey = document.getElementById("wallet-pubkey");

  // Wallet Balances & Airdrop UI
  const walletBalancesBox = document.getElementById("wallet-balances-box");
  const userSolBalance = document.getElementById("user-sol-balance");
  const btnAirdropUser = document.getElementById("btn-airdrop-user");
  const btnFaucetDesk = document.getElementById("btn-faucet-desk");
  const distributorPubkey = document.getElementById("distributor-pubkey");
  const distributorSolBalance = document.getElementById("distributor-sol-balance");
  const btnAirdropDistributor = document.getElementById("btn-airdrop-distributor");
  const faucetStatusMessage = document.getElementById("faucet-status-message");
  const btnRefreshBalances = document.getElementById("btn-refresh-balances");

  // Web3 Sections
  const reqLevelCheck = document.getElementById("req-level-check");
  const reqMintCheck = document.getElementById("req-mint-check");
  const btnMintNft = document.getElementById("btn-mint-nft");
  const mintTxDisplay = document.getElementById("mint-tx-display");
  const txHashLink = document.getElementById("tx-hash-link");
  const yieldRateVal = document.getElementById("yield-rate-val");
  const yieldClaimableVal = document.getElementById("yield-claimable-val");
  const btnClaimYield = document.getElementById("btn-claim-yield");

  // Focus Timer Elements
  const focusTimerText = document.getElementById("focus-timer-text");
  const focusStatusText = document.getElementById("focus-status-text");
  const focusDuration = document.getElementById("focus-duration");
  const btnFocusToggle = document.getElementById("btn-focus-toggle");
  const valReward = document.getElementById("val-reward");

  // Inventory Elements
  const invTreat = document.getElementById("inv-treat");
  const invToy = document.getElementById("inv-toy");
  const invBattery = document.getElementById("inv-battery");
  const invMutagen = document.getElementById("inv-mutagen");

  // Supabase Auth Elements
  const authGateway = document.getElementById("auth-gateway");
  const userProfileBadge = document.getElementById("user-profile-badge");
  const userEmail = document.getElementById("user-email");
  const btnLogout = document.getElementById("btn-logout");

  // API Sync Elements
  const syncConsoleLogs = document.getElementById("sync-console-logs");
  const valLastSync = document.getElementById("val-last-sync");
  const valServerStatus = document.getElementById("val-server-status");

  // Center Stable Standing UI Elements
  const panelTitleText = document.getElementById("panel-title-text");
  const btnBackToStable = document.getElementById("btn-back-to-stable");
  const stableMetricsView = document.getElementById("stable-metrics-view");

  // Web3 State
  let isWalletConnected = false;
  let mockWalletAddress = null;
  let lastBalanceFetchTime = 0;
  let isFetchingBalances = false;
  let timerInterval = null;
  let lastSessionActive = false;
  let previousSyncFingerprint = "";
  let isCompletingFocus = false;
  let supabase = null;

  // Append Log Line to Sync Console
  function addConsoleLog(text, type = "info") {
    if (!syncConsoleLogs) return;
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${timestamp}] ${text}`;
    syncConsoleLogs.appendChild(line);
    syncConsoleLogs.scrollTop = syncConsoleLogs.scrollHeight;
  }

  // Initialize Supabase
  function initSupabase() {
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
        if (valServerStatus) {
          valServerStatus.textContent = "ONLINE";
          valServerStatus.style.color = "#39ff14";
        }
        if (authGateway) authGateway.classList.remove("hidden");
      } catch (e) {
        console.error("Supabase client init error", e);
        if (valServerStatus) {
          valServerStatus.textContent = "CONFIG ERR";
          valServerStatus.style.color = "#ff3366";
        }
      }
    } else {
      supabase = null;
      if (valServerStatus) {
        valServerStatus.textContent = "OFFLINE";
        valServerStatus.style.color = "#ff3366";
      }
      if (authGateway) authGateway.classList.add("hidden");
    }
  }

  // Load state on start
  loadState();
  initSupabase();

  // Listen to background syncs — reload full state so staking panel always reflects latest
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATE_UPDATED") {
      state = message.state;
      updateUI();
    }
  });

  function loadState() {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response) {
        state = response;
        updateUI();
        startArenaAnimationLoop();
        startYieldTicker();
      }
    });
  }

  // Live staking countdown ticker — refreshes staking panel every 30s without a full reload
  setInterval(() => {
    if (state) renderStakingExpeditions();
  }, 30000);

  function updateUI() {
    if (!state) return;

    const activeId = state.activePetId || "sol-cat";
    const pet = state.pets ? state.pets[activeId] : null;
    if (!pet) return;

    // Pet Display
    arenaPetName.textContent = pet.name;
    const rarityColors = {
      "Common": "#00E5FF",
      "Rare": "#FFaa00",
      "Epic": "#ff00bf",
      "Legendary": "#FFD700",
      "Treasury": "#FFD700"
    };
    const rColor = rarityColors[pet.rarity || "Common"] || "#fff";
    arenaPetLevel.textContent = `LEVEL ${pet.level} [${(pet.rarity || "Common").toUpperCase()}]`;
    arenaPetLevel.style.color = rColor;
    inputRename.value = pet.name;

    if (pet.status === "sleep") {
      arenaSleepScreen.classList.remove("hidden");
    } else {
      arenaSleepScreen.classList.add("hidden");
    }

    // Stats Allocator — base stats + gear bonus totals
    const equip = pet.equipment || {};
    function gearBonus(stat) {
      let bonus = 0;
      Object.values(equip).forEach(g => {
        if (!g) return;
        if (g.primaryStat && g.primaryStat.name === stat) bonus += g.primaryStat.value;
        (g.secondaryStats || []).forEach(s => { if (s.name === stat) bonus += s.value; });
      });
      return bonus;
    }
    if (statStrVal) statStrVal.textContent = `${pet.strength || 10}${gearBonus('strength') > 0 ? ' (+' + gearBonus('strength') + ')' : ''}`;
    if (statAgiVal) statAgiVal.textContent = `${pet.agility || 10}${gearBonus('agility') > 0 ? ' (+' + gearBonus('agility') + ')' : ''}`;
    if (statIntVal) statIntVal.textContent = `${pet.intelligence || 10}${gearBonus('intelligence') > 0 ? ' (+' + gearBonus('intelligence') + ')' : ''}`;
    if (statStaVal) statStaVal.textContent = `${pet.stamina || 10}${gearBonus('stamina') > 0 ? ' (+' + gearBonus('stamina') + ')' : ''}`;
    if (statPointsPool) statPointsPool.textContent = pet.availableStatPoints || 0;

    // Disable plus buttons if pool is empty
    const pts = pet.availableStatPoints || 0;
    document.querySelectorAll(".stat-plus-btn").forEach(btn => {
      btn.disabled = (pts <= 0);
      btn.style.opacity = (pts <= 0) ? "0.4" : "1";
    });

    // XP — handle max level cap display
    const isMaxLevel = (pet.level || 1) >= 60;
    if (isMaxLevel) {
      hudXpRatio.textContent = `MAX LEVEL 🏆`;
      hudXpBar.style.width = `100%`;
      hudXpBar.style.background = `linear-gradient(to right, #ffd700, #ff9f43)`;
    } else {
      hudXpRatio.textContent = `${pet.xp} / ${pet.xpNeeded}`;
      hudXpBar.style.width = `${Math.min(100, (pet.xp / (pet.xpNeeded || 1)) * 100)}%`;
      hudXpBar.style.background = ``;
    }

    // Active skin highlighter
    document.querySelectorAll(".skin-dot").forEach(dot => {
      if (dot.dataset.skin === pet.skin) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    const ownedSkins = state.ownedSkins || ["neon-cyan", "neon-gold", "neon-pink"];
    const dotPurple = document.getElementById("skin-dot-purple");
    const dotMatrix = document.getElementById("skin-dot-matrix");
    const dotRainbow = document.getElementById("skin-dot-rainbow");
    if (dotPurple) {
      if (ownedSkins.includes("neon-purple")) dotPurple.classList.remove("hidden");
      else dotPurple.classList.add("hidden");
    }
    if (dotMatrix) {
      if (ownedSkins.includes("neon-matrix")) dotMatrix.classList.remove("hidden");
      else dotMatrix.classList.add("hidden");
    }
    if (dotRainbow) {
      if (ownedSkins.includes("neon-rainbow")) dotRainbow.classList.remove("hidden");
      else dotRainbow.classList.add("hidden");
    }

    // Active Stable switch highlighter
    document.querySelectorAll(".stable-btn").forEach(btn => {
      if (btn.getAttribute("data-pet-id") === activeId) {
        btn.classList.add("active");
        btn.style.borderColor = "var(--color-cyan)";
      } else {
        btn.classList.remove("active");
        btn.style.borderColor = "transparent";
      }
    });

    // Shop Inventory counts
    const inventory = state.inventory || {};
    if (invTreat) invTreat.textContent = inventory.treat || 0;
    if (invToy) invToy.textContent = inventory.toy || 0;
    if (invBattery) invBattery.textContent = inventory.battery || 0;
    if (invMutagen) invMutagen.textContent = inventory.mutagen || 0;

    // Use buttons opacity based on items left
    document.querySelectorAll(".use-btn").forEach(btn => {
      const itemType = btn.getAttribute("data-item");
      const qty = inventory[itemType] || 0;
      if (qty <= 0) {
        btn.style.opacity = "0.4";
        btn.style.pointerEvents = "none";
      } else {
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
      }
    });

    // Update staking slot shop cost display
    const slotCostEl = document.getElementById("shop-slot-cost-display");
    if (slotCostEl) {
      const nextSlot = (state.stakingSlotsLimit || 1) + 1;
      const petcoinCosts = [0, 0, 10000, 25000, 50000, 100000];
      const deskCosts = [0, 0, 0, 300, 500, 1000];
      
      const petcoinCost = petcoinCosts[nextSlot] || 100000;
      const deskCost = deskCosts[nextSlot] || 0;

      if (nextSlot > 5) {
        slotCostEl.textContent = "MAX (5/5) 🏆";
      } else {
        let costText = `Slot ${nextSlot}: ${petcoinCost.toLocaleString()}💰`;
        if (deskCost > 0) {
          costText += ` + ${deskCost}💖`;
        }
        slotCostEl.textContent = costText;
      }
    }

    // Focus Session Monitor
    syncFocusTimer(state.focusSession);

    // Auth gate Handling
    const auth = state.userAccount || { loggedIn: false };
    const adminLink = document.getElementById("admin-panel-link");
    if (!auth.loggedIn) {
      if (authGateway) authGateway.classList.remove("hidden");
      if (userProfileBadge) userProfileBadge.classList.add("hidden");
      if (adminLink) adminLink.classList.add("hidden");
    } else {
      if (authGateway) authGateway.classList.add("hidden");
      if (userProfileBadge) userProfileBadge.classList.remove("hidden");
      if (userEmail) userEmail.textContent = auth.email;
      if (adminLink) {
        if (state.role === 'admin' || auth.email.includes("dev")) {
          adminLink.classList.remove("hidden");
        } else {
          adminLink.classList.add("hidden");
        }
      }
    }

    // Auto-Sync logs trigger
    const currentFingerprint = `${pet.level}-${pet.xp}-${state.petcoin}-${pet.strength}-${pet.agility}-${pet.intelligence}-${state.inventory.treat}-${state.inventory.toy}-${state.inventory.battery}-${state.inventory.mutagen}`;
    if (currentFingerprint !== previousSyncFingerprint) {
      previousSyncFingerprint = currentFingerprint;
      triggerDatabaseSync(state);
    }

    // Last Synced Date
    if (state.lastSynced && valLastSync) {
      valLastSync.textContent = new Date(state.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }



    // Wallet Status
    updateWalletUI(pet);

    // Render static SVG if idle/excited/sleep
    const activeSpecies = pet.species || (activeId.startsWith("sol-cat") ? "sol-cat" : (activeId.startsWith("astro-dog") ? "astro-dog" : (activeId.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
    if (currentAction !== "walk" && activePetRender && typeof PET_ASSETS !== "undefined" && PET_ASSETS[activeSpecies]) {
      activePetRender.style.marginLeft = `${playpenX}px`;
      activePetRender.style.transform = playpenDir < 0 ? "scaleX(-1)" : "scaleX(1)";
      activePetRender.innerHTML = PET_ASSETS[activeSpecies].render(pet.status || "idle", pet.stage || "Baby", pet.skin);
    }

    // Render Stable Standings Metrics List
    renderStableStandings();

    // Render Staking & Expeditions View
    renderStakingExpeditions();

    // Render Equipment Slots Panel
    renderEquipmentPanel(pet);

    // Render Gear Bag
    renderGearBag();
  }

  // ── EQUIPMENT PANEL RENDERER ──
  function renderEquipmentPanel(pet) {
    if (!pet) return;
    const equip = pet.equipment || {};
    const rarityColors = { Common: '#808080', Rare: '#00c0ff', Epic: '#bd00ff', Legendary: '#ffb700' };
    const slots = ['weapon', 'head', 'clothes', 'aiChip'];

    slots.forEach(slot => {
      const nameEl = document.getElementById(`equip-${slot}-name`);
      const statsEl = document.getElementById(`equip-${slot}-stats`);
      const slotEl = document.getElementById(`slot-${slot}`);
      if (!nameEl || !statsEl || !slotEl) return;

      const gear = equip[slot];
      if (gear) {
        const color = rarityColors[gear.rarity] || '#fff';
        slotEl.style.borderColor = color;
        slotEl.style.boxShadow = `0 0 8px ${color}55`;
        nameEl.textContent = gear.name;
        nameEl.style.color = color;
        const allStats = [gear.primaryStat, ...(gear.secondaryStats || [])].filter(Boolean);
        statsEl.innerHTML = allStats.map(s => `<span style="font-size:8px; color:rgba(255,255,255,0.6);">${s.name.substring(0,3).toUpperCase()} +${s.value}</span>`).join(' ');
        slotEl.title = `[${gear.rarity}] ${gear.name} — Click to unequip`;
        // Click to unequip
        slotEl.onclick = () => {
          chrome.runtime.sendMessage({ action: 'unequipGear', slot, petId: pet.id }, res => {
            if (res && res.success) {
              showToast(`${gear.name} unequipped!`, 'info');
              loadState();
            } else {
              showToast(res?.error || 'Unequip failed', 'error');
            }
          });
        };
      } else {
        slotEl.style.borderColor = 'rgba(255,255,255,0.12)';
        slotEl.style.boxShadow = 'none';
        nameEl.textContent = 'Empty';
        nameEl.style.color = 'rgba(255,255,255,0.3)';
        statsEl.innerHTML = '';
        slotEl.title = '';
        slotEl.onclick = null;
      }
    });
  }

  // ── GEAR BAG RENDERER ──
  function renderGearBag() {
    const listEl = document.getElementById('gear-bag-list');
    const emptyEl = document.getElementById('gear-bag-empty');
    if (!listEl || !state) return;

    const gearInv = state.gearInventory || [];
    // Remove old gear cards but keep the empty message element
    listEl.querySelectorAll('.gear-card').forEach(c => c.remove());

    if (gearInv.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    const rarityColors = { Common: '#808080', Rare: '#0A84FF', Epic: '#BF5AF2', Legendary: '#FF9500' };
    const rarityEmoji = { Common: '⚪', Rare: '🔵', Epic: '🟣', Legendary: '🟡' };
    const slotIcon = { weapon: '⚔️', head: '🪖', clothes: '👕', aiChip: '💾' };
    const slotLabel = { weapon: 'Weapon', head: 'Head', clothes: 'Clothes', aiChip: 'AI Chip' };
    const typeColors = { weapon: '#FF453A', head: '#0A84FF', clothes: '#30D158', aiChip: '#FF9500' };

    gearInv.forEach(gear => {
      const color = rarityColors[gear.rarity] || '#fff';
      const typeColor = typeColors[gear.type] || 'rgba(255,255,255,0.4)';
      const card = document.createElement('div');
      card.className = 'gear-card';
      card.style.cssText = `
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid ${color}35;
        border-radius: 12px;
        padding: 10px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 105px;
      `;

      const allStats = [gear.primaryStat, ...(gear.secondaryStats || [])].filter(Boolean);
      const statsHtml = allStats.map(s =>
        `<span style="font-size:8px; font-weight:700; color:#fff; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); padding:2px 5px; border-radius:6px; display:inline-block; font-family:'Share Tech Mono',monospace;">${s.name.substring(0,3).toUpperCase()} +${s.value}</span>`
      ).join(' ');

      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:8px; color:${color}; font-weight:700; background:${color}15; border:1px solid ${color}30; padding:1px 6px; border-radius:10px; letter-spacing:0.5px;">${gear.rarity.toUpperCase()}</span>
            <span style="font-size:11px; filter: drop-shadow(0 0 2px ${typeColor});" title="${slotLabel[gear.type]}">${slotIcon[gear.type] || '🎒'}</span>
          </div>
          <div style="font-size:11px; font-weight:700; color:#fff; margin-bottom:6px; line-height:1.2; font-family:'Rajdhani',sans-serif;">${gear.name}</div>
        </div>
        <div>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">${statsHtml}</div>
          <div style="text-align:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px; margin-top:2px;">
            <span class="equip-action-btn" style="font-size:8px; font-weight:bold; color:${color}; border:1px solid ${color}55; padding:2px 8px; border-radius:10px; text-transform:uppercase; letter-spacing:0.5px; transition:all 0.2s;">Equip Gear</span>
          </div>
        </div>
      `;

      card.addEventListener('mouseenter', () => { 
        card.style.borderColor = color; 
        card.style.boxShadow = `0 4px 15px ${color}20, inset 0 1px 0 rgba(255,255,255,0.05)`; 
        card.style.transform = 'translateY(-2px)';
        const btn = card.querySelector('.equip-action-btn');
        if (btn) {
          btn.style.background = color;
          btn.style.color = '#000';
        }
      });
      card.addEventListener('mouseleave', () => { 
        card.style.borderColor = `${color}35`; 
        card.style.boxShadow = 'none'; 
        card.style.transform = 'translateY(0)';
        const btn = card.querySelector('.equip-action-btn');
        if (btn) {
          btn.style.background = 'transparent';
          btn.style.color = color;
        }
      });

      card.addEventListener('click', () => {
        const activeId = state.activePetId || 'sol-cat';
        chrome.runtime.sendMessage({ action: 'equipGear', gearId: gear.id, petId: activeId }, res => {
          if (res && res.success) {
            showToast(`${gear.name} equipped on ${state.pets[activeId]?.name || activeId}! ${rarityEmoji[gear.rarity]}`, 'success');
            loadState();
          } else {
            showToast(res?.error || 'Equip failed', 'error');
          }
        });
      });

      listEl.appendChild(card);
    });
  }

  // ── TOAST NOTIFICATION HELPER ──
  function showToast(message, type = 'info') {
    const existing = document.getElementById('deskpet-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'deskpet-toast';
    const colors = { success: '#30D158', error: '#FF453A', info: '#00E5FF', warning: '#FFB700' };
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: rgba(10,10,20,0.95); border: 1px solid ${colors[type] || colors.info};
      color: #fff; padding: 12px 18px; border-radius: 8px;
      font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 15px ${colors[type] || colors.info}44;
      max-width: 320px; animation: fadeInUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  // Render Stable Standings Panel (TCG Card Game Revamp)
  function renderStableStandings() {
    const listEl = document.getElementById("stable-standings-list");
    if (!listEl || !state || !state.pets) return;

    listEl.innerHTML = "";

    const petList = Object.values(state.pets);
    petList.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.xp - a.xp;
    });

    const rarityColors = {
      "Common": "#00E5FF",
      "Rare": "#FFaa00",
      "Epic": "#ff00bf",
      "Legendary": "#FFD700",
      "Treasury": "#FFD700"
    };

    petList.forEach((pet, index) => {
      const rank = index + 1;
      const color = rarityColors[pet.rarity || "Common"] || "#fff";
      const tier = (pet.rarity || "Common").toUpperCase();


      const card = document.createElement("div");
      card.style.cssText = `
        background: rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        width: 100%;
        max-width: 240px;
        height: 275px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 14px;
        position: relative;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        overflow: hidden;
      `;

      if (pet.id === state.activePetId) {
        card.style.transform = "scale(1.03) translateY(-4px)";
        card.style.borderColor = "#0A84FF";
        card.style.boxShadow = `0 12px 35px rgba(10, 132, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)`;
      }

      if (pet.locked) {
        card.style.opacity = "0.50";
        card.style.borderColor = "#ff3e3e";
      }

      card.addEventListener("mouseenter", () => {
        if (pet.locked) return;
        card.style.transform = pet.id === state.activePetId
          ? "scale(1.05) translateY(-6px)"
          : "scale(1.03) translateY(-4px)";
        card.style.borderColor = "#0A84FF";
      });
      card.addEventListener("mouseleave", () => {
        if (pet.locked) return;
        if (pet.id === state.activePetId) {
          card.style.transform = "scale(1.03) translateY(-4px)";
          card.style.borderColor = "#0A84FF";
        } else {
          card.style.transform = "scale(1) translateY(0)";
          card.style.borderColor = "rgba(255, 255, 255, 0.1)";
        }
      });

      card.addEventListener("click", () => {
        if (pet.locked) {
          showToast(`This pet NFT is locked. Make sure the NFT is in your connected wallet!`, "error");
          return;
        }
        chrome.runtime.sendMessage({ action: "changePet", petId: pet.id });
      });

      const petSpecies = pet.species || (pet.id.startsWith("sol-cat") ? "sol-cat" : (pet.id.startsWith("astro-dog") ? "astro-dog" : (pet.id.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
      const petSvg = typeof PET_ASSETS !== "undefined" && PET_ASSETS[petSpecies]
        ? PET_ASSETS[petSpecies].render(pet.status || "idle", pet.stage || "Baby", pet.skin)
        : "";

      card.innerHTML = `
        <!-- Card Header (Rank, Level, Rarity) -->
        <div style="display:flex; justify-content:space-between; align-items:center; font-family:inherit;">
          <span style="font-size:13px; font-weight:700; color:${color};">#${rank}</span>
          <div style="display:flex; gap:4px; align-items:center;">
            <span style="font-size:9px; font-weight:700; color:${color}; background:rgba(255,255,255,0.08); border:1px solid ${color}30; padding:2px 8px; border-radius:10px;">${tier}</span>
            ${pet.id !== state.activePetId ? `<span class="release-pet-btn" data-pet-id="${pet.id}" title="Release Pet" style="cursor:pointer; font-size:11px; opacity:0.6; color:#ff3e3e; margin-left:4px; transition: opacity 0.2s;">❌</span>` : ''}
          </div>
        </div>

        <!-- Card Image Art (Dynamic Vector SVG Container) -->
        <div class="card-art-container" style="flex:1; margin:8px 0; border-radius:12px; border:1px solid rgba(255,255,255,0.06); background:radial-gradient(circle, #2c2c2e 0%, #161617 100%); display:flex; align-items:center; justify-content:center; overflow:hidden; height:105px; min-height:105px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">
          ${petSvg}
        </div>

        <!-- Card Body (Name & Stats) -->
        <div>
          <div style="text-align:center; margin-bottom:6px;">
            <strong style="font-size:14px; color:#fff; letter-spacing:-0.2px; font-weight:700;">${pet.name.toUpperCase()}</strong>
            <div style="font-size:10px; color:rgba(255,255,255,0.5); font-weight:500;">LVL ${pet.level} (${pet.stage.toUpperCase()})</div>
          </div>

          <!-- Stats row -->
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px; text-align:center; font-family:inherit; border-top:1px solid rgba(255,255,255,0.08); padding-top:6px; margin-top:4px;">
            <div>
              <div style="font-size:8px; font-weight:600; color:rgba(255,255,255,0.4);">STR</div>
              <span style="font-size:11px; font-weight:700; color:#FF453A;">${pet.strength || 10}</span>
            </div>
            <div>
              <div style="font-size:8px; font-weight:600; color:rgba(255,255,255,0.4);">AGI</div>
              <span style="font-size:11px; font-weight:700; color:#30D158;">${pet.agility || 10}</span>
            </div>
            <div>
              <div style="font-size:8px; font-weight:600; color:rgba(255,255,255,0.4);">INT</div>
              <span style="font-size:11px; font-weight:700; color:#0A84FF;">${pet.intelligence || 10}</span>
            </div>
          </div>
          
          <!-- State check -->
          <div style="text-align:center; font-size:9px; font-weight:600; margin-top:6px; color:${pet.locked ? '#ff3e3e' : (pet.status === 'sleep' ? '#0A84FF' : '#30D158')}; letter-spacing:0.5px;">
            STATUS: ${pet.locked ? 'LOCKED 🔒' : pet.status.toUpperCase()}
          </div>
        </div>
      `;

      const releaseBtn = card.querySelector(".release-pet-btn");
      if (releaseBtn) {
        releaseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const petId = releaseBtn.getAttribute("data-pet-id");
          const petName = pet.name;
          if (confirm(`Are you sure you want to release ${petName} from your stable permanently? This action cannot be undone.`)) {
            chrome.runtime.sendMessage({ action: "deletePet", petId }, (res) => {
              if (res && res.success) {
                showToast(`${petName} has been released.`, "info");
                loadState();
              } else {
                alert(res ? res.error : "Failed to release pet");
              }
            });
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  function renderStakingExpeditions() {
    const listEl = document.getElementById("staking-pets-list");
    const slotsInfo = document.getElementById("staking-slots-info");
    if (!listEl || !state || !state.pets) return;

    let stakedCount = 0;
    const petList = Object.values(state.pets);
    petList.forEach(p => { if (p.staked) stakedCount++; });
    if (slotsInfo) {
      slotsInfo.textContent = `${stakedCount} / ${state.stakingSlotsLimit || 1}`;
    }

    listEl.innerHTML = "";

    const stabledPets = petList.filter(p => p.id !== state.activePetId);
    if (stabledPets.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:12px; color:rgba(255,255,255,0.4); font-size:12px;">No stabled pets available. All pets are active companions or missing.</div>`;
      return;
    }

    stabledPets.forEach(pet => {
      const row = document.createElement("div");
      row.className = "expedition-row";
      row.style.cssText = `
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 8px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 10px rgba(0,0,0,0.15);
      `;

      const petNameAndLevel = `<strong style="color:#fff; font-size:13px; font-family:'Rajdhani',sans-serif;">${pet.name.toUpperCase()}</strong> <span style="font-size:10px; color:rgba(255,255,255,0.5);">LVL ${pet.level} (${pet.rarity || 'Common'})</span>`;

      if (pet.staked && pet.stakingSession) {
        const session = pet.stakingSession;
        const elapsed = Date.now() - session.startedAt;
        const remaining = Math.max(0, session.duration - elapsed);
        
        // Progress percentage
        const progressPct = session.duration > 0 
          ? Math.min(100, (elapsed / session.duration) * 100) 
          : 100;

        let statusText = "";
        let actionBtn = "";

        if (remaining <= 0 || session.completed) {
          statusText = `<span style="color:#30D158; font-weight:bold; font-size:11px; text-shadow:0 0 5px rgba(48,209,88,0.2);">EXPEDITION COMPLETE!</span>`;
          actionBtn = `<button class="hud-btn glow-green claim-stake-btn" data-pet-id="${pet.id}" style="font-size:11px; padding:6px 12px; border-radius:12px; font-weight:bold;">Claim Loot</button>`;
        } else {
          const mins = Math.ceil(remaining / 60000);
          const hrs = (remaining / 3600000).toFixed(1);
          statusText = `<span style="color:#FFaa00; font-size:11px;">On ${session.type.toUpperCase()} Expedition: ${hrs}h remaining</span>`;
          actionBtn = `<button class="hud-btn dev-complete-stake-btn" data-pet-id="${pet.id}" style="font-size:9px; padding:4px 8px; opacity:0.6; border-radius:8px;">Dev Speedup</button>`;
        }

        row.innerHTML = `
          <div style="flex-grow:1; min-width:200px; display:flex; flex-direction:column; gap:2px;">
            <div>${petNameAndLevel}</div>
            <div style="margin-top:2px;">${statusText}</div>
            <div class="expedition-progress-outer" style="margin-top:6px;">
              <div class="expedition-progress-inner" style="width: ${progressPct}%"></div>
            </div>
          </div>
          <div>${actionBtn}</div>
        `;
      } else {
        row.innerHTML = `
          <div>
            <div>${petNameAndLevel}</div>
            <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-top:2px;">Ready for deployment</div>
            ${pet.minted ? `<div class="premium-rewards-label" style="font-size:10px; color:#ffd700; margin-top:2px;">💎 Earns +10 $DESK on completion</div>` : ""}
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <select class="stake-type-select" style="background:#1a1a2e; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:11px; padding:5px 8px; border-radius:8px; outline:none; font-family:'Rajdhani',sans-serif; cursor:pointer;">
              <option value="cpu">CPU Mining ($PETCOIN)</option>
              <option value="ram">RAM Salvage (Items)</option>
              <option value="net">Network Scan (XP/Mutagen)</option>
            </select>
            <select class="stake-time-select" style="background:#1a1a2e; color:#fff; border:1px solid rgba(255,255,255,0.15); font-size:11px; padding:5px 8px; border-radius:8px; outline:none; font-family:'Rajdhani',sans-serif; cursor:pointer;">
              <option value="2">2 Hours</option>
              <option value="4">4 Hours</option>
              <option value="8">8 Hours</option>
            </select>
            <button class="hud-btn glow-gold start-stake-btn" data-pet-id="${pet.id}" style="font-size:11px; padding:6px 12px; border-radius:12px; font-weight:bold;">Stake</button>
          </div>
        `;
      }
      listEl.appendChild(row);
    });

    listEl.querySelectorAll(".stake-time-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const rowEl = select.closest(".expedition-row");
        const labelEl = rowEl.querySelector(".premium-rewards-label");
        if (labelEl) {
          const hours = parseInt(e.target.value);
          const rewards = { 2: 10, 4: 25, 8: 60 };
          const reward = rewards[hours] || 10;
          labelEl.textContent = `💎 Earns +${reward} $DESK on completion`;
        }
      });
    });

    listEl.querySelectorAll(".start-stake-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const petId = btn.getAttribute("data-pet-id");
        const rowEl = btn.closest(".expedition-row");
        const typeSelect = rowEl.querySelector(".stake-type-select");
        const timeSelect = rowEl.querySelector(".stake-time-select");
        const expeditionType = typeSelect.value;
        const durationHours = parseInt(timeSelect.value);

        chrome.runtime.sendMessage({
          action: "startStaking",
          petId,
          expeditionType,
          durationHours
        }, (res) => {
          if (res && res.success) {
            addConsoleLog(`Deployed ${petId} on ${expeditionType} expedition!`, "success");
            loadState();
          } else {
            alert(res.error || "Failed to start staking");
          }
        });
      });
    });

    listEl.querySelectorAll(".claim-stake-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const petId = btn.getAttribute("data-pet-id");
        chrome.runtime.sendMessage({
          action: "claimStakingReward",
          petId
        }, (res) => {
          if (res && res.success) {
            addConsoleLog(res.rewardMsg || "Loot claimed successfully!", "success");
            loadState();
          } else {
            alert(res.error || "Failed to claim rewards");
          }
        });
      });
    });

    listEl.querySelectorAll(".dev-complete-stake-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const petId = btn.getAttribute("data-pet-id");
        chrome.storage.local.get(["petState"], (res) => {
          if (res.petState && res.petState.pets[petId]) {
            const petState = res.petState;
            if (petState.pets[petId].stakingSession) {
              petState.pets[petId].stakingSession.duration = 0;
              chrome.storage.local.set({ petState }, () => {
                loadState();
              });
            }
          }
        });
      });
    });
  }

  // Trigger Database sync to Supabase
  async function triggerDatabaseSync(state) {
    if (!supabase) return;

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
      addConsoleLog("Sync failed: User session not verified.", "info");
      return;
    }

    addConsoleLog(`POST /rest/v1/pet_state payload...`, "post");

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

  // (rest of the code remains exactly unchanged to preserve all games, focus, mints, and yield ticker features)
  function updateWalletUI(pet) {
    if (petcoinBalanceEl) petcoinBalanceEl.textContent = Math.floor(state.petcoin || 0);

    if (state && state.solanaWalletPubkey) {
      isWalletConnected = true;
      mockWalletAddress = state.solanaWalletPubkey;
    }

    if (isWalletConnected) {
      btnWalletConnect.textContent = "Wallet Active";
      btnWalletConnect.classList.add("connected");
      hudWalletDot.className = "dot-green";
      hudWalletText.textContent = "Wallet Connected";
      walletPubkey.innerHTML = `SOL: <a href="https://explorer.solana.com/address/${mockWalletAddress}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">${mockWalletAddress.substring(0, 6)}...${mockWalletAddress.substring(mockWalletAddress.length - 6)}</a>`;

      btnClaimYield.disabled = false;

      // Mint controls
      if (pet.level >= 60) {
        reqLevelCheck.textContent = "✅";
        reqLevelCheck.className = "req-check valid";
        if (!pet.minted) {
          btnMintNft.disabled = false;
          reqMintCheck.textContent = "Eligible";
          reqMintCheck.className = "req-check valid";
          mintTxDisplay.classList.add("hidden");
        } else {
          btnMintNft.disabled = true;
          reqMintCheck.textContent = "MINTED (NFT)";
          reqMintCheck.className = "req-check valid";
          mintTxDisplay.classList.remove("hidden");
          if (pet.lastMintTxSignature) {
            txHashLink.innerHTML = `Address: <a href="https://explorer.solana.com/address/${pet.mintAddress}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">${pet.mintAddress.substring(0, 6)}...</a><br>Tx: <a href="https://explorer.solana.com/tx/${pet.lastMintTxSignature}?cluster=devnet" target="_blank" style="color:var(--color-pink); text-decoration:underline;">View Mint Tx</a>`;
          } else {
            txHashLink.innerHTML = `<a href="https://explorer.solana.com/address/${pet.mintAddress}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">${pet.mintAddress.substring(0, 8)}...</a>`;
          }
        }
      } else {
        reqLevelCheck.textContent = "❌";
        reqLevelCheck.className = "req-check invalid";
        btnMintNft.disabled = true;
        reqMintCheck.textContent = "Level 60 Required";
        reqMintCheck.className = "req-check invalid";
        mintTxDisplay.classList.add("hidden");
      }

      // Claim Tx controls
      const claimTxDisplay = document.getElementById("claim-tx-display");
      const claimTxHashLink = document.getElementById("claim-tx-hash-link");
      if (claimTxDisplay && claimTxHashLink) {
        if (state.lastClaimTxSignature) {
          claimTxDisplay.classList.remove("hidden");
          claimTxHashLink.innerHTML = `<a href="https://explorer.solana.com/tx/${state.lastClaimTxSignature}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">View Claim Tx</a>`;
        } else {
          claimTxDisplay.classList.add("hidden");
        }
      }
      
      syncNFTsFromWallet();
    } else {
      btnWalletConnect.textContent = "Connect Wallet";
      btnWalletConnect.classList.remove("connected");
      hudWalletDot.className = "dot-red";
      hudWalletText.textContent = "Wallet Disconnected";
      walletPubkey.textContent = "Connect to load Solana wallet...";

      btnMintNft.disabled = true;
      btnClaimYield.disabled = true;
      mintTxDisplay.classList.add("hidden");
      
      const claimTxDisplay = document.getElementById("claim-tx-display");
      if (claimTxDisplay) claimTxDisplay.classList.add("hidden");
    }

    // Trigger balance fetch
    fetchAndShowWalletBalances();
  }

  function fetchAndShowWalletBalances(force = false) {
    if (!isWalletConnected) {
      if (walletBalancesBox) walletBalancesBox.classList.add("hidden");
      return;
    }

    const now = Date.now();
    if (!force && isFetchingBalances) return;
    if (!force && (now - lastBalanceFetchTime < 15000)) {
      if (walletBalancesBox) walletBalancesBox.classList.remove("hidden");
      return;
    }

    isFetchingBalances = true;
    if (walletBalancesBox) walletBalancesBox.classList.remove("hidden");

    chrome.runtime.sendMessage({ action: "getWalletBalances" }, (res) => {
      isFetchingBalances = false;
      if (res && res.success) {
        lastBalanceFetchTime = Date.now();
        
        // Auto-align and sync if there is a mismatch between Supabase/UI state and background wallet
        if (res.userPubkey && mockWalletAddress !== res.userPubkey) {
          console.warn("Wallet public key mismatch detected. UI shows:", mockWalletAddress, "but Active is:", res.userPubkey, ". Aligning UI and syncing state...");
          mockWalletAddress = res.userPubkey;
          if (walletPubkey) {
            walletPubkey.innerHTML = `SOL: <a href="https://explorer.solana.com/address/${mockWalletAddress}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">${mockWalletAddress.substring(0, 6)}...${mockWalletAddress.substring(mockWalletAddress.length - 6)}</a>`;
          }
          chrome.runtime.sendMessage({
            type: "UPDATE_STATE",
            updates: { solanaWalletPubkey: res.userPubkey }
          });
        }

        if (userSolBalance) {
          userSolBalance.textContent = res.userBalance !== null ? `${res.userBalance.toFixed(4)} SOL` : "Error fetching";
        }
        if (deskBalanceEl) {
          deskBalanceEl.textContent = res.deskBalance !== undefined ? res.deskBalance.toFixed(4) : "0.0000";
        }
        state.desk = res.deskBalance !== undefined ? res.deskBalance : 0;
        if (distributorPubkey) {
          distributorPubkey.innerHTML = `<a href="https://explorer.solana.com/address/${res.distributorPubkey}?cluster=devnet" target="_blank" style="color:var(--color-cyan); text-decoration:underline;">${res.distributorPubkey.substring(0, 6)}...${res.distributorPubkey.substring(res.distributorPubkey.length - 6)}</a>`;
          distributorPubkey.setAttribute("data-pubkey", res.distributorPubkey);
        }
        if (distributorSolBalance) {
          distributorSolBalance.textContent = res.distributorBalance !== null ? `${res.distributorBalance.toFixed(4)} SOL` : "Error fetching";
        }
      } else {
        console.error("Failed to fetch wallet balances:", res ? res.error : "No response");
      }
    });
  }

  // Focus Timer Countdown Loop
  function syncFocusTimer(session) {
    const activeNow = session && session.active;
    if (activeNow) {
      focusDuration.disabled = true;
      btnFocusToggle.textContent = "Stop Focus";
      btnFocusToggle.classList.add("active");
      focusStatusText.textContent = session.isPaused ? "PAUSED (Idle)" : "Focusing...";

      const rewardVal = session.duration * 20;
      valReward.textContent = rewardVal;
      lastSessionActive = true;

      if (timerInterval) clearInterval(timerInterval);

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
              loadState();
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
      if (timerInterval) clearInterval(timerInterval);
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

  focusDuration.addEventListener("change", () => {
    const selectedMin = parseInt(focusDuration.value);
    focusTimerText.textContent = `${selectedMin.toString().padStart(2, "0")}:00`;
    valReward.textContent = selectedMin * 20;
  });

  btnFocusToggle.addEventListener("click", () => {
    if (state.focusSession && state.focusSession.active) {
      chrome.runtime.sendMessage({ action: "stopFocus" }, () => {
        lastSessionActive = true;
        loadState();
      });
    } else {
      const duration = parseInt(focusDuration.value);
      chrome.runtime.sendMessage({ action: "startFocus", duration }, () => {
        lastSessionActive = true;
        loadState();
      });
    }
  });

  // Arena Animations (Translating SVG instead of canvas drawing)
  let lastFrameTime = 0;
  function startArenaAnimationLoop() {
    function tick(timestamp) {
      if (timestamp - lastFrameTime > 60) {
        lastFrameTime = timestamp;

        const activeId = state?.activePetId || "sol-cat";
        const pet = state?.pets ? state.pets[activeId] : null;

        // Roaming intelligence inside the container
        if (pet && pet.status !== "sleep") {
          if (currentAction === "walk") {
            if (playpenTargetX !== null) {
              const dx = playpenTargetX - playpenX;
              if (Math.abs(dx) > 3) {
                playpenDir = Math.sign(dx);
                playpenX += playpenDir * 1.5;

                if (activePetRender) {
                  activePetRender.style.marginLeft = `${playpenX}px`;
                  activePetRender.style.transform = playpenDir < 0 ? "scaleX(-1)" : "scaleX(1)";
                  const walkSpecies = pet.species || (activeId.startsWith("sol-cat") ? "sol-cat" : (activeId.startsWith("astro-dog") ? "astro-dog" : (activeId.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
                  if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[walkSpecies]) {
                    activePetRender.innerHTML = PET_ASSETS[walkSpecies].render("walk", pet.stage || "Baby", pet.skin);
                  }
                }
              } else {
                currentAction = "idle";
                playpenTargetX = null;
                updateUI();
              }
            }
          }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function triggerTemporaryAction(actionName, duration = 1500) {
    if (actionTimeout) clearTimeout(actionTimeout);
    currentAction = actionName;
    updateUI();
    actionTimeout = setTimeout(() => {
      currentAction = "idle";
      updateUI();
    }, duration);
  }

  function idleActionChooser() {
    if (state && state.pets && state.pets[state.activePetId]) {
      const pet = state.pets[state.activePetId];
      if (pet.status === "sleep") return;
    }
    if (Math.random() < 0.3) {
      currentAction = "walk";
      playpenTargetX = 20 + Math.random() * 120;
    } else if (Math.random() < 0.1) {
      triggerTemporaryAction("excited", 2000);
    }
  }
  setInterval(idleActionChooser, 6000);

  // Quick Action Buttons
  arenaBtnPet.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "pet" }, (res) => {
      if (res && !res.success) {
        // Show cooldown/rate-limit message as a toast
        showToast(res.error || "Cannot pet right now.", "warning");
      } else {
        triggerTemporaryAction("excited");
      }
    });
  });

  arenaBtnFeed.addEventListener("click", () => {
    triggerTemporaryAction("excited");
    chrome.runtime.sendMessage({ action: "feed" });
  });

  arenaBtnSleep.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "sleep" });
  });

  // ⚔️ Equipment Slot Toggle — flip PET ARENA between pet view and gear slots
  const arenaGearBtn = document.getElementById("arena-btn-gear");
  const arenaEquipPanel = document.getElementById("arena-equipment-panel");
  const canvasContainerEl = document.querySelector(".canvas-container");
  let gearPanelOpen = false;

  if (arenaGearBtn && arenaEquipPanel && canvasContainerEl) {
    arenaGearBtn.addEventListener("click", () => {
      gearPanelOpen = !gearPanelOpen;
      if (gearPanelOpen) {
        canvasContainerEl.style.display = "none";
        arenaEquipPanel.style.display = "block";
        arenaGearBtn.style.borderColor = "#bd00ff";
        arenaGearBtn.style.color = "#bd00ff";
        arenaGearBtn.style.background = "rgba(189,0,255,0.1)";
        arenaGearBtn.textContent = "\u2715 Hide Equipment";
      } else {
        canvasContainerEl.style.display = "";
        arenaEquipPanel.style.display = "none";
        arenaGearBtn.style.borderColor = "rgba(189,0,255,0.4)";
        arenaGearBtn.style.color = "rgba(255,255,255,0.7)";
        arenaGearBtn.style.background = "";
        arenaGearBtn.textContent = "\u2694\ufe0f Equipment Slots";
      }
    });
  }

  btnRename.addEventListener("click", () => {
    const name = inputRename.value.trim();
    if (name) {
      chrome.runtime.sendMessage({ action: "renamePet", name });
    }
  });

  // Stat point Allocator
  document.querySelectorAll(".stat-plus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const statName = btn.dataset.stat;
      chrome.runtime.sendMessage({ action: "allocateStat", statName }, (response) => {
        if (response && response.state) {
          state = response.state;
          updateUI();
        } else {
          loadState();
        }
      });
    });
  });

  // Skin selectors
  document.querySelectorAll(".skin-dot").forEach(dot => {
    dot.addEventListener("click", (e) => {
      const skin = e.target.dataset.skin;
      chrome.runtime.sendMessage({ action: "changeSkin", skin });
    });
  });

  // Stable Swapper
  document.querySelectorAll(".stable-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const petId = btn.getAttribute("data-pet-id");
      chrome.runtime.sendMessage({ action: "changePet", petId });
    });
  });

  // Shop Buying — use event delegation so dynamically re-rendered buttons always work
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".buy-btn");
    if (!btn) return;
    const itemType = btn.getAttribute("data-item");
    const cost = parseInt(btn.getAttribute("data-cost"));
    btn.disabled = true;
    btn.textContent = "...";
    chrome.runtime.sendMessage({ action: "buyItem", itemType, cost }, (res) => {
      if (res && res.success) {
        addConsoleLog(`Bought 1x ${itemType} for ${cost} 💰`, "success");
        state = res.state;
        updateUI();
      } else {
        const errMsg = (res && res.error) ? res.error : "Purchase failed";
        addConsoleLog(`Buy failed: ${errMsg}`, "error");
        alert(errMsg);
      }
      btn.disabled = false;
      btn.textContent = `Buy (${cost}💰)`;
    });
  });

  // Shop Using — event delegation so dynamically re-rendered buttons always work
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".use-btn");
    if (!btn) return;
    const itemType = btn.getAttribute("data-item");
    btn.disabled = true;
    chrome.runtime.sendMessage({ action: "useItem", itemType }, (res) => {
      if (res && res.success) {
        addConsoleLog(`Used 1x ${itemType}!`, "success");
        state = res.state;
        updateUI();
      } else {
        const errMsg = (res && res.error) ? res.error : "Use failed";
        addConsoleLog(`Use failed: ${errMsg}`, "error");
      }
      btn.disabled = false;
    });
  });

  // Share on X
  btnShareX.addEventListener("click", () => {
    const activeId = state.activePetId || "sol-cat";
    const pet = state.pets ? state.pets[activeId] : null;
    if (!pet) return;

    const text = encodeURIComponent(`I'm caring for my Lv.${pet.level} DeskPet [${pet.name}]! XP: ${pet.xp}. Play along! #DeskPet #Solana`);
    const shareUrl = `https://x.com/intent/tweet?text=${text}`;
    window.open(shareUrl, "_blank");
  });

  // Wallet Connect
  btnWalletConnect.addEventListener("click", () => {
    if (isWalletConnected) return;
    btnWalletConnect.textContent = "Connecting...";
    chrome.runtime.sendMessage({ action: "getWallet" }, (res) => {
      if (res && res.success) {
        isWalletConnected = true;
        mockWalletAddress = res.publicKey;
        // Update state to include this public key
        chrome.runtime.sendMessage({
          type: "UPDATE_STATE",
          updates: { solanaWalletPubkey: res.publicKey }
        }, (updatedState) => {
          if (updatedState) {
            state = updatedState;
            updateUI();
          }
        });
      } else {
        btnWalletConnect.textContent = "Connect Wallet";
        alert(res ? res.error : "Failed to load wallet");
      }
    });
  });

  // Refresh Balances
  if (btnRefreshBalances) {
    btnRefreshBalances.addEventListener("click", () => {
      fetchAndShowWalletBalances(true);
      btnRefreshBalances.style.opacity = "0.5";
      setTimeout(() => btnRefreshBalances.style.opacity = "1", 500);
    });
  }

  // Airdrop User SOL
  if (btnAirdropUser) {
    btnAirdropUser.addEventListener("click", () => {
      btnAirdropUser.disabled = true;
      btnAirdropUser.textContent = "Airdropping...";
      if (faucetStatusMessage) faucetStatusMessage.textContent = "";
      
      chrome.runtime.sendMessage({ action: "requestAirdrop", target: "user" }, (res) => {
        btnAirdropUser.disabled = false;
        btnAirdropUser.textContent = "🪂 Airdrop User SOL";
        
        if (res && res.success) {
          if (userSolBalance) userSolBalance.textContent = `${res.balance.toFixed(4)} SOL`;
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-cyan)";
            faucetStatusMessage.textContent = res.message || "✅ Airdrop successful! +1 SOL";
          }
          // Delay balance refresh by 1.5 seconds to allow Solana ledger to commit state
          setTimeout(() => {
            fetchAndShowWalletBalances(true);
          }, 1500);
        } else {
          const errMsg = res ? res.error : "Unknown error";
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-pink)";
            faucetStatusMessage.textContent = `❌ Faucet failed: ${errMsg}`;
          }
          console.error("Airdrop failed:", errMsg);
        }
      });
    });
  }

  if (btnFaucetDesk) {
    btnFaucetDesk.addEventListener("click", () => {
      btnFaucetDesk.disabled = true;
      btnFaucetDesk.textContent = "Funding...";
      if (faucetStatusMessage) faucetStatusMessage.textContent = "";
      
      chrome.runtime.sendMessage({ action: "requestDeskFaucet" }, (res) => {
        btnFaucetDesk.disabled = false;
        btnFaucetDesk.textContent = "🪂 Airdrop User $DESK";
        
        if (res && res.success) {
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-cyan)";
            faucetStatusMessage.textContent = res.message || "✅ $DESK airdrop successful! +10,000 $DESK";
          }
          // Delay balance refresh by 1.5 seconds to allow Solana ledger to commit state
          setTimeout(() => {
            fetchAndShowWalletBalances(true);
          }, 1500);
        } else {
          const errMsg = res ? res.error : "Unknown error";
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-pink)";
            faucetStatusMessage.textContent = `❌ Faucet failed: ${errMsg}`;
          }
          console.error("$DESK airdrop failed:", errMsg);
        }
      });
    });
  }

  // Airdrop Distributor SOL
  if (btnAirdropDistributor) {
    btnAirdropDistributor.addEventListener("click", () => {
      btnAirdropDistributor.disabled = true;
      btnAirdropDistributor.textContent = "Funding...";
      if (faucetStatusMessage) faucetStatusMessage.textContent = "";
      
      chrome.runtime.sendMessage({ action: "requestAirdrop", target: "distributor" }, (res) => {
        btnAirdropDistributor.disabled = false;
        btnAirdropDistributor.textContent = "🪂 Fund Distributor";
        
        if (res && res.success) {
          if (distributorSolBalance) distributorSolBalance.textContent = `${res.balance.toFixed(4)} SOL`;
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-cyan)";
            faucetStatusMessage.textContent = "✅ Distributor funded! +2 SOL";
          }
          // Delay balance refresh by 1.5 seconds to allow Solana ledger to commit state
          setTimeout(() => {
            fetchAndShowWalletBalances(true);
          }, 1500);
        } else {
          const errMsg = res ? res.error : "Unknown error";
          if (faucetStatusMessage) {
            faucetStatusMessage.style.color = "var(--color-pink)";
            faucetStatusMessage.textContent = `❌ Limit/429. Fund manually using QuickNode Faucet link above!`;
          }
          console.error("Distributor funding failed:", errMsg);
        }
      });
    });
  }

  btnMintNft.addEventListener("click", async () => {
    if (!isWalletConnected) return;
    btnMintNft.disabled = true;
    btnMintNft.textContent = "MINTING...";
    addConsoleLog("Initializing background NFT minting...", "info");
    
    const activeId = state?.activePetId || "sol-cat";
    
    chrome.runtime.sendMessage({
      action: "mintPetNFT",
      petId: activeId
    }, (res) => {
      btnMintNft.disabled = false;
      if (res && res.success) {
        addConsoleLog(`Mint success! Hash: ${res.txSignature.substring(0, 10)}...`, "success");
        btnMintNft.textContent = "MINT COMPLETE!";
        loadState();
      } else {
        const errMsg = res ? res.error : "Unknown error";
        addConsoleLog(`Mint failed: ${errMsg}`, "error");
        btnMintNft.textContent = "MINT NFT (FAILED)";
      }
    });
  });

  // Claim Yield
  let yieldTickerInterval = null;
  function startYieldTicker() {
    if (yieldTickerInterval) clearInterval(yieldTickerInterval);
    yieldTickerInterval = setInterval(() => {
      if (state) {
        const activeId = state.activePetId || "sol-cat";
        const pet = state.pets ? state.pets[activeId] : null;
        if (pet) {
          const baseRateHr = 10;
          const levelMultiplier = 1 + (pet.level * 0.05);
          const statsMultiplier = 1 + ((pet.intelligence || 10) * 0.02);

          let rarityMultiplier = 1.0;
          const rarity = (pet.rarity || "Common").toLowerCase();
          if (rarity === "rare") rarityMultiplier = 1.25;
          else if (rarity === "epic") rarityMultiplier = 1.5;
          else if (rarity === "legendary") rarityMultiplier = 2.0;

          const activeRate = baseRateHr * levelMultiplier * statsMultiplier * rarityMultiplier;

          // Inactive pet stables scale contribution (25% yield each)
          let inactiveRateSum = 0;
          if (state.pets) {
            for (const petId in state.pets) {
              if (petId !== activeId) {
                const ip = state.pets[petId];
                const ipLevelMult = 1 + (ip.level * 0.05);
                const ipStatsMult = 1 + ((ip.intelligence || 10) * 0.02);
                let ipRarityMult = 1.0;
                const ipRarity = (ip.rarity || "Common").toLowerCase();
                if (ipRarity === "rare") ipRarityMult = 1.25;
                else if (ipRarity === "epic") ipRarityMult = 1.5;
                else if (ipRarity === "legendary") ipRarityMult = 2.0;

                const ipRate = baseRateHr * ipLevelMult * ipStatsMult * ipRarityMult;
                inactiveRateSum += (ipRate * 0.25);
              }
            }
          }

          let ratePerHour = activeRate + inactiveRateSum;

          // Active Bonding Boost (1.5x if interacted in last 15 mins)
          const bondingCooldown = 15 * 60 * 1000;
          const isBonded = state.lastActiveInteractTime && (Date.now() - state.lastActiveInteractTime < bondingCooldown);
          if (isBonded) {
            ratePerHour *= 1.5;
          }

          const ratePerMs = ratePerHour / (3600 * 1000);

          const now = Date.now();
          const lastYield = state.lastYieldTime || now;
          let elapsedMs = now - lastYield;
          const maxElapsedMs = 8 * 3600 * 1000;
          if (elapsedMs > maxElapsedMs) elapsedMs = maxElapsedMs;

          const currentSessionYield = elapsedMs * ratePerMs;
          const totalClaimable = (state.claimableYield || 0) + currentSessionYield;

          yieldRateVal.textContent = `${ratePerHour.toFixed(2)} $PETCOIN/hr`;
          if (isBonded) {
            yieldRateVal.innerHTML += ` <span style="color:#ffd700; font-size:10px;">⚡ BONDED (1.5x)</span>`;
          }
          yieldClaimableVal.textContent = `${totalClaimable.toFixed(4)} $PETCOIN`;
          btnClaimYield.disabled = (totalClaimable <= 0);
        }
      } else {
        yieldRateVal.textContent = "0.00 $PETCOIN/hr";
        yieldClaimableVal.textContent = "0.0000 $PETCOIN";
        btnClaimYield.disabled = true;
      }
    }, 1000);
  }

  btnClaimYield.addEventListener("click", async () => {
    btnClaimYield.disabled = true;
    btnClaimYield.textContent = "CLAIMING...";
    addConsoleLog("Initializing claim yield flow...", "info");
    
    chrome.runtime.sendMessage({ action: "claimYield" }, (res) => {
      btnClaimYield.disabled = false;
      btnClaimYield.textContent = "CLAIM $PETCOIN YIELD";
      
      if (res && res.success) {
        addConsoleLog("Yield claimed successfully!", "success");
        loadState();
      } else {
        const errorMsg = res ? res.error : "Unknown error";
        addConsoleLog(`Claim failed: ${errorMsg}`, "error");
      }
    });
  });



  // Shop & Sink Events
  const btnShopResetStats = document.getElementById("btn-shop-reset-stats");
  const btnShopBuySkin = document.getElementById("btn-shop-buy-skin");
  const btnShopBuySlot = document.getElementById("btn-shop-buy-slot");
  const shopSkinSelect = document.getElementById("shop-skin-select");

  if (btnShopResetStats) {
    btnShopResetStats.addEventListener("click", () => {
      const activeId = state.activePetId || "sol-cat";
      chrome.runtime.sendMessage({ action: "resetAttributes", petId: activeId }, (res) => {
        if (res && res.success) {
          addConsoleLog(`Stat attributes successfully reset!`, "success");
          loadState();
        } else {
          alert(res.error || "Reset failed");
        }
      });
    });
  }

  if (btnShopBuySkin && shopSkinSelect) {
    btnShopBuySkin.addEventListener("click", () => {
      const skinName = shopSkinSelect.value;
      chrome.runtime.sendMessage({ action: "buyCosmeticSkin", skinName }, (res) => {
        if (res && res.success) {
          addConsoleLog(`Custom Skin unlocked: ${skinName}!`, "success");
          loadState();
        } else {
          alert(res.error || "Purchase failed");
        }
      });
    });
  }

  if (btnShopBuySlot) {
    btnShopBuySlot.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "buyExtraStakingSlot" }, (res) => {
        if (res && res.success) {
          addConsoleLog(`Unlocked an extra Staking Slot!`, "success");
          loadState();
        } else {
          alert(res.error || "Purchase failed");
        }
      });
    });
  }


  // Privy Auth Action
  const btnPrivyLogin = document.getElementById("btn-privy-login");
  if (btnPrivyLogin) {
    btnPrivyLogin.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("privy-auth.html") });
    });
  }

  async function logoutPrivy() {
    if (typeof PrivySDK !== 'undefined' && PrivySDK.Privy) {
      try {
        const privyInstance = new PrivySDK.Privy({
          appId: CONFIG.PRIVY_APP_ID,
          storage: new PrivySDK.LocalStorage()
        });
        await privyInstance.initialize();
        const session = await privyInstance.user.get();
        await privyInstance.auth.logout(session?.user);
        addConsoleLog("Privy session cleared.", "info");
      } catch (e) {
        console.error("Privy logout warning:", e);
      }
    }
  }

  // Logout Trigger
  btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;
    btnLogout.textContent = "Logging out...";
    
    await logoutPrivy();

    if (supabase) {
      await supabase.auth.signOut();
    }
    chrome.runtime.sendMessage({ action: "logout" }, () => {
      addConsoleLog("Session terminated.", "info");
      previousSyncFingerprint = "";
      btnLogout.disabled = false;
      btnLogout.textContent = "Logout";
      loadState();
    });
  });

  // --- GAME NAVIGATION LOGIC ---
  document.querySelectorAll(".game-select-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const game = btn.getAttribute("data-game");

      // Hide stable view
      stableMetricsView.classList.remove("active");

      // Hide all other game contents
      document.querySelectorAll(".game-container .tab-content").forEach(c => {
        if (c.id !== `game-tab-${game}`) c.classList.remove("active");
      });

      // Show selected game contents
      const targetGameTab = document.getElementById(`game-tab-${game}`);
      if (targetGameTab) targetGameTab.classList.add("active");

      // Show back button, update title
      btnBackToStable.classList.remove("hidden");
      panelTitleText.textContent = `PLAYING: ${game.toUpperCase()}`;

      // Stop runner game first before booting
      stopRunnerGame();

      // Hook up PvP & Breeding initializers
      if (game === "pvp") {
        connectToPvPLobby();
      } else if (game === "breeding") {
        populateBreedingDropdowns();
      } else if (game === "store") {
        initStoreView();
      }
    });
  });

  btnBackToStable.addEventListener("click", () => {
    // Hide all game tabs
    document.querySelectorAll(".game-container .tab-content").forEach(c => {
      c.classList.remove("active");
    });

    // Show stable view
    stableMetricsView.classList.add("active");

    // Hide back button, reset title
    btnBackToStable.classList.add("hidden");
    panelTitleText.textContent = "PET STABLE STANDINGS";

    // Cancel active runner game execution
    stopRunnerGame();
  });

  // --- ON-CHAIN NFT AUTO-FETCHING & SYNC LOOP ---
  let isSyncingNFTs = false;
  let lastNftSyncTime = 0;
  async function syncNFTsFromWallet() {
    const now = Date.now();
    if (isSyncingNFTs || !isWalletConnected || !supabase) return;
    if (now - lastNftSyncTime < 15000) return; // 15s cooldown to prevent HTTP 429 RPC rate limits
    lastNftSyncTime = now;
    isSyncingNFTs = true;
    try {
      const walletsToQuery = [];
      if (state?.solanaWalletPubkey) walletsToQuery.push(state.solanaWalletPubkey);
      if (state?.userAccount?.walletAddress && state.userAccount.walletAddress !== state.solanaWalletPubkey) {
        walletsToQuery.push(state.userAccount.walletAddress);
      }
      if (mockWalletAddress && !walletsToQuery.includes(mockWalletAddress)) {
        walletsToQuery.push(mockWalletAddress);
      }

      if (walletsToQuery.length === 0) {
        isSyncingNFTs = false;
        return;
      }
      
      const tokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      const ownedNftMints = [];

      for (const wallet of walletsToQuery) {
        try {
          const response = await solanaRpcCall("getTokenAccountsByOwner", [
            wallet,
            { programId: tokenProgramId },
            { encoding: "jsonParsed" }
          ]);
          if (response && response.value) {
            response.value.forEach(acc => {
              const info = acc.account.data.parsed.info;
              if (info.tokenAmount.decimals === 0 && parseInt(info.tokenAmount.amount) === 1) {
                if (!ownedNftMints.includes(info.mint)) {
                  ownedNftMints.push(info.mint);
                }
              }
            });
          }
        } catch (err) {
          console.error(`Failed to fetch NFTs for wallet ${wallet}:`, err);
        }
      }
        
      if (ownedNftMints.length === 0 && Object.keys(state.pets).filter(id => state.pets[id].minted).length === 0) {
        isSyncingNFTs = false;
        return;
      }
      
      const { data: allStates, error } = await supabase.from('pet_state').select('*');
      if (error || !allStates) {
        console.error("Failed to load user states for NFT sync:", error);
        return;
      }
      
      const allMintedPets = {};
      allStates.forEach(row => {
        const pets = row.state_data?.pets || {};
        Object.values(pets).forEach(pet => {
          if (pet.minted && pet.mintAddress) {
            allMintedPets[pet.mintAddress] = pet;
          }
        });
      });
      
      let stateChanged = false;
      
      // A. Import: Owned on-chain NFT but not in our local state.pets
      for (const mint of ownedNftMints) {
        const sourcePet = allMintedPets[mint];
        if (sourcePet) {
          const localMatch = Object.values(state.pets).find(p => p.mintAddress === mint);
          if (!localMatch) {
            addConsoleLog(`On-chain NFT detected in wallet: ${sourcePet.name}. Importing to stable...`, "success");
            state.pets[sourcePet.id] = {
              ...sourcePet,
              staked: false,
              stakingSession: null,
              status: "idle",
              locked: false
            };
            stateChanged = true;
          }
        }
      }
      
      // B. Fraud Protection: In local stable but no longer owned on-chain
      for (const [id, pet] of Object.entries(state.pets)) {
        if (pet.minted && pet.mintAddress) {
          // 2-minute grace period for new mints / purchases to prevent indexer lag false positives
          const age = Date.now() - (pet.obtainedAt || pet.mintedAt || 0);
          const isGracePeriod = age < 120000;
          
          const stillOwned = ownedNftMints.includes(pet.mintAddress);
          if (!stillOwned && !isGracePeriod) {
            if (!pet.locked) {
              addConsoleLog(`On-chain NFT for ${pet.name} is no longer owned by this wallet. Locking pet.`, "warning");
              pet.locked = true;
              if (state.activePetId === id) {
                const unlockedPet = Object.values(state.pets).find(p => !p.locked && p.id !== id);
                state.activePetId = unlockedPet ? unlockedPet.id : null;
              }
              stateChanged = true;
            }
          } else if (stillOwned && pet.locked) {
            addConsoleLog(`On-chain NFT for ${pet.name} detected in wallet. Unlocking pet.`, "success");
            pet.locked = false;
            stateChanged = true;
          }
        }
      }
      
      if (stateChanged) {
        chrome.storage.local.set({ petState: state }, () => {
          loadState();
          if (supabase && state.userAccount.loggedIn) {
            (async () => {
              const sessionRes = await supabase.auth.getSession();
              const user = sessionRes?.data?.session?.user;
              if (user) {
                await supabase.from('pet_state').upsert({ 
                  user_id: user.id, 
                  state_data: state, 
                  updated_at: new Date().toISOString() 
                });
              }
            })();
          }
        });
      }
      
    } catch (e) {
      console.error("NFT Auto-Fetching failed:", e);
    } finally {
      isSyncingNFTs = false;
    }
  }

  // --- CYBER STORE GAME LOGIC ---
  async function initStoreView() {
    updateTreasurySupplyUI();
    
    const btnBuyEgg = document.getElementById("store-btn-buy-egg");
    const btnBuyTreasury = document.getElementById("store-btn-buy-treasury");
    
    if (btnBuyEgg) {
      btnBuyEgg.onclick = () => buyStoreItem("egg");
    }
    if (btnBuyTreasury) {
      btnBuyTreasury.onclick = () => buyStoreItem("treasury");
    }
  }

  async function updateTreasurySupplyUI() {
    const supplyEl = document.getElementById("store-treasury-supply");
    if (!supplyEl) return;
    if (!supabase) {
      supplyEl.textContent = "Supply: Connect Server";
      return;
    }
    try {
      const { data } = await supabase.from('global_config').select('value').eq('key', 'treasury_mint_count').maybeSingle();
      const count = data ? (data.value.count || 0) : 0;
      supplyEl.textContent = `Supply: ${count} / 3333`;
    } catch (e) {
      console.error("Failed to fetch treasury supply:", e);
    }
  }

  async function buyStoreItem(type) {
    if (!isWalletConnected) {
      alert("Please connect your Phantom/Privy wallet first.");
      return;
    }
    
    const price = type === "egg" ? 500 : 5000;
    
    // Check treasury limit
    if (type === "treasury" && supabase) {
      try {
        const { data } = await supabase.from('global_config').select('value').eq('key', 'treasury_mint_count').maybeSingle();
        const count = data ? (data.value.count || 0) : 0;
        if (count >= 3333) {
          alert("All 3,333 Limited Treasury Level 60 Pets have been minted!");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    addConsoleLog(`Initiating purchase of ${type} for ${price} $DESK...`, "info");
    
    const btnId = type === "egg" ? "store-btn-buy-egg" : "store-btn-buy-treasury";
    const btn = document.getElementById(btnId);
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "PROCESSING...";

    chrome.runtime.sendMessage({
      action: "buyStoreItem",
      itemType: type
    }, (res) => {
      btn.disabled = false;
      btn.textContent = origText;
      if (res && res.success) {
        addConsoleLog(`Purchase complete! ${res.name} welcomed to stable.`, "success");
        loadState();
      } else {
        const errMsg = res ? res.error : "Unknown error";
        addConsoleLog(`Purchase failed: ${errMsg}`, "error");
        alert("Purchase failed: " + errMsg);
      }
    });
  }

  // --- MEMORY MATCH GAME LOGIC ---
  const btnStartMemory = document.getElementById("btn-start-memory");
  const memoryGrid = document.getElementById("memory-grid");
  const memoryVictory = document.getElementById("memory-victory");
  const btnResetMemory = document.getElementById("btn-reset-memory");

  const emojis = ["👽", "🤖", "👾", "⚡", "🔋", "🔮", "🧬", "🛡️"];
  let flippedCards = [];
  let matchesFound = 0;

  btnStartMemory.addEventListener("click", () => {
    document.querySelector("#game-tab-memory .game-intro").classList.add("hidden");
    memoryGrid.classList.remove("hidden");
    initMemoryGame();
  });

  btnResetMemory.addEventListener("click", () => {
    memoryVictory.classList.add("hidden");
    memoryGrid.classList.remove("hidden");
    initMemoryGame();
  });

  function initMemoryGame() {
    memoryGrid.innerHTML = "";
    flippedCards = [];
    matchesFound = 0;

    const cardSet = [...emojis, ...emojis];
    cardSet.sort(() => Math.random() - 0.5);

    cardSet.forEach((emoji, index) => {
      const card = document.createElement("div");
      card.className = "memory-card";
      card.dataset.value = emoji;
      card.dataset.index = index;

      card.innerHTML = `
        <div class="card-front">${emoji}</div>
        <div class="card-back">?</div>
      `;

      card.addEventListener("click", () => handleCardClick(card));
      memoryGrid.appendChild(card);
    });
  }

  function handleCardClick(card) {
    if (flippedCards.length >= 2 || card.classList.contains("flipped") || card.classList.contains("matched")) return;

    card.classList.add("flipped");
    flippedCards.push(card);

    if (flippedCards.length === 2) {
      setTimeout(checkMemoryMatch, 800);
    }
  }

  function checkMemoryMatch() {
    const [card1, card2] = flippedCards;
    if (card1.dataset.value === card2.dataset.value) {
      card1.classList.add("matched");
      card2.classList.add("matched");
      matchesFound++;

      if (matchesFound === emojis.length) {
        setTimeout(() => {
          memoryGrid.classList.add("hidden");
          memoryVictory.classList.remove("hidden");

          chrome.runtime.sendMessage({ action: "addXpDirect", amount: 20 });
          chrome.runtime.sendMessage({ action: "payoutTokens", amount: 10 });
        }, 500);
      }
    } else {
      card1.classList.remove("flipped");
      card2.classList.remove("flipped");
    }
    flippedCards = [];
  }

  // --- NEON RUNNER GAME LOGIC ---
  const btnStartRunner = document.getElementById("btn-start-runner");
  const runnerIntro = document.getElementById("runner-intro");
  const runnerWrap = document.getElementById("runner-wrap");
  const runnerScoreEl = document.getElementById("runner-score");
  const runnerGameOver = document.getElementById("runner-gameover");
  const btnResetRunner = document.getElementById("btn-reset-runner");
  const runnerStatusTitle = document.getElementById("runner-status-title");
  const runnerRewardMsg = document.getElementById("runner-reward-msg");
  const runnerCanvas = document.getElementById("runner-canvas");

  let runnerCtx = runnerCanvas.getContext("2d");
  let runnerActive = false;
  let runnerLoopId = null;
  let runnerScore = 0;
  let runnerPhysics = {
    playerY: 140,
    playerVy: 0,
    gravity: 0.6,
    jumpPower: -11,
    isJumping: false,
    obstacles: [],
    speed: 3.5,
    spawnTimer: 0
  };

  btnStartRunner.addEventListener("click", () => {
    runnerIntro.classList.add("hidden");
    runnerWrap.classList.remove("hidden");
    startRunnerGame();
  });

  btnResetRunner.addEventListener("click", () => {
    runnerGameOver.classList.add("hidden");
    runnerWrap.classList.remove("hidden");
    startRunnerGame();
  });

  function startRunnerGame() {
    runnerScore = 0;
    runnerPhysics.playerY = 140;
    runnerPhysics.playerVy = 0;
    runnerPhysics.isJumping = false;
    runnerPhysics.obstacles = [];
    runnerPhysics.speed = 3.5;
    runnerPhysics.spawnTimer = 0;
    runnerActive = true;

    window.addEventListener("keydown", handleRunnerInput);
    runnerCanvas.addEventListener("touchstart", handleRunnerJumpClick);
    runnerCanvas.addEventListener("mousedown", handleRunnerJumpClick);

    runnerLoop();
  }

  function stopRunnerGame() {
    runnerActive = false;
    if (runnerLoopId) cancelAnimationFrame(runnerLoopId);
    window.removeEventListener("keydown", handleRunnerInput);
    if (runnerCanvas) {
      runnerCanvas.removeEventListener("touchstart", handleRunnerJumpClick);
      runnerCanvas.removeEventListener("mousedown", handleRunnerJumpClick);
    }
  }

  function handleRunnerInput(e) {
    if (e.code === "Space" || e.code === "ArrowUp") {
      jumpPlayer();
      e.preventDefault();
    }
  }

  // (rest of the code remains exactly unchanged to preserve all runner features)
  function handleRunnerJumpClick() {
    jumpPlayer();
  }

  function jumpPlayer() {
    if (!runnerPhysics.isJumping) {
      runnerPhysics.playerVy = runnerPhysics.jumpPower;
      runnerPhysics.isJumping = true;
    }
  }

  function runnerLoop() {
    if (!runnerActive) return;
    updateRunnerPhysics();
    drawRunnerScene();
    runnerLoopId = requestAnimationFrame(runnerLoop);
  }

  function updateRunnerPhysics() {
    runnerScore++;
    runnerScoreEl.textContent = runnerScore;

    runnerPhysics.playerY += runnerPhysics.playerVy;
    runnerPhysics.playerVy += runnerPhysics.gravity;

    if (runnerPhysics.playerY >= 140) {
      runnerPhysics.playerY = 140;
      runnerPhysics.playerVy = 0;
      runnerPhysics.isJumping = false;
    }

    runnerPhysics.speed = 3.5 + (runnerScore * 0.003);

    runnerPhysics.spawnTimer--;
    if (runnerPhysics.spawnTimer <= 0) {
      runnerPhysics.obstacles.push({
        x: runnerCanvas.width,
        width: 14 + Math.random() * 8,
        height: 20 + Math.random() * 20
      });
      runnerPhysics.spawnTimer = 90 + Math.random() * 60;
    }

    for (let i = runnerPhysics.obstacles.length - 1; i >= 0; i--) {
      const obs = runnerPhysics.obstacles[i];
      obs.x -= runnerPhysics.speed;

      const pX = 50;
      const pWidth = 24;
      const pHeight = 24;

      if (
        pX < obs.x + obs.width &&
        pX + pWidth > obs.x &&
        runnerPhysics.playerY < 140 + pHeight &&
        runnerPhysics.playerY + pHeight > 180 - obs.height
      ) {
        triggerRunnerGameOver();
      }

      if (obs.x + obs.width < 0) {
        runnerPhysics.obstacles.splice(i, 1);
      }
    }
  }

  function drawRunnerScene() {
    runnerCtx.fillStyle = "#0c0816";
    runnerCtx.fillRect(0, 0, runnerCanvas.width, runnerCanvas.height);

    runnerCtx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    runnerCtx.lineWidth = 2;
    runnerCtx.beginPath();
    runnerCtx.moveTo(0, 164);
    runnerCtx.lineTo(runnerCanvas.width, 164);
    runnerCtx.stroke();

    runnerCtx.save();
    runnerCtx.fillStyle = "#ff00bf";
    runnerCtx.shadowBlur = 12;
    runnerCtx.shadowColor = "#ff00bf";
    runnerCtx.fillRect(50, runnerPhysics.playerY, 24, 24);

    runnerCtx.fillStyle = "#ffffff";
    runnerCtx.shadowBlur = 8;
    runnerCtx.shadowColor = "#ffffff";
    runnerCtx.fillRect(66, runnerPhysics.playerY + 6, 4, 4);
    runnerCtx.fillRect(56, runnerPhysics.playerY + 6, 4, 4);

    runnerCtx.fillStyle = "#00f0ff";
    runnerCtx.shadowBlur = 8;
    runnerCtx.shadowColor = "#00f0ff";
    runnerCtx.fillRect(46, runnerPhysics.playerY + 4, 4, 4);
    runnerCtx.fillRect(46, runnerPhysics.playerY + 14, 4, 4);
    runnerCtx.restore();

    runnerPhysics.obstacles.forEach(obs => {
      runnerCtx.save();
      runnerCtx.fillStyle = "#00f0ff";
      runnerCtx.shadowBlur = 10;
      runnerCtx.shadowColor = "#00f0ff";

      runnerCtx.beginPath();
      runnerCtx.moveTo(obs.x, 164);
      runnerCtx.lineTo(obs.x + obs.width / 2, 164 - obs.height);
      runnerCtx.lineTo(obs.x + obs.width, 164);
      runnerCtx.closePath();
      runnerCtx.fill();

      runnerCtx.fillStyle = "#ffffff";
      runnerCtx.shadowBlur = 6;
      runnerCtx.shadowColor = "#ffffff";
      runnerCtx.beginPath();
      runnerCtx.moveTo(obs.x + obs.width / 4, 164);
      runnerCtx.lineTo(obs.x + obs.width / 2, 164 - obs.height * 0.6);
      runnerCtx.lineTo(obs.x + (obs.width * 3) / 4, 164);
      runnerCtx.closePath();
      runnerCtx.fill();

      runnerCtx.restore();
    });
  }

  function triggerRunnerGameOver() {
    stopRunnerGame();
    runnerWrap.classList.add("hidden");
    runnerGameOver.classList.remove("hidden");

    const milestoneAchieved = runnerScore >= 150;

    if (milestoneAchieved) {
      runnerStatusTitle.textContent = "MILESTONE REACHED!";
      runnerStatusTitle.style.color = "var(--color-green)";
      runnerRewardMsg.innerHTML = `Score: ${runnerScore}. Rewards: <span class="green-text">+30 XP | +15 $PETCOIN</span>`;

      chrome.runtime.sendMessage({ action: "addXpDirect", amount: 30 });
      chrome.runtime.sendMessage({ action: "payoutTokens", amount: 15 });
    } else {
      runnerStatusTitle.textContent = "GAME OVER";
      runnerStatusTitle.style.color = "var(--color-red)";
      runnerRewardMsg.textContent = `Score: ${runnerScore}. Goal: 150 points for bounty.`;
    }
  }

  // --- CLICKER GAME LOGIC ---
  const clickerZone = document.getElementById("clicker-zone");
  const clickerEffectText = document.getElementById("clicker-effect-text");
  const clickerCountEl = document.getElementById("clicker-count");
  let clickCount = 0;

  clickerZone.addEventListener("click", () => {
    const activeId = state?.activePetId || "sol-cat";
    const pet = state?.pets ? state.pets[activeId] : null;
    if (!pet || pet.status === "sleep") return;

    clickCount++;
    clickerCountEl.textContent = clickCount;

    clickerEffectText.classList.remove("clicker-pop-animation");
    void clickerEffectText.offsetWidth;
    clickerEffectText.classList.add("clicker-pop-animation");

    // Add stats to background
    const extraHappiness = Math.min(100, pet.happiness + 2);
    const extraEnergy = Math.min(100, pet.energy + 1);

    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: {
        pets: {
          ...state.pets,
          [activeId]: {
            ...pet,
            happiness: extraHappiness,
            energy: extraEnergy
          }
        }
      }
    });

    if (clickCount % 10 === 0) {
      chrome.runtime.sendMessage({ action: "addXpDirect", amount: 2 });
    }
  });

  // Browser-Side Web3 Helpers & Privy Providers
  async function getPrivySolanaProvider() {
    if (typeof PrivySDK === 'undefined' || !PrivySDK.Privy) {
      throw new Error("PrivySDK library is not loaded.");
    }
    const privyInstance = new PrivySDK.Privy({
      appId: CONFIG.PRIVY_APP_ID,
      storage: new PrivySDK.LocalStorage()
    });
    
    try {
      await privyInstance.initialize();
    } catch (e) {
      if (!e.message.toLowerCase().includes("no tokens")) {
        throw e;
      }
    }
    
    const userSession = await privyInstance.user.get();
    if (!userSession || !userSession.user) {
      throw new Error("User not authenticated with Privy");
    }
    
    let solanaWallet = PrivySDK.getUserEmbeddedSolanaWallet(userSession.user);
    if (!solanaWallet) {
      try {
        addConsoleLog("No embedded Solana wallet found. Provisioning one now...", "info");
        await privyInstance.embeddedWallet.create({ chainType: 'solana' });
        const updatedSession = await privyInstance.user.get();
        if (updatedSession && updatedSession.user) {
          solanaWallet = PrivySDK.getUserEmbeddedSolanaWallet(updatedSession.user);
        }
      } catch (createErr) {
        console.error("Failed to auto-provision embedded Solana wallet:", createErr);
        throw new Error("No embedded Solana wallet found, and auto-provisioning failed: " + createErr.message);
      }
    }
    
    if (!solanaWallet) {
      throw new Error("No embedded Solana wallet found.");
    }
    
    const entropy = PrivySDK.getEntropyDetailsFromAccount(solanaWallet);
    if (!entropy) {
      throw new Error("Failed to retrieve wallet entropy.");
    }
    
    const provider = await privyInstance.embeddedWallet.getSolanaProvider(
      solanaWallet,
      entropy.entropyId,
      entropy.entropyIdVerifier
    );
    
    return { provider, walletAddress: solanaWallet.address };
  }

  function uint8ArrayToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
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

  // ==========================================
  // ⚔️ PVP LOBBY CLIENT BINDINGS
  // ==========================================
  let lobbySocket = null;
  let pvpQueueState = false;
  let activeChallengerWallet = null;
  let battlePlayoutInterval = null;

  const pvpServerIndicator = document.getElementById("pvp-server-indicator");
  const pvpServerText = document.getElementById("pvp-server-text");
  const pvpPlayersList = document.getElementById("pvp-players-list");
  const pvpChatLog = document.getElementById("pvp-chat-log");
  const pvpChatInput = document.getElementById("pvp-chat-input");
  const pvpBtnChatSend = document.getElementById("pvp-btn-chat-send");
  const pvpBtnQueue = document.getElementById("pvp-btn-queue");

  const pvpChallengePrompt = document.getElementById("pvp-challenge-prompt");
  const pvpChallengerName = document.getElementById("pvp-challenger-name");
  const pvpChallengerPet = document.getElementById("pvp-challenger-pet");
  const pvpBtnAccept = document.getElementById("pvp-btn-accept");
  const pvpBtnDecline = document.getElementById("pvp-btn-decline");

  const pvpLobbyView = document.getElementById("pvp-lobby-view");
  const pvpBattleView = document.getElementById("pvp-battle-view");
  const pvpBattleOutcome = document.getElementById("pvp-battle-outcome");
  const pvpBtnOutcomeOk = document.getElementById("pvp-btn-outcome-ok");

  const SKIN_COLORS = {
    "neon-cyan": "#00e5ff",
    "neon-pink": "#ff007f",
    "neon-green": "#39ff14",
    "neon-gold": "#ffd700",
    "neon-purple": "#bd00ff",
    "neon-matrix": "#39ff14",
    "neon-rainbow": "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)"
  };

  function connectToPvPLobby() {
    if (lobbySocket && (lobbySocket.readyState === WebSocket.OPEN || lobbySocket.readyState === WebSocket.CONNECTING)) return;
    
    pvpServerText.textContent = "Connecting...";
    if (pvpServerIndicator) {
      pvpServerIndicator.className = "dot-red";
      pvpServerIndicator.style.background = "#ff3e3e";
    }

    const wsUrl = CONFIG.BACKEND_WS_URL || "ws://localhost:3000";
    lobbySocket = new WebSocket(`${wsUrl}/lobby`);

    lobbySocket.onopen = () => {
      pvpServerText.textContent = "CONNECTED";
      if (pvpServerIndicator) {
        pvpServerIndicator.className = "dot-green";
        pvpServerIndicator.style.background = "#39ff14";
      }

      const activeId = state?.activePetId || "sol-cat";
      const pet = state?.pets ? state.pets[activeId] : null;
      const wallet = mockWalletAddress || state?.solanaWalletPubkey || "0xMockWalletDev";
      const username = (state?.userAccount && state.userAccount.loggedIn) ? state.userAccount.email.split("@")[0] : "DeskPet Rider";

      lobbySocket.send(JSON.stringify({
        type: "init",
        walletAddress: wallet,
        username: username,
        activePet: pet
      }));
    };

    lobbySocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      switch (data.type) {
        case "lobby_update":
          renderLobbyPlayers(data.players);
          break;
        case "chat_broadcast":
          appendLobbyChat(data.sender, data.text);
          break;
        case "challenge_received":
          showChallengeReceived(data.challengerName, data.challengerWallet, data.challengerPet);
          break;
        case "challenge_declined":
          addConsoleLog(`Challenge declined by ${data.responderName}`, "info");
          break;
        case "battle_start":
          playoutBattle(data.opponent, data.logs, data.winnerWallet);
          break;
      }
    };

    lobbySocket.onclose = () => {
      pvpServerText.textContent = "DISCONNECTED";
      if (pvpServerIndicator) {
        pvpServerIndicator.className = "dot-red";
        pvpServerIndicator.style.background = "#ff3e3e";
      }
      // Reconnect after 5s
      setTimeout(connectToPvPLobby, 5000);
    };
  }

  function renderLobbyPlayers(players) {
    if (!pvpPlayersList) return;
    pvpPlayersList.innerHTML = "";
    const myWallet = mockWalletAddress || state?.solanaWalletPubkey || "0xMockWalletDev";
    const others = players.filter(p => p.walletAddress !== myWallet);

    if (others.length === 0) {
      pvpPlayersList.innerHTML = `<div style="color:rgba(255,255,255,0.3); text-align:center; margin-top:20px;">No other players online</div>`;
      return;
    }

    others.forEach(p => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.padding = "4px 6px";
      row.style.background = "rgba(255,255,255,0.03)";
      row.style.border = "1px solid rgba(255,255,255,0.05)";
      row.style.borderRadius = "4px";

      const info = document.createElement("div");
      info.innerHTML = `<strong style="color:#ffd700;">${p.username}</strong><br/><span style="color:rgba(255,255,255,0.5); font-size:9px;">${p.activePet ? `Lv.${p.activePet.level} ${p.activePet.name}` : 'No pet'}</span>`;

      const btn = document.createElement("button");
      btn.className = "hud-btn glow-cyan";
      btn.style.padding = "2px 6px";
      btn.style.fontSize = "9px";

      if (p.status === "battle") {
        btn.textContent = "In Battle";
        btn.disabled = true;
        btn.style.opacity = "0.5";
      } else if (p.status === "queue") {
        btn.textContent = "Queueing";
        btn.disabled = true;
        btn.style.opacity = "0.5";
      } else {
        btn.textContent = "Challenge";
        btn.onclick = () => {
          lobbySocket.send(JSON.stringify({
            type: "challenge",
            targetWallet: p.walletAddress
          }));
          btn.textContent = "Sent...";
          btn.disabled = true;
        };
      }

      row.appendChild(info);
      row.appendChild(btn);
      pvpPlayersList.appendChild(row);
    });
  }

  function appendLobbyChat(sender, text) {
    if (!pvpChatLog) return;
    const row = document.createElement("div");
    row.innerHTML = `<span style="color:#ffd700;">[${sender}]:</span> <span>${text}</span>`;
    pvpChatLog.appendChild(row);
    pvpChatLog.scrollTop = pvpChatLog.scrollHeight;
  }

  function showChallengeReceived(name, wallet, pet) {
    activeChallengerWallet = wallet;
    if (pvpChallengerName) pvpChallengerName.textContent = name;
    if (pvpChallengerPet) pvpChallengerPet.textContent = pet ? `Lv.${pet.level} ${pet.name}` : "Companion";
    if (pvpChallengePrompt) pvpChallengePrompt.classList.remove("hidden");
  }

  function playoutBattle(opponent, logs, winnerWallet) {
    if (pvpChallengePrompt) pvpChallengePrompt.classList.add("hidden");
    if (pvpLobbyView) pvpLobbyView.classList.add("hidden");
    if (pvpBattleView) pvpBattleView.classList.remove("hidden");
    
    const activeId = state?.activePetId || "sol-cat";
    const myPet = state?.pets ? state.pets[activeId] : null;

    if (document.getElementById("battle-pet-name-a")) {
      document.getElementById("battle-pet-name-a").textContent = myPet ? myPet.name : "Your Pet";
    }
    if (document.getElementById("battle-pet-name-b")) {
      document.getElementById("battle-pet-name-b").textContent = opponent.activePet ? opponent.activePet.name : "Opponent";
    }
    if (document.getElementById("battle-pet-owner-b")) {
      document.getElementById("battle-pet-owner-b").textContent = opponent.username;
    }

    const feed = document.getElementById("battle-combat-feed");
    if (feed) feed.innerHTML = "";

    let step = 0;
    if (battlePlayoutInterval) clearInterval(battlePlayoutInterval);

    // Initial HP
    const startFrame = logs.find(l => l.type === "start");
    let maxHpA = startFrame ? startFrame.petA.hp : 200;
    let maxHpB = startFrame ? startFrame.petB.hp : 200;

    battlePlayoutInterval = setInterval(() => {
      if (step >= logs.length) {
        clearInterval(battlePlayoutInterval);
        resolveBattleOutcome(winnerWallet);
        return;
      }

      const frame = logs[step];
      if (frame.type === "action") {
        if (feed) {
          const line = document.createElement("div");
          line.textContent = frame.message;
          if (frame.isCrit) line.style.color = "#ffb700";
          if (frame.isDodge) line.style.color = "#00c0ff";
          feed.appendChild(line);
          feed.scrollTop = feed.scrollHeight;
        }

        // Update HP Bars
        const hpPctA = Math.max(0, (frame.hpA / maxHpA) * 100);
        const hpPctB = Math.max(0, (frame.hpB / maxHpB) * 100);

        if (document.getElementById("battle-pet-hp-bar-a")) {
          document.getElementById("battle-pet-hp-bar-a").style.width = `${hpPctA}%`;
        }
        if (document.getElementById("battle-pet-hp-bar-b")) {
          document.getElementById("battle-pet-hp-bar-b").style.width = `${hpPctB}%`;
        }
        if (document.getElementById("battle-pet-hp-val-a")) {
          document.getElementById("battle-pet-hp-val-a").textContent = `${frame.hpA} / ${maxHpA} HP`;
        }
        if (document.getElementById("battle-pet-hp-val-b")) {
          document.getElementById("battle-pet-hp-val-b").textContent = `${frame.hpB} / ${maxHpB} HP`;
        }
      }
      step++;
    }, 1500);
  }

  function resolveBattleOutcome(winnerWallet) {
    const myWallet = mockWalletAddress || state?.solanaWalletPubkey || "0xMockWalletDev";
    const isWinner = (winnerWallet === myWallet);

    const outcomeTitle = document.getElementById("battle-outcome-title");
    const outcomeDesc = document.getElementById("battle-outcome-desc");

    if (pvpBattleOutcome) pvpBattleOutcome.classList.remove("hidden");

    if (isWinner) {
      if (outcomeTitle) {
        outcomeTitle.textContent = "🏆 VICTORY!";
        outcomeTitle.style.color = "#ffd700";
      }
      
      const newPetcoin = (state.petcoin || 0) + 500;
      const activeId = state.activePetId || "sol-cat";
      let updatedPets = { ...state.pets };
      if (updatedPets[activeId] && updatedPets[activeId].level < 60) {
        updatedPets[activeId].xp += 100;
      }

      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { petcoin: newPetcoin, pets: updatedPets }
      }, (updated) => {
        if (updated) state = updated;
        updateUI();
      });

      if (outcomeDesc) outcomeDesc.textContent = "You defeated your opponent! Rewards: +500 $PETCOIN | +100 XP to active pet.";
      addConsoleLog("PvP Victory! Earned +500 $PETCOIN, +100 XP.", "success");
    } else {
      if (outcomeTitle) {
        outcomeTitle.textContent = "💀 DEFEAT";
        outcomeTitle.style.color = "#ff3e3e";
      }

      const newPetcoin = (state.petcoin || 0) + 100;
      const activeId = state.activePetId || "sol-cat";
      let updatedPets = { ...state.pets };
      if (updatedPets[activeId] && updatedPets[activeId].level < 60) {
        updatedPets[activeId].xp += 20;
      }

      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { petcoin: newPetcoin, pets: updatedPets }
      }, (updated) => {
        if (updated) state = updated;
        updateUI();
      });

      if (outcomeDesc) outcomeDesc.textContent = "You were defeated. Consolation: +100 $PETCOIN | +20 XP to active pet.";
      addConsoleLog("PvP Defeat. Earned +100 $PETCOIN, +20 XP.", "info");
    }
  }

  // Hook chat input
  if (pvpBtnChatSend) pvpBtnChatSend.addEventListener("click", sendLobbyChat);
  if (pvpChatInput) {
    pvpChatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendLobbyChat();
    });
  }

  function sendLobbyChat() {
    if (!pvpChatInput) return;
    const text = pvpChatInput.value.trim();
    if (!text || !lobbySocket || lobbySocket.readyState !== WebSocket.OPEN) return;
    lobbySocket.send(JSON.stringify({
      type: "chat",
      text
    }));
    pvpChatInput.value = "";
  }

  // Hook queue button
  if (pvpBtnQueue) {
    pvpBtnQueue.addEventListener("click", () => {
      if (!lobbySocket || lobbySocket.readyState !== WebSocket.OPEN) return;
      pvpQueueState = !pvpQueueState;
      if (pvpQueueState) {
        lobbySocket.send(JSON.stringify({ type: "join_queue" }));
        pvpBtnQueue.textContent = "❌ CANCEL MATCHMAKING QUEUE";
        pvpBtnQueue.className = "hud-btn glow-pink";
      } else {
        lobbySocket.send(JSON.stringify({ type: "leave_queue" }));
        pvpBtnQueue.textContent = "⚔️ QUEUE FOR QUICK MATCH";
        pvpBtnQueue.className = "hud-btn glow-cyan";
      }
    });
  }

  // Hook challenge response buttons
  if (pvpBtnAccept) {
    pvpBtnAccept.addEventListener("click", () => {
      if (pvpChallengePrompt) pvpChallengePrompt.classList.add("hidden");
      if (lobbySocket && activeChallengerWallet) {
        lobbySocket.send(JSON.stringify({
          type: "challenge_respond",
          accepted: true,
          challengerWallet: activeChallengerWallet
        }));
      }
    });
  }

  if (pvpBtnDecline) {
    pvpBtnDecline.addEventListener("click", () => {
      if (pvpChallengePrompt) pvpChallengePrompt.classList.add("hidden");
      if (lobbySocket && activeChallengerWallet) {
        lobbySocket.send(JSON.stringify({
          type: "challenge_respond",
          accepted: false,
          challengerWallet: activeChallengerWallet
        }));
      }
      activeChallengerWallet = null;
    });
  }

  if (pvpBtnOutcomeOk) {
    pvpBtnOutcomeOk.addEventListener("click", () => {
      if (pvpBattleOutcome) pvpBattleOutcome.classList.add("hidden");
      if (pvpBattleView) pvpBattleView.classList.add("hidden");
      if (pvpLobbyView) pvpLobbyView.classList.remove("hidden");
      pvpQueueState = false;
      if (pvpBtnQueue) {
        pvpBtnQueue.textContent = "⚔️ QUEUE FOR QUICK MATCH";
        pvpBtnQueue.className = "hud-btn glow-cyan";
      }
    });
  }


  // ==========================================
  // 🧬 BREEDING GAME TAB CLIENT BINDINGS
  // ==========================================
  const breedSelectParentA = document.getElementById("breed-select-parent-a");
  const breedSelectParentB = document.getElementById("breed-select-parent-b");
  const breedPreviewA = document.getElementById("breed-preview-a");
  const breedPreviewB = document.getElementById("breed-preview-b");
  const breedPreviewColorA = document.getElementById("breed-preview-color-a");
  const breedPreviewColorB = document.getElementById("breed-preview-color-b");
  const breedPreviewColorBaby = document.getElementById("breed-preview-color-baby");
  const breedBtnSubmit = document.getElementById("breed-btn-submit");

  const breedNewbornCard = document.getElementById("breed-newborn-card");
  const breedBabyName = document.getElementById("breed-baby-name");
  const breedBabyRarity = document.getElementById("breed-baby-rarity");
  const breedBurnNotification = document.getElementById("breed-burn-notification");
  const breedBabyStats = document.getElementById("breed-baby-stats");
  const breedBabyAvatarCircle = document.getElementById("breed-baby-avatar-circle");
  const breedBtnNewbornOk = document.getElementById("breed-btn-newborn-ok");

  function populateBreedingDropdowns() {
    if (!breedSelectParentA || !breedSelectParentB) return;
    breedSelectParentA.innerHTML = '<option value="">- Select Parent A -</option>';
    breedSelectParentB.innerHTML = '<option value="">- Select Parent B -</option>';
    
    if (!state || !state.pets) return;

    // Filter Level 60 pets
    const eligiblePets = Object.values(state.pets).filter(p => p.level === 60);

    if (eligiblePets.length < 2) {
      if (breedPreviewA) breedPreviewA.textContent = "Requires at least two Level 60 pets.";
      if (breedPreviewB) breedPreviewB.textContent = "Requires at least two Level 60 pets.";
      if (breedBtnSubmit) {
        breedBtnSubmit.disabled = true;
        breedBtnSubmit.style.opacity = "0.5";
      }
      return;
    }

    if (breedBtnSubmit) {
      breedBtnSubmit.disabled = false;
      breedBtnSubmit.style.opacity = "1";
    }

    eligiblePets.forEach(p => {
      const optA = document.createElement("option");
      optA.value = p.id;
      optA.textContent = `${p.name} (Lv.60 ${p.rarity})`;
      
      const optB = optA.cloneNode(true);

      breedSelectParentA.appendChild(optA);
      breedSelectParentB.appendChild(optB);
    });
  }

  function updateBreedPreviews() {
    if (!breedSelectParentA || !breedSelectParentB) return;
    const idA = breedSelectParentA.value;
    const idB = breedSelectParentB.value;

    const petA = state?.pets ? state.pets[idA] : null;
    const petB = state?.pets ? state.pets[idB] : null;

    const breedAvatarA = document.getElementById("breed-avatar-a");
    const breedAvatarB = document.getElementById("breed-avatar-b");

    if (petA) {
      if (breedPreviewA) breedPreviewA.innerHTML = `STR: ${petA.strength} | AGI: ${petA.agility}<br/>INT: ${petA.intelligence} | STA: ${petA.stamina}`;
      if (breedPreviewColorA) breedPreviewColorA.style.background = SKIN_COLORS[petA.skin] || "#fff";
      if (breedAvatarA) {
        const petSpecies = petA.species || (petA.id.startsWith("sol-cat") ? "sol-cat" : (petA.id.startsWith("astro-dog") ? "astro-dog" : (petA.id.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
        const petSvg = typeof PET_ASSETS !== "undefined" && PET_ASSETS[petSpecies]
          ? PET_ASSETS[petSpecies].render("idle", petA.stage || "Baby", petA.skin)
          : "";
        breedAvatarA.innerHTML = petSvg;
      }
    } else {
      if (breedPreviewA) breedPreviewA.textContent = "- No Pet Selected -";
      if (breedPreviewColorA) breedPreviewColorA.style.background = "transparent";
      if (breedAvatarA) {
        breedAvatarA.innerHTML = `
          <div class="breed-capsule-empty">
            <span>🧪 CHAMBER A</span>
            <span style="font-size:9px; opacity:0.6;">OFFLINE</span>
          </div>
        `;
      }
    }

    if (petB) {
      if (breedPreviewB) breedPreviewB.innerHTML = `STR: ${petB.strength} | AGI: ${petB.agility}<br/>INT: ${petB.intelligence} | STA: ${petB.stamina}`;
      if (breedPreviewColorB) breedPreviewColorB.style.background = SKIN_COLORS[petB.skin] || "#fff";
      if (breedAvatarB) {
        const petSpecies = petB.species || (petB.id.startsWith("sol-cat") ? "sol-cat" : (petB.id.startsWith("astro-dog") ? "astro-dog" : (petB.id.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
        const petSvg = typeof PET_ASSETS !== "undefined" && PET_ASSETS[petSpecies]
          ? PET_ASSETS[petSpecies].render("idle", petB.stage || "Baby", petB.skin)
          : "";
        breedAvatarB.innerHTML = petSvg;
      }
    } else {
      if (breedPreviewB) breedPreviewB.textContent = "- No Pet Selected -";
      if (breedPreviewColorB) breedPreviewColorB.style.background = "transparent";
      if (breedAvatarB) {
        breedAvatarB.innerHTML = `
          <div class="breed-capsule-empty">
            <span>🧪 CHAMBER B</span>
            <span style="font-size:9px; opacity:0.6;">OFFLINE</span>
          </div>
        `;
      }
    }

    if (petA && petB) {
      if (breedPreviewColorBaby) {
        const bgA = SKIN_COLORS[petA.skin] || '#fff';
        const bgB = SKIN_COLORS[petB.skin] || '#fff';
        breedPreviewColorBaby.style.background = `linear-gradient(135deg, ${bgA}, ${bgB})`;
      }
    } else {
      if (breedPreviewColorBaby) breedPreviewColorBaby.style.background = "transparent";
    }
  }

  if (breedSelectParentA) breedSelectParentA.addEventListener("change", updateBreedPreviews);
  if (breedSelectParentB) breedSelectParentB.addEventListener("change", updateBreedPreviews);

  if (breedBtnSubmit) {
    breedBtnSubmit.addEventListener("click", () => {
      const idA = breedSelectParentA.value;
      const idB = breedSelectParentB.value;

      if (!idA || !idB) {
        alert("Please select both parents.");
        return;
      }

      if (idA === idB) {
        alert("Parents must be different pets!");
        return;
      }

      const petA = state.pets[idA];
      const petB = state.pets[idB];

      if (state.petcoin < 100000 || state.desk < 5000) {
        alert("Insufficient funds. You need 100,000 $PETCOIN and 5,000 $DESK to breed.");
        return;
      }

      breedBtnSubmit.disabled = true;
      breedBtnSubmit.textContent = "🧬 BREEDING IN PROGRESS...";

      chrome.runtime.sendMessage({
        action: "breedPets",
        parentAId: idA,
        parentBId: idB
      }, (res) => {
        breedBtnSubmit.disabled = false;
        breedBtnSubmit.textContent = "🧬 INITIATE GENE FUSION (100k💰 | 5k💖)";
        
        if (res && res.success && res.babyPet) {
          state = res.state;
          updateUI();
          
          // Display Newborn Screen
          if (breedBabyName) breedBabyName.textContent = res.babyPet.name;
          if (breedBabyRarity) {
            breedBabyRarity.textContent = `${res.babyPet.rarity} Companion`;
            breedBabyRarity.style.color = res.babyPet.rarity === "Legendary" ? "#ffb700" : (res.babyPet.rarity === "Epic" ? "#bd00ff" : (res.babyPet.rarity === "Rare" ? "#00c0ff" : "#808080"));
          }
          if (breedBurnNotification) {
            if (res.burnedParentName) {
              breedBurnNotification.textContent = `🔥 High Stakes: ${res.burnedParentName} was burned!`;
              breedBurnNotification.classList.remove("hidden");
            } else {
              breedBurnNotification.classList.add("hidden");
            }
          }
          if (breedBabyStats) {
            breedBabyStats.innerHTML = `
              <div>STR: ${res.babyPet.strength}</div>
              <div>AGI: ${res.babyPet.agility}</div>
              <div>INT: ${res.babyPet.intelligence}</div>
              <div>STA: ${res.babyPet.stamina}</div>
            `;
          }
          if (breedBabyAvatarCircle) {
            const bgA = SKIN_COLORS[petA.skin] || '#fff';
            const bgB = SKIN_COLORS[petB.skin] || '#fff';
            breedBabyAvatarCircle.style.background = `linear-gradient(135deg, ${bgA}, ${bgB})`;
          }
          
          if (breedNewbornCard) breedNewbornCard.classList.remove("hidden");
          addConsoleLog(`Success! Bred new companion [${res.babyPet.name}]!`, "success");
        } else {
          const errMsg = res ? res.error : "Unknown error";
          alert(errMsg || "Breeding failed.");
        }
      });
    });
  }

  if (breedBtnNewbornOk) {
    breedBtnNewbornOk.addEventListener("click", () => {
      if (breedNewbornCard) breedNewbornCard.classList.add("hidden");
      if (btnBackToStable) btnBackToStable.click(); // Return to stables view
    });
  }
});
