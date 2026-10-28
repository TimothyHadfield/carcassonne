# Carcassonne — chat log

## 2026-10-18 to 2026-10-19 — first build (games wave, phase 1 + 2)
- **Asked:** Tim: "do ... carcasson." Base game with the real 72-tile mix, own SVG art, real-table companion like the Catan stats site, vs 1–4 computers at measured strength with hints and a study mode. Phase 2: exact rules incl. common variants, online play, ideas list, polish for iPhone and laptop, rules check with sources, QA.
- **Built:** engine, tiles, AI, render, app (Play / Tiles / Scores / Settings), companion odds, online rooms through the shared `online.js`, River and Inns & Cathedrals, 6 players, big meeple, strength table, `docs/ideas.md`, `docs/rules-check.md`.
- **Verified:** engine 162, odds 15, online 18 tests passing (each seen failing against a broken engine); full 6-player River + I&C game in WebKit at 393 px with 0 errors; two-browser online game on real Firebase (both agreed on scores); all tabs at 393 px and laptop, no overflow, no console errors.
- **QA (fresh agent, live site, 2026-10-20):** no crashes or console errors. Fixed: end-of-game scoring now in the log ("(end)"), the results sheet shows when the game ended on another tab, the old 2-tile city gives 1 per shield, and the chip and badge clipping. Each fix was re-measured (off-tab game: sheet shown, log sum 185 = score total 185).
- **Open:** Traders & Builders parked; real-iPhone check; online with expansions in a live browser.

## 2026-10-20 — visual design pass
- **Asked:** Tim: "review them again for design improvements especially visually."
- **Built:** walled cities with houses (no seam on tile edges), tile bevel, bigger pennants and monasteries, meeples 32/44 with outline + shadow, hint squares quieter with the best one solid gold, rotate animates (hand and board), dock fixed height so nothing jumps, disabled Place looks disabled, 4-player chips on one grid, 42 px zoom buttons, taller setting options, results table even columns + chart baseline, laptop: bigger dock text, 6x4 tiles grid.
- **Verified:** tests 164/15/18 pass; before/after screenshots of 8 states at 393 px and 1440 px (WebKit), 0 console errors, no overflow, no page scroll; dock positions measured equal before/after picking a meeple; spin class measured on hand and ghost.
- **Open:** look on Tim's real iPhone.

## 2026-10-20 — one auto-fit zoom
- **Asked:** Tim: "Make it so that there is only an auto zoom that automatically fits the whole board in sight and then you can zoom if you want with easily reseting back to auto mode."
- **Built:** auto fit (all tiles + every empty spot) on load, new game, Play-tab return, resize/rotation (ResizeObserver) and every placed tile, gliding; one-finger drag does nothing in auto; pinch / wheel / + zoom in, drag pans clamped; can't zoom out past the fit (that is auto again); Fit dimmed in auto, lit blue when zoomed; double-tap off a spot resets. Removed the old free drag and the 0.12 min zoom. Phone on its side: zoom buttons in a row (the column was cut off).
- **Verified:** new `tests/zoom.ui.mjs` (WebKit, 393x659, 659x393, 1280x800, a 65-tile game, 3 growing moves): 38 fails on the old code, 60/60 on the new (4 runs in a row). Glide measured (scale 1.26 -> 1.04 -> 0.95 over 750 ms). Late game: a tile is 25.6 px at 393 px in auto.
- **Open:** pinch on a real iPhone.

## 2026-10-20 — sounds, celebrations, animations
- **Asked:** Tim (all games): "add opptional sounds ... win celebrations, and other fun annimations ... make sure everything is customizable in the settings".
- **Built:** shared `js/fx.js` copied in; `js/sfx.js` (custom tileDraw / tileTurn / meeple / bell + the per-move sound plan); `app.js` moveFx (sounds in step with floaters, chip count-up, meeples fly home, big-city sparkle), turnFx (chime + pulse on your turn), finalFx (farm/total count-up then win/lose); Tiles/Scores tab sounds; Settings "Sound & effects" section; Animations off/Fast also cover the game's own CSS motion.
- **Verified:** `tests/fx.ui.mjs` (WebKit, fake speaker): 26 fails + a crash on the old code, 49/49 on the new (3 runs); engine 164, odds 15, online 18, zoom 60 still pass; screenshots at 393 px and 1280 px, no console errors, no overflow.
- **Open:** real-iPhone listen; two-browser online sound check.

