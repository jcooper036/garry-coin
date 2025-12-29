# GarryRoyale Design Document

## Core Concept

**GarryRoyale** is a collectible GCM battler with Battle Royale elements, built as a Discord Activity. Players collect, breed, and battle GCMs called GarryCoinMonsters (GCMs) using GarryCoins in single-player campaigns, asynchronous gym battles, and multiplayer Battle Royale sessions.

**Key Philosophy:** Pay-to-win is embraced. Players with jobs can spend GC to get ahead rather than grinding. More GC = more chances at success.

**General Note** For development, we refer to the creatures as GCMs. However, that is the least fun way to do so in the actual game. The following names (and more) are all acceptable and should be used in different situations: Garrymons, Garrians, Garrygons, Garryfolk, Garrites, Gearbears, Coinlings, Garrybeasts

---

## GCM Mechanics

### Base Stats

Every GCM has 7 core stats, randomly assigned at "birth" (range: 1-15):

- **Attack**: Physical damage output
- **Defense**: Physical damage reduction
- **Sp. Attack**: Special ability damage output
- **Sp. Defense**: Special ability damage reduction
- **Speed**: Turn order, dodge chance, cooldown reduction
- **HP**: Health points (damage capacity)
- **Grit**: Base willingness to fight vs flee when taking damage

### Leveling System

- **10 levels maximum** (Level 1-10)
- Each level up: **All stats increase by +1**
- Simple, predictable growth curve

### Combat Abilities

Each GCM has exactly 3 abilities:

1. **Fast Attack**: Low cooldown (2-3s), low damage, auto-fires
2. **Charge Attack**: High cooldown (8-12s), high damage/utility, auto-fires
3. **Passive Ability**: Always active (e.g., stat buffs, regen, reflect damage, evasion)

### GCM Memory & PTSD System

**GCMs remember their battle experiences and develop psychological patterns.**

#### Memory Events Tracked:
- GCMs that KO'd them (species + type)
- GCMs they KO'd
- Close victories (won with <20% HP)
- Narrow defeats (lost with opponent <20% HP)
- Consecutive wins/losses
- Battles fled from
- Allies that fought alongside them (multiplayer)

#### Grit Modifiers Based on Memory:

