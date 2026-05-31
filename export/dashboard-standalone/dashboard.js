// --- STANDALONE MOCK STATE ---
window.chrome = {
  runtime: {
    sendMessage: function(msg, callback) {
      if (msg.type === "GET_STATE") {
        if (callback) callback(window.mockDeskpetState);
      } else if (msg.type === "UPDATE_STATE") {
        window.mockDeskpetState = { ...window.mockDeskpetState, ...msg.updates };
        if (callback) callback(window.mockDeskpetState);
        window.dispatchEvent(new CustomEvent("STATE_UPDATED", { detail: window.mockDeskpetState }));
      } else if (msg.type === "ADD_XP") {
        window.mockDeskpetState.xp += msg.amount;
        while(window.mockDeskpetState.xp >= (window.mockDeskpetState.level * 30 + 20)) {
          window.mockDeskpetState.xp -= (window.mockDeskpetState.level * 30 + 20);
          window.mockDeskpetState.level++;
          window.mockDeskpetState.statPoints += 3;
        }
        if (callback) callback(window.mockDeskpetState);
        window.dispatchEvent(new CustomEvent("STATE_UPDATED", { detail: window.mockDeskpetState }));
      } else if (msg.type === "PROGRESS_QUEST") {
        const quest = window.mockDeskpetState.dailyQuests.find(q => q.id === msg.questId);
        if (quest && !quest.completed) {
          quest.current = Math.min(quest.target, quest.current + msg.amount);
          if (quest.current >= quest.target) {
             quest.completed = true;
             window.mockDeskpetState.xp += quest.rewardXp;
             window.mockDeskpetState.deskBalance += quest.rewardTokens;
          }
        }
        if (callback) callback(window.mockDeskpetState);
        window.dispatchEvent(new CustomEvent("STATE_UPDATED", { detail: window.mockDeskpetState }));
      } else if (msg.type === "OPEN_DASHBOARD") {
        alert("Dashboard would open here! (Mock)");
        if (callback) callback({success:true});
      }
    },
    onMessage: {
      addListener: function(listener) {
        window.addEventListener("STATE_UPDATED", (e) => {
          listener({ type: "STATE_UPDATED", state: e.detail });
        });
      }
    }
  },
  storage: {
    local: {
      get: function(keys, callback) {
        if (callback) callback({ deskpet_position: { x: window.innerWidth - 120, y: window.innerHeight - 150 } });
      },
      set: function(obj, callback) {
        if (callback) callback();
      }
    }
  }
};

window.mockDeskpetState = {
  petName: "Neon Buddy",
  level: 1,
  xp: 0,
  happiness: 80,
  energy: 80,
  intelligence: 5,
  strength: 5,
  charm: 5,
  statPoints: 0,
  rarity: "Common",
  activePetSkin: "neon-cyan",
  walletConnected: false,
  deskBalance: 0,
  nftMinted: false,
  mintTx: "",
  isSleeping: false,
  showFloatingPet: true,
  dailyQuests: [
    { id: "active_time", text: "Keep browser active (passive time)", target: 60, current: 0, rewardXp: 15, rewardTokens: 5, completed: false },
    { id: "play_games", text: "Play mini-games 2 times", target: 2, current: 0, rewardXp: 20, rewardTokens: 10, completed: false },
    { id: "feed_pet", text: "Feed your pet 3 times", target: 3, current: 0, rewardXp: 10, rewardTokens: 5, completed: false },
    { id: "share_x", text: "Share your pet on X/Twitter", target: 1, current: 0, rewardXp: 25, rewardTokens: 15, completed: false }
  ]
};
// --- END STANDALONE MOCK STATE ---

// DeskPet - Dashboard Controller

