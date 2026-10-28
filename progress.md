# Carcassonne — progress

## START HERE
Last updated: 2026-10-28 (wave 3: Traders & Builders, hand-of-tiles house rule, Learn videos in the rules sheet, 320 px Settings fix). Read this file, then `CLAUDE.md`, then `docs/rules-check.md` and `docs/ideas.md`. Live: https://timothyhadfield.github.io/carcassonne/

## Goal right now
Built and live. Base game + River + Inns & Cathedrals + Traders & Builders (+ hand-of-tiles house rule), vs 1–5 computers, online rooms, and a real-table companion. Waiting on Tim's feedback.

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
| Visual design pass (2026-10-20): walled cities with little houses, tile light/bevel, bigger meeples with shadows, quieter hint squares (best one solid), rotate animates, dock fixed height, 42 px zoom buttons, 6x4 tiles grid on laptop | done, before/after screenshots at 393 px + 1440 px |
| One zoom (2026-10-20): auto fit of every tile + empty spot, glides as the board grows; pinch/wheel/+ to zoom, Fit (lit when zoomed) or double-tap off a spot to go back | done, `tests/zoom.ui.mjs` 60/60 |
| Sound & effects (2026-10-20): shared `js/fx.js` + `js/sfx.js`; sounds for every move (yours, computers', online), win/lose celebration, big-city sparkle, score count-ups, meeples fly home; Settings "Sound & effects" section | done, `tests/fx.ui.mjs` 49/49 (26 fails + crash on old code) |
| Real-table look (2026-10-20): Play screen is a dark wooden table (shared `_table` kit); tiles have cardboard thickness + shadow; far side = score plates + each player's standing meeples + two face-down tile stacks (thickness = tiles left, one badge for both); your edge = your tile held up + your meeples; laptop: your edge under the map, side panel = score track board (0-49, meeples on it, 50/100 tokens) + bag + log; next tile is dealt off the stack and turns over; computers' tiles fly onto their square | done, before/after shots at 393, 320, 659x393, 1280 |
| Edge pass (2026-10-20): 50 weird situations tested (list in the table below); fixes for Back, New game by mistake, two tabs, online room start/close, no meeples, tiles set aside, 6 players at 320 px and laptop, results buttons; reviewer leftovers: meeples stand as a little crowd, phone score track (25 x 2 strip), wooden zoom tokens; `_table` kit 1.0.1 recopied | done, `tests/edge.ui.mjs` 121/121 (25 fails on old code) |
| Visibility pass (2026-10-21): meeples on the map at least ~12 px on a phone (own layer on top of the tiles, up to ~60% of a tile, about the real piece); a tap or Hint on a map with tiles under 40 px zooms in to that spot (64 px tiles), a tap on a taken square magnifies there, Place goes back to the whole map; zoom tokens get their own strip (column right or row on top, whichever leaves the map bigger), never over a tile; phone on its side: map takes the whole left under the track, plates + stack + your edge in the right column; laptop: map full height, your edge at the foot of the side panel | done, `tests/vis.ui.mjs` 40/40 WebKit + Chrome (18 fails on old code) |
| Improvement pass (2026-10-27): hint numbers off by default (`set.hv` one-time switch-off for old saves); Owners flag token tints claimed cities/roads/farms (`ownersLayer` + `CarcRender.ownMask/ownShape`); Undo vs the computer (single human, not Daily/guided/online); end-of-game Replay (◀ Play ▶ Done; `g.acts` + seed rebuild); `_profile` My stats/achievements/Daily (vs Hard, standard rules) via `js/carcprofile.js`; `_coach` rules sheet + guided first game (`js/tutorial.js`, seed 20261046); `_pwa` install + offline; every level puts down farmers, Medium/Hard pick among near-best moves; original art: meadows, stone walls with battlements, gravel roads; score flash + meeple hop | done, `tests/improve.ui.mjs` 35/35 (fails on old code), `tests/improve.test.js` 17/17 (old AI: 2 fail), `tools/pwa-check.mjs` 18/18 |
| Wave 3 (2026-10-28): Traders & Builders (24 own-art tiles, goods wine/grain/cloth, builder double turn, pig), off by default; house rule "Hand of tiles" (Off/2/3, not with the River); rules sheet gets T&B, House rules and 5 Learn videos (oEmbed-checked, new tab); computers play all of it; Settings fit at 320 px (was 33 px too wide); 3-4 players at 320 px show colour + score (name was one clipped letter); `fx.ui` taken-square flake fixed (tap zooms first on a tiny map) | done, `tests/tb.test.js` 55/55, `tests/tb.ui.mjs` 38/38 (old code: 5 fail + crash), all other suites green |

## Authorized next steps
- (none beyond fixing bugs Tim or QA finds)

## Standing instructions (Tim's words)
- "do ... carcasson."
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors... Make sure to get everything right like rules and artwork and specific numbers of cards, routes, details, etc."
- (2026-10-20, all zoomable boards) "some games have maps and whatnot you can zoom in and out of often. Make it so that there is only an auto zoom that automatically fits the whole board in sight and then you can zoom if you want with easily reseting back to auto mode."

- (2026-10-20, all games) "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."

- (2026-10-20, all games) "make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life ... It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."

- (2026-10-20, all games) "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."

- (2026-10-21, all games) "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."

## Weird scenarios (edge pass 2026-10-20; full list: 50 in the pass notes, test `tests/edge.ui.mjs`)
| Scenario | Old code | Now |
|---|---|---|
| No meeples left / no free feature: status said "Tap a circle" with none shown | fail | says "No meeples left. Place it?" / "No meeple spot here." |
| A drawn tile fits nowhere (set aside): no word, stack dropped by 2 | fail | "A tile fit nowhere: set aside." under the status |
| Back with results sheet or "?" bubble open: changed tab / left the site | fail | Back closes it first; closing by hand leaves no dead Back step |
| "New game" in Settings mid-game: game lost on one tap (online: left the room) | fail | first tap shows "Start over?", second starts |
| Two tabs of one game: each overwrote the other's moves | fail | the other tab follows; only the tab that moved last runs computers |
| Local computer move pending when an online room starts: sent to the room as yours, or crash (`L.flat`) | fail | cancelled |
| Online room closes mid-game: silently back to your game | fail | "The room closed. Back to your game." |
| Scores tab: 4+ meeples of one player on a city (tally wrapped to 0 after 3) | fail | counts to 7 |
| 6 players, 3-digit scores at 320/393 px: scores cut ("1!") | fail | coloured plate edge instead of the icon, scores fit |
| 6 players on laptop: side panel (track, bag, log) pushed off screen | fail | grid column can shrink |
| Results sheet with 6 players at 320 px / on its side: New game hidden below | fail | buttons stick to the sheet bottom, names one line |
| Ties, all-computer table, reload during computer turn, taps during computer turn, double Place, Animations off, tab switching mid-flight, storage blocked, 1920x1080, 640x400 (zoom 200%) | pass | pass |

## Sound map (event -> sound; `js/sfx.js` plan() + `app.js` moveFx/turnFx/finalFx)
| Event | Sound | Animation |
|---|---|---|
| Tap a square where the tile can't go (your turn) | `error` | - |
| Pick a square / Hint | `cardSlide` (pitch .6) | ghost tile (existing) |
| Rotate (button or tap the tile again) | `tileTurn` (custom) | quarter turn (existing) |
| Meeple circle on / big meeple / off | `meeple` (custom) / pitch .8 / `tap` | - |
| Tile placed (anyone; computers at vol .85) | `place` (wood knock) | drop-in (existing) |
| Placed with a meeple | `meeple` +110 ms | - |
| City / road / monastery finished | `coins` / `coin` / `bell` (custom), 300 ms + 250 ms each, in step with the +N floaters | +N floater, chip score counts up + pops |
| Meeples come home | `pop` (pitch .75) | meeple flies board -> owner's chip |
| Your city worth 20+ | (ding) | `celebrate big` sparkle at your chip |
| Next tile drawn | `tileDraw` (custom) | - |
| It becomes YOUR turn | `turn` chime, 500 ms after the last move | pulse of your tile |
| Game ends | `drumroll`; farm +N floaters; chips count to final | results: Farm + Total count up 0.9 s, then `celebrate win` (your colours) or `lose` |
| Tiles tab: tile tapped / sold-out tile | `tileDraw` / `error` + shake | - |
| Scores tab: Add | `coin` (<10) or `coins` | points count up |
| Other buttons | `tap` (fx auto clicks; not Rotate/Place/Hint/tiles grid) | - |

## Traps
- **Kits re-copied 2026-10-28 (w3-sweep, v15): game-coach 1.2.0 + game-pwa 1.4.0.** First-visit offer uses `place:'auto', avoid:['#btn-place']` and now sits at the top on phones (over the zoom buttons); the old `--coach-offer-bottom` override is gone. `tests/zoom.ui.mjs` marks the offer answered (`coach-offer:carc-first`) so it can click zoom. Measured clear of tab bar + Place at 393×659, 320×568, 659×393; pwa-check 18/18.
- **online.js cache stamp (2026-10-27):** every import of `js/online.js` uses `?v=a3d0418b`, the `_online` content stamp. After a re-copy: put the new stamp from `node ../_online/tools/stamp.mjs` there, bump the importing file's `?v=` (and pwa.js `data-version`), then `node ../_online/tools/stamp.mjs --check .` must say OK.
- `js/fx.js` is a byte copy of `Board and Card Games/_fx/fx.js`: never edit it here; game sounds go in `js/sfx.js` (`FX.define`). Its `:where(.fx-set) .switch/.seg/.q` rules have class specificity, so `style.css` restyles them to match the game (`.fx-set ...`).
- Animations off adds `fx-still` on `<html>` (all CSS animations/transitions off, no floaters); Fast adds `fx-fast`. `finalFx` runs once per game (`g.cheered`).
- `tests/fx.ui.mjs` uses a fake AudioContext (WebKit on Windows has none) and spies on FX. fx.js is 1.0.3 (time-based confetti); recopy and bump `?v=` when `_fx` changes.
- `js/online.js` is a copy of the shared `_online/online.js`; edit the shared one, then recopy.
- `js/net.js` is an ES module that hands `createOnline` to the plain-script app via `self.CarcNet` and a `carcnet` event.
- Online: after sending a move the UI blocks until `st.moves` changes (`sentAt`), or a fast second tap sends a double move.
- The online public view sorts the bag so order stays secret; `privateView` is empty (nothing else is hidden).
- The results sheet is marked shown only while the Play tab is open (`g.shown`); end-of-game events go into `g.log` once (`g.loggedFinal`).
- Results sheet appears about 2 s after the last tile in WebKit; screenshot scripts must wait.
- River tiles that cannot be placed are set aside (about 1 in 60 computer games).
- Strength sims: `node tools/sim.js` (slow; 1000 games takes minutes).
- City walls are drawn only on the field side (`city()` in `render.js` returns fill + wall paths); stroking the whole shape puts a seam on tile edges.
- The tile bevel sits outside the rotate group in `RD.tile()` so the light stays top-left. Rotation animation: `spinFrom()` in `app.js` (hand + ghost).
- Zoom lives in `app.js` (`fitBox`, `clampView`, `applyView`, `boardInput`). `renderBoard` starts the new `#world` at the old one's computed transform, or every redraw would cancel the glide. `vs.user` = manual mode. UI test: `node tests/zoom.ui.mjs [--shots dir]` (needs Playwright in `~/.claude/tools`; `SITE_ROOT=<other checkout>` tests old code).
- `css/table.css` + `js/table.js` are byte copies of `Board and Card Games/_table/`; never edit them here (override in `style.css`). The kit's `filter: drop-shadow` on `.tbl-meeple` drops WebKit to ~2 fps with 20+ meeples (measured): `style.css` turns it off under `#view-play` and draws a shadow ellipse instead.
- Seats are `#players .pchip[data-seat=i]` (moveFx `chipAt`); the one "you" seat at this device (`meSeat()`) has its meeples in `#mine` at your edge, not under its plate. Pass-the-phone games: everyone's meeples stay under the plates and `#mine` shows the current human's.
- The first child of `#world` must stay a tile `<g>` (tests measure it): the cardboard edge/shadow layers are `<path>`s. A computer's tile is drawn with class `incoming` (hidden) until its flight from the hand lands (`incomingAt`, `flyToBoard`).
- Weird-situation test: `node tests/edge.ui.mjs` (`ONLY=name1,name2` runs some; `--shots dir`). It fakes the online room by routing `js/net.js` to a stand-in, and seeds localStorage once per context (`__seeded` key) so a second tab shares it.
- Two tabs: `storage` listener in `app.js` adopts the other tab's game; `leader` = this tab runs the computers (set by moving, a tap, or the tab becoming visible).
- Results sheet and "?" bubble push a history step (`overlayStep`); closing by hand steps back with `popSkip` (a tab tap in the same click waits for it via `afterPop`).
- Under heavy machine load the fx/edge timing checks can be late (computer move > 750 ms); rerun once before hunting a bug (old code flakes the same).
- Screenshot script for the 4 states x 4 sizes: scratchpad `table/carcassonne/shots.mjs <siteRoot> <outDir> [--widths]` (not in the repo).
- Board meeples are drawn in their own layer after all tiles (size from `meepleSize()`, from the fit zoom), so a big meeple's overhang isn't covered by the next tile; an incoming computer tile hides its meeple too (`flyToBoard` un-hides every `.incoming`). `vs.focus` = zoomed in by a tap/Hint (`focusOn`); a human `submit` returns to auto. Zoom token side: `toolsRow` + `.board-wrap.tools-row` set in `fit()`.
- Visibility test: `node tests/vis.ui.mjs [--shots dir]` (`ENGINE=chromium` for Chrome). Audit script (not in repo): scratchpad `vis/carcassonne/shots.mjs <siteRoot> <outDir>`.
- Kit copies (`js/coach.js`, `css/coach.css`, `js/profile.js`, `css/profile.css`, `js/pwa.js`, `sw.js`, `tools/make-icons.mjs`, `tools/pwa-check.mjs`, `js/fx.js`) are byte-identical to `../_coach`, `../_profile`, `../_pwa`, `../_fx`: never edit here, recopy. Bump `pwa.js?v=N data-version="N"` with any deploy-worthy change; leave the `online.js?v=` stamp alone. The coach checks `until` from a rAF loop that headless WebKit barely runs, so `renderDock` calls `tour.update()` during the guided game.
- Saved games keep `acts` (every move) for Undo/Replay; games saved before 2026-10-27 have none, so they get neither (and are not counted in My stats unless finished after a move).
- T&B engine (2026-10-28): `st.fig[p]={b,g}`, `st.goods[p]=[w,g,c]`, `st.bonus` (builder's 2nd tile), figure on a tile = `tile.x=[p,fi,'b'|'g']`, group `fk`/`gd`. Action `{type:'place',x,y,r,fi,big,fig,t}`: `fig` puts a builder/pig on `fi` instead of a meeple. Hand rule: `st.hands[p]`, `st.cur = hands[turn][0]`, `E.pick(st,t)`, `t` on the action; `AI.rankAll` ranks every held tile. `tools/ladder.js` takes `OPTS='{"tb":true,"hand":2}'`.
- `tests/fx.ui.mjs` taken-square tap: on a map with tiles under 40 px the first tap zooms in (by design), so the test taps again, then Fit.
- Screenshots of mid-game states: build a saved state with the engine + AI in node and load it through a throwaway page that sets `localStorage['carcassonne:v1']` (too big for `--local` on Windows).

## Decisions
- Default rules: current (3rd edition) farms, 2-tile city = 4, farmers on. Settings offer 1st-edition farms, old 2-tile city = 2, farmers off.
- River: spring first, 10 shuffled, lake last; base start tile shuffled into the main bag (rules allow either).
- I&C: first-edition 18 tiles, no garden.
- 6-player chips on phone use a compact layout (no names).
- Easy computer plays the best move with skill 0.6 (weaker on purpose).
- Sound & effects sits in Settings after Rules; "big" sparkle only for your own finished city of 20+ points; computers' sounds at 85% volume; a game with only computers gets no win/lose.
- Real-table look: dark wood surface; tile backs plain dark brown with a faint ring (own design); score track only on laptop (phone shows scores on the plates); 4+ players on a phone show colour + score without names; phone on its side puts your edge bottom-right; tiles in two stacks (`#deck2` + `#deck`, the badge sits on `#deck`, deals fly from `#deck`); supply meeples get a seeded tilt (`TABLE.jitter`).
- Edge pass looks (plainest, Tim can redirect): phone score track = the 50-square loop as a 25 x 2 strip under the plates; meeples left = two loose rows; zoom = round wooden tokens (Fit lit = blue ring); 5-6 players on a phone = coloured left edge on the plate instead of the meeple icon; "Start over?" second-tap guard; companion Tiles/Scores still base game only and 5 players max (Tim's call).
- Visibility pass looks (plainest, Tim can redirect): meeples on a zoomed-out map grow to ~60% of a tile; tap-to-zoom at 64 px tiles when tiles are under 40 px; laptop "your edge" moved from under the map to the foot of the side panel; phone on its side: plates in rows of 2-3 in the right column.
- Auto fit caps a tile at 150 px (else the opening tile fills a laptop screen); manual zoom max is 2.5 or twice the fit.

- Improvement pass looks (plainest, Tim can redirect): Owners = a 5th wooden token with a flag; Undo = first dock button (4 buttons share the row); Settings Play card gets a row My stats / Daily game / Rules / Guided game; Daily = you vs Hard, standard rules; ratings Easy 1000 / Medium 1400 / Hard 1625 (from the sims, Medium–Easy gap capped at 400); Undo or Hint or hint numbers or study mode = "with help" (unrated).

- Wave 3 looks and wording (plainest, Tim can redirect): T&B switch under Rules; "House rules" sub-heading with "Hand of tiles" Off/2/3 and a one-line note; builder/pig are own-art figures (tall piece, pig) beside the meeples, spots are dashed circles; held tiles are small tiles beside your tile; goods icons barrel/sheaf/cloth bolt; "Place + builder"/"Place + pig"; rules sheet "Learn more: videos" with 5 links; strength note gets one T&B/hand line.
- Hand of tiles and the River are exclusive (choosing one turns the other off). Only 1 house rule added besides the existing Farmers off (more would be guesses).

## Measured strength (2026-10-27, `node tools/sim.js 400`, after every level got farmers)
Hard vs Med 78.5%, Hard vs Easy 96.5%, Med vs Easy 95.5%, Hard vs 3 Med 63% (fair 25%), Med vs 3 Easy 63%; first seat in Hard vs Hard wins 56.9%. Farmers per 100 moves Easy/Med/Hard 6.6/5.6/7.3 (was 0/0/9.5). Same move twice from one spot: 13/16/20 of 40 (was 14/20/25). `node tools/ladder.js 200` runs the whole ladder.
2026-10-28 ladder: T&B (200/pair) Hard–Med 72.8%, Med–Easy 93.0%, Hard–Easy 98.5%, Hard vs 3 Med 64.5%; Hand 2: 82.8 / 94.0 / 98.5%, Hard vs 3 Med 59%; T&B + Hand 3 (100/pair): 69.0 / 91.5 / 93.0%, Hard vs 3 Med 38%.

## NOT verified
- Edge pass: online fixes (room start with a pending computer move, room closed message) tested with a stand-in room, not live Firebase; two tabs tested in one WebKit context, not two iPhone Safari tabs.
- On Tim's real iPhone (only the WebKit iPhone emulation).
- Online with 3 or more real browsers (two-browser game verified).
- Real two-finger pinch on an iPhone (test uses synthetic pointer events in WebKit).
- Online games with River or I&C turned on (engine tests cover the adapter with options; no live browser run).
- How the sounds actually sound and their loudness on a real iPhone (tests use a fake speaker); online sounds from another player's move (same code path as computer moves, not run with two browsers).

- Visibility pass: tap-to-zoom with a real finger on an iPhone (synthetic touch events in WebKit + Chrome only). Still small by nature: on a phone a late map's whole-map view has 16-20 px tiles and 7-8 px hint numbers (the tap zoom is the answer); meeple circles on the hand tile ~20-30 px; laptop side panel bag scrolls (last row below the fold at 1280x800).
- Improvement pass: install to the iPhone home screen and offline play on a real phone (pwa-check in WebKit only); Daily seed shared across devices (same kit function as other games, not compared on two devices); the Owners farm tint on very crowded late maps (checked on a 30-tile 3-player map). `fx.ui` "tap on a taken square: error sound" and `zoom.ui` flake about 1 run in 3 under load, on old code too.
- Wave 3: T&B and hand of tiles in online rooms (options passed to the room; engine adapter tested, no two-browser run); the new tile art and figures on a real iPhone; `pwa-check` "nothing left localhost" failed once in 4 runs (passed 3 after; old code 1/1 pass).
- Real-table look: the deal/flip and tile flights on a real iPhone (WebKit emulation only); frame rate on a real phone with a late 4-player game (headless WebKit: idle 42-44 fps, same as before); online opponent tile flights (same code path as computers, no two-browser run).

## Rejected / parked
- ~~River 2~~ parked: less common than the first River.
