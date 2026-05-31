# DeskPet Economic Model & 3-Year Feasibility Analysis

This document provides a deep-dive financial projection, tokenomics design, supply inflation analysis, and 3-year operational budgeting for the **DeskPet** companion RPG on Solana.

---

## 🪙 1. Tokenomics Base Parameters ($DESK)

With a target **Fully Diluted Valuation (FDV) of $3,000,000**, the token values and supply structure are defined as:

* **Total Supply:** 100,000,000 $DESK
* **Launch Token Price:** $0.03 USD
* **Standard Unit Prices (Fiat Equivalents):**
  * **Mystery Pet Egg:** 500 $DESK ($\approx$ $15.00 USD)
  * **Genesis Max-Level Pet:** 5,000 $DESK ($\approx$ $150.00 USD)
  * **Breeding Fee:** 5,000 $DESK ($\approx$ $150.00 USD)
  * **Standard Level-60 Mint Fee:** 1,000 $DESK ($\approx$ $30.00 USD)

---

## 📈 2. Supply Inflation Control & Genesis Pet Premium

A primary risk in Web3 companion games is pet inflation: since players can level up free starter pets to Level 60 and mint them on-chain, there is a theoretically unlimited supply of pets. To protect the economy, we must create a clear tier separation between **Genesis Pets** (capped at 5,000) and **Standard Minted Pets**.

```
                ┌───────────────────────────────────────────┐
                │             PET MINT PIPELINE             │
                └─────────────────────┬─────────────────────┘
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
┌──────────────────────┐                              ┌──────────────────────┐
│ Genesis Pets (5,000) │                              │ Standard Pets (Unl.) │
└──────────┬───────────┘                              └──────────┬───────────┘
           │                                                     │
     Inst. Level 60                                         Starts at Lv 1
     2.0x Yield Multiplier                                  1.0x-1.5x Multiplier
     50% Breed Discount                                     Full Breed Fee (5k $DESK)
     Genesis Staking Pool                                   Standard Staking Pools
           │                                                     │
           └──────────────────────────┬──────────────────────────┘
                                      ▼
                      ┌───────────────────────────────┐
                      │    PET INFLATION CONTROL      │
                      ├───────────────────────────────┤
                      │ • Level-60 Mint Fee (1k $DESK)│
                      │ • 5,000 $DESK Breed Burn      │
                      │ • Pet Retirement (Burn)       │
                      └───────────────────────────────┘
```

### A. Making Genesis Pets Premium

1. **Passive Yield & Multipliers:**
   * **Genesis Pets:** Instantly minted at Level 60 with a locked, permanent **2.0x** yield/XP multiplier.
   * **Standard Pets:** Retain their egg-rolled rarity multiplier (Common = 1.0x, Rare = 1.25x, Epic = 1.5x, Legendary = 2.0x). A player has to roll a 3% Legendary chance *and* grind to level 60 to match a Genesis pet's baseline multiplier.
2. **Exclusionary Staking Pools (High-Yield):**
   * Introduce "Treasury Expeditions" accessible *only* to Genesis pets. These expeditions yield rare gear chests (Epic/Legendary) and high-rate `$DESK` allocations that standard pets cannot farm.
3. **Breeding Privilege:**
   * Genesis parents enjoy a **50% discount** on the Breeding Tax (2,500 `$DESK` instead of 5,000 `$DESK`) and a reduced cooldown (3 days instead of 7 days).
4. **Platform Fee Revenue Sharing:**
   * Distribute 20% of all marketplace transaction fees (secondary royalties) to a staking pool exclusive to Genesis Pet holders.

### B. Standard Pet Inflation Sinks

To balance the unlimited minting of Level-60 pets, the following sinks will actively destroy pet supply:

