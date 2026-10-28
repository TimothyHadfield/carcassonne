# Rules check: Carcassonne

Every count, rule and score the site uses, with the sources it was checked against. Status: **OK** = matches two sources and has a test; **choice** = sources allow more than one reading, our pick is stated.

Sources:
- **[NW]** Northwestern University CS tile list for the base game (tile letters A–X with counts).
- **[WP]** Wikipedia, "Carcassonne (board game)" (72 tiles, editions, River = 12 tiles).
- **[BGA]** Board Game Arena Carcassonne help pages.
- **[JCZ]** JCloisterZone source, `src/extraResources/expansions/basic.xml`, `river.xml`, `inns_and_cathedrals.xml` (tile layouts and counts).
- **[HiG]** Hans im Glück / Rio Grande Inns & Cathedrals rules sheet.
- **[CAR]** "Carcassonne: The Complete Annotated Rules" v7.3 (River p.27–30, I&C section).

## Base game

| Item | Site | Sources | Status | Test |
|---|---|---|---|---|
| Tiles in the game | 72 incl. start tile | NW, WP, JCZ | OK | engine: 72 tiles |
| Tile mix A–X (24 types) | A2 B4 C1 D4 E5 F2 G1 H3 I2 J3 K3 L3 M2 N3 O2 P3 Q1 R3 S2 T1 U8 V9 W4 X1 (D includes the start tile) | NW, JCZ | OK | engine: per-type counts sum to 72 |
| Start tile | type D (city side + straight road), one of the 4 D's | NW, WP | OK | engine |
| Shields (pennants) | 10 tiles | NW, JCZ | OK | engine |
| Meeples | 7 per player | WP, BGA | OK | engine: conservation over random games |
| Players | 2–5 base (6 with I&C) | WP, HiG | OK | |
| Placement | every touching edge must match; must touch a placed tile | WP, BGA | OK | engine: legal moves |
| Unplaceable tile | removed from the game, draw again | BGA, CAR | OK | engine |
| One meeple per turn, only on the tile just placed, not on an occupied feature | WP, BGA | OK | engine |
| Finished road | 1 per tile | WP, BGA | OK | engine |
| Finished city | 2 per tile + 2 per shield | WP, BGA | OK | engine |
| Two-tile city | 4 (current) or old rule (setting): 1 per tile + 1 per shield, so 2 or 3 | CAR, BGA | choice: default 4 | engine both |
| Finished cloister | 9 (itself + 8 around) | WP, BGA | OK | engine |
| Majority | most meeples score; ties all score full | WP, BGA | OK | engine |
| Meeples come home when finished | WP, BGA | OK | engine |
| End: unfinished road 1/tile, city 1/tile + 1/shield, cloister 1 + 1 per neighbour | WP, BGA | OK | engine |
| Farms (3rd edition) | 3 per finished city touched, per farm | WP, BGA | OK | engine |
| Farms (1st edition, setting) | each finished city pays 4 to the side with most farmers across all its fields | CAR, WP | OK | engine |
| Farmers off (setting) | common house rule for beginners | CAR | choice | engine |
| Tile art | own SVG, not the published art | — | OK | |

## The River (first edition, 12 tiles)

| Item | Site | Sources | Status | Test |
|---|---|---|---|---|
| Tile count | 12: spring, lake, 10 river | WP, JCZ, CAR | OK | engine: 12 tiles |
| Mix | tile layouts and counts as in river.xml (2 of two types, 1 of the rest) | JCZ, CAR p.28 | OK | engine: mix |
| Setup | spring placed first, 10 shuffled, lake last | CAR p.27, JCZ | OK | engine: 20 games, river first, lake last |
| Start tile D | shuffled into the main stack | CAR p.27 ("can be mixed ... or placed after", treated like a normal tile) | choice | engine |
| No U-turn | two turns the same way in a row are not allowed | CAR p.28 | OK | engine |
| Followers | allowed on river tiles (roads, cities, fields, cloisters) but not on the water | CAR p.28 | OK | engine |
| Unplaceable river tile | set aside like any unplaceable tile (rare: about 1 in 60 computer games) | CAR, BGA | choice | |
| River 2 (2005, 12 different tiles) | not built | WP | skipped | |

## Inns & Cathedrals (18 tiles)

| Item | Site | Sources | Status | Test |
|---|---|---|---|---|
| Tile count | 18, incl. 6 inns and 2 cathedrals | HiG, JCZ, WP | OK | engine: 18 / 6 / 2 |
| Inn road | 2 per tile if finished, 0 at game end if not | HiG, CAR | OK | engine: 8 and 0 |
| Cathedral city | 3 per tile + 3 per shield if finished, 0 at game end if not | HiG, CAR | OK | engine: 15 and 0 |
| Large meeple | 1 per player, counts as 2 for majority, scores like one meeple, can be a farmer | HiG, CAR | OK | engine: beats one meeple, comes home |
| 6th player | grey pieces | HiG | OK | |
| Garden / later-edition extras | not in the first-edition set | JCZ | skipped | |

## Traders & Builders (24 tiles, 2026-10-28; Settings → Rules, off by default)

Sources: **[JCZ]** `traders_and_builders.xml` (tile layouts, counts, goods per city), **[WP]** Wikipedia expansion list, **[CAR]** annotated rules T&B section, **[BGA]** T&B help.

| Item | Site | Sources | Status | Test |
|---|---|---|---|---|
| Tiles | 24 (Ta–Tx, own art) | JCZ, WP | OK | tb: 24 tiles |
| Goods on city tiles | 20: 9 wine, 6 grain, 5 cloth | JCZ, CAR | OK | tb: goods counts |
| Who gets goods | the player who lays the tile that finishes the city, meeple or not | CAR, BGA | OK | tb |
| Goods at the end | most of each kind scores 10; a tie: all tied score 10 | CAR, BGA | OK | tb |
| Builder | instead of a meeple, on a road/city where you have a meeple; extending that feature gives a 2nd tile straight away, never a 3rd; comes home when the feature is finished | CAR, BGA | OK | tb: extra turn, no third, comes home |
| Pig | instead of a meeple, on a field where you have a farmer; that farm scores 4 per city (3rd ed.), 5 (1st ed. rule) | CAR, BGA | OK | tb: both editions |
| Bridge and hedges | drawn; road, city and field areas follow the JCZ tile layouts (the bridge carries the road over the field) | JCZ | OK | tb: random games conserve figures |
| Computers | Easy/Medium/Hard value goods, builder turns and the pig; ladder holds (200 games a pair: Hard–Med 72.8%, Med–Easy 93.0%) | — | OK | tb: computers use figures; `OPTS='{"tb":true}' node tools/ladder.js 200` |

## House rules (off by default)

| Item | Site | Sources | Status | Test |
|---|---|---|---|---|
| Farmers off | no meeples on fields | CAR | choice | engine |
| Hand of tiles (2 or 3) | everyone holds 2 or 3 tiles, plays one, draws one; tiles that fit nowhere are set aside and replaced; ends when every hand and the bag are empty; not with the River | BGG house-rule threads, CAR (variant note) | choice | tb: hand rule; ladder hand 2: Hard–Med 82.8%, Med–Easy 94.0% |

## Not built

- Other expansions (Princess & Dragon, Tower, etc.).
