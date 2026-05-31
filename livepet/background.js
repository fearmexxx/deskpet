// Background Service Worker for CyberPet Companion
importScripts('config.js', 'supabase.js');

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

// Default Pet State
const DEFAULT_STATE = {
  petcoin: 100,
  activePetId: "sol-cat",
  pets: {
    "sol-cat": {
      id: "sol-cat",
      name: "Sol-Cat",
      level: 1,
      xp: 0,
      xpNeeded: 100,
      stage: "Baby", // Baby, Teen, Adult
      hunger: 80,
      happiness: 80,
      energy: 80,
      status: "idle",
      strength: 10,
      agility: 10,
      intelligence: 10,
      availableStatPoints: 0,
      minted: false,
      mintAddress: null
    },
    "astro-dog": {
      id: "astro-dog",
      name: "Astro-Dog",
      level: 1,
      xp: 0,
      xpNeeded: 120,
      stage: "Baby",
      hunger: 70,
      happiness: 70,
      energy: 70,
      status: "idle",
      strength: 12,
      agility: 8,
      intelligence: 10,
      availableStatPoints: 0,
      minted: false,
      mintAddress: null
    },
    "cyber-bunny": {
      id: "cyber-bunny",
      name: "Cyber-Bunny",
      level: 1,
      xp: 0,
      xpNeeded: 90,
      stage: "Baby",
      hunger: 60,
      happiness: 60,
      energy: 90,
      status: "idle",
      strength: 8,
      agility: 12,
      intelligence: 10,
      availableStatPoints: 0,
      minted: false,
      mintAddress: null
    }
  },
  inventory: {
    treat: 3,
    toy: 2,
    battery: 1,
    mutagen: 0
  },
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

// Initialize State
function initStorage() {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) {
      chrome.storage.local.set({ petState: DEFAULT_STATE });
      console.log("Initialized default pet state.");
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "petGameLoop") {
    updatePetStats();
  }
});

function updatePetStats() {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) return;

    let state = JSON.parse(JSON.stringify(result.petState));
    
    // Check Focus timer status and idle state
    if (state.focusSession && state.focusSession.active) {
      if (state.focusSession.isPaused) {
        // Shift end time forward by 1 minute while paused to freeze remaining time
        state.focusSession.endTime += 60000;
        
        // Ensure active pet stays asleep while paused
        const pet = state.pets[state.activePetId];
        if (pet && pet.status !== "sleep") {
          pet.status = "sleep";
        }
      } else {
        // Idle detection: check if inactive for more than 3 minutes (180000ms)
        const idleTime = Date.now() - (state.focusSession.lastActivityTime || Date.now());
        if (idleTime > 180000) {
          state.focusSession.isPaused = true;
          const pet = state.pets[state.activePetId];
          if (pet) {
            pet.status = "sleep";
          }
        } else if (Date.now() >= state.focusSession.endTime) {
          state.focusSession.active = false;
          const reward = state.focusSession.duration * 20; // 20 $PETCOIN per min
          state.petcoin = (state.petcoin || 0) + reward;
          
          const pet = state.pets[state.activePetId];
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
      // If sleeping, regain energy, hunger still decays slowly
      pet.energy = Math.min(100, pet.energy + 5);
      pet.hunger = Math.max(0, pet.hunger - 0.5);
      if (pet.energy >= 100) {
        pet.status = "idle"; // Wake up automatically when fully rested
      }
    }

    // 2. Perform growth/XP calculations if stats are high
    if (pet.hunger > 50 && pet.happiness > 50 && pet.status !== "sleep") {
      gainXP(state, pet, 2); // Passively gain XP when happy and fed
    }

    // 3. Save state
    chrome.storage.local.set({ petState: state }, () => {
      syncStateToSupabase(state);
    });
  });
}

function gainXP(state, pet, amount) {
  pet.xp += amount;
  if (pet.xp >= pet.xpNeeded) {
    pet.xp -= pet.xpNeeded;
    pet.level += 1;
    pet.xpNeeded = Math.floor(pet.xpNeeded * 1.3);
    
    // Growth rewards: award 5 attribute points and some petcoins
    pet.availableStatPoints = (pet.availableStatPoints || 0) + 5;
    state.petcoin = (state.petcoin || 0) + (pet.level * 20);
    
    // Growth stages
    if (pet.level >= 10) {
      pet.stage = "Adult";
    } else if (pet.level >= 5) {
      pet.stage = "Teen";
    } else {
      pet.stage = "Baby";
    }
  }
}