* **Level-60 Minting Barrier:** Minting a free pet onto the blockchain costs 1,000 `$DESK` ($\approx$ $30.00 USD). This prevents players from botting/farming Level-60 pets and flooding the market, as they must pay a significant capital cost to convert game progress to an NFT.
* **Pet Retirement (The De-rezzing Sink):** Introduce a mechanic where players can permanently "burn" their Level-60 pets in exchange for high-tier item chests (gear/mutagens). This gives high-level pets a floor price based on the value of the random gear upgrades they yield.
* **The Breeding Burn:** Every breeding event burns 5,000 `$DESK`, shrinking the circulating token supply and raising the baseline cost of new generation pets.

---

## 📊 3. 3-Year Operational Cost Projection (2-Person Team)

To ensure long-term stability, we project a 3-year runway covering salaries, infrastructure, listing/audit fees, and marketing.

| Category | Description | Year 1 | Year 2 | Year 3 | 3-Year Total |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Human Costs** | 1 Dev ($6k/mo), 1 Ops/Mktg ($4.5k/mo) | $126,000 | $126,000 | $126,000 | **$378,000** |
| **Infrastructure** | RPC Node, Server, Supabase, Privy, CDNs | $5,280 | $5,500 | $6,000 | **$16,780** |
| **Marketing / UA** | KOLs, X/Brave ads, community rewards | $50,000 | $50,000 | $50,000 | **$150,000** |
| **One-Time Fees** | Legal, smart contract audits, DEX seeding | $60,000 | $0 | $0 | **$60,000** |
| **Total Expenses**| **Annual Cash Flow Requirement** | **$241,280** | **$181,500** | **$182,000** | **$604,780** |

---

## 💰 4. 3-Year Revenue Projections (Sustainability Check)

To evaluate whether the $3M FDV model sustains the $604,780 operating budget, we model three tiers of revenue:

### A. Core Revenue Drivers

1. **Genesis Pet Sales (5,000 Capped Supply):**
   * Total Pool Value = 5,000 pets $\times$ 5,000 `$DESK` = 25,000,000 `$DESK` ($\approx$ $750,000 USD).
   * **Projected Sales Timeline:**
     * **Year 1:** Sell 2,000 Genesis pets $\rightarrow$ **$300,000 USD**
     * **Year 2:** Sell 1,500 Genesis pets $\rightarrow$ **$225,000 USD**
     * **Year 3:** Sell 1,500 Genesis pets $\rightarrow$ **$225,000 USD**
2. **Mystery Egg Sales:**
   * Average of 150 eggs sold per month across the network (1,800/year @ $15 USD each).
   * **3-Year Revenue:** 5,400 eggs $\times$ $15 = $81,000 USD.
3. **Marketplace Royalties:**
   * Enforce a 5% royalty on all secondary trades of pets & gear.
   * Projected trade volumes: Year 1 = $1M, Year 2 = $3M, Year 3 = $5M (Total = $9M).
   * **3-Year Royalty Revenue (Team Share 50%):** $9,000,000 $\times$ 5% $\times$ 50% = **$225,000 USD** (other 50% goes to Genesis staking incentives).
4. **The Focus Pass (Battle Pass Subscriptions):**
   * Premium subscription priced at $5/month. Assuming a modest average of 1,500 active subscribers:
   * **3-Year Revenue:** 1,500 subs $\times$ $5 $\times$ 36 months = **$270,000 USD**.

### B. Financial Summary

```
3-Year Projected Revenue:
  • Token Launch Pool Allocation (10% Sale):   $300,000 USD
  • Genesis Pet Sales (5,000 total):           $750,000 USD
  • Mystery Egg Sales:                         $81,000 USD
  • Secondary Marketplace Royalties:           $225,000 USD
  • Focus Pass Subscriptions:                  $270,000 USD
──────────────────────────────────────────────────────────
TOTAL REVENUE:                              $1,626,000 USD
TOTAL EXPENSES:                             $604,780 USD
──────────────────────────────────────────────────────────
NET SURPLUS / CAPITAL RESERVE:              $1,021,220 USD
```

### 📢 Conclusion on Feasibility
The economic model is **highly viable**. Even if we only achieve **40% of our sales goals**, the revenue generated ($650,400) still covers our 3-year operational cost ($604,780). This provides a massive buffer to fund user acquisition, sustain developer overhead, and ensure long-term ecosystem health.
