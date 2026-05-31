# Implementation Plan: DeskPet Onboarding, Cyber Store & NFT Auto-Fetching

We will enhance the starting player experience by introducing a dynamic onboarding phase, building an official store to purchase Level 1 Mystery Eggs and Limited Treasury Level 60 NFTs, and implementing automatic on-chain NFT ownership validation to sync pets dynamically.

## User Review Required

> [!IMPORTANT]
> - **SOL / $DESK Price for Store Purchases**: We will use Devnet `$DESK` SPL tokens (mint address: `AtdpNbFfYWqaE4bVrwh7mP3jE7K2NSJCiCodvbxGXJt2`) for purchases. We proposed prices of `500 $DESK` for the Level 1 Mystery Egg and `5,000 $DESK` for the Level 60 Limited Treasury NFT.
> - **Treasury Wallet**: Token payments will go to your configured Distributor/Treasury Solana wallet address.
> - **Metadata Storage**: Since full Metaplex metadata on-chain is expensive and slow, we will write the detailed stats and HSL colors of each minted NFT to a new Supabase database table `minted_nfts`. Ownership is cryptographically checked on-chain via SPL Token account balances.

---

## Proposed Changes

### Database Layer

#### [NEW] Supabase `minted_nfts` Table
Create a new table `minted_nfts` to store the authoritative game properties of each on-chain minted pet:
- `mint_address` (TEXT, Primary Key)
- `owner_wallet` (TEXT)
- `species` (TEXT: `sol-cat` | `astro-dog` | `cyber-bunny`)
- `name` (TEXT)
- `level` (INTEGER)
- `xp` (INTEGER)
- `stage` (TEXT)
- `strength` (INTEGER)
- `agility` (INTEGER)
- `intelligence` (INTEGER)
- `stamina` (INTEGER)
- `skin` (TEXT)
- `rarity` (TEXT)
- `equipment` (JSONB)
- `is_treasury` (BOOLEAN)
- `updated_at` (TIMESTAMP)

### Client Extension Layer

#### [MODIFY] [background.js](file:///e:/2026/code/deskpet/background.js)
- Modify `DEFAULT_STATE` to remove hardcoded starting pets (they will be empty on raw initial state).
- Update `initStorage()`:
  - If no `petState` is found (new user), generate **3 random common Level 1 pets** (random species, random name e.g., "Cyber Pup #5092", random common skin color, level 1, stats based on base templates).
  - Assign the first generated pet as `activePetId`.
  - Save this state as the initial `petState`.
- Update message handler:
  - Add an action to register newly minted or bought NFTs into the Supabase database.

#### [MODIFY] [dashboard.html](file:///e:/2026/code/deskpet/dashboard.html)
- Add a new tab `🏪 Store` to the game modules selection bar.
- Add the corresponding tab view (`#game-tab-store`) containing:
  - Mystery Egg purchase card (500 `$DESK`): Buy a Level 1 random common pet NFT.
  - Treasury Level 60 Pet card (5,000 `$DESK`): Limited supply of 3333. Buy a fully-leveled Level 60 pet NFT.
  - A status indicator showing the total treasury pets minted out of 3333.

#### [MODIFY] [dashboard.js](file:///e:/2026/code/deskpet/dashboard.js)
- **Level 60 Minting Check**:
  - Update the "Mint NFT" button behavior. Disable the button and display "Requires Level 60" unless `pet.level === 60`.
- **Cyber Store Purchases**:
  - Implement store tab selection and UI rendering.
  - Implement purchase logic:
    - Transfer `$DESK` from the user's ATA to the Treasury ATA.
    - Generate a new pet (either Level 1 or Level 60 depending on the selected card).
    - Mint the NFT on-chain to the user's Privy wallet (mint keypair generation, token account creation, minting 1 token, revoking mint authority).
    - Register the NFT in Supabase `minted_nfts` table.
    - Add the pet to the local stable `state.pets` and save state.
- **On-Chain Auto-Fetching Loop**:
  - Implement `syncNFTsFromWallet()` triggered on wallet connect and periodically:
    - Query `getTokenAccountsByOwner` for the user's connected Privy wallet on Solana Devnet.
    - Identify all tokens where balance = 1 and decimals = 0 (NFTs).
    - Fetch details for all identified mint addresses from the Supabase `minted_nfts` table.
    - **Import**: If an NFT is owned on-chain but not in `state.pets`, fetch its metadata and inject it into the stable.
    - **Fraud Protection**: If a pet in `state.pets` is flagged as `minted = true` but its `mintAddress` is no longer in the user's on-chain wallet (transferred or sold), automatically remove or lock it from the stable.

---

## Verification Plan

### Automated/Manual Tests
- Log in with a clean/new user profile to verify they receive 3 randomized Level 1 common pets instead of the standard fixed set.
- Check the "Mint NFT" button on a low-level pet and verify it is locked with a "Requires Level 60" tooltip.
- Verify that a level 60 pet can successfully complete the mint process.
- Purchase a Level 1 Mystery Egg and Level 60 Treasury pet from the store. Verify SPL tokens are deducted and the new NFTs show up in the stable.
- Transfer one of the minted NFTs to a different wallet and check if it disappears from the active stable (fraud protection).
