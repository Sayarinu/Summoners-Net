// Original, non-playable header fixtures built from the cited container layouts. No game packets.
export function roflFixture(
  options: {
    format?: "ROFL" | "ROFL2";
    version?: string;
    gameId?: bigint;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const format = options.format ?? "ROFL",
    version = options.version ?? "16.22.734.5521";
  const metadata = Buffer.from(
    JSON.stringify({
      gameLength: 1_800_000,
      ...(format === "ROFL" ? { gameVersion: version } : {}),
      lastGameChunkId: 4,
      lastKeyFrameId: 2,
      statsJson: JSON.stringify([
        {
          SKIN: "Ahri",
          TEAM: "100",
          CHAMPIONS_KILLED: "3",
          ASSISTS: "4",
          WIN: "Win",
          RIOT_ID_GAME_NAME: "Fixture player",
        },
        { SKIN: "Zed", TEAM: "200", NUM_DEATHS: 3, WIN: "Fail" },
        {},
      ]),
      ...options.metadata,
    }),
  );
  if (format === "ROFL2") {
    const prefix = Buffer.alloc(15 + Buffer.byteLength(version));
    Buffer.from([82, 73, 79, 84, 2, 0]).copy(prefix);
    prefix.writeBigUInt64LE(options.gameId ?? 7612345678n, 6); // Opaque: deliberately not an identity.
    prefix.writeUInt8(Buffer.byteLength(version), 14);
    prefix.write(version, 15);
    const tail = Buffer.alloc(4);
    tail.writeUInt32LE(metadata.length);
    return Buffer.concat([prefix, Buffer.alloc(256), metadata, tail]);
  }
  const header = Buffer.alloc(288),
    payload = Buffer.alloc(34);
  Buffer.from([82, 73, 79, 84, 0, 0]).copy(header);
  header.writeUInt16LE(288, 262);
  header.writeUInt32LE(288 + metadata.length + 34, 264);
  header.writeUInt32LE(288, 268);
  header.writeUInt32LE(metadata.length, 272);
  header.writeUInt32LE(288 + metadata.length, 276);
  header.writeUInt32LE(34, 280);
  header.writeUInt32LE(288 + metadata.length + 34, 284);
  payload.writeBigUInt64LE(options.gameId ?? 7612345678n, 0);
  payload.writeUInt32LE(1_800_000, 8);
  payload.writeUInt16LE(0, 32);
  return Buffer.concat([header, metadata, payload]);
}
