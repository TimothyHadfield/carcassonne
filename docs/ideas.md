# Carcassonne: data, exploration and theory ideas

Tim's ask (2026-10-19): "Brainstorm what additions you can do to the game with data, exploration, theory, etc. ... Implement your good ideas."

Each idea: **Build** or **Skip**, with the reason in one line. Built ones say where they live.

| # | Idea | Call | Why |
|---|---|---|---|
| 1 | **Expected-points hint on every legal square** (best turn + meeple) | **Build** (Play, Hints switch) | The odds layer right where the decision is made, Tim's core ask. |
| 2 | **Draw odds for the hole you need** (pick the 4 sides, get "chance before the bag runs out", next turn, in 3 turns) | **Build** (Tiles tab) | The real-table question, solved exactly with the hypergeometric formula, tested by brute force. |
| 3 | **Tiles left in the bag**, live, with pictures | **Build** (Tiles tab; Play sidebar on laptop) | Card-counting for tiles; feeds idea 2. |
| 4 | **Study mode: points given up per move** and running total | **Build** (Play, Study switch) | "Points lost per choice" from the common brief. |
| 5 | **Dead squares**: holes no tile left in the bag can ever fill, marked with a red X | **Build** (Play, with Hints or Study) | Real strategy (killing an opponent's city), cheap to compute exactly. |
| 6 | **Score race chart** at game end, with the end-of-game jump (farms, unfinished) visible | **Build** (Results sheet) | Shows where the game was won; farms' size surprises new players. |
| 7 | **Score breakdown by feature** (city / road / monastery / farm) per player | **Build** (Results sheet) | Tells you which part of your game is weak. |
| 8 | **Measured computer strength** table (win rates from thousands of self-play games) | **Build** (Settings → How strong?) | The brief's "measured, not claimed" rule. |
| 9 | **First-player advantage**, measured from the same self-play runs | **Build** (How strong? note) | One number people argue about at the table; we can measure it. |
| 10 | **Score helper with majority** (tap meeples per player, it works out who scores; ties both score) | **Build** (Scores tab) | Majority/tie rules are the most-argued part at a real table. |
| 11 | **Farm scoring helper**, current and first-edition rules | **Build** (Scores tab, Farm; Settings → Farm scoring) | Tim asked for end-of-game farm scoring. |
| 12 | Hint button that shows the single best move | **Build** (Play) | One tap from "what should I do" to the answer. |
| 13 | Projected final score for each player (current score + expected value of their meeples) | Skip for now | Useful but adds numbers to the main strip; would need its own Tim look. |
| 14 | "Which tile closes my feature" for each of your open features during a vs-computer game | Skip for now | Covered by hints + dead squares; a list per feature is wordy on a phone. |
| 15 | Heatmap of where the best players place (from expert game logs) | Skip | No free, public expert game logs with board positions. |
| 16 | Photo of a real board → read the tiles | Skip | Needs a paid vision API ($0 rule) or a big model download. |
| 17 | Monte-Carlo look-ahead computer (plays out the bag many times per move) | Skip for now | Too slow on a phone per move; the one-tile-ahead evaluator is measured instead. |
| 18 | Tile-shape explainer: how many tiles have each edge type (79 city edges, 94 road edges) and what that means for closing big cities | Skip for now | Interesting trivia, but not a decision aid; could become a ? note later. |
