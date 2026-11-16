# ROFL metadata import evidence

Checked 2026-11-16 for LUNE-718. Support covers the two container signatures below and metadata
only. The parser does not decrypt, decompress or inspect game packets. These layouts come from
independent maintainers' source and observations, not a Riot-supported binary-format specification.
No live League client or fresh replay was available; generated fixtures exercise the documented
layout and malformed-input handling, not current-client compatibility.

## Legacy ROFL

Accept the six-byte prefix `52 49 4f 54 00 00` and the known 288-byte header. Bytes 6–261 are an
opaque signature. The remaining fields use little-endian unsigned integers:

| Absolute byte offset | Width | Meaning                    |
| -------------------- | ----- | -------------------------- |
| 262                  | 2     | Header length              |
| 264                  | 4     | File length                |
| 268                  | 4     | Metadata offset            |
| 272                  | 4     | Metadata byte length       |
| 276                  | 4     | Payload-header offset      |
| 280                  | 4     | Payload-header byte length |
| 284                  | 4     | Payload offset             |

These offsets are derived from the maintainer's
[signature definition](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/ROFL.cs)
and
[length-field model](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/Rofl/Lengths.cs).

At the declared payload-header offset, an unsigned 64-bit little-endian value is the game ID; retain
its decimal string without converting through a JavaScript number. The fixed payload header is 34
bytes: duration occupies bytes 8–11, and an unsigned 16-bit key length occupies bytes 32–33. The
variable key follows. Checking those bounds does not require retaining the key or inspecting
packets. No platform identifier is defined in this structure.
[Payload-header model](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/Rofl/PayloadHeader.cs)

The metadata is UTF-8 JSON at its declared offset. `gameVersion` is a string; `gameLength` is
milliseconds; `statsJson` is a **string containing another JSON document**, whose root is the
participant array. `lastGameChunkId` and `lastKeyFrameId` are numeric bookkeeping fields.
[Legacy metadata model](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/Rofl/Metadata.cs)

## ROFL2

Accept `52 49 4f 54 02 00`. The final four bytes encode the metadata length as a little-endian
integer. For file size `N` and metadata length `M`, metadata spans `[N - 4 - M, N - 4)`. The
maintained C# reader confirms this tail-first extraction, but reads a fixed 14-byte version; that
shortcut must not be copied.
[ROFL2 reader](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Readers/Rofl2Reader.cs)

