// Content script to render the cute interactive floating companion pet

(function() {
  // Prevent duplicate insertion
  if (document.getElementById("cyberpet-extension-root")) return;
  function safeSendMessage(message, callback) {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            // Ignore context invalidation warning
            return;
          }
          if (callback) callback(response);
        });
      } catch (e) {
        // Context invalidated, ignore silently
      }
    }
  }

  const root = document.createElement("div");
  root.id = "cyberpet-extension-root";
  document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });

  // Stylesheet
  const style = document.createElement("style");
  style.textContent = `
    .pet-wrapper {
      position: fixed;
      bottom: 100px;
      right: 100px;
      width: 120px;
      height: 140px;
      z-index: 999999;
      cursor: grab;
      user-select: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 10px;
      transition: transform 0.1s ease;
      filter: drop-shadow(0 8px 16px rgba(0,0,0,0.3));
    }

    .pet-wrapper:active {
      cursor: grabbing;
    }

    .bubble {
      position: absolute;
      top: -45px;
      background: rgba(26, 26, 46, 0.95);
      border: 1.5px solid #00FFCC;
      color: #FFF;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-family: 'Outfit', 'Segoe UI', system-ui, sans-serif;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px) scale(0.9);
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 0 10px rgba(0, 255, 204, 0.3);
    }

    .bubble.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .bubble::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px 6px 0;
      border-style: solid;
      border-color: rgba(26, 26, 46, 0.95) transparent;
      display: block;
      width: 0;
    }

    /* Core animations */
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    
    @keyframes walk {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      25% { transform: translateY(-4px) rotate(-4deg); }
      75% { transform: translateY(-4px) rotate(4deg); }
    }

    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }

    .pet-svg {
      transition: all 0.3s ease;
    }

    .pet-svg.idle {
      animation: bounce 2s infinite ease-in-out;
    }

    .pet-svg.walk {
      animation: walk 0.6s infinite linear;
    }

    .pet-svg.happy {
      animation: bounce 0.6s infinite ease-in-out;
    }

    .pet-svg.eat {
      animation: shake 0.4s infinite ease-in-out;
    }

    .pet-svg.sleep {
      opacity: 0.85;
      animation: bounce 4s infinite ease-in-out;
    }

    /* SVG part animations */
    .tail-anim {
      transform-origin: 68px 65px;
      animation: tailWiggle 1.5s infinite ease-in-out;
    }

    @keyframes tailWiggle {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(15deg); }
    }

    .ear-left-anim {
      animation: earLeftWiggle 3s infinite ease-in-out;
    }

    @keyframes earLeftWiggle {
      0%, 100%, 90% { transform: rotate(0deg); }
      95% { transform: rotate(-8deg); }
    }

    .ear-right-anim {
      animation: earRightWiggle 3.2s infinite ease-in-out;
    }

    @keyframes earRightWiggle {
      0%, 100%, 88% { transform: rotate(0deg); }
      93% { transform: rotate(8deg); }
    }

    /* Particle / bubble animations */
    .z-anim {
      animation: floatUp 2s infinite linear;
      transform-origin: bottom;
    }

    .z-anim-delayed {
      animation: floatUp 2s infinite linear;
      animation-delay: 1s;
    }

    @keyframes floatUp {
      0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
      20% { opacity: 1; }
      100% { transform: translate(10px, -20px) scale(1.2); opacity: 0; }
    }

    .food-anim {
      animation: foodBounce 1s infinite ease-in-out;
    }

    @keyframes foodBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    /* Controls button overlay */
    .controls {
      position: absolute;
      bottom: 5px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .pet-wrapper:hover .controls {
      opacity: 1;
      pointer-events: auto;
    }

    .btn {
      background: rgba(20, 241, 149, 0.85);
      border: none;
      color: #000;
      font-size: 9px;
      font-weight: bold;
      border-radius: 4px;
      padding: 2px 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background 0.2s;
    }

    .btn:hover {
      background: #14F195;
    }
  `;
  shadow.appendChild(style);

  // Companion Wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "pet-wrapper";
  shadow.appendChild(wrapper);

  // Bubble
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  wrapper.appendChild(bubble);

  // Pet Graphic Container
  const petContainer = document.createElement("div");
  petContainer.className = "pet-graphic";
  wrapper.appendChild(petContainer);

  // Controls overlay
  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `
    <button class="btn btn-feed">Feed</button>
    <button class="btn btn-pet">Pet</button>
    <button class="btn btn-follow">Follow</button>
  `;
  wrapper.appendChild(controls);

  // State Variables
  let petState = null;
  let isDragging = false;
  let startX, startY;
  let posX = window.innerWidth - 180;
  let posY = window.innerHeight - 200;
  let targetX = posX;
  let targetY = posY;
  let followMouse = false;
  let mouseX = 0;
  let mouseY = 0;

  wrapper.style.left = `${posX}px`;
  wrapper.style.top = `${posY}px`;

  // Say something periodic (witty developer & blockchain quotes)
  const phrases = {
    idle: [
      "*purr*", 
      "Checking Solana block times... yup, sub-second!", 
      "Did you write tests for this code?", 
      "Deploying to mainnet on a Friday? Brave soul.", 
      "GM! Ready to compile some loops?", 
      "WAGMI! But let me eat first.", 
      "Is that a bug or a feature?", 
      "I sleep on bytes, you sleep on dreams.", 
      "Solana is fast, but how fast can you type?", 
      "Maybe refactor this function next?",
      "Checking block height... we are climbing!",
      "Rust macros are black magic.",
      "Just looked at your git commit message. 'fix'? Really?",
      "Let's write clean code today."
    ],
    sleep: [
      "zZz... mining blocks... zZz", 
      "Dreaming of gasless transactions...", 
      "zZz... proof-of-nap... zZz", 
      "Shh, compiling dreams.",
      "zZz... local host offline... zZz"
    ],
    eat: [
      "Nom nom! Data bytes taste delicious!", 
      "Parsing snacks at 65,000 TPS!", 
      "Yummy dynamic metadata!", 
      "Delicious treat block!"
    ],
    happy: [
      "Let's gooo! Mainnet vibes!", 
      "Leveling up is my favorite transaction!", 
      "This workspace energy is immaculate!", 
      "Yay! Send it to the moon!"
    ]
  };

  function speak(text) {
    bubble.textContent = text;
    bubble.classList.add("show");
    setTimeout(() => {
      bubble.classList.remove("show");
    }, 3000);
  }

  // Speak every 25 seconds
  const speechInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(speechInterval);
      return;
    }
    if (petState) {
      const activeId = petState.activePetId;
      const pet = petState.pets[activeId];
      if (pet) {
        const list = phrases[pet.status] || phrases.idle;
        const phrase = list[Math.floor(Math.random() * list.length)];
        speak(phrase);
      }
    }
  }, 25000);

  // Dragging logic
  wrapper.addEventListener("mousedown", (e) => {
    // Avoid triggering when clicking buttons
    if (e.target.classList.contains("btn")) return;
    
    isDragging = true;
    startX = e.clientX - wrapper.offsetLeft;
    startY = e.clientY - wrapper.offsetTop;
    wrapper.style.transition = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isDragging) {
      posX = e.clientX - startX;
      posY = e.clientY - startY;

      // Keep within bounds
      posX = Math.max(0, Math.min(window.innerWidth - 120, posX));
      posY = Math.max(0, Math.min(window.innerHeight - 120, posY));

      wrapper.style.left = `${posX}px`;
      wrapper.style.top = `${posY}px`;
      targetX = posX;
      targetY = posY;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      wrapper.style.transition = "transform 0.1s ease";
    }
  });

  // Action Buttons Listeners
  controls.querySelector(".btn-feed").addEventListener("click", () => {
    safeSendMessage({ action: "feed" }, (response) => {
      if (response && response.success) {
        speak("Nom nom! Thanks!");
      } else {
        speak("No treats left! Buy some in the Stable shop! 😢");
      }
    });
  });

  controls.querySelector(".btn-pet").addEventListener("click", () => {
    safeSendMessage({ action: "pet" }, (response) => {
      if (response && response.success) {
        speak("Aww, that tickles!");
      }
    });
  });

  const followBtn = controls.querySelector(".btn-follow");
  followBtn.addEventListener("click", () => {
    followMouse = !followMouse;
    followBtn.style.background = followMouse ? "#9945FF" : "rgba(20, 241, 149, 0.85)";
    followBtn.style.color = followMouse ? "#FFF" : "#000";
    speak(followMouse ? "Let's walk!" : "Staying here.");
  });

  // Pet AI behavior loop (Wandering / Following mouse)
  setInterval(() => {
    if (isDragging) return;

    if (followMouse) {
      // Walk towards mouse
      const diffX = mouseX - posX - 60;
      const diffY = mouseY - posY - 60;
      const dist = Math.sqrt(diffX * diffX + diffY * diffY);

      if (dist > 80) {
        const speed = 4;
        posX += (diffX / dist) * speed;
        posY += (diffY / dist) * speed;
        
        // Face moving direction of pet graphic only (prevents text flipping)
        petContainer.style.transform = diffX < 0 ? "scaleX(-1)" : "scaleX(1)";
        updatePetStateClass("walk");
      } else {
        updatePetStateClass(petState ? petState.pets[petState.activePetId].status : "idle");
      }
    } else {
      // Random wandering (occasionally)
      if (Math.random() < 0.15 && petState && petState.pets[petState.activePetId].status !== "sleep") {
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 80;
        targetX = Math.max(50, Math.min(window.innerWidth - 150, posX + Math.cos(angle) * dist));
        targetY = Math.max(50, Math.min(window.innerHeight - 150, posY + Math.sin(angle) * dist));
      }

      // If the pet goes to sleep, cancel active movement immediately
      const activeStatus = (petState && petState.pets && petState.activePetId && petState.pets[petState.activePetId]) ? petState.pets[petState.activePetId].status : "idle";
      if (activeStatus === "sleep") {
        targetX = posX;
        targetY = posY;
      }

      // Smooth step towards target
      const stepX = (targetX - posX) * 0.05;
      const stepY = (targetY - posY) * 0.05;

      if (Math.abs(stepX) > 0.5 || Math.abs(stepY) > 0.5) {
        posX += stepX;
        posY += stepY;
        petContainer.style.transform = stepX < 0 ? "scaleX(-1)" : "scaleX(1)";
        updatePetStateClass("walk");
      } else {
        updatePetStateClass(petState ? petState.pets[petState.activePetId].status : "idle");
      }
    }

    wrapper.style.left = `${posX}px`;
    wrapper.style.top = `${posY}px`;
  }, 30);

  function updatePetStateClass(status) {
    const svgEl = petContainer.querySelector(".pet-svg");
    if (svgEl) {
      // Keep static SVG visual but update dynamic state styling
      // If we are eating/sleeping/happy, that overrides walk/idle
      const activeStatus = (petState && petState.pets && petState.activePetId && petState.pets[petState.activePetId]) ? petState.pets[petState.activePetId].status : "idle";
      if (activeStatus === "sleep" || activeStatus === "eat" || activeStatus === "happy") {
        svgEl.className.baseVal = `pet-svg ${activeStatus}`;
      } else {
        svgEl.className.baseVal = `pet-svg ${status}`;
      }
    }
  }

  // Load and Render Pet
  function renderPet(state) {
    if (!state || !state.pets || !state.activePetId) return;
    petState = state;
    const activeId = state.activePetId;
    const pet = state.pets[activeId];
    if (!pet) return;

    // PET_ASSETS is defined in pet_assets.js which runs before content.js
    if (typeof PET_ASSETS !== "undefined" && PET_ASSETS[activeId]) {
      petContainer.innerHTML = PET_ASSETS[activeId].render(pet.status, pet.stage, pet.skin);
    }
  }

  function isContextValid() {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  }

  // Read state and monitor storage changes
  if (isContextValid()) {
    try {
      chrome.storage.local.get(["petState"], (result) => {
        if (chrome.runtime.lastError) return;
        if (result && result.petState) {
          renderPet(result.petState);
        }
      });
    } catch (e) {
      // Ignore silently
    }
  }

  if (isContextValid()) {
    try {
      chrome.storage.onChanged.addListener((changes) => {
        if (!isContextValid()) return;
        if (changes.petState) {
          renderPet(changes.petState.newValue);
        }
      });
    } catch (e) {
      // Ignore silently
    }
  }

  // Productivity Tracking: User Activity Monitor
  let lastActivitySent = 0;
  function recordActivity() {
    if (!isContextValid()) {
      // Self-destruct: remove listeners to avoid background memory leakage
      document.removeEventListener("mousemove", recordActivity);
      document.removeEventListener("keydown", recordActivity);
      document.removeEventListener("scroll", recordActivity);
      document.removeEventListener("click", recordActivity);
      return;
    }
    const now = Date.now();
    if (now - lastActivitySent > 10000) { // throttle pings to background (10s)
      lastActivitySent = now;
      safeSendMessage({ action: "userActivity" });
    }
  }

  document.addEventListener("mousemove", recordActivity);
  document.addEventListener("keydown", recordActivity);
  document.addEventListener("scroll", recordActivity);
  document.addEventListener("click", recordActivity);

  // Distraction Shield: URL Blacklist Checker
  const DISTRACTING_SITES = ["youtube.com", "twitter.com", "x.com", "reddit.com", "facebook.com", "instagram.com"];
  const distractionInterval = setInterval(() => {
    if (!isContextValid()) {
      clearInterval(distractionInterval);
      return;
    }
    if (!petState) return;
    const session = petState.focusSession;
    const isFocusActive = session && session.active && !session.isPaused;
    if (!isFocusActive) return;

    const currentHost = window.location.hostname.toLowerCase();
    const isDistracted = DISTRACTING_SITES.some(site => currentHost.includes(site));

    if (isDistracted) {
      const warnings = [
        "Hey! Close this tab, we're focusing! 😠",
        "Stop slacking! Get back to coding! 😡",
        "I'm losing stats! Close this page! 😢",
        "No Twitter/Reddit during work! 🛑",
        "We are supposed to be productive! 😤"
      ];
      speak(warnings[Math.floor(Math.random() * warnings.length)]);

      // Apply off-chain stats penalty in background
      safeSendMessage({ action: "distractionPenalty" });
    }
  }, 20000); // Check every 20 seconds
})();
