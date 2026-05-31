# 🛡️ CyberPet RPG Gear System

This document outlines the detailed design of the CyberPet RPG equipment and exploration raid staking system. Gears are earned passively through exploration raids (staking) and provide substantial attribute boosts to help pets overcome harder challenges.

---

## 🎒 1. Gear Slots & Class Types

Each pet has **4 Equipment Slots**:

1.  **Weapon**: Slots into the offense slot. Grants high Strength/Intelligence. *Only obtainable from 4h and 8h raids.*
2.  **Head**: Slots into the helmet slot. Grants Stamina/Intelligence. *Obtainable from all raids.*
3.  **Clothes**: Slots into the body slot. Grants Stamina/Agility. *Obtainable from all raids.*
4.  **AI Chip**: Slots into the tech slot. Grants Agility/Intelligence/Stamina. *Only obtainable from 4h and 8h raids.*

---

## 💎 2. Gear Rarity Tiers & Stat Allocation

Gears roll random primary and secondary attributes from:
*   **Strength (STR)**
*   **Agility (AGI)**
*   **Intelligence (INT)**
*   **Stamina (STA)** *(A new attribute introduced to increase pet resilience and survival in longer raids)*

### Rarity Tiers & Attribute Ranges:

| Tier | Base Stat Rolls | Multiplier | Visual Border Color | Drop Rate Weight (2h / 4h / 8h) |
| :--- | :--- | :--- | :--- | :--- |
| **Common** (Grey) | `+1` to `+5` | 1.0x | `#808080` | 80% / 50% / 15% |
| **Rare** (Blue) | `+6` to `+12` | 1.2x | `#00c0ff` | 20% / 35% / 40% |
| **Epic** (Purple) | `+13` to `+22` | 1.5x | `#bd00ff` | 0% / 5% / 10% |
| **Legendary** (Gold) | `+23` to `+35` | 2.0x | `#ffb700` | 0% / 0.5% / 1% |

*Note: Item stats are rolled dynamically on drop. Each item has 1 primary stat (high roll) and up to 2 secondary stats (lower rolls).*

---

## 🚀 3. Exploration Raids (Staking) Drop Mechanics

Pets are staked on Net/CPU/RAM raids to scavenge for gears. Duration and active attributes influence gear finding rates.

### Staking Raid Tiers:

1.  **2-Hour Scout Raid (Quick Scan)**
    *   **Requirements**: None
    *   **Possible Drops**: Common/Rare Head, Clothes.
    *   **Drop Chance**: 30% chance to find any gear.
2.  **4-Hour Expedition Raid (Sector Scan)**
    *   **Requirements**: None
    *   **Possible Drops**: Common/Rare/Epic Weapons, Head, Clothes, AI Chips.
    *   **Drop Chance**: 60% chance to find any gear (including Weapons & AI Chips).
3.  **8-Hour Deep Raid (Abyss Raid)**
    *   **Requirements**: Level 30+ (or Epic rarity pet)
    *   **Possible Drops**: Common/Rare/Epic/Legendary Weapons, Head, Clothes, AI Chips.
    *   **Drop Chance**: 100% guaranteed gear drop. Highly boosted Epic & Legendary rates.

### Attribute Influence on Raids:
*   **Agility (AGI)**: Reduces raid duration by **0.5% per point** (capped at 50% reduction).
*   **Strength (STR)**: Increases the chance of rolling higher rarity tiers (+0.1% per point).
*   **Stamina (STA)**: Reduces energy decay during raids (pets lose less energy upon returning).

---

## 🔓 4. Post-Level 60 Progression & Stables

Initially, players start with **1 Stables Slot** and **1 Staking Slot**.

Once a pet reaches the **Max Level (Level 60)**, the player unlocks the ability to expand their stable operations:
*   **Max Stable/Staking Slots**: Up to **5 slots** total.
*   **Unlocking Cost**:
    *   **Slot 2**: 10,000 $PETCOIN
    *   **Slot 3**: 25,000 $PETCOIN + 300 $DESK
    *   **Slot 4**: 50,000 $PETCOIN + 500 $DESK
    *   **Slot 5**: 100,000 $PETCOIN + 1000 $DESK
