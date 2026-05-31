# DeskPet Chrome/Firefox Extension (MVP)

DeskPet is a lightweight browser extension that brings a cute, glowing neon pixel-art NFT pet to your browser. Your pet floats overlayed on webpages, levels up through passive browsing and active mini-games, and simulates a full Solana Web3 play-and-earn economy.

## Features Built

1. **Floating Pet Overlay**:
   - Injects onto webpages.
   - Draggable across the window.
   - Hover stats HUD and quick actions (Pet, Feed, Open Station Dashboard).
   
2. **Dynamic Canvas Pet Engine**:
   - Renders pixel art on the canvas procedurally.
   - Custom styling with glowing neon silhouettes and particles (Zzz sleep, happy hearts, leveling sparks).
   - Dynamic evolution states: Egg (Lv. 1-10) ➔ Baby (Lv. 11-30) ➔ Juvenile (Lv. 31-60) ➔ Adult (Lv. 61-90) ➔ Legendary (Lv. 91-100).
   - Custom glowing skin colors (Cyan, Pink, Green, Gold).

3. **Quick-Action Dropdown Popup**:
   - Compact view of Level, XP, Energy, and Happiness.
   - Toggle Sleep mode and perform actions quickly.

4. **HUD Dashboard (Station)**:
   - **Pet Arena**: Watch the pet roam around in a neon pixel room. Customizer options to rename the pet and set glowing skins.
   - **Daily Bounty Board**: Quests that reward XP and $PETCOIN tokens on completion.
   - **Mini-Games Center**:
     - *Quick Clicker*: Click to interact and feed/pet.
     - *Grid Memory Match*: Flip and match cards to claim tokens and XP.
     - *Neon Runner*: Jumps spikes in an endless runner on a Canvas. Reach 150 points for the bounty!
   - **Solana NFT Core Sandbox**:
     - Connect simulated Phantom Wallet.
     - Accumulate real-time $DESK token yield boosted by stats/level.
     - Mint your Level 10+ pet into a dynamic Metaplex Core NFT with metadata stored on Solana Devnet.
     - Genetic Breeding Lab to breed rare eggs by burning $DESK.

## Project Structure

- [manifest.json](file:///e:/2026/code/deskpet/manifest.json) — Manifest V3 config and resources.
- [background.js](file:///e:/2026/code/deskpet/background.js) — Service worker managing state storage, passive time tracking, and alarms.
- [pet-engine.js](file:///e:/2026/code/deskpet/pet-engine.js) — Canvas engine for procedural rendering, animations, and particle physics.
- [content.js](file:///e:/2026/code/deskpet/content.js) & [content.css](file:///e:/2026/code/deskpet/content.css) — Page overlay content scripts.
- [popup.html](file:///e:/2026/code/deskpet/popup.html), [popup.css](file:///e:/2026/code/deskpet/popup.css), [popup.js](file:///e:/2026/code/deskpet/popup.js) — Quick dropdown action controls.
- [dashboard.html](file:///e:/2026/code/deskpet/dashboard.html), [dashboard.css](file:///e:/2026/code/deskpet/dashboard.css), [dashboard.js](file:///e:/2026/code/deskpet/dashboard.js) — Full-screen main Dashboard interface.
- [assets/icon.png](file:///e:/2026/code/deskpet/assets/icon.png) — Glowing neon egg extension icon.

## Installation & How to Run

1. Open **Google Chrome** (or any Chromium browser like Brave/Edge).
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** in the top-left corner.
5. Select the folder `e:\2026\code\deskpet`.
6. Pin the **DeskPet** extension from the puzzle menu.
7. Open any webpage (e.g., Google, Wikipedia) to see the pet float and roam.
8. Click the extension icon to view the control panel, or click `HUD` to launch the full experience.
