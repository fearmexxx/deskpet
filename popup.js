// DeskPet - Popup JavaScript Controller

document.addEventListener("DOMContentLoaded", () => {
  let state = null;

  // DOM elements
  const activePetRender = document.getElementById("active-pet-render");
  const petNameEl = document.getElementById("pet-name");
  const levelBadgeEl = document.getElementById("pet-level-badge");
  const xpTextEl = document.getElementById("xp-text");
  const xpBarEl = document.getElementById("xp-bar");
  const energyTextEl = document.getElementById("energy-text");
  const energyBarEl = document.getElementById("energy-bar");
  const happinessTextEl = document.getElementById("happiness-text");
  const happinessBarEl = document.getElementById("happiness-bar");
  const sleepOverlay = document.getElementById("sleep-overlay");
  
  const btnPet = document.getElementById("btn-pet");
  const btnFeed = document.getElementById("btn-feed");
  const btnSleep = document.getElementById("btn-sleep");
  const btnSleepText = document.getElementById("sleep-btn-text");
  const btnDashboard = document.getElementById("btn-dashboard");
  const btnToggleFloat = document.getElementById("btn-toggle-float");
  const floatStatusDot = document.getElementById("float-status-dot");
  const floatBtnLabel = document.getElementById("float-btn-label");

  // Load initial state
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response) {
      state = response;
      updateUI();
    }
  });

  // Listen for state changes
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATE_UPDATED") {
      state = message.state;
      updateUI();
    }
  });

  function updateUI() {
    if (!state) return;

    const activeId = state.activePetId || "sol-cat";
    const pet = state.pets ? state.pets[activeId] : null;
    if (!pet) return;

    petNameEl.textContent = pet.name;
    levelBadgeEl.textContent = `LEVEL ${pet.level}`;

    // XP calculation
    xpTextEl.textContent = `${pet.xp} / ${pet.xpNeeded}`;
    xpBarEl.style.width = `${Math.min(100, (pet.xp / pet.xpNeeded) * 100)}%`;

    // Energy calculation
    energyTextEl.textContent = `${Math.floor(pet.energy)}%`;
    energyBarEl.style.width = `${pet.energy}%`;

    // Happiness calculation
    happinessTextEl.textContent = `${Math.floor(pet.happiness)}%`;
    happinessBarEl.style.width = `${pet.happiness}%`;

    // Sleep toggle state representation
    const isSleeping = pet.status === "sleep";
    if (isSleeping) {
      sleepOverlay.classList.remove("hidden");
      btnSleepText.textContent = "Wake Up";
      btnSleep.style.borderColor = "var(--color-cyan)";
      btnSleep.style.color = "var(--color-cyan)";
    } else {
      sleepOverlay.classList.add("hidden");
      btnSleepText.textContent = "Sleep";
      btnSleep.style.borderColor = "rgba(255, 255, 255, 0.1)";
      btnSleep.style.color = "var(--text-main)";
    }

    // Toggle float state representation
    const isPetVisible = state.showFloatingPet !== false;
    if (isPetVisible) {
      if (floatBtnLabel) floatBtnLabel.textContent = "Hide Web Pet";
      if (floatStatusDot) { floatStatusDot.style.background = "#39ff14"; floatStatusDot.title = "Web pet is VISIBLE"; }
      btnToggleFloat.style.borderColor = "rgba(255, 255, 255, 0.1)";
      btnToggleFloat.style.color = "var(--text-main)";
    } else {
      if (floatBtnLabel) floatBtnLabel.textContent = "Show Web Pet";
      if (floatStatusDot) { floatStatusDot.style.background = "#ff3366"; floatStatusDot.title = "Web pet is HIDDEN - click to show"; }
      btnToggleFloat.style.borderColor = "var(--color-pink)";
      btnToggleFloat.style.color = "var(--color-pink)";
    }

    // Render active pet SVG
    const activeSpecies = pet.species || (activeId.startsWith("sol-cat") ? "sol-cat" : (activeId.startsWith("astro-dog") ? "astro-dog" : (activeId.startsWith("cyber-bunny") ? "cyber-bunny" : "sol-cat")));
    if (activePetRender && typeof PET_ASSETS !== "undefined" && PET_ASSETS[activeSpecies]) {
      activePetRender.innerHTML = PET_ASSETS[activeSpecies].render(pet.status || "idle", pet.stage || "Baby", pet.skin);
    }

    // Update footer status to show real Solana wallet address
    const footerStatus = document.querySelector(".solana-status");
    if (footerStatus) {
      if (state.solanaWalletPubkey) {
        const shortAddr = state.solanaWalletPubkey.substring(0, 4) + "..." + state.solanaWalletPubkey.substring(state.solanaWalletPubkey.length - 4);
        footerStatus.innerHTML = `<span class="sol-dot" style="background-color: var(--color-green); box-shadow: 0 0 6px var(--color-green);"></span> SOL: <a href="https://explorer.solana.com/address/${state.solanaWalletPubkey}?cluster=devnet" target="_blank" style="color: var(--color-cyan); text-decoration: none; border-bottom: 1px dashed var(--color-cyan);">${shortAddr}</a>`;
      } else {
        footerStatus.innerHTML = `<span class="sol-dot" style="background-color: var(--color-gold); box-shadow: 0 0 6px var(--color-gold);"></span> Web3 Offline`;
      }
    }
  }

  // Interaction handlers
  btnPet.addEventListener("click", () => {
    if (!state) return;
    const activeId = state.activePetId || "sol-cat";
    const pet = state.pets ? state.pets[activeId] : null;
    if (pet && pet.status === "sleep") return;
    
    chrome.runtime.sendMessage({ action: "pet" });
  });

  btnFeed.addEventListener("click", () => {
    if (!state) return;
    const activeId = state.activePetId || "sol-cat";
    const pet = state.pets ? state.pets[activeId] : null;
    if (pet && pet.status === "sleep") return;

    chrome.runtime.sendMessage({ action: "feed" });
  });

  btnSleep.addEventListener("click", () => {
    if (!state) return;
    chrome.runtime.sendMessage({ action: "sleep" });
  });

  btnDashboard.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
  });

  btnToggleFloat.addEventListener("click", () => {
    if (!state) return;
    const currentShowVal = state.showFloatingPet !== false;
    const newShowVal = !currentShowVal;

    state.showFloatingPet = newShowVal;
    updateUI();

    chrome.runtime.sendMessage({
      type: "UPDATE_STATE",
      updates: { showFloatingPet: newShowVal }
    });
  });
});
