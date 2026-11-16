# Detection fixtures

These PNGs are original constructed test patterns, not League frames, Riot assets, downloaded
portraits or evidence of real-world detection accuracy. They are covered by the repository's MIT
license.

Eleven 7 × 7 grayscale portrait stand-ins use deterministic intensity patterns. IDs 1–10 are the
test roster; pattern 11 is deliberately absent from that roster. Frames are 64 × 48, with a uniform
background. `positions.json` gives the ten normal icon centres in crop pixels.

- `normal.png` places the ten roster patterns in two rows.
- `scaled.png` places resized 9 × 9 patterns at the same top-left anchors; centres move +1,+1.
- `jump.png` moves participant 1 to centre (53.5,35.5).
- `duplicate.png` adds a second participant-1 pattern at centre (41.5,35.5).
- `occluded.png` covers five columns of participant 1 with background.
- `unknown.png` replaces participant 1 with pattern 11.
- `blank.png` contains background only.

The detector tests read these committed frames, assert known coordinates and rejection behaviour,
and construct only invalid-image variants in memory. Real captures and cached portrait packs remain
ignored local data; none are included here.
