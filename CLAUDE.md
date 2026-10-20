# Carcassonne — project rules

Read `progress.md` first (START HERE). Tim's global rules and `Code Projects/CLAUDE.md` apply.

- Static GitHub Pages site, repo `TimothyHadfield/carcassonne`, live https://timothyhadfield.github.io/carcassonne/. No build step: plain scripts in `js/`, `style.css`, `index.html`.
- Look: the dark Hub look (bg #0f1117, cards #1a1e2b, line #2a3042, text #e8eaf0, muted #969db4, accents #6ea8fe / #f0b354). No page scroll on main screens, bottom tabs on phone, side rail on laptop. Tim owns visuals and wording.
- Tile art is our own SVG (`js/render.js`). Never copy the published art or rulebook text.
- Rules must match the real game; every count and score is listed with sources in `docs/rules-check.md`. Change that file with any rule change.
- Tests: `node tests/engine.test.js`, `node tests/odds.test.js`, `node tests/online.test.mjs`. All must pass before a push.
- `js/online.js` is a copy of `Board and Card Games/_online/online.js`. Do not edit it here; recopy it when the shared one changes.
- When you change a script, bump its `?v=` in `index.html` (iPhone Safari caches hard).
- Commit with explicit paths, push each finished change, check it is live with `python ~/.claude/hooks/live-check.py "<this folder>"`.
