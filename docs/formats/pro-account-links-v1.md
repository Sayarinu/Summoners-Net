# Pro account links, version 1

Import this UTF-8 JSON file from **Sources & imports → Import pro account links**. The browser
uploads it only to the local application, which queues a worker job. The worker validates the entire
file and resolves exact stored source IDs before one transaction writes any links. A malformed row,
unknown player or conflicting target rejects the whole file. The job reports the failing field or
one-based link number, and previous links remain unchanged. Field paths such as `links.0.evidence`
use zero-based JSON array indexes.

## Shape

The following is an illustrative placeholder, not evidence of any real account's ownership. Replace
the PUUID, source ID and URL with corroborated values from your sources before importing.

```json
{
  "formatVersion": 1,
  "links": [
    {
      "puuid": "replace_with_the_exact_Riot_API_PUUID",
      "player": { "source": "pandascore", "sourceId": "123" },
      "evidence": [
        {
          "url": "https://example.invalid/source-identifying-the-account",
          "note": "Explain how this source identifies the account and the pro player."
        }
      ]
    }
  ]
}
```

| Field             | Contract                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatVersion`   | Number `1`. Unknown versions are rejected.                                                                                                              |
| `links`           | Between 1 and 10,000 link objects; each PUUID appears once.                                                                                             |
| `puuid`           | Exact Riot API PUUID, 20–100 letters, digits, underscores or hyphens. Riot IDs and player names are not substitutes.                                    |
| `player.source`   | `pandascore` or `oracle`.                                                                                                                               |
| `player.sourceId` | A nonempty source ID string up to 300 characters, after trimming surrounding whitespace. The corresponding player must already exist in the local data. |
| `evidence`        | Between 1 and 5 objects with a supporting `url` and optional `note`.                                                                                    |
| `evidence[].url`  | HTTP(S) URL up to 2,048 characters, without embedded username/password credentials.                                                                     |
| `evidence[].note` | Optional nonempty explanation, at most 1,000 characters after trimming whitespace.                                                                      |

The whole file is limited to **5 MiB**, independent of the row and string limits. Unknown fields are
rejected at every object level. Text must contain valid Unicode characters and no NUL. Numeric
source IDs must still be JSON strings. Use source IDs from stored provider data, not a profile slug,
display name or a guessed match. Oracle IDs beginning with `observation:` are match-scoped fallback
observations and are not eligible link targets. Team IDs cannot stand in for player IDs.

## Evidence and identity

A source URL should directly support the account-to-player relationship, for example an account
listed by the player or their team. Include a note explaining that relationship when it is not
obvious. The importer checks structure, exact source identity and conflicts; it **does not fetch
URLs or independently verify ownership**. These are imported assertions with preserved evidence, not
system-verified ownership badges. No name matching or provider requests occur during import.

One PUUID links to one source player. Several accounts may link to the same player. A newer file may
update the evidence for an existing account-to-player pair; its supplied evidence array replaces the
previous array. Trying to switch an existing PUUID to a different source player rejects the file and
requires reviewing the conflicting evidence outside this importer. There is no automatic conflict
resolution or deletion operation. Links absent from a newer file are retained.

The stored record preserves the source player identity, evidence, format version, source file
SHA-256 and import timestamp. Its current public player name and local profile decoration can change
as provider data is refreshed; that never changes the original source ID used for the link. Uploaded
files are private staged files under the ignored `.local/imports` directory. Do not commit actual
link files or extracted account data. Committed tests use constructed evidence fixtures only.
