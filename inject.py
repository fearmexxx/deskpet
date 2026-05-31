import sys

mock_code = """// --- STANDALONE MOCK STATE ---
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

"""

files = ['export/dashboard-standalone/dashboard.js', 'export/pet-standalone/floating-pet.js']
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    with open(f, 'w', encoding='utf-8') as file:
        file.write(mock_code + content)
print('Mock code injected successfully.')
