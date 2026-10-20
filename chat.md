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
