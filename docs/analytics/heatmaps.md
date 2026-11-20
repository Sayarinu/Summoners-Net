# Heatmaps

Heatmaps show where a champion, player or role tends to be, die or get kills in solo queue, per
patch. The aggregate job builds them with the patch's other solo-queue aggregates; pages read only
the stored aggregates (`heatmap_samples` and `heatmap_cells`, migration `0045`).

## Points

- **Positions**: every stored minute frame from minute 1 with coordinates. Minute 0 is skipped
  because every champion is in the fountain.
- **Deaths**: the location of each champion kill in which the subject was the victim.
- **Kills**: the location of each champion kill the subject made. Assists are not counted.

Only non-remake games with a stored timeline count. Coordinates Riot omits are skipped, never
treated as zero.

## Side normalization

Red side's points are rotated half a turn about the map centre before binning:

```
x' = (minX + maxX) - x = 14750 - x
y' = (minY + maxY) - y = 14860 - y
```

using the minimap bounds (`minX = minY = -120`, `maxX = 14870`, `maxY = 14980`). Every heatmap
therefore reads from blue side's perspective, with the player's own base bottom left. The same
rotation is applied to positions, deaths and kills, using the side of the player the point belongs
to: the victim's side for deaths and the killer's side for kills.

## Grid and sample

Points are binned on a fixed 16 x 16 grid over the bounds; points outside the bounds are skipped.
Each heatmap reports its sample: the games the subject played with a stored timeline, and the points
binned. A heatmap below 10 games (the shared minimum sample) is not drawn. Its sample is still
stored and shown, but its cells are not written.
