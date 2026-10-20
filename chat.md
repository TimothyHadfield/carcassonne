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