A newer implementation and its sample observations locate an unsigned one-byte version length at
byte 14, followed by that many version bytes at byte 15. Thus the header ends at `15 + length`;
version `16.8.766.8562` occupies 13 bytes. Bytes 6–13 remain uninterpreted. Metadata is preceded by
a 256-byte opaque signature. Neither that signature nor the opaque header bytes establish the game
ID or platform. The newer notes explicitly found that the opaque bytes did not match the sample's
filename game ID.
[ROFL2 header parser](https://github.com/Toastaspiring/ROFL-X/blob/88954be66da506f188fbd134944fdfd8334ad846/src/rofl/header.rs),
[observed container boundaries](https://github.com/Toastaspiring/ROFL-X/blob/88954be66da506f188fbd134944fdfd8334ad846/docs/ROFL_FORMAT.md)

The footer retains numeric `gameLength`, chunk bookkeeping fields and the stringified `statsJson`
array. The header supplies the version; a footer `gameVersion` is absent in the newer sample and is
not required. The C# metadata model also takes the version separately.
[ROFL2 metadata model](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/Rofl2/Metadata2.cs)

## Statistics and identity

Participant statistics are flat objects with largely string-valued fields. Useful source keys
include `SKIN` (champion identifier/name), `TEAM`, `WIN`, `CHAMPIONS_KILLED`, `NUM_DEATHS`,
`ASSISTS`, `RIOT_ID_GAME_NAME`, `RIOT_ID_TAG_LINE` and `PUUID`. The models evolve; preserve bounded
source statistics without requiring every known key. Missing fields stay unknown. Do not copy
upstream fallbacks that infer a role from array position, turn an absent result into a loss, or
assume blue team when the team field is absent.
[Participant model](https://github.com/fraxiinus/roflxd.cs/blob/9921136947155ed7a162738d20e6107070813e1c/Rofl.Extract.Data/Models/Rofl/PlayerStats.cs),
[newer metadata interpretation](https://github.com/Toastaspiring/ROFL-X/blob/88954be66da506f188fbd134944fdfd8334ad846/src/rofl/metadata.rs)

Import behavior:

- Legacy: preserve the embedded decimal game ID. An explicit platform supplied by the user is
  separate provenance, not a value extracted from the file. A link may only target that same
  platform and game ID in stored Riot matches; retain the source file identity and any corroborating
  metadata rather than merging records by a player name.
- ROFL2: game ID stays `null` and the import remains unlinked. A filename, opaque header bytes or
  manually supplied platform cannot supply the missing embedded ID.
- Preserve replay player identifiers in their own source namespace. In particular, do not assume a
  replay's raw PUUID representation equals the encrypted PUUID returned by the public Riot API.
- Recognizing the file prefix and hashing its bytes establishes format/provenance, not authenticity
  of Riot's signature. Do not describe metadata as cryptographically verified.

## Import validation decisions

The following are defensive importer rules, not claims that Riot guarantees these limits:

1. Bound total file bytes at the entry point and metadata bytes before allocating or decoding. Reuse
   the application's bounded upload mechanism; define explicit participant, field-count and
   string-size limits. Metadata is small compared with the packet body, so a metadata-specific limit
   should be much lower than the file limit. Read/hash in bounded chunks where practical.
2. Require exact supported magic; reject unknown versions without guessing another layout. For
   legacy files require the known header size, matching declared/actual file length, in-range
   ordered sections and a payload header of at least 34 bytes. Require the key-length field to fit
   within that header. Use declared offsets rather than assuming sections are adjacent.
3. For ROFL2 require a nonempty bounded version, enough bytes for the declared header, a positive
   bounded footer length, and space between header and footer for the opaque signature. Reject
   overlapping/truncated ranges before slicing. No chunk parsing is necessary.
4. Decode strict UTF-8 and validate both JSON layers. Require an object outside, a string
   `statsJson`, and an array of bounded participant objects inside. Reject nonfinite, negative or
   unsafe numeric durations. Scientific notation is valid JSON number syntax when its resulting
   value is an exact safe integer; do not silently round identifiers.
5. Chunk-count fields appear in observed files, but upstream parsers differ on requiring them. A
   metadata-only importer need not require unused counters; validate them when retained and never
   fill missing ones with zero. Validate version syntax and preserve the complete source version.
6. Keep unknown or malformed metadata distinct from a valid empty/partial statistic. Validate the
   entire import before one transaction changes stored records. A failed import cannot replace
   earlier successful metadata.

Tests should cover both signatures, different version lengths, offsets at boundaries, truncated
headers/footers, huge length claims, invalid UTF-8, both malformed JSON layers, wrong stats types,
unsafe numeric IDs, missing statistics, duplicate imports and the ROFL2 unlinked state. Fixtures
must be identified as generated from these layout descriptions. No third-party implementation,
replay asset or packet data is vendored.

Riot's [Replay API documentation](https://developer.riotgames.com/docs/lol#replay-api) concerns
controlling an already-running replay, not this binary metadata contract. Its
[replay FAQ](https://support.riotgames.com/en-us/league-of-legends/gameplay/replays-faq-pro-tips)
says playback expires with a patch update; metadata readability therefore must not be presented as a
promise that an old file can still be played.

## Implemented import contract

The local upload endpoint accepts a replay of at most 256 MiB and bounded multipart overhead. It
stages a private, uniquely named copy under `.local/imports/replays`, then queues `replay-metadata`.
The browser does not parse it. An optional platform selection is explicitly user-supplied
provenance; no platform is inferred from the filename.

The worker reads bounded header ranges and at most 4 MiB of metadata, and hashes the whole file in
chunks without decoding its packet body. It checks file stability while reading. The metadata object
accepts the documented fields above; statistics must be a stringified array of at most 64 flat
participant objects, each with at most 512 bounded scalar fields. Known team and K/D/A fields must
be bounded nonnegative integers when present. Missing fields remain absent in stored source metadata
and become null in the public summary. Header and metadata duration values are retained separately.

Only after the whole header and both JSON layers validate does one transaction upsert metadata by
source SHA-256. The private source statistics are preserved; public summaries expose champion, team,
K/D/A and result without merging replay player identities into Riot identities. The public
`replayMetadata(sha256)` query links a legacy embedded ID only with the explicitly selected platform
and agreeing patch in stored Riot data. ROFL2 stays unlinked. Metadata survives provider retention.

By default, the worker deletes its staged copy before storing validated metadata, including when
validation fails. A database failure leaves previous metadata intact; re-upload the original to
retry. `KEEP_REPLAY_FILES=true` retains newly processed copies, including invalid uploads; false or
an unset value deletes them. Existing retained copies are not removed when this setting changes. The
worker only processes regular files under the configured replay staging directory; it refuses
arbitrary original paths and symlinks. Failure to remove a staged copy prevents metadata storage and
reports the cleanup failure. An upload that cannot be queued also attempts to remove its new copy.

The committed fixtures are small original, non-playable headers constructed in
`packages/data/tests/rofl-fixtures.ts`. No real replay, extracted user metadata or game packet asset
is committed. Tests establish parser and import behavior; current-client compatibility has not been
checked with a live or freshly captured replay.