## 2026-10-20 — real-table look
- **Asked:** Tim (all games): make each game look "almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses". Keep the auto-fit zoom.
- **Built:** shared `_table` kit copied in (`css/table.css`, `js/table.js`), fx.js recopied (1.0.3, no game-side speed workaround existed). Play = dark wooden table; tiles with cardboard edge + shadow, the picked tile held above its square with a bigger shadow; far side: score plates + standing wooden meeples + the face-down tile stack (thickness and badge = tiles left); your edge: the drawn tile held up (thick tile) + your meeples; laptop: your edge under the map, side panel = score track board (0-49, score meeples, 50/100 tokens) + bag + scoring log; next tile dealt off the stack then turns over (3-D), computers' tiles fly from the middle onto their square; phone on its side: your edge on the right; 320 px: smaller tile.
- **Verified:** engine 164, odds 15, online 18, zoom 60/60, fx 49/49; before/after screenshots of setup, mid, late (4 players), end at 393, 320, 659x393 and 1280 (WebKit), 0 console errors, no overflow; idle frame rate measured equal to before (42-44 fps) after replacing the kit meeple's drop-shadow filter (2 fps with it).
- **Review round (2 read-only reviews):** fixed meeple supplies packed like star ratings (spaced, seeded tilt), one stack -> two face-down stacks, phone on its side puts your edge bottom-right, brighter laptop panel text. Left as is (Tim's call or out of scope): no score track on phone, zoom buttons look like app controls, tab bar.
- **Open:** real iPhone look and feel; two-browser online run.

## 2026-10-20 — edge pass (weird situations)
- **Asked:** Tim (all games): "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Plus the reviewer's leftovers: meeples like star ratings, no phone score track, app-like zoom buttons.
- **Built:** 50 scenarios listed and tested; fixes: no-meeples status, set-aside notice, Back closes sheet/bubble first, "Start over?" guard on New game, two-tab sync, pending computer move cancelled when a room starts, room-closed notice, tally to 7, 6-player plates at 320/393, laptop grid with 6 plates, sticky results buttons; meeple crowds, phone score strip (25 x 2), wooden zoom tokens; `_table` 1.0.1 recopied + `.gitattributes`.
- **Verified:** new `tests/edge.ui.mjs` 121/121 (25 fails on old code); engine 164, odds 15, online 18, zoom 60, fx 49; screenshots at 320, 393, 659x393, 1280, 1920, 640x400 (WebKit), no overflow, no errors; re-render time measured not slower (181 vs 251 ms median, noisy machine).
- **Open:** online fixes only with a stand-in room; real iPhone.

## 2026-10-21 — visibility pass (crowded maps)
- **Asked:** Tim (all games): boards too small to see what's going on; fill the screen with the board, use the empty space, and check the dense parts.
- **Audit (before, WebKit):** late 6-player map (79 tiles) at 393 px: tiles 19.8 px, meeples 6.2 px, hint numbers 7.7 px, lit squares 18 px; zoom tokens covered 5 tiles/spots; phone on its side gave the map 38% of the screen; laptop meeples 13.8 px, map lost 170 px of height to your edge.
- **Built:** meeples in their own layer, sized ~17 px on screen (32-62 tile units); tap/Hint on a tiny map zooms to that spot (64 px tiles), Place returns to the whole map; zoom tokens get their own strip; side-on phone layout (plates in the right column); laptop your edge at the foot of the side panel; game-over Results/New game no longer clipped on a side-on phone.
- **Verified:** new `tests/vis.ui.mjs` 40/40 in WebKit and Chrome (18 fails on old code); engine, odds, online, zoom, fx, edge suites pass; before/after shots at 393, 320, 659x393, 1280, 1440; one read-only reviewer pass, its fixes applied.
- **Open:** real-finger tap zoom on an iPhone; whole-map view of a late phone map stays small by nature (tap zoom covers it).

## 2026-10-27 — improvement pass (from the competitor analysis)
- **Asked:** manager brief: fix listed problems, check the whole computer ladder (every level uses farmers, not predictable), steal the $0 ideas (ownership tint, hint numbers hidden by default, richer original art, Undo + end-of-game replay), add the shared kits (coach, profile 1.1.0, pwa), bigger key-moment animations, no empty bands.
- **Built:** Owners flag token; hint numbers off by default; Undo vs the computer; Replay; My stats + achievements + Daily (vs Hard, no Undo; quitting after your first tile = a loss; guided game never counts); rules sheet + guided first game; install/offline (pwa 1.3.0, coach 1.1.0 copied byte-identical); Easy and Medium now put down farmers, Medium/Hard choose among near-best moves; stone walls with battlements, textured meadows, gravel roads; score flash + meeple hop (off with animations / reduced motion); 4-button dock fits at 320 px.
- **Verified:** `tests/improve.ui.mjs` 35/35 WebKit (crashes/fails on old code), `tests/improve.test.js` 17/17 (old AI fails the farmer checks), pwa-check 18/18, engine 164, odds 15, online 18, zoom 60, fx 50 (one old flake), edge 121, vis 40 WebKit + Chrome; `tools/sim.js 400`: Hard vs Medium 78.5%, Medium vs Easy 95.5%; shots at 393, 320, 659x393, 1280, 1440, 0 console errors, no overflow.
- **Open:** Tim's calls on the looks (Owners token, Undo placement, Settings button row, achievement names, Daily vs Hard); real-iPhone install and offline.

## 2026-10-28 — wave 3 (make the games better)
- **Asked:** Tim: "Just make the games better ... adding variations like common house rules ... links to youtube videos on strategies/how to play/variations". Manager brief: Traders & Builders as rules, 1–3 house rules, 2–5 Learn videos, leftovers (flaky tests, 393/320 issues).
- **Built:** Traders & Builders (24 own-art tiles from the JCZ layouts; goods, builder double turn, pig; both farm editions), off by default; house rule Hand of tiles (2/3), off by default; computers play both; rules sheet T&B + House rules + 5 videos; Settings fits at 320 px; 3-4 players at 320 px drop the clipped name; `fx.ui` taken-square flake fixed.
- **Verified:** `tests/tb.test.js` 55/55, new `tests/tb.ui.mjs` 38/38 WebKit at 393 + 320 (old code: 5 fail, crash); engine 164, improve 17, odds 15, online 18, zoom 60 (x4), fx 50 (x6 in a row), edge 121, improve.ui 35, vis 40, pwa-check 18/18 (1 flake in 4); ladder: T&B Hard–Med 72.8%, Med–Easy 93.0%; Hand 2: 82.8 / 94.0%; videos: oEmbed 200 + title match on 2026-10-28; shots at 393, 320, 659x393, 1280, 1440 with 0 errors and no overflow.
- **Open:** Tim's calls on the T&B/hand looks and wording; online with T&B/hand in two real browsers; real iPhone.
- **Kit sweep v15 (same day, builder A1):** game-coach 1.2.0 + game-pwa 1.4.0 re-copied, offer `place:'auto'` avoiding Place (old offer-bottom override removed; zoom.ui marks the offer answered); offer clear of tab bar + Place at 393×659 / 320×568 / 659×393, settings 320 px no sideways scroll, no selects; engine/odds/improve/tb/online + all 6 UI suites green, pwa-check 18/18.
