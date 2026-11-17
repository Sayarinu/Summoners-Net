# Draft win probability

The draft model estimates each side's chance to win from the draft alone, before the game. It is a
`draft` model in `wp_models` (migration 0048), trained with the other models by the `wp-train` job
and `pnpm wp:train`, with one active model at a time. Solo game pages and the
[draft assistant](matchups.md#draft-assistant) show it; `/models` shows its calibration.

## Inputs

Every input is in win-rate points above 50% and needs at least ten games, otherwise it is left out:

- **Champion strength**: each champion's win rate in its role.
- **Lane matchup**: for each role both sides have picked, blue's shrunk win rate against the red
  champion, `(wins + 50 · b) / (games + 50)`, where `b` is blue's pooled win rate in the role.
- **Synergy**: for each pair of teammates, the duo win rate minus the rate expected from both
  champions' own role win rates (`a + b − 0.5`), times `n / (n + 50)`.

## Model

Three features, each summed from blue's side (red inputs count against blue) and scaled so one unit
is ten win-rate points, feed a logistic regression with L2 regularization:

```
strength = Σ blue strength − Σ red strength
lane     = Σ blue lane matchups
synergy  = Σ blue pair synergy − Σ red pair synergy
P(blue wins) = σ(β₀ + β₁·strength + β₂·lane + β₃·synergy)
```

Inputs left out add nothing to their sum. The coverage shown with every probability counts how many
inputs were known: up to 10 champions, 5 lanes and 20 pairs. Every input is listed with its games.

## Training and calibration

Training uses ranked solo games (queue 420, not remakes) from the solo-queue training window where
each team has exactly one player in each of the five roles. Games are split by match with a seeded
shuffle; 20% are held out.

To keep the held-out evaluation honest, the inputs used in training are built **from the training
games only**, per patch. A training game's own result is left out of its inputs, so no game informs
its own features. Held-out games are scored against counts they never contributed to. The Brier
score and ten reliability bins on the held-out games are stored with the model and shown on
`/models`. With fewer training games than the minimum (the same minimum as the solo-queue model),
the model is stored as rejected and the active one stays.

## Predictions

Solo game pages and the assistant read the stored solo-queue aggregates for the patch:
`champion_aggregates`, `matchup_aggregates` (with the pooled baselines stored in
`blindability_scores`) and `champion_duos`. A game page's inputs include that game, unlike the
held-out evaluation. The assistant scores the draft as it stands and with each candidate in the role
to fill, for the user's side; pro drafts have no draft model. Reads are bounded to the picked
champions and the candidates' role, and are in the query plan budget test. No provider is called.
