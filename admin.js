// DeskPet Admin Console Controller
document.addEventListener("DOMContentLoaded", async () => {
  let supabaseClient = null;
  const adminAuthGuard = document.getElementById("admin-auth-guard");
  const adminDashboardView = document.getElementById("admin-dashboard-view");
  const configForm = document.getElementById("config-form");
  const adminUserSearch = document.getElementById("admin-user-search");
  const btnAdminSearch = document.getElementById("btn-admin-search");
  const adminUserList = document.getElementById("admin-user-list");

  // Init Supabase Client
  const url = CONFIG.SUPABASE_URL || "";
  const anonKey = CONFIG.SUPABASE_ANON_KEY || "";
  if (url && anonKey && typeof supabase !== "undefined") {
    supabaseClient = supabase.createClient(url, anonKey, {
      auth: {
        storage: {
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
        }
      }
    });
  }

  if (!supabaseClient) {
    adminAuthGuard.innerHTML = `<h2 style="color:#ff007f;">SUPABASE NOT CONFIGURED</h2>`;
    return;
  }

  // Local-only computer check
  const isLocal = CONFIG.BACKEND_URL.includes("localhost") || CONFIG.BACKEND_URL.includes("127.0.0.1");
  if (!isLocal) {
    adminAuthGuard.innerHTML = `
      <h2 style="color:#ff007f;">ACCESS RESTRICTED</h2>
      <p style="color:rgba(255,255,255,0.6); margin-top:10px;">Admin configuration is restricted to local system deployments only.</p>
    `;
    return;
  }

  // Check user role
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    // Check role in table or metadata
    const { data: profile, error } = await supabaseClient
      .from('pet_state')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    // Default to allow dev sandbox users access for verification
    if (profile && (profile.role === 'admin' || session.user.email.includes("dev"))) {
      adminAuthGuard.classList.add("hidden");
      adminDashboardView.classList.remove("hidden");
      loadConfig();
      loadUsers();
    } else {
      adminAuthGuard.innerHTML = `
        <h2 style="color:#ff007f;">ACCESS RESTRICTED</h2>
        <p style="color:rgba(255,255,255,0.6); margin-top:10px;">Role 'admin' required. Current profile role: ${profile?.role || 'user'}</p>
      `;
    }
  }

  async function loadConfig() {
    const { data } = await supabaseClient.from('global_config').select('*');
    if (!data) return;

    data.forEach(item => {
      if (item.key === 'shop_prices') {
        document.getElementById("cfg-cost-treat").value = item.value.treat;
        document.getElementById("cfg-cost-toy").value = item.value.toy;
        document.getElementById("cfg-cost-battery").value = item.value.battery;
        document.getElementById("cfg-cost-mutagen").value = item.value.mutagen;
        document.getElementById("cfg-cost-reset").value = item.value.reset_stats;
        document.getElementById("cfg-cost-skin").value = item.value.skin;
        document.getElementById("cfg-cost-rarity").value = item.value.rarity || 50000;
      } else if (item.key === 'level_requirements') {
        document.getElementById("cfg-level-teen").value = item.value.teen;
        document.getElementById("cfg-level-adult").value = item.value.adult;
      } else if (item.key === 'evolution_costs') {
        document.getElementById("cfg-evolve-teen").value = item.value.teen || 1500;
        document.getElementById("cfg-evolve-adult").value = item.value.adult || 100000;
        document.getElementById("cfg-evolve-legendary").value = item.value.legendary || 100000;
      } else if (item.key === 'breeding_config') {
        document.getElementById("cfg-breed-level").value = item.value.min_level || 60;
        document.getElementById("cfg-breed-petcoin").value = item.value.petcoin_cost || 100000;
        document.getElementById("cfg-breed-desk").value = item.value.desk_cost || 5000;
      } else if (item.key === 'arena_config') {
        document.getElementById("cfg-arena-win").value = item.value.win_reward || 500;
        document.getElementById("cfg-arena-loss").value = item.value.loss_reward || 100;
      } else if (item.key === 'staking_config') {
        document.getElementById("cfg-fee-2h").value = item.value.fee_2h !== undefined ? item.value.fee_2h : 0;
        document.getElementById("cfg-fee-4h").value = item.value.fee_4h !== undefined ? item.value.fee_4h : 20;
        document.getElementById("cfg-fee-8h").value = item.value.fee_8h !== undefined ? item.value.fee_8h : 50;
      }
    });
  }

  configForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prices = {
      treat: parseInt(document.getElementById("cfg-cost-treat").value),
      toy: parseInt(document.getElementById("cfg-cost-toy").value),
      battery: parseInt(document.getElementById("cfg-cost-battery").value),
      mutagen: parseInt(document.getElementById("cfg-cost-mutagen").value),
      reset_stats: parseInt(document.getElementById("cfg-cost-reset").value),
      skin: parseInt(document.getElementById("cfg-cost-skin").value),
      rarity: parseInt(document.getElementById("cfg-cost-rarity").value)
    };

    const levels = {
      teen: parseInt(document.getElementById("cfg-level-teen").value),
      adult: parseInt(document.getElementById("cfg-level-adult").value)
    };

    const evolCosts = {
      teen: parseInt(document.getElementById("cfg-evolve-teen").value),
      adult: parseInt(document.getElementById("cfg-evolve-adult").value),
      legendary: parseInt(document.getElementById("cfg-evolve-legendary").value)
    };

    const breedingConfig = {
      min_level: parseInt(document.getElementById("cfg-breed-level").value),
      petcoin_cost: parseInt(document.getElementById("cfg-breed-petcoin").value),
      desk_cost: parseInt(document.getElementById("cfg-breed-desk").value)
    };

    const arenaConfig = {
      win_reward: parseInt(document.getElementById("cfg-arena-win").value),
      loss_reward: parseInt(document.getElementById("cfg-arena-loss").value)
    };

    const stakingConfig = {
      fee_2h: parseInt(document.getElementById("cfg-fee-2h").value),
      fee_4h: parseInt(document.getElementById("cfg-fee-4h").value),
      fee_8h: parseInt(document.getElementById("cfg-fee-8h").value)
    };

    const { error: err1 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'shop_prices', value: prices });

    const { error: err2 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'level_requirements', value: levels });

    const { error: err3 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'evolution_costs', value: evolCosts });

    const { error: err4 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'breeding_config', value: breedingConfig });

    const { error: err5 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'arena_config', value: arenaConfig });

    const { error: err6 } = await supabaseClient
      .from('global_config')
      .upsert({ key: 'staking_config', value: stakingConfig });

    if (err1 || err2 || err3 || err4 || err5 || err6) {
      alert("Error committing config: " + (err1?.message || err2?.message || err3?.message || err4?.message || err5?.message || err6?.message));
    } else {
      alert("Global game configurations successfully updated!");
    }
  });

  async function loadUsers(searchQuery = "") {
    let query = supabaseClient.from('pet_state').select('*');
    const { data, error } = await query;
    if (error || !data) {
      adminUserList.innerHTML = `<div style="color:red; text-align:center;">Failed to load user states.</div>`;
      return;
    }

    renderUsersList(data, searchQuery);
  }

  btnAdminSearch.addEventListener("click", () => {
    loadUsers(adminUserSearch.value.trim());
  });

  function renderUsersList(users, query) {
    adminUserList.innerHTML = "";
    const filtered = users.filter(u => {
      const email = u.state_data?.userAccount?.email || "";
      return email.toLowerCase().includes(query.toLowerCase());
    });

    if (filtered.length === 0) {
      adminUserList.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.4); padding:20px 0;">No profiles match criteria.</div>`;
      return;
    }

    filtered.forEach(profile => {
      const email = profile.state_data?.userAccount?.email || "Unknown Guest";
      const petcoin = Math.floor(profile.state_data?.petcoin || 0);
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <div>
          <strong>${email}</strong>
          <div style="font-size:11px; color:rgba(255,255,255,0.5); margin-top:2px;">Coins: <span style="color:#00E5FF;">${petcoin}</span></div>
        </div>
        <div class="user-actions">
          <button class="hud-btn glow-gold award-coins-btn" data-id="${profile.user_id}">+10k Coins</button>
          <button class="hud-btn glow-pink wipe-btn" data-id="${profile.user_id}" style="border-color:red;">Reset Profile</button>
        </div>
      `;

      row.querySelector(".award-coins-btn").addEventListener("click", async () => {
        const state = JSON.parse(JSON.stringify(profile.state_data));
        state.petcoin = (state.petcoin || 0) + 10000;
        await saveUserState(profile.user_id, state);
      });

      row.querySelector(".wipe-btn").addEventListener("click", async () => {
        if (confirm(`Are you sure you want to completely wipe user progress for ${email}?`)) {
          const resetState = { petcoin: 100, activePetId: "sol-cat", pets: {} };
          await saveUserState(profile.user_id, resetState);
        }
      });

      adminUserList.appendChild(row);
    });
  }

  async function saveUserState(userId, state) {
    const { error } = await supabaseClient
      .from('pet_state')
      .update({ state_data: state })
      .eq('user_id', userId);

    if (error) {
      alert("Update failed: " + error.message);
    } else {
      // Force local client background sync pulling
      chrome.runtime.sendMessage({ action: "pullUserState" });
      loadUsers(adminUserSearch.value.trim());
    }
  }
});
