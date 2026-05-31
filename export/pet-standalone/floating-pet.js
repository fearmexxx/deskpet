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

// DeskPet - Webpage Content Script

(function () {
  // Smart duplicate injection guard
  const existingRoot = document.getElementById("deskpet-root");
  if (existingRoot) {
    // Already injected — just make sure it syncs visibility from current state
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response) {
        existingRoot.style.display = response.showFloatingPet !== false ? "flex" : "none";
      }
    });
    return;
  }

  let state = null;
  let animFrame = 0;
  let currentAction = "idle"; // idle, walk, excited, sleep
  let targetX = null;
  let targetY = null;
  let walkSpeed = 0.8;
  let canvasSize = 80;
  
  // Position variables
  let posX = window.innerWidth - 120;
  let posY = window.innerHeight - 150;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // DOM Elements
  let rootEl = null;
  let canvasEl = null;
  let tooltipEl = null;
  let menuEl = null;

  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response) {
      state = response;
      init();
      syncVisibility();
    }
  });

  // Listen to background changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATE_UPDATED") {
      state = message.state;
      updateTooltip();
      syncVisibility();
    }
  });

  function init() {
    // Load last position if saved
    chrome.storage.local.get(["deskpet_position"], (posResult) => {
      if (posResult.deskpet_position) {
        posX = Math.min(window.innerWidth - canvasSize, Math.max(0, posResult.deskpet_position.x));
        posY = Math.min(window.innerHeight - canvasSize, Math.max(0, posResult.deskpet_position.y));
      }
      createElements();
      requestAnimationFrame(animationLoop);
      setInterval(idleActionChooser, 6000); // Decides what the pet does every 6s
      syncVisibility();
    });
  }

  function createElements() {
    // Root container
    rootEl = document.createElement("div");
    rootEl.id = "deskpet-root";
    rootEl.style.left = posX + "px";
    rootEl.style.top = posY + "px";

    // Canvas
    canvasEl = document.createElement("canvas");
    canvasEl.id = "deskpet-canvas";
    canvasEl.width = canvasSize;
    canvasEl.height = canvasSize;
    rootEl.appendChild(canvasEl);

    // Hover Menu / HUD
    tooltipEl = document.createElement("div");
    tooltipEl.id = "deskpet-tooltip";
    rootEl.appendChild(tooltipEl);
    updateTooltip();

    // Context menu container
    menuEl = document.createElement("div");
    menuEl.id = "deskpet-menu";
    menuEl.innerHTML = `
      <button id="deskpet-btn-pet" title="Pet Buddy">👋 Pet</button>
      <button id="deskpet-btn-feed" title="Feed Snack">🍖 Feed</button>
      <button id="deskpet-btn-dash" title="Open Dashboard">🚀 HUD</button>
      <button id="deskpet-btn-close" title="Hide (Refresh to restore)">❌ Close</button>
    `;
    rootEl.appendChild(menuEl);

    document.body.appendChild(rootEl);

    // Drag events
    canvasEl.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", drag);
    window.addEventListener("mouseup", endDrag);

    // Button actions
    menuEl.querySelector("#deskpet-btn-pet").addEventListener("click", () => {
      triggerAction("excited", 2000);
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { energy: Math.min(100, (state.energy || 80) + 15) }
      });
      // Progress quest
      chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "feed_pet", amount: 1 });
    });

    menuEl.querySelector("#deskpet-btn-feed").addEventListener("click", () => {
      triggerAction("excited", 2000);
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { happiness: Math.min(100, (state.happiness || 80) + 15) }
      });
      chrome.runtime.sendMessage({ type: "PROGRESS_QUEST", questId: "feed_pet", amount: 1 });
    });

    menuEl.querySelector("#deskpet-btn-dash").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    });

    menuEl.querySelector("#deskpet-btn-close").addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "UPDATE_STATE",
        updates: { showFloatingPet: false }
      });
    });

    // Auto-reposition on window resize
    window.addEventListener("resize", () => {
      posX = Math.min(window.innerWidth - canvasSize, posX);
      posY = Math.min(window.innerHeight - canvasSize, posY);
      rootEl.style.left = posX + "px";
      rootEl.style.top = posY + "px";
    });
  }

  function updateTooltip() {
    if (!state || !tooltipEl) return;
    const stage = window.PetEngine ? window.PetEngine.getStage(state.level) : "egg";
    tooltipEl.innerHTML = `
      <div class="deskpet-name">${state.petName}</div>
      <div class="deskpet-level">Lv.${state.level} (${stage.toUpperCase()})</div>
      <div class="deskpet-bar-bg">
        <div class="deskpet-bar-fill" style="width: ${((state.xp || 0) / (state.level * 30 + 20)) * 100}%"></div>
      </div>
      <div class="deskpet-stats">⚡ ${state.energy || 0}% | ❤️ ${state.happiness || 0}%</div>
    `;
  }

  function syncVisibility() {
    if (!rootEl || !state) return;
    if (state.showFloatingPet !== false) {
      rootEl.style.display = "flex";
    } else {
      rootEl.style.display = "none";
    }
  }

  // Draggable logic
  function startDrag(e) {
    if (e.button !== 0) return; // Only left click
    isDragging = true;
    dragStartX = e.clientX - posX;
    dragStartY = e.clientY - posY;
    canvasEl.style.cursor = "grabbing";
    rootEl.classList.add("dragging");
    e.preventDefault();
  }

  function drag(e) {
    if (!isDragging) return;
    posX = e.clientX - dragStartX;
    posY = e.clientY - dragStartY;

    // Bounds checking
    posX = Math.min(window.innerWidth - canvasSize, Math.max(0, posX));
    posY = Math.min(window.innerHeight - canvasSize, Math.max(0, posY));

    rootEl.style.left = posX + "px";
    rootEl.style.top = posY + "px";
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    canvasEl.style.cursor = "grab";
    rootEl.classList.remove("dragging");
    
    // Save new position
    chrome.storage.local.set({ deskpet_position: { x: posX, y: posY } });
  }

  // Action states helper
  let actionTimeout = null;
  function triggerAction(actionName, duration) {
    if (actionTimeout) clearTimeout(actionTimeout);
    currentAction = actionName;
    
    if (duration) {
      actionTimeout = setTimeout(() => {
        currentAction = "idle";
      }, duration);
    }
  }

  // Random wander choosing logic
  function idleActionChooser() {
    if (isDragging || currentAction === "excited" || (state && state.isSleeping)) return;

    const rand = Math.random();
    if (rand < 0.25) {
      // Wander left/right
      currentAction = "walk";
      const direction = Math.random() < 0.5 ? -1 : 1;
      const distance = 40 + Math.random() * 60;
      targetX = Math.min(window.innerWidth - canvasSize, Math.max(0, posX + direction * distance));
    } else if (rand < 0.35) {
      // Small bounce/excited state
      triggerAction("excited", 1500);
    } else {
      currentAction = "idle";
      targetX = null;
    }
  }

  // Master Frame & Physics loop
  let lastFrameTime = 0;
  function animationLoop(timestamp) {
    if (!rootEl || !canvasEl) return;

    // 10 FPS animation updates (100ms interval)
    if (timestamp - lastFrameTime > 100) {
      animFrame++;
      lastFrameTime = timestamp;

      // Handle simple AI movement/wander
      if (currentAction === "walk" && targetX !== null && !isDragging) {
        const dx = targetX - posX;
        if (Math.abs(dx) > 2) {
          posX += Math.sign(dx) * walkSpeed;
          rootEl.style.left = posX + "px";
        } else {
          currentAction = "idle";
          targetX = null;
        }
      }

      // Sync state settings to check sleep mode
      const isSleeping = state ? state.isSleeping : false;
      const happinessVal = state ? state.happiness : 80;
      const sadnessRatio = (100 - happinessVal) / 100;

      // Draw the frame using the loaded engine
      if (window.PetEngine) {
        window.PetEngine.draw(
          canvasEl,
          currentAction,
          animFrame,
          state ? state.activePetSkin : "neon-cyan",
          state ? state.level : 1,
          isSleeping,
          sadnessRatio
        );
      }
    }

    requestAnimationFrame(animationLoop);
  }
})();
