export interface MapPosition {
  readonly x: number | null;
  readonly y: number | null;
}

// Image bounds and fixture coordinates: https://hextechdocs.dev/map-data/.
export const summonersRiftBounds = { minX: -120, minY: -120, maxX: 14870, maxY: 14980 } as const;

export function worldToPixel(position: MapPosition, width: number, height = width) {
  const { x, y } = position;
  const { minX, minY, maxX, maxY } = summonersRiftBounds;
  if (
    x === null ||
    y === null ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < minX ||
    x > maxX ||
    y < minY ||
    y > maxY ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  return { x: ((x - minX) / (maxX - minX)) * width, y: ((maxY - y) / (maxY - minY)) * height };
}

export function pixelToWorld(position: MapPosition, width: number, height = width) {
  const { x, y } = position;
  if (
    x === null ||
    y === null ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    x > width ||
    y < 0 ||
    y > height
  )
    return null;
  const { minX, minY, maxX, maxY } = summonersRiftBounds;
  return { x: minX + (x / width) * (maxX - minX), y: maxY - (y / height) * (maxY - minY) };
}
