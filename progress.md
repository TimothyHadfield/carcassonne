# Carcassonne — progress

## START HERE
Last updated: 2026-10-19. Read this file, then `CLAUDE.md`, then `docs/rules-check.md` and `docs/ideas.md`. Live: https://timothyhadfield.github.io/carcassonne/

## Goal right now
Built and live. Base game + River + Inns & Cathedrals, vs 1–5 computers, online rooms, and a real-table companion. Waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Engine (base 72 tiles, farms both editions, variants) | done, tested |
| River (12 tiles, first edition) | done, tested |
| Inns & Cathedrals (18 tiles, big meeple, 6th player) | done, tested |
| Computers Easy / Med / Hard, strength table under "How strong?" | done, measured (1000-game sims) |
| Placement hints (expected points on each lit square), study mode | done |
| Companion: Tiles tab (tiles left, odds a hole gets filled before the bag runs out), Scores tab (score tracker incl. farms) | done |
| Online rooms (shared `js/online.js`, Firebase `th-board-games`) | done, two-browser game verified |
| Traders & Builders | parked (see Rejected / parked) |

## Authorized next steps
- (none beyond fixing bugs Tim or QA finds)

## Standing instructions (Tim's words)
- "do ... carcasson."
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors... Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."

## Traps
- `js/online.js` is a copy of the shared `_online/online.js`; edit the shared one, then recopy.
- `js/net.js` is an ES module that hands `createOnline` to the plain-script app via `self.CarcNet` and a `carcnet` event.
- Online: after sending a move the UI blocks until `st.moves` changes (`sentAt`), or a fast second tap sends a double move.
- The online public view sorts the bag so order stays secret; `privateView` is empty (nothing else is hidden).
- Results sheet appears about 2 s after the last tile in WebKit; screenshot scripts must wait.
- River tiles that cannot be placed are set aside (about 1 in 60 computer games).
- Strength sims: `node tools/sim.js` (slow; 1000 games takes minutes).

## Decisions
- Default rules: current (3rd edition) farms, 2-tile city = 4, farmers on. Settings offer 1st-edition farms, old 2-tile city = 2, farmers off.
- River: spring first, 10 shuffled, lake last; base start tile shuffled into the main bag (rules allow either).
- I&C: first-edition 18 tiles, no garden.
- 6-player chips on phone use a compact layout (no names).
- Easy computer plays the best move with skill 0.6 (weaker on purpose).

## Measured strength (1000 games each)
Hard vs Med 81%, Hard vs Easy 98%, Med vs Easy 95%, Hard vs 3 Med 84%, Med vs 3 Easy 70%; first seat in Hard vs Hard wins 55.5%.

## NOT verified
- On Tim's real iPhone (only the WebKit iPhone emulation).
- Online with 3 or more real browsers (two-browser game verified).
- Online games with River or I&C turned on (engine tests cover the adapter with options; no live browser run).

## Rejected / parked
- ~~Traders & Builders~~ parked: needs goods tokens, the builder double turn and the pig; base + River + I&C first.
- ~~River 2~~ parked: less common than the first River.
