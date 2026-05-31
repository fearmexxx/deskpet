# Master Development Roadmap & Mechanics Log: CyberPet RPG

This document serves as the consolidated source of truth for the CyberPet Companion ecosystem. It details the core mechanical design, formulas, values, and progression systems, while actively tracking our implementation progress and version history.

---

## 📊 1. Core Vitals & Decay Loop (100% Completed)

Each pet has three dynamic meters ranging from **0 to 100** that decay over time. These metrics dictate the pet's state, visual expressions, passive growth, and productivity impact.

| Vital | Description | Passive Decay (Active) | Sleep Mode Effect | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Hunger** | Represents food saturation. Prevents XP gain at 0. | `-1.0` point/min | `-0.5` points/min | **Implemented** in `background.js` |
| **Happiness** | Represents play/interaction level. Decreases yield at 0. | `-1.0` point/min | `0.0` (frozen) | **Implemented** in `background.js` |
| **Energy** | Represents stamina. Pet wakes up at 100. | `-1.0` point/min | `+5.0` points/min | **Implemented** in `background.js` |

*   **Animation States**: idle, walk, happy, eat, sleep animations are **Implemented** using fluid vector HSL Handoffs in `content.js` and `popup.js`.

---

## 📈 2. XP & Leveling Progression (100% Completed)

XP represents the pet's developmental milestones. Passive and active methods feed XP into the leveling formula.

### XP Formula & Curve
$XP_{needed}(Level) = \lfloor XP_0 \times 1.3^{(Level - 1)} \rfloor$
* **Base Values ($XP_0$)**: **90** (Bunny), **100** (Cat), **120** (Dog).

### XP Accrual Sources (All Implemented)
1.  **Passive Growth**: `+2 XP` / min if hunger/happiness > 50. (In background periodic loop)
2.  **Petting**: `+10 XP` per interact.
3.  **Feeding / Playing**: `+15 XP` per consumable.
4.  **Mutagen Injection**: `+25 XP` per mutagen used.
5.  **Focus Timer Pomodoro**: `+2 XP` per focus min.
6.  **Distraction Penalty**: `-10 XP` on blacklisted tabs during Focus (shield scanner).

### Growth Stages (Implemented)
- Baby (Lv 1 - 4) $\rightarrow$ Teen (Lv 5 - 9) $\rightarrow$ Adult (Lv 10+)
- SVG Scale sizes ($0.70 \rightarrow 0.90 \rightarrow 1.10$) auto-apply based on stage.

---

## ⚔️ 3. RPG Attributes & Staking Expeditions (100% Completed)

Upon leveling up, pets receive **5 Attribute Points** to allocate.

- **Strength**: Governs combat damage and exploration success rate. Allocates successfully in HUD.
- **Agility**: Governs evasion and speeds up travel times (decreases staking trips duration by 0.5% per point). Displays correctly in HUD.
- **Intelligence**: Boosts $PETCOIN yields by $+1\%$ per point. Active in Options yield loop calculations.
- **Staking Expeditions (CPU/RAM/Net)**: Stables allow deploying inactive companions on Devnet expeditions (2h/4h/8h durations scaled down by Agility attributes) to harvest XP, soft coins, or Mutagens.

---

## 💰 4. Consumables Shop & Dual-Token System (100% Completed)

The economy features a stable **Dual-Token System** separating gameplay progression from on-chain transactions.

1. **$PETCOIN (Off-chain Gameplay Currency)**: Eased off-chain loop with zero gas. Used for basic vitals shop consumables.
2. **$DESK (On-chain Devnet SPL Token)**: E.g., for evolution upgrades, breeder companions, and premium cosmetic unlocks. Mint address: `AtdpNbFfYWqaE4bVrwh7mP3jE7K2NSJCiCodvbxGXJt2`.

| Item | Cost | Effect | Implementation |
| :--- | :--- | :--- | :--- |
| **Treat** | 20 💰 | Restores `+25 Hunger`, `+15 XP`. | Implemented |
| **Toy** | 30 💰 | Restores `+30 Happiness`, `+15 XP`. | Implemented |
| **Battery** | 50 💰 | Restores `+40 Energy`, `+10 XP`. | Implemented |
| **Mutagen** | 200 💰 | Random stat `+1` to `+3`, `+25 XP`. | Implemented |

---

## 🔐 5. Privy Wallet Auth & Browser-Side Signing (100% Completed)

We transitioned authentication and transaction signing to support Web3 best-practices:
- **Privy passwordless OTP Auth**: Integrated `@privy-io/js-sdk-core` locally via custom IIFE bundle (`privy-sdk.min.js`) ensuring MV3 compliance. Exposes embedded Solana wallets.
- **Browser-Side Signing (Hard Cutover)**: Since Privy wallets are managed via MPC requiring DOM verification, all transaction creation and signing is executed client-side in `dashboard.js`.
  - **NFT Minting**: Handled directly in the dashboard using the Privy Solana provider, signing and broadcasting raw base64 transaction payloads.
  - **Yield Claims**: Dashboard requests an off-chain ledger claim, constructs a mint transaction for `$DESK` to the user's Associated Token Account (ATA), prompts the user for fee-payer signing, and hands it to the distributor service worker to co-sign and execute.
- **Supabase Dual-Auth Sync**: Privy authentication tokens automatically trigger background registration and syncs to Supabase Database (under derived internal credentials) maintaining fully synced profiles.

---

## 🧬 6. Companion Breeding Engine (100% Completed)
- Requires two Level 60 parent pets. Cost: 100k Petcoin and 5k Desk coin.
- Mixes HSL DNA of parents with a chance for wild neon mutations.
- Breeding logic handles genetic crossover and is fully functional on the authoritative game server.

---

## ⚔️ 7. Multiplayer Lobby & Pet Arena (100% Completed)
- **WebSockets**: Render peer pets on shared websites via Lightweight WebSockets.
- **PvP Pet Arena**: Authoritative server combat simulation and PvP lobby functionality.
- **WoW-Style Gear System**: Features 5 rarity tiers (Common, Blue, Epic, Legendary, Mythic) generated on the backend with random attributes to prevent cheating.

---

## 🔮 8. Future Roadmap & Upcoming Mechanics (Phase 7+)

### Phase 7: Randomized 10,000 NFT Mint & Rarity Blueprint
- **Generative Smart Contract**: Up to 10,000 unique pets generated from randomized metadata traits.
- **Rarity Tiers**: Common (60%), Rare (25%), Epic (12%), Legendary (3%). Higher tiers grant multiplier boosts to passive XP and $PETCOIN focus earnings.
