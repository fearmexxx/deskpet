DeskPet PRD (Product Requirements Document)
Project Name: DeskPet
Version: 1.0 (MVP)
Date: May 27, 2026
Creator: Grok (for Brother MaxxNG)1. Product VisionDeskPet is a lightweight Chrome/Edge/Firefox browser extension that brings a cute, always-visible pixel-art NFT pet to your desktop. The pet floats as a transparent always-on-top window, levels up through idle time + light interaction, and gives true ownership via Solana NFTs.It turns passive computer usage into a fun, rewarding experience while driving virality through easy X/Twitter sharing.Tagline: “Your pet that never leaves your screen.”2. Objectives & Success MetricsPrimary Goals:Create a sticky daily habit (users keep extension running 4+ hours/day)
Achieve 10k+ active users in first 3 months
Build a sustainable play-and-earn economy on Solana
Viral coefficient > 1.2 through shareable pet progress

KPIs:DAU / MAU ratio
Average session time (target: 2+ hours)
NFT mints & secondary trading volume
Retention: Day 7 > 40%, Day 30 > 20%

3. Target AudienceCrypto degens & NFT collectors (18-35)
Solana ecosystem users
People who spend 4+ hours on desktop (developers, traders, gamers, remote workers)
Fans of Tamagotchi / Neopets / idle games

4. Core Features (MVP)4.1 Floating Pet OverlayTransparent always-on-top window (draggable, resizable, minimizable)
Pixel art pet (32x32 → 64x64 base size)
Multiple states: Idle, Wander, Follow Cursor (gentle), Sleep, Excited, Sad
Smooth animations (8–12 FPS) using Canvas + spritesheets

4.2 Pet Stats & Leveling SystemStats:Level (1–100)
Happiness (0–100)
Energy (0–100)
Three traits: Intelligence, Strength, Charm

XP Sources:Passive: +1 XP every 5–8 minutes (browser/PC active)
Feeding & mini-games
Daily quests (self-claimed)
Social sharing bonus

Level Up Rewards:Visual evolution
Stat point allocation
Increased passive token yield
New cosmetics / mini-games

4.3 Gameplay LoopPet idles and gains passive progress
User clicks to feed / pet / play 30-second mini-game
Complete daily quests → claim rewards
Share progress to X (one-click screenshot + template)
Level up → celebrate + on-chain sync (major levels)

Mini-Games (MVP):Clicker (feed/pet)
Simple memory match
Light endless runner

4.4 Blockchain Layer (Solana)Pets as Metaplex Core NFTs
Dynamic traits via plugins (level, rarity, stats)
Main token: $DESK (SPL Token-2022)
Passive yield claimable daily
Breeding system (2 pets → new pet + token burn)
Integration with Magic Eden (deep links) + simple in-game marketplace

4.5 Social & ViralityBuilt-in screenshot + “Share to X” button
No direct X API usage
Leaderboards (off-chain backend)
Guild/community multipliers

5. User Journey (MVP)Install extension from Chrome Web Store
Optional wallet connect (Phantom/Backpack)
Claim free starter Common pet (egg → baby)
Pet appears floating → user starts playing
Level up to 10 → first evolution
Mint/upgrade to better rarity
Trade on Magic Eden or in-game market

6. Technical RequirementsExtension Tech Stack:Manifest V3
HTML5 Canvas + JavaScript (or TypeScript)
State: Chrome Storage + IndexedDB
Floating window: chrome.windows.create (alwaysOnTop, transparent)
Animations: Spritesheets in Aseprite → exported PNG

Blockchain:Solana + Metaplex Core + Umi SDK
Embedded wallet option (Particle / Dynamic)
Anchor (for custom programs if needed)

Backend (Minimal):Supabase or Firebase (leaderboards, quests, user data)

Assets:Pixel art in the exact style of the reference images (dark bg, glowing neon, retro)
All animations created in Aseprite

7. Design & Art DirectionStyle: Retro pixel art with strong glows, particles, and neon accents
Consistent evolution visual progression (Baby → Juvenile → Adult → Legendary)
Dark theme friendly for overlay
Sound effects (optional, muted by default)

8. MonetizationNFT pet mints & cosmetics
Marketplace trading fees (1–5%)
Premium cosmetic packs
$DESK token utility & staking

9. Development RoadmapPhase 0: Pre-Build (1 week)Finalize pixel art style + create 3–4 full evolution sets
Create spritesheets for idle, walk, excited, sleep

Phase 1: MVP Core (4–6 weeks)Floating overlay + basic animations
Idle XP + leveling system (local)
Wallet connect + basic NFT mint
2 mini-games + feeding

Phase 2: Blockchain & Economy (3–4 weeks)Metaplex Core integration
Token + yield
Breeding
Magic Eden + simple marketplace

Phase 3: Polish & Launch (2–3 weeks)Social sharing
Leaderboards
Launch campaign on Crypto Twitter

10. Risks & MitigationsPerformance: Keep canvas small + optimize animations
Spam fatigue: Make social features optional
Token economy death spiral: Strong sinks (breeding, cosmetics, listing fees)
Extension store approval: Avoid aggressive mining or wallet prompts

Next Steps for You (Immediate Action Items)Art — Generate/create full spritesheets for at least one pet line (egg → legendary) in Aseprite
Prototype — Build the floating window + idle animation first (pure JS, no blockchain)
Smart Contracts — Set up Solana project + Metaplex Core collection
Naming — Finalize pet name, token ticker, collection name

