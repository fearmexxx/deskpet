# DeskPet: Progress Review & Phase 7 Proposal

## 📊 Current Progress Audit

After a thorough review of every file in the workspace — all documentation ([progress.md](file:///e:/2026/code/deskpet/progress.md), [system_memory.md](file:///e:/2026/code/deskpet/system_memory.md), [walkthrough.md](file:///e:/2026/code/deskpet/walkthrough.md), [strategic_analysis.md](file:///e:/2026/code/deskpet/strategic_analysis.md), [economic_model_and_feasibility.md](file:///e:/2026/code/deskpet/economic_model_and_feasibility.md), [gears.md](file:///e:/2026/code/deskpet/gears.md)), the full server codebase ([server.js](file:///e:/2026/code/deskpet/server/server.js) — 2,123 lines), the extension codebase, and the `livepet/` standalone fork — here is the consolidated status:

### ✅ Completed Features (Phases 1–6)

| Phase | Feature | Server | Client | Notes |
|:------|:--------|:------:|:------:|:------|
| 1 | SVG Companion overlay (drag, walk, idle, eat, sleep, happy) | — | ✅ | Shadow DOM injection, HSL skins |
| 1 | Vitals decay loop (hunger/happiness/energy) | ✅ | ✅ | Authoritative on server |
| 2 | XP / Leveling (Lv 1→60, Baby→Teen→Adult→Legendary stages) | ✅ | ✅ | Rarity multiplier scaling |
| 2 | RPG attributes (STR/AGI/INT/STA) + allocation + respec | ✅ | ✅ | 10k $PETCOIN respec fee |
| 2 | $PETCOIN passive yield + Focus Timer "Focus-to-Earn" | ✅ | ✅ | Rarity-scaled, 8h offline cap |
| 3 | Consumables shop (Treat/Toy/Battery/Mutagen) | ✅ | ✅ | Prices in $PETCOIN |
| 3 | Cyber Store (Mystery Egg 500 $DESK, Treasury Pet 5k $DESK) | ✅ | ✅ | Server-side rarity rolls |
| 3 | Generative rarity system (Common/Rare/Epic/Legendary/Treasury) | ✅ | ✅ | Skin→rarity mapping |
| 4 | Privy OTP Auth + embedded Solana wallet auto-provisioning | — | ✅ | MV3-compliant IIFE bundle |
| 4 | Supabase dual-auth sync (resilient try-catch) | ✅ | ✅ | Offline fallback |
| 4 | On-chain NFT auto-sync (dual wallet scan, lock/grace period) | — | ✅ | 2-min grace, 15s debounce |
| 4 | $DESK faucet (30k $DESK server-minted per claim, 24h cooldown) | ✅ | ✅ | Rate-limited |
| 4 | Transaction replay prevention (`processed_transactions` table) | ✅ | — | — |
| 4 | 30% burn / 70% recycle on store & breeding fees | ✅ | — | On-chain `BurnTo` |
| 5 | Staking expeditions (CPU/RAM/NET, 2h/4h/8h) | ✅ | ✅ | Obstacle RNG, gear drops at Lv60 |
| 5 | RPG gear system (4 slots, 4 rarity tiers, stat rolls) | ✅ | ✅ | Equip/unequip server-side |
| 5 | Staking slot upgrades (1→5, escalating $PETCOIN + $DESK cost) | ✅ | ✅ | Requires Lv60 pet to unlock |
| 5 | Premium $DESK staking rewards (dynamic halving, 150/day cap) | ✅ | ✅ | Distributor balance checks |
| 6 | Breeding engine (Lv60 parents, genetic HSL crossover, 50/50 parent burn) | ✅ | ✅ | 100k $PETCOIN + 5k $DESK |
| 6 | Multiplayer WebSocket lobby + PvP arena | ✅ | ✅ | Turn-based combat sim with stunts, crits, skills |
| 6 | Stage ascension (Baby→Teen→Adult→Legendary, mutagen-gated final tier) | ✅ | — | Server-only |

### ⚠️ Identified Gaps & Technical Debt

| # | Issue | Severity | Details |
|:--|:------|:--------:|:--------|
| 1 | **`upgradeRarity` action still exists on server** | 🟡 Medium | [server.js L1281-1299](file:///e:/2026/code/deskpet/server/server.js#L1281-L1299) — The implementation plan said to remove this, but it's still live. Allows any user to pay 50k $PETCOIN to jump rarity tiers client-side. |
| 2 | **Gear names reference Warcraft IP** | 🔴 High | [server.js L278-296](file:///e:/2026/code/deskpet/server/server.js#L278-L296) — "Ashbringer", "Thunderfury", "Frostmourne", "Kel'Thuzad's Reach" etc. This is a **legal risk** for Chrome Web Store publication. Progress notes say WoW references were "fully scrubbed" but they are still in the gear generator. |
| 3 | **`resetAttributes` uses petId as species check** | 🟡 Medium | [server.js L1340-1343](file:///e:/2026/code/deskpet/server/server.js#L1340-L1343) — Compares `targetPetId` (a UUID like `sol-cat-a3f8b2c1`) against string literals `"astro-dog"` and `"cyber-bunny"`. Will never match → all pets reset to cat base stats. Should check `pet.species` instead. |
| 4 | **`faucet/claim` missing `new` keyword** | 🟡 Medium | [server.js L462](file:///e:/2026/code/deskpet/server/server.js#L462) — `solanaWeb3.TransactionInstruction({...})` missing `new` → will throw at runtime when creating ATA. |
| 5 | **No heartbeat/anti-cheat on focus sessions** | 🟡 Medium | Strategic analysis recommends active heartbeat verification, but none is implemented. Focus timer rewards can be farmed. |
| 6 | **Server runs only on localhost:3001** | 🔴 High | No deployment config (Dockerfile, Render/Railway config, or Procfile). Server is development-only. |
| 7 | **`livepet/` fork is stale** | ⚪ Low | The `livepet/` directory contains a separate standalone extension fork (12 files, its own progress.md from Phase 1-2). Appears to be an older branch. |
| 8 | **Breed species resolution uses ID parsing** | 🟡 Medium | [server.js L1500](file:///e:/2026/code/deskpet/server/server.js#L1500) — Uses `parentA.id.includes("cat")` instead of `parentA.species`. Fragile for baby IDs that start with `baby-`. |

---

## 🔮 Phase 7 Proposal: "Launch Readiness & Polish Sprint"

Based on the gap analysis, the PRD goals (10k users, Chrome Web Store publication), and the economic model targeting a $3M FDV launch, I propose the next stage focuses on **launch readiness** rather than adding new gameplay mechanics. The game loop is already feature-complete. What's missing is the hardening, polish, and deployment infrastructure to actually ship.

### Proposed Work Streams

---

### Stream A: Critical Bug Fixes & Legal Compliance (Priority: 🔴 IMMEDIATE)

#### [MODIFY] [server.js](file:///e:/2026/code/deskpet/server/server.js)

1. **Scrub all Warcraft/Blizzard IP references from gear names** — Replace "Ashbringer", "Thunderfury", "Frostmourne", "Helm of Domination", "Neltharion's Tear", "Eye of C'Thun" etc. with original cyberpunk-themed names (e.g., "Plasma Railcannon", "Quantum Disruptor", "Neural Cortex Helm").
2. **Remove `upgradeRarity` action** — Delete the handler at L1281-1299 to prevent paying $PETCOIN to bypass the randomized rarity system.
3. **Fix `resetAttributes` species detection** — Change `targetPetId` comparisons to use `targetPet.species` field.
4. **Fix `faucet/claim` missing `new` keyword** — Add `new` to `solanaWeb3.TransactionInstruction(...)` on L462.
5. **Fix breeding species resolution** — Use `parentA.species` instead of `parentA.id.includes("cat")`.

> [!CAUTION]
> The Warcraft IP issue is a **publication blocker**. Blizzard/Activision actively enforces trademark claims. This must be fixed before any public release.

---

### Stream B: Deployment & Infrastructure (Priority: 🔴 HIGH)

#### [NEW] Deployment Configuration

1. **Create `Dockerfile`** for the Express server with multi-stage build.
2. **Create `render.yaml`** or equivalent deployment manifest for Render/Railway.
3. **Migrate `distributor-keypair.json`** to encrypted environment variables only. Add the file to `.gitignore` (verify it's not already committed in git history).
4. **Add `CORS_ORIGIN` environment variable** to restrict API access to the extension's origin ID only.
5. **Configure Helius or QuickNode RPC** — Replace the default `api.devnet.solana.com` with a reliable RPC provider that supports mainnet rate limits.

#### [MODIFY] [config.js](file:///e:/2026/code/deskpet/config.js)
- Add a `SERVER_URL` constant pointing to the deployed server URL instead of hardcoded `localhost:3001`.

---

### Stream C: Anti-Cheat & Focus Timer Hardening (Priority: 🟡 MEDIUM)

#### [MODIFY] [server.js](file:///e:/2026/code/deskpet/server/server.js)

1. **Focus session heartbeat validation** — Add a `/api/focus/heartbeat` endpoint. The client must POST a heartbeat every 2 minutes during an active focus session. If no heartbeat is received for 5 minutes, the session auto-pauses on the server side.
2. **Focus daily cap** — Enforce a maximum of 180 minutes (3 hours) of rewarded focus time per day per user.
3. **Petting rate-limit per IP** — Add express-rate-limit middleware to prevent bot hammering of the sync-action endpoint.

#### [MODIFY] [background.js](file:///e:/2026/code/deskpet/background.js)
- Implement periodic heartbeat calls during active focus sessions using `chrome.alarms`.

---

### Stream D: Chrome Web Store Publication Prep (Priority: 🟡 MEDIUM)

#### [MODIFY] [manifest.json](file:///e:/2026/code/deskpet/manifest.json)

1. **Bump version** to `2.0.0` for the launch candidate.
2. **Update description** — Use SEO-optimized text: *"DeskPet RPG: Your neon cyber-companion that lives on every webpage. Focus Timer, NFT pets on Solana, PvP battles & breeding."*
3. **Review permissions** — Verify `<all_urls>` host permission is justified and document the justification for Chrome Web Store review.

#### [NEW] Chrome Web Store Assets
- Create 5 promotional screenshots (1280x800) showing: pet overlay on a real webpage, dashboard stable view, store UI, PvP arena, and focus timer in action.
- Create 1 promotional tile image (440x280).
- Write the full store listing description (SEO keywords: Pomodoro, Focus Timer, Virtual Pet, Tamagotchi, Solana, NFT).

---

### Stream E: UX Polish & Quality of Life (Priority: 🟢 NICE TO HAVE)

1. **Notification system** — Chrome notifications for: staking expedition completed, pet is hungry/about to faint, focus session completed.
2. **Sound effects** — Optional, muted-by-default sound FX for level-ups, gear drops, and arena victories.
3. **Onboarding tutorial** — First-time walkthrough overlay in the dashboard explaining the core loop.
4. **Gear tooltips** — Hover cards on the gear inventory showing stat comparisons vs. currently equipped items.

---

## Open Questions

> [!IMPORTANT]
> **Q1: Devnet → Mainnet Migration Timeline?**
> The entire token economy ($DESK, NFT mints, staking rewards) currently runs on Solana Devnet. When do you want to target Mainnet deployment? This affects whether we need to set up Helius RPC, multi-sig treasury via Squads, and LP seeding in this phase or defer it.

> [!IMPORTANT]
> **Q2: What to do with the `livepet/` fork?**
> The `livepet/` directory contains a separate standalone version of the extension (12 files, its own progress.md stuck at Phase 1-2). Should we:
> - **Archive it** — Move to a `_legacy/` folder and ignore.
> - **Delete it** — Remove entirely from the repo.
> - **Merge any unique features** — If it has anything the main extension doesn't.

> [!IMPORTANT]
> **Q3: Server deployment platform preference?**
> The server needs to be deployed for real users. Options:
> - **Render** (free tier available, WebSocket support, auto-deploy from Git)
> - **Railway** (similar to Render, good DX)
> - **AWS/GCP** (more control, more complexity)
> - **VPS** (cheapest, manual management)

> [!IMPORTANT]
> **Q4: Do you want to execute all 5 streams, or prioritize?**
> Streams A + B are blockers for any public release. Streams C, D, E can be deferred. Would you like to proceed with A + B first, or go all-in on the full sprint?

---

## Verification Plan

### Stream A (Bug Fixes)
- `grep` the server codebase for any remaining Warcraft/Blizzard trademarked names.
- Test `resetAttributes` with generated pet IDs (not static species names).
- Verify `upgradeRarity` action returns a 400 error or is gone entirely.
- Test faucet claim for new users (ATA creation path).

### Stream B (Deployment)
- Deploy to Render staging, verify all endpoints respond.
- Confirm `distributor-keypair.json` is NOT in the git history.
- Test CORS rejection from non-extension origins.

### Stream C (Anti-Cheat)
- Run a focus session without sending heartbeats — verify it auto-pauses after 5 minutes.
- Verify daily focus cap prevents rewards after 180 minutes.

### Stream D (Store)
- Load extension as unpacked in Chrome, verify manifest v3 compliance warnings.
- Review all permissions justifications.
