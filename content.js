// DeskPet - Webpage Content Script

(function () {
  // Smart duplicate injection guard
  const existingRoot = document.getElementById("deskpet-root");
  if (existingRoot) {
    safeSendMessage({ type: "GET_STATE" }, (response) => {
      if (response) {
        existingRoot.style.display = response.showFloatingPet !== false ? "flex" : "none";
      }
    });
    return;
  }

  let state = null;
  let currentAction = "idle"; // idle, walk, excited, sleep
  let targetX = null;
  let targetY = null;
  let canvasSize = 80;
  
  // Position variables
  let posX = window.innerWidth - 120;
  let posY = window.innerHeight - 150;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  // Follow Mode & Roaming
  let followMouse = false;
  let mouseX = 0;
  let mouseY = 0;
  let roamPauseTimer = 50;

  // DOM Elements
  let rootEl = null;
  let canvasEl = null; // Used as the SVG container div
  let tooltipEl = null;
  let menuEl = null;
  let bubbleEl = null;

  const cutePhrases = [
    "*purr* Coding companion active! 🐾",
    "Did you write tests for this script? 🥺",
    "Please don't push direct to main branch! 🛑",
    "WAGMI! But let me take a quick nap. 💤",
    "Rust macros are absolute black magic! 🔮",
    "I sleep on bytes, you sleep on dreams.",
    "GM! Ready to compile some loops? ⚡",
    "Is that a bug or a feature? Let me eat it! 🐛",
    "Solana transaction speed goes zoom! 🚀",
    "Refactoring this function might be a good idea...",
    "Check your git diff before you commit! 🔍",
    "I'm keeping watch for distraction traps! 😤",
    "Can I get a yummy treat block? 🍪",
    "Astro-dog helmet is so cozy. 🐕",
    "Sol-cat style is sub-second fast! 🐈",
    "Cyber-bunny ears receive cosmic signals! 🐇"
  ];

  function getActivePet() {
    if (!state) return null;
    const activeId = state.activePetId || "sol-cat";
    return state.pets ? state.pets[activeId] : null;
  }

  function fetchStateWithRetry(retries = 3) {
    safeSendMessage({ type: "GET_STATE" }, (response) => {
      if (response) {
        state = response;
        if (!rootEl) {
          init();
        } else {
          updateTooltip();
          syncVisibility();
        }
      } else if (retries > 0) {
        console.log(`DeskPet: GET_STATE returned empty. Retrying... (${retries} left)`);
        setTimeout(() => fetchStateWithRetry(retries - 1), 1000);
      }
    });
  }

  fetchStateWithRetry(3);

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
      targetX = posX;
      targetY = posY;
      createElements();

      // Start behavior loop at 30ms ticks (~33 FPS)
      setInterval(idleActionChooser, 30);
      
      // Periodic speech trigger (every 25 seconds if not sleeping)
      setInterval(() => {
        const pet = getActivePet();
        if (pet && pet.status !== "sleep" && Math.random() < 0.8) {
          const phrase = cutePhrases[Math.floor(Math.random() * cutePhrases.length)];
          speak(phrase);
        }
      }, 25000);

      syncVisibility();
    });
  }

  function speak(text) {
    if (!bubbleEl && rootEl) {
      bubbleEl = document.createElement("div");
      bubbleEl.id = "deskpet-bubble";
      bubbleEl.style.cssText = "position:absolute; top:-40px; background:rgba(15,10,25,0.9); border:1.5px solid #00f0ff; color:#fff; padding:6px 12px; border-radius:12px; font-size:10px; white-space:nowrap; pointer-events:none; box-shadow:0 0 10px rgba(0, 240, 255, 0.4); z-index:100000; font-family:'Segoe UI',system-ui,sans-serif;";
      rootEl.appendChild(bubbleEl);
    }
    if (bubbleEl) {
      bubbleEl.textContent = text;
      bubbleEl.style.display = "block";
      setTimeout(() => {
        if (bubbleEl) bubbleEl.style.display = "none";
      }, 3500);
    }
  }

  function createElements() {
    // Root container
    rootEl = document.createElement("div");
    rootEl.id = "deskpet-root";
    rootEl.style.left = posX + "px";
    rootEl.style.top = posY + "px";

    // Div container for SVG injection
    canvasEl = document.createElement("div");
    canvasEl.id = "deskpet-canvas"; // Keeps styling rules intact
    canvasEl.style.width = canvasSize + "px";
    canvasEl.style.height = canvasSize + "px";
    canvasEl.style.cursor = "grab";
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
      <button id="deskpet-btn-follow" title="Toggle Follow Mouse">👣 Follow</button>
    `;
    rootEl.appendChild(menuEl);

    document.body.appendChild(rootEl);

    // Drag events
    canvasEl.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", drag);
    window.addEventListener("mouseup", endDrag);

    // Capture mouse movement for follow logic
    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Button actions
    menuEl.querySelector("#deskpet-btn-pet").addEventListener("click", () => {
      const pet = getActivePet();
      if (pet && pet.status === "sleep") return;
      speak("Aww, that tickles!");
      safeSendMessage({ action: "pet" });
    });

    menuEl.querySelector("#deskpet-btn-feed").addEventListener("click", () => {
      const pet = getActivePet();
      if (pet && pet.status === "sleep") return;
      safeSendMessage({ action: "feed" }, (res) => {
        if (res && res.success) {
          speak("Nom nom! Thanks!");
        } else {
          speak("No treats left! Buy in HUD!");
        }
      });
    });

    menuEl.querySelector("#deskpet-btn-dash").addEventListener("click", () => {
      safeSendMessage({ type: "OPEN_DASHBOARD" });
    });

    const followBtn = menuEl.querySelector("#deskpet-btn-follow");
    followBtn.addEventListener("click", () => {
      followMouse = !followMouse;
      followBtn.style.background = followMouse ? "rgba(255, 0, 191, 0.2)" : "rgba(255, 255, 255, 0.08)";
      followBtn.style.borderColor = followMouse ? "#ff00bf" : "rgba(255, 255, 255, 0.12)";
      speak(followMouse ? "Following you!" : "Roaming freely.");
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
    const pet = getActivePet();
    if (!pet) return;
    const stage = pet.stage || "Baby";
    tooltipEl.innerHTML = `
      <div class="deskpet-name">${pet.name}</div>
      <div class="deskpet-level">Lv.${pet.level} (${stage.toUpperCase()})</div>
      <div class="deskpet-bar-bg">
        <div class="deskpet-bar-fill" style="width: ${Math.min(100, ((pet.xp || 0) / (pet.xpNeeded || 100)) * 100)}%"></div>
      </div>
      <div class="deskpet-stats">⚡ ${Math.floor(pet.energy || 0)}% | ❤️ ${Math.floor(pet.happiness || 0)}%</div>
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
    if (e.button !== 0) return;
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

    posX = Math.min(window.innerWidth - canvasSize, Math.max(0, posX));
    posY = Math.min(window.innerHeight - canvasSize, Math.max(0, posY));

    rootEl.style.left = posX + "px";
    rootEl.style.top = posY + "px";
    targetX = posX;
    targetY = posY;
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    canvasEl.style.cursor = "grab";
    rootEl.classList.remove("dragging");
    if(chrome.runtime && chrome.runtime.id) chrome.storage.local.set({ deskpet_position: { x: posX, y: posY } });
  }

  // AI behavior & translation loop
  function idleActionChooser() {
    if (isDragging || !rootEl || !canvasEl || !state) return;
    const pet = getActivePet();
    if (!pet) return;

    const activeId = state.activePetId || "sol-cat";
    const species = pet.species || (activeId.startsWith("sol-cat") ? "sol-cat" : (activeId.startsWith("astro-dog") ? "astro-dog" : (activeId.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));

    if (followMouse) {
      const diffX = mouseX - posX - 40;
      const diffY = mouseY - posY - 40;
      const dist = Math.sqrt(diffX * diffX + diffY * diffY);

      if (dist > 60 && pet.status !== "sleep") {
        const speed = 2.5;
        posX += (diffX / dist) * speed;
        posY += (diffY / dist) * speed;
        canvasEl.style.transform = diffX < 0 ? "scaleX(-1)" : "scaleX(1)";
        currentAction = "walk";
        
        if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
          canvasEl.innerHTML = PET_ASSETS[species].render("walk", pet.stage || "Baby", pet.skin);
        }
      } else {
        currentAction = pet.status || "idle";
        if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
          canvasEl.innerHTML = PET_ASSETS[species].render(pet.status || "idle", pet.stage || "Baby", pet.skin);
        }
      }
    } else {
      // Free Roaming Logic
      if (pet.status === "sleep") {
        currentAction = "sleep";
        targetX = posX;
        targetY = posY;
        if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
          canvasEl.innerHTML = PET_ASSETS[species].render("sleep", pet.stage || "Baby", pet.skin);
        }
      } else if (currentAction === "walk") {
        const diffX = targetX - posX;
        const diffY = targetY - posY;
        const dist = Math.sqrt(diffX * diffX + diffY * diffY);

        if (dist > 4) {
          const speed = 1.2;
          posX += (diffX / dist) * speed;
          posY += (diffY / dist) * speed;
          canvasEl.style.transform = diffX < 0 ? "scaleX(-1)" : "scaleX(1)";
          if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
            canvasEl.innerHTML = PET_ASSETS[species].render("walk", pet.stage || "Baby", pet.skin);
          }
        } else {
          // Arrived! Stop, transition to idle, and start pause timer
          currentAction = "idle";
          roamPauseTimer = 80 + Math.floor(Math.random() * 120); // pause for 2.4 - 6 seconds
          
          // 25% chance to speak a cute coding phrase upon stopping!
          if (Math.random() < 0.25) {
            const phrase = cutePhrases[Math.floor(Math.random() * cutePhrases.length)];
            speak(phrase);
          }
          
          if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
            canvasEl.innerHTML = PET_ASSETS[species].render(pet.status || "idle", pet.stage || "Baby", pet.skin);
          }
        }
      } else {
        // Idling
        roamPauseTimer--;
        if (roamPauseTimer <= 0) {
          // Choose a new random walk target inside a 200px bounding radius
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 100;
          targetX = Math.max(50, Math.min(window.innerWidth - 120, posX + Math.cos(angle) * dist));
          targetY = Math.max(50, Math.min(window.innerHeight - 120, posY + Math.sin(angle) * dist));
          currentAction = "walk";
        }
        
        if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[species]) {
          canvasEl.innerHTML = PET_ASSETS[species].render(pet.status || "idle", pet.stage || "Baby", pet.skin);
        }
      }
    }

    rootEl.style.left = posX + "px";
    rootEl.style.top = posY + "px";
  }

  function isContextValid() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  }

  function safeSendMessage(msg, callback) {
    if (!isContextValid()) return;
    try {
      if (callback) {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) return;
          callback(res);
        });
      } else {
        chrome.runtime.sendMessage(msg);
      }
    } catch (e) {
      console.warn("DeskPet: Message sending failed (context invalidated).", e);
    }
  }

  // Productivity Tracking: User Activity Monitor
  let lastActivitySent = 0;
  function recordActivity() {
    if (!isContextValid()) {
      // Self-destruct event listeners on invalid context
      document.removeEventListener("mousemove", recordActivity);
      document.removeEventListener("keydown", recordActivity);
      document.removeEventListener("scroll", recordActivity);
      document.removeEventListener("click", recordActivity);
      return;
    }
    const now = Date.now();
    if (now - lastActivitySent > 10000) { // throttle pings to 10 seconds
      lastActivitySent = now;
      safeSendMessage({ action: "userActivity" });
    }
  }

  document.addEventListener("mousemove", recordActivity);
  document.addEventListener("keydown", recordActivity);
  document.addEventListener("scroll", recordActivity);
  document.addEventListener("click", recordActivity);

  // Distraction Shield: blacklisted URL Checker
  const DISTRACTING_SITES = ["youtube.com", "twitter.com", "x.com", "reddit.com", "facebook.com", "instagram.com", "tiktok.com"];
  const distractionInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(distractionInterval);
      return;
    }
    const pet = getActivePet();
    if (!pet || !state) return;
    const session = state.focusSession;
    const isFocusActive = session && session.active && !session.isPaused;
    if (!isFocusActive) return;

    const currentHost = window.location.hostname.toLowerCase();
    const isDistracted = DISTRACTING_SITES.some(site => currentHost.includes(site));

    if (isDistracted) {
      const warnings = [
        "Hey! Close this tab, we're focusing! 😠",
        "Stop slacking! Get back to coding! 😡",
        "I'm losing stats! Close this page! 😢",
        "No Social Media / TikTok during work! 🛑",
        "We are supposed to be productive! 😤"
      ];
      speak(warnings[Math.floor(Math.random() * warnings.length)]);

      safeSendMessage({ action: "distractionPenalty" });
    }
  }, 20000); // Check every 20 seconds
})();