document.addEventListener("DOMContentLoaded", () => {
  let state = null;
  let animFrame = 0;
  let currentAction = "idle";
  let actionTimeout = null;
  let playpenX = 80;
  let playpenTargetX = null;
  let playpenDir = 1;

  // DOM Elements
  const arenaCanvas = document.getElementById("arena-canvas");
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
  const statIntVal = document.getElementById("stat-int-val");
  const statChmVal = document.getElementById("stat-chm-val");
  const statPointsPool = document.getElementById("stat-points-pool");
  const hudXpRatio = document.getElementById("hud-xp-ratio");
  const hudXpBar = document.getElementById("hud-xp-bar");
  
  const questsList = document.getElementById("quests-list");
  
  // Wallet
  const btnWalletConnect = document.getElementById("btn-wallet-connect");
  const walletHud = document.getElementById("wallet-hud");
  const deskBalanceEl = document.getElementById("desk-balance");
  const hudWalletDot = document.getElementById("hud-wallet-dot");
  const hudWalletText = document.getElementById("hud-wallet-text");
  const walletPubkey = document.getElementById("wallet-pubkey");

  // Web3 Sections
  const reqLevelCheck = document.getElementById("req-level-check");
  const reqMintCheck = document.getElementById("req-mint-check");
  const btnMintNft = document.getElementById("btn-mint-nft");
  const mintTxDisplay = document.getElementById("mint-tx-display");
  const txHashLink = document.getElementById("tx-hash-link");
  
  const yieldRateVal = document.getElementById("yield-rate-val");
  const yieldClaimableVal = document.getElementById("yield-claimable-val");
  const btnClaimYield = document.getElementById("btn-claim-yield");
  
  const btnBreedPets = document.getElementById("btn-breed-pets");
  const breedSuccessMsg = document.getElementById("breed-success-msg");

  // Load state on start
  loadState();

  // Listen to background syncs
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

  function updateUI() {
    if (!state) return;

    // Pet Display
    arenaPetName.textContent = state.petName;
    arenaPetLevel.textContent = `LEVEL ${state.level}`;
    inputRename.value = state.petName;

    if (state.isSleeping) {
      arenaSleepScreen.classList.remove("hidden");
    } else {
      arenaSleepScreen.classList.add("hidden");
    }

    // Stats Allocator
    statStrVal.textContent = state.strength;
    statIntVal.textContent = state.intelligence;
    statChmVal.textContent = state.charm;
    statPointsPool.textContent = state.statPoints;

    // Disable plus buttons if pool is empty
    document.querySelectorAll(".stat-plus-btn").forEach(btn => {
      btn.disabled = (state.statPoints <= 0);
    });

    // XP
    const xpNeeded = state.level * 30 + 20;
    hudXpRatio.textContent = `${state.xp} / ${xpNeeded}`;
    hudXpBar.style.width = `${(state.xp / xpNeeded) * 100}%`;

    // Active skin highlighter
    document.querySelectorAll(".skin-dot").forEach(dot => {
      if (dot.dataset.skin === state.activePetSkin) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    // Render Quests list
    renderQuests();

    // Wallet Status
    updateWalletUI();
  }

  function updateWalletUI() {
    if (state.walletConnected) {
      btnWalletConnect.textContent = "Phantom Locked";
      btnWalletConnect.classList.add("connected");
      hudWalletDot.className = "dot-green";
      hudWalletText.textContent = "Wallet Connected";
      walletPubkey.textContent = "SOL: 5k3pMNE...H9qEb4Yt";
      deskBalanceEl.textContent = state.deskBalance.toFixed(2);

      // Web3 Buttons Unlock
      btnClaimYield.disabled = false;

      if (state.deskBalance >= 100) {
        btnBreedPets.disabled = false;
      } else {
        btnBreedPets.disabled = true;
      }

      // Mint controls
      if (state.level >= 10) {
        reqLevelCheck.textContent = "✅";
        reqLevelCheck.className = "req-check valid";
        if (!state.nftMinted) {
          btnMintNft.disabled = false;
          reqMintCheck.textContent = "Eligible";
          reqMintCheck.className = "req-check valid";
        } else {
          btnMintNft.disabled = true;
          reqMintCheck.textContent = "MINTED (NFT)";
          reqMintCheck.className = "req-check valid";
          showMintHash();
        }
      } else {
        reqLevelCheck.textContent = "❌";
        reqLevelCheck.className = "req-check invalid";
        btnMintNft.disabled = true;
        reqMintCheck.textContent = "Level 10 Required";
        reqMintCheck.className = "req-check invalid";
      }
    } else {
      btnWalletConnect.textContent = "Connect Phantom";
      btnWalletConnect.classList.remove("connected");
      hudWalletDot.className = "dot-red";
      hudWalletText.textContent = "Wallet Disconnected";
      walletPubkey.textContent = "Connect to load Solana wallet...";
      deskBalanceEl.textContent = "0.00";

      btnMintNft.disabled = true;
      btnClaimYield.disabled = true;
      btnBreedPets.disabled = true;
      mintTxDisplay.classList.add("hidden");
    }
  }

  function showMintHash() {
    mintTxDisplay.classList.remove("hidden");
    txHashLink.textContent = state.mintTx ? state.mintTx.substring(0, 24) + "..." : "Simulated Metaplex Tx";
  }

  // Arena Animations
  let lastFrameTime = 0;
  function startArenaAnimationLoop() {
    function tick(timestamp) {
      if (timestamp - lastFrameTime > 120) { // ~8 FPS
        animFrame++;
        lastFrameTime = timestamp;

        // Roaming intelligence inside the container
        if (state && !state.isSleeping) {
          if (currentAction === "walk") {
            if (playpenTargetX !== null) {
              const dx = playpenTargetX - playpenX;
              if (Math.abs(dx) > 3) {
                playpenDir = Math.sign(dx);
                playpenX += playpenDir * 2;
              } else {
                currentAction = "idle";
                playpenTargetX = null;
              }
            }
          }

          // Random roaming decider
          if (Math.random() < 0.05 && currentAction === "idle") {
            currentAction = "walk";
            playpenTargetX = 20 + Math.random() * 120;
          }
        }

        // Draw Canvas
        if (state && window.PetEngine) {
          const happinessVal = state.happiness;
          const sadnessRatio = (100 - happinessVal) / 100;
          
          // Clear and scale
          const ctx = arenaCanvas.getContext("2d");
          ctx.clearRect(0, 0, arenaCanvas.width, arenaCanvas.height);
          
          // Render inside context offset to allow movement
          ctx.save();
          // Adjust position inside canvas
          ctx.translate(playpenX, 60);

          window.PetEngine.draw(
            arenaCanvas,
            currentAction,
            animFrame,
            state.activePetSkin,
            state.level,
            state.isSleeping,
            sadnessRatio
          );

          ctx.restore();
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function triggerAction(actionName, duration = 1500) {
    if (actionTimeout) clearTimeout(actionTimeout);
    currentAction = actionName;
    actionTimeout = setTimeout(() => {
      currentAction = "idle";
    }, duration);
  }

  // Interactions
  arenaBtnPet.addEventListener("click", () => {
    if (state.isSleeping) return;
    triggerAction("excited");
    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { energy: Math.min(100, state.energy + 10) }
    });
    chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "feed_pet", amount: 1 });
  });

  arenaBtnFeed.addEventListener("click", () => {
    if (state.isSleeping) return;
    triggerAction("excited");
    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { happiness: Math.min(100, state.happiness + 15) }
    });
    chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "feed_pet", amount: 1 });
  });

  arenaBtnSleep.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { isSleeping: !state.isSleeping }
    });
  });

  // Rename Box
  btnRename.addEventListener("click", () => {
    const val = inputRename.value.trim();
    if (val) {
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { petName: val }
      });
    }
  });

  // Stats plus allocator clicks
  document.querySelectorAll(".stat-plus-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (state.statPoints <= 0) return;
      const statName = e.target.dataset.stat;
      const updates = { statPoints: state.statPoints - 1 };
      
      if (statName === "strength") updates.strength = state.strength + 1;
      else if (statName === "intelligence") updates.intelligence = state.intelligence + 1;
      else if (statName === "charm") updates.charm = state.charm + 1;

      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates
      });
    });
  });

  // Skin selectors
  document.querySelectorAll(".skin-dot").forEach(dot => {
    dot.addEventListener("click", (e) => {
      const selectedSkin = e.target.dataset.skin;
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { activePetSkin: selectedSkin }
      });
    });
  });

  // Share on X
  btnShareX.addEventListener("click", () => {
    const text = encodeURIComponent(`I'm caring for my Lv.${state.level} DeskPet [${state.petName}]! XP: ${state.xp}. Play along! #DeskPet #Solana`);
    const shareUrl = `https://x.com/intent/tweet?text=${text}`;
    window.open(shareUrl, "_blank");

    chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "share_x", amount: 1 });
  });

  // Wallet Connect Mock
  btnWalletConnect.addEventListener("click", () => {
    if (state.walletConnected) return; // remains connected in session
    btnWalletConnect.textContent = "Connecting...";
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { walletConnected: true }
      });
    }, 800);
  });

  // Daily Quests Render
  function renderQuests() {
    questsList.innerHTML = "";
    if (!state.dailyQuests) return;

    state.dailyQuests.forEach(q => {
      const item = document.createElement("div");
      item.className = `quest-item ${q.completed ? "completed" : ""}`;
      
      const widthPct = (q.current / q.target) * 100;
      const statusBadge = q.completed 
        ? `<span class="quest-status-badge claimed">CLAIMED</span>`
        : `<span class="quest-status-badge pending">PENDING</span>`;

      item.innerHTML = `
        <div class="quest-info">
          <span class="quest-text">${q.text}</span>
          <span class="quest-reward">+${q.rewardXp} XP | +${q.rewardTokens} $DESK</span>
        </div>
        <div class="quest-progress-wrap">
          <div class="quest-bar-bg">
            <div class="quest-bar-fill" style="width: ${widthPct}%"></div>
          </div>
          <span class="quest-ratio">${q.current}/${q.target}</span>
          ${statusBadge}
        </div>
      `;
      questsList.appendChild(item);
    });
  }

  // --- GAME TABS ---
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      e.target.classList.add("active");
      document.getElementById(`game-tab-${e.target.dataset.tab}`).classList.add("active");

      // Pause runner if active and switching away
      if (e.target.dataset.tab !== "runner") {
        stopRunnerGame();
      }
    });
  });

  // --- MEMORY MATCH GAME LOGIC ---
  const btnStartMemory = document.getElementById("btn-start-memory");
  const memoryGrid = document.getElementById("memory-grid");
  const memoryVictory = document.getElementById("memory-victory");
  const btnResetMemory = document.getElementById("btn-reset-memory");
  
  const emojis = ["👽", "🤖", "👾", "⚡", "🔋", "🔮", "🧬", "🛡️"];
  let memoryCards = [];
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
    
    // Create double set and shuffle
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
        // Game Won!
        setTimeout(() => {
          memoryGrid.classList.add("hidden");
          memoryVictory.classList.remove("hidden");

          // Rewards
          chrome.runtime.sendMessage({ type: "ADD_XP", amount: 20 });
          chrome.runtime.sendMessage({
            type: "UPDATE_STATE",
            updates: { deskBalance: state.deskBalance + 10 }
          });
          // Complete Daily Quest progress
          chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "play_games", amount: 1 });
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
  const runnerCanvas = document.getElementById("runner-canvas");
  const runnerScoreEl = document.getElementById("runner-score");
  const runnerGameOver = document.getElementById("runner-gameover");
  const btnResetRunner = document.getElementById("btn-reset-runner");
  const runnerStatusTitle = document.getElementById("runner-status-title");
  const runnerRewardMsg = document.getElementById("runner-reward-msg");

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
    
    // Jump listeners
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

  function handleRunnerJumpClick(e) {
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

    // Apply gravity
    runnerPhysics.playerY += runnerPhysics.playerVy;
    runnerPhysics.playerVy += runnerPhysics.gravity;

    if (runnerPhysics.playerY >= 140) {
      runnerPhysics.playerY = 140;
      runnerPhysics.playerVy = 0;
      runnerPhysics.isJumping = false;
    }

    // Speed scaling
    runnerPhysics.speed = 3.5 + (runnerScore * 0.003);

    // Spawn obstacles
    runnerPhysics.spawnTimer--;
    if (runnerPhysics.spawnTimer <= 0) {
      // Add obstacle
      runnerPhysics.obstacles.push({
        x: runnerCanvas.width,
        width: 14 + Math.random() * 8,
        height: 20 + Math.random() * 20
      });
      runnerPhysics.spawnTimer = 90 + Math.random() * 60; // cooldown frames
    }

    // Update obstacles
    for (let i = runnerPhysics.obstacles.length - 1; i >= 0; i--) {
      const obs = runnerPhysics.obstacles[i];
      obs.x -= runnerPhysics.speed;

      // Collision Check
      // Player x is fixed around 50, size roughly 24x24
      const pX = 50;
      const pWidth = 24;
      const pHeight = 24;

      if (
        pX < obs.x + obs.width &&
        pX + pWidth > obs.x &&
        runnerPhysics.playerY < 140 + pHeight &&
        runnerPhysics.playerY + pHeight > 180 - obs.height
      ) {
        // Crash! Game over
        triggerRunnerGameOver();
      }

      if (obs.x + obs.width < 0) {
        runnerPhysics.obstacles.splice(i, 1);
      }
    }
  }

  function drawRunnerScene() {
    // Clear canvas
    runnerCtx.fillStyle = "#0c0816";
    runnerCtx.fillRect(0, 0, runnerCanvas.width, runnerCanvas.height);

    // Draw Floor line
    runnerCtx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    runnerCtx.lineWidth = 2;
    runnerCtx.beginPath();
    runnerCtx.moveTo(0, 164);
    runnerCtx.lineTo(runnerCanvas.width, 164);
    runnerCtx.stroke();
    // Draw player (cute glowing retro pixel character)
    runnerCtx.save();
    runnerCtx.fillStyle = "#ff00bf";
    runnerCtx.shadowBlur = 12;
    runnerCtx.shadowColor = "#ff00bf";
    
    // Draw main body
    runnerCtx.fillRect(50, runnerPhysics.playerY, 24, 24);
    
    // Draw glowing pixel highlights/accents
    runnerCtx.fillStyle = "#ffffff";
    runnerCtx.shadowBlur = 8;
    runnerCtx.shadowColor = "#ffffff";
    // Eyes
    runnerCtx.fillRect(66, runnerPhysics.playerY + 6, 4, 4);
    runnerCtx.fillRect(56, runnerPhysics.playerY + 6, 4, 4);
    
    // Little glowing horns/spikes on back
    runnerCtx.fillStyle = "#00f0ff";
    runnerCtx.shadowBlur = 8;
    runnerCtx.shadowColor = "#00f0ff";
    runnerCtx.fillRect(46, runnerPhysics.playerY + 4, 4, 4);
    runnerCtx.fillRect(46, runnerPhysics.playerY + 14, 4, 4);
    runnerCtx.restore();

    // Draw Obstacles
    runnerPhysics.obstacles.forEach(obs => {
      runnerCtx.save();
      runnerCtx.fillStyle = "#00f0ff";
      runnerCtx.shadowBlur = 10;
      runnerCtx.shadowColor = "#00f0ff";
      
      // Draw neon obstacle triangles (spikes)
      runnerCtx.beginPath();
      runnerCtx.moveTo(obs.x, 164);
      runnerCtx.lineTo(obs.x + obs.width / 2, 164 - obs.height);
      runnerCtx.lineTo(obs.x + obs.width, 164);
      runnerCtx.closePath();
      runnerCtx.fill();
      
      // Draw a white glowing inner core to make spikes pop!
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
      runnerRewardMsg.innerHTML = `Score: ${runnerScore}. Rewards: <span class="green-text">+30 XP | +15 $DESK</span>`;

      chrome.runtime.sendMessage({ type: "ADD_XP", amount: 30 });
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { deskBalance: state.deskBalance + 15 }
      });
      // Progress quest
      chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "play_games", amount: 1 });
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
    if (state.isSleeping) return;
    clickCount++;
    clickerCountEl.textContent = clickCount;

    // Visual pop animation
    clickerEffectText.classList.remove("clicker-pop-animation");
    void clickerEffectText.offsetWidth; // trigger reflow
    clickerEffectText.classList.add("clicker-pop-animation");

    // Add stats to background
    const extraHappiness = Math.min(100, state.happiness + 2);
    const extraEnergy = Math.min(100, state.energy + 1);
    
    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { happiness: extraHappiness, energy: extraEnergy }
    });

    if (clickCount % 10 === 0) {
      chrome.runtime.sendMessage({ type: "ADD_XP", amount: 2 });
    }

    // Complete active pet clicks daily quest
    chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "play_games", amount: 0.1 });
  });

  // --- WEB3 SANDBOX ACTIONS ---

  // Mint NFT
  btnMintNft.addEventListener("click", () => {
    if (!state.walletConnected || state.level < 10 || state.nftMinted) return;

    btnMintNft.textContent = "MINTING METAPLEX CORE NFT...";
    btnMintNft.disabled = true;

    // Simulate mining delays
    setTimeout(() => {
      const mockTx = "4g8xS1D" + Math.random().toString(36).substring(2, 18).toUpperCase() + "metaplexCore";
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { nftMinted: true, mintTx: mockTx }
      });
      btnMintNft.textContent = "MINT COMPLETE!";
    }, 2000);
  });

  // $DESK Yield Collector
  let claimableDesk = 0;
  function startYieldTicker() {
    setInterval(() => {
      if (state && state.walletConnected) {
        // Base rate yields based on level & stats
        const levelMultiplier = 1 + (state.level * 0.05);
        const statsAvg = (state.strength + state.intelligence + state.charm) / 3;
        const statsMultiplier = 1 + (statsAvg * 0.02);
        
        // Base rate is 0.01 tokens per second
        const ratePerSec = 0.005 * levelMultiplier * statsMultiplier;
        claimableDesk += ratePerSec;

        yieldRateVal.textContent = `${(ratePerSec * 3600).toFixed(2)} $DESK/hr`;
        yieldClaimableVal.textContent = `${claimableDesk.toFixed(4)} $DESK`;
      } else {
        yieldRateVal.textContent = "0.00 $DESK/hr";
        yieldClaimableVal.textContent = "0.0000 $DESK";
      }
    }, 1000);
  }

  btnClaimYield.addEventListener("click", () => {
    if (claimableDesk <= 0) return;

    const claimedAmount = claimableDesk;
    claimableDesk = 0;

    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { deskBalance: state.deskBalance + claimedAmount }
    });
  });

  // Breeding Lab
  btnBreedPets.addEventListener("click", () => {
    if (state.deskBalance < 100) return;

    btnBreedPets.textContent = "BREEDING GENETIC SYNAPSE...";
    btnBreedPets.disabled = true;

    setTimeout(() => {
      // Subtract 100 $DESK
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { deskBalance: state.deskBalance - 100 }
      });

      btnBreedPets.textContent = "INITIATE BREEDING (100 $DESK)";
      btnBreedPets.disabled = false;
      
      breedSuccessMsg.classList.remove("hidden");
      setTimeout(() => {
        breedSuccessMsg.classList.add("hidden");
      }, 5000);

    }, 2000);
  });
});