Grit modifiers are checked at the end of a battle. Each has an activation condition, an effect, and an end condition. Either condition might come with a chance (if it doesn't have one , then it happens whenever the condition is met). In general, they should be related to battle history, and they should impact behavior in future battles. This is usually via modifying Grit, but some might also modify other stats.

**Examples of modifiers
- **Winning streak** 
    - activation: win 3 times in a row (win means flee, KO, or kill)
    - effect: +1 grit per win (starting with the 3rd)
    - ends: when loses
- **Losing streak**, basically the opposite of winning streak
- **Bloodlust**
    - activation: kill two opponents in a row
    - effect: +1 grit, +1 attack, +1 special attack per kill streak when opponent gets below 50% HP
    - ends: when 3+ matches have ended without that GCM getting a kill
- **<type> trauma**
    - activates: (25% chance) when GCM flees or KOed
    - effect: -1 grit when facing GCMs of that type
    - ends: when defeats a GCM of that type
- **gentle**
    - activates: (10%) when KOs an opponent
    - effect: if attack would bring opponent to 0 or less, brings them to 1 instead (unless they are at 1, then it kills them)
    - ends: (25%) on any defeat
- **<type> phobia**
    - activates: flees 3 times from a specific type without having a victory aginst that type, or having been KOed by that type
    - effect: -10 grit when facing that type
    - ends: not fleeing from that type (KO defeat or victory)
- **Seeking Revenge**
    - activates (25%): when KOed
    - effect: when fighting a GCM of the same kind (not just type), +4 grit, and +1 to all stats when fighting a GCM of that type
    - ends: when KOs or kills a GCM of that type. 
- **Seeking Redemption**
    - activates (25%): when flees
    - effect: when fighting a GCM of the same kind (not just type), +4 grit
    - ends: when doesn't flee from fighting GCM of that kind
- **<Kind> Expert**
    - activates: when has defeated 5 GCMs of a specific kind
    - effect: +1 to all stats when fighting GCMs of that kind
    - ends: never
- **<Type> Expert**
    - activates: when has defeated 10 GCMs of a specifc type
    - effect: +1 to all stats when fighting GCMs of that type
    - ends: never

#### Grit Behavior:

- once below 60% HP, then apply the following
- fight_chance = (current hp / max hp) + (grit * 0.4 / 15)\
- grit check: if random(0, 1) > fight_chance: flees
- effectively, this means that at 60% health a GCM with 1 grit has a 60% chance to keep fighting, but a GCM with 15 grit has a 100% chance to keep fighting. Near zero, even a GCM with 15 grit will still only have a 40% chance to keep fighting. This is important because of the perma-dealth mechanic (and consider that GCMs will likely go from ~10% health to dead in one large attack)

**Special mechanic - Last Stand:**
- GCMs with grit 11+ who drop below 20% HP get +25% attack boost (going out in glory)

---

## Battle Mechanics
- GCMs can only battle GCMs of the same level +- 1 level (so a battle might be for levels 2-4, and both teams would have to consist of all GCMs level 2-4)
- experince is always applied after any GCM is defeated (so can level up mid battle)

### Battle Arrangment
- all battles are a team of 6 vs a team of 6
- the battle is 3 spaces on either side

### Turn-Based Auto-Combat
- GCMs auto-attack based on speed stat (higher speed = more turns)
- Fast attacks fire every 1-3 seconds, modified by speed stats
    - fast attacks generate energy, which are used for charge attacks
- Charge attacks fire when enough energy has accumulated
- attacks go to the space straight across, and if there is no target, then they go to the adjacent space with the lowest health
- when a GCM goes down, it is replaced by the next one in the queue

### Flee Mechanics

- When HP threshold reached (based on grit), check for flee
- If flee, flee success rate: `(Speed / Opponent Speed) * 100`%
- Failed flee = take damage and stuck for 5 more seconds
- Successful flee = lose battle but GCM survives

### KO mechanics
- below 30% HP GCMs roll a stability check each time they are hit
- if they fail, they are KOed (as long as they would survive)

### Permadeath
- **0 HP = permanent death**
- GCM is removed from inventory
- Battle history preserved in graveyard
- Can be cloned for 10x their "value" (see Revival section)

---

## Game Modes

- the battle is over when all a trainer's GCMs have fled, fainted, or died

### Single Player training
- players may pit their own GCMs against each other for training. However, there are no modifications to the permadeath rules when doing this.

### Single Player: AI Trainer Campaign

**50 unique AI trainers** with personalities and memory systems.

#### Trainer Battles:
- when a player goes to battle a traininer, they pick a level of GCM they want to battle
- then they are given 3 random trainers to pick from
- each AI trainer can only battle once per day per level
- they are given a random team (maybe with some modifiers) of GCMs at that level


#### Trainer Personalities:

1. **The Coward**: All low-grit GCMs, plays defensively, flees often
2. **The Berserker**: All high-grit, all-in aggression
3. **The Strategist**: Adapts mid-battle, uses items tactically
4. **The Gambler**: Random team every time, unpredictable

#### Featured Trainers:

- **Garrett the Photographer** (Gym Leader): Door-type GCMs, "Flash" ability to blind
- **The Balrog Tamer** (LOTR): Fire GCMs, "You Shall Not Pass" ability
- **The Watch Collector**: Time manipulation abilities (speed buffs, cooldown resets)
- **PUBG Champion**: Survival-focused team, zone control mechanics
- **The Federal Reserve Governor**: Buys victories with infinite GC (corrupted/joke fight)

#### Trainer Memory System:

- Remembers your last 3 team compositions
- Counter-picks based on your patterns
- Dialogue changes based on history:
  - *"Back with that Door Mimic again? I'm ready this time."*
  - *"I see you've replaced your fallen warrior. Smart."*

---

### Multiplayer Async: Territory control system

We want to paint the picture of the garrymon world being run and controlled by gangs. Might makes right in this world, the group with the strongest mons wins. There is NEVER to be an alliacnce system amongst players - they may agree to not attack each other outside of the game, but that is purely a social aspect.

Territory control nets several benifits in income GC and items. There are 3 levels of territories - districts, cities, and regions. In general, there are bonuses for controlling adjactent entities. Coin income is usually increased by some multiplier, and items might only be available when controlling adjacent territories. For example, controlling 3 adjacent districts might net one unit of meth per day, whereas controlling each individually nets no items. Better items require controlling larger and larget adjacent territories. 

Control of the territories are represented by fields at a district level, gyms at at the city level, and stadiums at the regional level. For every adjactent defending structure, the GCMs defending that structure get +1 to every stat except grit. (so a territory with five other adjacent controlled territories would net +5 to every stat except grit for the mons controlling that territory). This is intended to do a few things:
- any player can challenge any territory, but because your GCMs only get xp when battling a GCMs of equal or greater level, you'd have to bring over-leveled GCMs to fight entrenced territories rather than working from the outside (and with permadeath on the line that seems dumb to do). This is especially true since a level 1 GCM is not totally helpless against a level 10 GCM
- because a district is not on the same level as a city, it does not count as an adjacent territory. Therefore, to defend a city, a player would naturally use one of their stronger teams, since it will be much harder to get the stat boosts
- likewise, as players are not likely to control multiple regions, they will have their very strongest team that they are willing to risk defending a region

Unlike standard battles, gyms can be staffed by more than 6 GCMs. In these battles, opponents need to defeat ALL GCMs to win (and the extras keep backfilling any KOed ones). They do not have a level, so the GCMs in the gym can be any level and can be challenged by GCMs of any level. It is the other incentives described above that prevent players from simplying bringing teams that will steamroll a lower level territory

#### Gym Tiers:

1. **Garrygon Training Field** (district)
   - 100k GC/day passive income
   - Holds 6 a team of 6 GCMs
   - usually 3 adjacent districts will produce 1 item per day

2. **City Gym** (city)
   - 1M GC/day passive income
   - Holds 12 defender GCMs
   - Special conditions that can be set by the controller to favor defending GCMs
   - controlling a city should give a steady supply of lower tier items, and one or two mid tier items

3. **Stadium** (Region)
   - 10M GC/day passive income
   - Holds 18 defender GCMs
   - Special conditions that can change throughout the battle
   - Holding gives several mid tier items and one high tier item

#### Gym Mechanics:

- permadeath is always in play for both sides of gym battles

**Claiming a gym:**
- Must defeat all defending GCMs with your team
- +1 to every stat except grit for each adjacent territory of the same level
- Cost to attempt: 5M GC (prevents spam)

**Defending:**
- Your GCMs defending gyms can't be used elsewhere
- Can add reinforcements remotely: 5M GC per GCM
- Players can use items on gym GCMs at any time

**Prestige system:**
- The longer you hold a gym, the more income it generates
- Day 1: Base income
- Day 2+: 1.5x income
- Day 4+: 2x income (caps here)

---

### 1v1 Player challenge
- Just like other trainer battles, you can challenge other players to a 1v1
- start by sending a challenge that includes a level range and a wager
- wager can be any combination of money, items, or GCMs

---

### Multiplayer Session: Battle Royale

**4-16 players compete in real-time GCM arena battles.**

#### Format:

- Each player brings **3 GCMs** plus 3 backups
- Entry fee: 10M GC per player
- Winner takes 80% of pot, 20% house cut
- Last team standing wins

#### BR Mechanics - Free-For-All Arena:

**How it works:**
- All GCMs spawn simultaneously in arena
- the players GCM team moves as a unit
- players choose which GCMs to apply the items total
- can only carry 4 items at a time
- the player commands the team where to move
- **Shrinking zone** damages GCMs outside safe area (zone shrinks every 30 seconds)

**Fighting**
- when within range of another team of GCMs can chose to fight
- not consensual, if one side intiates the fight it happens
- goes to the typical battle screen
- while fighting, the team has immunity from other effects in the arena and from being in other fights
- the fight is only between the 3 GCMs in the party (the backups are only accessed via items)

**Supply Drops:**
- Appear randomly every 45 seconds
- Contain: Healing items, TMs, stat boosts (temporary large ones or permenet small ones), shields, swaping with backups
- Players must move GCMs to drops to collect
- players chose which GCMs to apply items to
- can only carry 4 items at a time
- permanent boosts get better and better as the round goes on

**Retreat stations**
- retreat stations randomly appear so that players can get their team out

**Hazard Zones:**
- **Lava zones**: 5% max HP damage per second
- **Ice zones**: -50% speed
- **Electric zones**: Random stuns (2 second duration)

**Spectator Betting:**
- Eliminated players can bet on remaining players
- Other server members can watch and bet
- Betting pool separate from main prize pool

#### Victory Conditions:

- Last player with GCMs alive wins
- If time limit (10 minutes) reached: Player with most combined HP wins

---

## Economy & Monetization

### GC Costs:

| Action | Cost |
|--------|------|
| Gacha pack (1 GCM) | 10M GC |
| Gacha pack (5 GCMs) | 45M GC |
| Gacha pack (10 GCMs) | 80M GC |
| Type-specific pack (1 GCM) | 15M GC |
| Breeding (Common × Common) | 50M GC |
| Breeding (Rare × Rare) | 200M GC |
| Breeding (Legendary × Legendary) | 1B GC |
| Speed up breeding (instant hatch) | 100M GC |
| BR entry fee | 100M GC |
| Gym claim attempt | 5M GC |
| Gym reinforcement | 5M GC per GCM |
| Instant heal (full HP) | 1M per 10% missing HP |
| TM item (common) | 10M GC |
| TM item (rare) | 100M GC |
| TM item (legendary) | 500M GC |
| Clone dead GCM | 10x GCM value |

### GC Income:

| Source | Amount |
|--------|--------|
| AI trainer victory (early) | 1M - 5M GC |
| AI trainer victory (mid) | 5M - 20M GC |
| AI trainer victory (elite) | 20M - 50M GC |
| AI trainer victory (boss) | 50M - 200M GC |
| Gym passive income (daily) | 100k - 10M GC |
| Wild GCM capture (sell) | 5M - 100M GC |
| BR tournament (winner) | 80% of pot (640M+ for 8 players) |
| BR tournament (2nd place) | Participation trophy: 50M GC |
| Betting payouts | Variable |
| Selling GCMs to other players | Market price |

### GCM Value Calculation:

Used for cloning dead GCMs:

```
Base Value = Rarity multiplier × (Sum of base stats)
- Common: 1M per stat point
- Rare: 5M per stat point
- Legendary: 20M per stat point

Example:
- Legendary GCM with total stats of 90 (6 stats × 15 avg)
- Value = 20M × 90 = 1.8B GC
- Clone cost = 10x = 18B GC
```

---

## GCM Acquisition Systems

### Gacha Packs

**Pack types:**
1. **All-Type Packs**: Random GCM from any faction
2. **Faction-Specific Packs**: Guaranteed GCM from chosen faction (The Fellowship, The Watchers, The Doors, The Royales, The Mythics)

**Pack sizes & pricing:**
- 1 GCM: 10M GC (15M for type-specific)
- 5 GCMs: 45M GC (65M for type-specific)
- 10 GCMs: 80M GC (120M for type-specific)

**Pack opening mechanics:**
- All stats completely random (1-15 for each stat)
- Rarity determined by roll:
  - Common: 70% chance (avg stats 5-8)
  - Rare: 25% chance (avg stats 8-11)
  - Legendary: 5% chance (avg stats 11-14)
- Passive ability randomly assigned from faction pool
- Fast/charge attacks randomly assigned from faction pool

**Future mechanic:** Victory Coins (separate currency) can buff stats when opening packs

### Breeding System

**Genetics:**
- Each stat inherited from parents:
  - 50% chance from parent A
  - 50% chance from parent B
- **Mutation chance** (5%): Inherited stat ±2 (min 1, max 15)
- Passive ability: 50/50 from parents OR 2% chance for random new ability
- Moves: Inherits random fast + charge from either parent's moveset

**Breeding costs:**
- Base cost: 50M GC (Common × Common)
- Rare × Rare: 200M GC
- Legendary × Legendary: 1B GC
- Mixed rarities: Average of the two costs

**Breeding time:**
- 24 hours for egg to hatch (real-time)
- Speed up (instant): 100M GC

**Strategy:**
- Selective breeding to min-max stats
- Chase perfect 15/15/15/15/15/15/15 GCMs (astronomically rare)
- Breed for specific move combinations
- Build high-grit lineages

### Wild Encounters

**Daily free GCM:**
- Once per day, player gets a wild encounter
- Battle a random wild GCM (levels 1-5)
- Win = automatically capture it
- Loss = no capture, can try again next day
- Wild GCMs always have random stats (2-12 range)

**Strategy:**
- Free daily GCM for F2P players
- Can be used as breeding fodder
- Can be sold for 5M - 100M GC depending on stats

### GCM Trading

**Player-to-player marketplace:**
- List GCMs for sale (set your own GC price)
- Browse market for specific GCMs/stats/types
- 5% house cut on all trades
- GCM's memory/PTSD transfers with it (buyer beware!)

### Rescue Center

**Adopt abandoned GCMs:**
- When players release GCMs, they go to rescue center
- Available for adoption at 50% market value
- Random selection refreshes daily
- Good for budget players or finding unique PTSD histories

---

## Permadeath & Revival

### Permadeath Rules

- **0 HP = permanent death**
- GCM removed from inventory immediately
- All memories and battle history preserved
- Death recorded in personal graveyard

### Graveyard System

**Hall of Legends:**
- Visit your fallen GCMs
- View full battle history:
  - Total battles fought
  - Win/loss record
  - GCMs defeated
  - Cause of death
  - PTSD conditions at time of death
- Memorial message (player can write epitaph)

### Clone System

**Revive fallen GCMs:**
- Cost: **10x GCM value** (see economy section)
- Creates NEW GCM with identical base stats
- **Memory/PTSD does NOT transfer** (fresh start)
- Same passive ability and moves
- Resets to Level 1

**Example:**
- Legendary GCM worth 1.8B dies
- Clone cost: 18B GC
- Expensive but allows you to rebuild perfect stat GCMs

**No insurance system** - permadeath risk is real

---

## Technical Specifications

### Player Limits

- **Maximum 128 GCMs per player**
- Enough for pack opening and breeding
- Forces strategic choices about which GCMs to keep
- Can release GCMs to free space (go to Rescue Center)

### Health Regeneration

**Exponential decay (daily healing):**

GCMs heal automatically each day (real-time):
- Day 1: Heal 50% of missing HP
- Day 2: Heal 50% of remaining missing HP (75% total recovered)
- Day 3: 87.5% total
- Day 7: ~99% recovered

**Alternative:** Pay for instant heal:
- 1M GC per 10% missing HP
- Full heal a damaged GCM: 10M GC max

### GCM Types

5 types of GCMs to start. There is no type chart, only that certain abilities and moves live squarly within certain types

1. **Fellowship** (LOTR-themed / friend group themed)
   - Tank/support focused
   - High defense stats
   - Abilities: shields, healing, buffs

2. **Watch** (Garrett's watches)
   - Time manipulation
   - Speed and evasion focused
   - Abilities: haste, slow, cooldown manipulation

3. **Door** (Garrett's door photography)
   - Defensive walls
   - Area denial and control
   - Abilities: barriers, traps, lockdown

4. **Hardo** (Gaming/Battle Royale)
   - Asthetic is all the hardo kids with no life that play multiplayer games now, so items and themes from those games (PUBG, Apex, The Finals, League)
   - Aggressive damage dealers
   - High attack stats
   - Abilities: burst damage, executes, zone control

5. **Expat** (Themed around being an American Expat living Europe)
   - Balanced generalists
   - Weird/unique mechanics
   - Abilities: random effects, transformations, rule-breaking

---

## Move System (TMs)

### Move slots:

Each GCM has:
- 1 Fast Attack
- 1 Charge Attack
- 1 Passive (cannot be changed - innate to GCM)

### TM Items:

**TMs teach GCMs new moves** (replaces old move):

- TM items are consumable
- Can be found in:
  - BR supply drops
  - Trainer battle rewards (rare)
  - Purchased with GC (10M - 500M)

**Move rarity tiers:**
- Common moves: Basic damage, simple effects
- Rare moves: Unique utility, combos
- Legendary moves: Game-changing abilities

**Strategy:**
- Customize GCMs for specific matchups
- Replace inherited moves with better options
- Counter meta strategies

---

## MVP Development Phases

### Phase 1 - Core Battle & Collection Loop

**Goal:** Prove the core loop is engaging: collect → battle → level → collect

**Core Systems:**
- **Battle Engine:**
  - 6v6 turn-based auto-combat with 3-space grid
  - Speed-based turn order, energy generation for charge attacks
  - Flee mechanics with grit checks
  - KO stability checks below 30% HP
  - Permadeath at 0 HP
  - Level restrictions (±1 level matching)
  - XP and leveling (1-10 levels, +1 all stats per level)

- **GCM Collection (30 GCMs across 3 types):**
  - 3 starting types: Fellowship, Watch, Door (10 GCMs each)
  - 7 random stats (1-15 range): Attack, Defense, Sp.Atk, Sp.Def, Speed, HP, Grit
  - 3 abilities per GCM: Fast attack, Charge attack, Passive
  - 3 rarity tiers: Common (70%), Rare (25%), Legendary (5%)

- **Acquisition:**
  - Gacha packs (1/5/10 sizes, all-type and faction-specific)
  - Daily wild encounter (free GCM)
  - Starting GCM selection (choose 1 of 3)

- **AI Trainer Campaign (10 trainers):**
  - Player picks level range, gets 3 random trainer choices
  - Each trainer battleable once per day per level
  - Basic trainer memory (remembers last team composition)
  - Personality types: Coward, Berserker, Strategist, Gambler
  - GC rewards: 1M - 20M depending on difficulty

- **Basic Memory System:**
  - Track wins/losses, KOs dealt/received
  - **Winning Streak:** +1 grit after 3+ wins
  - **Losing Streak:** -1 grit after 3+ losses
  - **Type Trauma:** -1 grit vs type that KO'd you (25% activation)

- **Graveyard & Revival:**
  - Hall of Legends (view dead GCMs' battle history)
  - Clone system (10x GCM value to revive with fresh memory)

- **Health System:**
  - Exponential decay regen (50% missing HP per day)
  - Instant heal option (1M GC per 10% HP)

**Success Metrics:** Players spend 30+ minutes per session, return daily for wild encounters, 50%+ purchase gacha packs

---

### Phase 2 - Breeding, Trading & Player Competition

**Goal:** Add depth through genetics, player economy, and competitive PvP

**New Systems:**
- **Breeding:**
  - Stat inheritance (50/50 from each parent)
  - Mutation system (5% chance, ±2 to inherited stat)
  - Breeding costs scale with rarity (50M - 1B GC)
  - 24-hour hatch time (instant for 100M GC)
  - Ability/move inheritance from parents

- **Trading Marketplace:**
  - Player-to-player GCM sales (custom pricing)
  - 5% house cut on trades
  - Search/filter by stats, type, abilities
  - Memory/PTSD transfers with GCM (buyer beware!)

- **1v1 Player Challenges:**
  - Challenge with level range and wager
  - Wager GC, items, or GCMs
  - Same battle rules as AI trainers

- **Self-Training Mode:**
  - Battle your own GCMs against each other
  - Same permadeath rules apply (risky practice)

- **Rescue Center:**
  - Released GCMs available for adoption (50% market value)
  - Daily refresh of available GCMs
  - Unique PTSD histories

- **Expanded AI Campaign (25 more trainers = 35 total):**
  - Mid-tier trainers with better rewards (5M - 50M GC)
  - More sophisticated memory (remembers last 3 teams)
  - Dialogue adapts to battle history

- **Advanced Memory/PTSD:**
  - **Bloodlust:** Kill streaks grant +1 grit/attack/sp.atk
  - **Phobia:** -10 grit after fleeing same type 3+ times
  - **Seeking Revenge:** +4 grit, +1 all stats vs GCM kind that KO'd you (25% activation)
  - **Gentle:** Leaves opponents at 1 HP instead of killing (10% activation)
  - **Kind/Type Expert:** Permanent +1 all stats after 5/10 victories

**Success Metrics:** 20%+ of GCMs from breeding, active marketplace with daily trades, players battling each other regularly

---

### Phase 3 - Territory Control & Gang Warfare

**Goal:** Create persistent territorial competition with high-stakes rewards

**Major Systems:**
- **Territory Control Map:**
  - 3 tiers: Districts (Fields), Cities (Gyms), Regions (Stadiums)
  - Defender stat bonuses: +1 all stats (except grit) per adjacent controlled territory
  - No level restrictions on gym battles
  - Gyms hold 6/12/18 GCMs (field/gym/stadium)
  - Permadeath applies to attackers AND defenders

- **Adjacency Economy:**
  - Districts: 100k GC/day, 3 adjacent = 1 item/day
  - Cities: 1M GC/day, steady low-tier items + 1-2 mid-tier
  - Regions: 10M GC/day, multiple mid-tier + 1 high-tier item
  - Prestige multipliers: Day 1 (1x), Day 2+ (1.5x), Day 4+ (2x)

- **Items System:**
  - Low-tier: Basic healing, minor stat boosts
  - Mid-tier: TMs, temporary large stat boosts, shields
  - High-tier: Legendary TMs, permanent stat boosts, rare abilities
  - Items only available through territory control

- **Gym Mechanics:**
  - 5M GC to attempt takeover (prevents spam)
  - Defeat ALL defending GCMs to claim
  - Remote reinforcement (5M GC per GCM)
  - Players can use items on gym GCMs anytime
  - Special conditions for Cities (controller sets) and Regions (dynamic changes)

- **TM System (40+ moves):**
  - Consumable items that replace fast or charge attacks
  - Common/Rare/Legendary tiers (10M/100M/500M GC to purchase)
  - Found in territory rewards, BR drops, trainer battles
  - Allows GCM customization for specific matchups

- **Elite AI Trainers (15 more = 50 total):**
  - Boss-tier trainers with perfect stat distributions
  - Elite Four + hidden super bosses
  - 20M - 200M GC rewards
  - Require specific strategies to defeat

**Success Metrics:** Territories changing hands weekly, item economy driving territorial competition, 80%+ of active players holding at least one territory

---

### Phase 4 - Battle Royale & Competitive Endgame

**Goal:** High-stakes competitive multiplayer and seasonal content

**Major Features:**
- **Battle Royale (4-16 players):**
  - Each player: 3 active GCMs + 3 backups
  - Entry fee: 10M GC (winner takes 80% pot)
  - Team movement as a unit
  - 4-item carry limit
  - Non-consensual combat (either side initiates)
  - Fighting grants immunity from arena effects
  - Shrinking zone (30s intervals)
  - Supply drops (45s intervals): healing, TMs, stat boosts, backup swaps
  - Retreat stations (random spawns to extract)
  - Hazard zones: Lava (-5% HP/s), Ice (-50% speed), Electric (random stuns)
  - Permanent stat boosts scale as match progresses
  - Spectator betting system

- **Leaderboards:**
  - Richest players (total GC)
  - Strongest GCMs (stat totals)
  - Most territories controlled
  - Most kills (PvP and BR)
  - Longest win streaks
  - Perfect breeding achievements (15/15/15...)

- **Seasonal Events:**
  - Limited-time GCMs with unique abilities
  - Exclusive TMs available for short windows
  - Seasonal tournaments with massive prize pools
  - Themed territory bonuses (LOTR month, Gaming month, etc.)

- **Tournament Mode:**
  - Bracket-style competitions
  - Entry fees, prize pools
  - Ranked matchmaking system
  - Seasonal rankings with rewards

- **Advanced Breeding:**
  - Lineage tracking (family trees)
  - Pedigree system (show breeding history)
  - Genetic quality scores
  - Breeding achievements and titles

**Success Metrics:** BR sessions run daily with 8+ players, competitive meta develops, seasonal content drives engagement spikes

---

### Phase 5 - Expansion & Polish

**Long-term additions:**
- **New Types (2 more = 5 total + 2 = 7):**
  - Hardo (gaming/battle royale themed)
  - Expat (American expat in Europe themed)
  - Expand existing types with 10+ GCMs each

- **Advanced Features:**
  - GCM fusion (sacrifice 2 → create 1 stronger hybrid)
  - Victory Coins (separate currency for buffing pack openings)
  - Reputation system with AI trainers (unlock special dialogue/rewards)
  - GCM cosmetics (hats, accessories, skins)
  - Battle replays (review past fights)
  - AI improvements (adaptive difficulty, smarter tactics)

- **Platform Expansion:**
  - Mobile companion app
    - Check/reinforce territories
    - Breed GCMs
    - Open packs
    - View graveyard
    - Marketplace browsing
  - Push notifications for territory attacks
  - Offline breeding/healing progress

- **Quality of Life:**
  - Quick battle option (skip animations)
  - GCM presets (save team compositions)
  - Bulk pack opening
  - Advanced marketplace filters
  - Statistics dashboard (personal analytics)

**Success Metrics:** Year 1 player retention >30%, monthly revenue from GC purchases sustains development, active competitive community

---

## Design Principles

1. **Pay-to-win is embraced** - Players with GC get more chances, faster progression
2. **Permadeath creates stakes** - Every battle matters, GCM attachment
3. **Memory creates personality** - PTSD and victory streaks make GCMs feel alive
4. **Simple mechanics, deep strategy** - Easy to learn, hard to master
5. **Respect player time** - Can pay to skip grinding, busy adults can compete
6. **Social & competitive** - Trading, gyms, BR all encourage interaction
7. **Long-term goals** - Perfect breeding, gym empires, trainer completion

---

## Open Questions / Future Decisions

- Exact faction GCM lists (names, themes, abilities)
- Specific PTSD modifier values (need playtesting)
- Gym map layout (how many, where, themes)
- BR arena visual design
- Exact AI trainer difficulty curve
- Trading marketplace UI/UX
- Seasonal event cadence
- Balance patches frequency

---

**End of Design Document**

*Last updated: 2025-12-28*