// Handle actions from Popup or Content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  chrome.storage.local.get(["petState"], (result) => {
    let state = result.petState ? JSON.parse(JSON.stringify(result.petState)) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    const activeId = state.activePetId;
    const pet = state.pets[activeId];

    if (!pet) {
      sendResponse({ success: false, error: "Pet not found" });
      return;
    }

    if (message.action === "feed") {
      // Inline feed uses a treat
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('secure_use_item', { item_type: 'treat' });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      } else {
        if (state.inventory.treat > 0) {
          state.inventory.treat -= 1;
          pet.hunger = Math.min(100, pet.hunger + 25);
          pet.status = "eat";
          gainXP(state, pet, 15);
          chrome.storage.local.set({ petState: state }, () => {
            setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
            sendResponse({ success: true, state });
          });
        } else {
          sendResponse({ success: false, error: "No treats remaining" });
        }
      }
    } else if (message.action === "pet") {
      pet.happiness = Math.min(100, pet.happiness + 20);
      pet.status = "happy";
      gainXP(state, pet, 10);
      chrome.storage.local.set({ petState: state }, () => {
        setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
        sendResponse({ success: true, state });
      });
    } else if (message.action === "sleep") {
      if (pet.status === "sleep") {
        pet.status = "idle";
      } else {
        pet.status = "sleep";
      }
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "changePet") {
      if (state.pets[message.petId]) {
        state.activePetId = message.petId;
      }
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "mintNFT") {
      pet.minted = true;
      pet.mintAddress = "Sol" + Math.random().toString(36).substring(2, 15).toUpperCase();
      gainXP(state, pet, 50);
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "buyItem") {
      const cost = message.cost;
      const itemType = message.itemType;
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('secure_buy_item', { item_type: itemType, cost: cost });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      } else {
        if ((state.petcoin || 0) >= cost) {
          state.petcoin -= cost;
          state.inventory[itemType] = (state.inventory[itemType] || 0) + 1;
          chrome.storage.local.set({ petState: state }, () => {
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
        return true;
      } else {
        if (state.inventory[itemType] > 0) {
          state.inventory[itemType] -= 1;
          if (itemType === "treat") {
            pet.hunger = Math.min(100, pet.hunger + 25);
            pet.status = "eat";
            gainXP(state, pet, 15);
            chrome.storage.local.set({ petState: state }, () => {
              setTimeout(() => { resetPetStatus(activeId, "eat"); }, 3000);
              sendResponse({ success: true, state });
            });
          } else if (itemType === "toy") {
            pet.happiness = Math.min(100, pet.happiness + 30);
            pet.status = "happy";
            gainXP(state, pet, 15);
            chrome.storage.local.set({ petState: state }, () => {
              setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
              sendResponse({ success: true, state });
            });
          } else if (itemType === "battery") {
            pet.energy = Math.min(100, pet.energy + 40);
            gainXP(state, pet, 10);
            chrome.storage.local.set({ petState: state }, () => {
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
      if (bgSupabase && state.userAccount.loggedIn) {
        (async () => {
          try {
            const { data, error } = await bgSupabase.rpc('secure_allocate_stat', { stat_name: statName });
            if (error) {
              sendResponse({ success: false, error: error.message });
            } else {
              chrome.storage.local.set({ petState: data }, () => {
                sendResponse({ success: true, state: data });
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      } else {
        if (pet.availableStatPoints > 0) {
          pet.availableStatPoints -= 1;
          pet[statName] = (pet[statName] || 10) + 1;
          chrome.storage.local.set({ petState: state }, () => {
            sendResponse({ success: true, state });
          });
        } else {
          sendResponse({ success: false, error: "No available stat points" });
        }
      }
    } else if (message.action === "focusPayout") {
      const reward = message.reward;
      state.petcoin = (state.petcoin || 0) + reward;
      chrome.storage.local.set({ petState: state }, () => {
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
                  setTimeout(() => { resetPetStatus(activeId, "happy"); }, 3000);
                  sendResponse({ success: true, state: data });
                });
              }
            } catch (err) {
              sendResponse({ success: false, error: err.message });
            }
          })();
          return true;
        } else {
          const reward = state.focusSession.duration * 20;
          state.petcoin = (state.petcoin || 0) + reward;
          const pet = state.pets[state.activePetId];
          if (pet) {
            pet.status = "happy";
            gainXP(state, pet, state.focusSession.duration * 2);
            setTimeout(() => { resetPetStatus(state.activePetId, "happy"); }, 3000);
          }
          chrome.storage.local.set({ petState: state }, () => {
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
        sendResponse({ success: true, state });
      });
    } else if (message.action === "distractionPenalty") {
      const pet = state.pets[state.activePetId];
      if (pet) {
        pet.happiness = Math.max(0, pet.happiness - 15);
        pet.xp = Math.max(0, pet.xp - 10);
      }
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "login") {
      if (message.resetState) {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
      state.userAccount = {
        loggedIn: true,
        email: message.email,
        provider: message.provider,
        token: "jwt_" + Math.random().toString(36).substring(2, 12).toUpperCase()
      };
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "logout") {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      state.userAccount = {
        loggedIn: false,
        email: null,
        provider: null,
        token: null
      };
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    } else if (message.action === "syncStats") {
      state.lastSynced = Date.now();
      chrome.storage.local.set({ petState: state }, () => {
        sendResponse({ success: true, state });
      });
    }
  });

  return true; // Keep message channel open for async response
});

function resetPetStatus(petId, statusToReset) {
  chrome.storage.local.get(["petState"], (result) => {
    if (!result.petState) return;
    let state = JSON.parse(JSON.stringify(result.petState));
    if (state.pets[petId] && state.pets[petId].status === statusToReset) {
      state.pets[petId].status = "idle";
      chrome.storage.local.set({ petState: state });
    }
  });
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
    
    // Write full client state to PostgreSQL row indexed by authenticated user_id
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
      // Avoid infinite loop: set storage without invoking syncStateToSupabase again
      chrome.storage.local.set({ petState: state });
    }
  } catch (err) {
    console.error("Background sync exception:", err);
  }
}

