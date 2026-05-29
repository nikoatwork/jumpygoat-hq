# Example: real-estate search agent with `script.run`

This is a documentation-only sketch. Do not commit personal search criteria, API tokens, cookies, or private listing data.

## Agent bundle layout

```text
workspace/agents/real-estate-searcher/
  AGENT.md
  scripts/search-immoscout.ts
  state/listing-log.json
```

## `AGENT.md`

```markdown
---
name: real-estate-searcher
description: Finds new real-estate listings and summarizes changes.
allowedIntents:
  - script.run
  - mail.send
scripts:
  run:
    enabled: true
    connector: local-script
    allow:
      - scripts/search-immoscout.ts
    network: true
    write: true
    timeoutMs: 60000
    maxOutputChars: 12000
mail:
  send:
    enabled: false
    connector: agentmail
    inboxId: agent@agentmail.to
    to: operator@example.com
    subjectPrefix: "[listings] "
---

Run the allowlisted listing search script, identify new or meaningfully changed listings, and send a concise summary only when useful.
```

## Script input/output sketch

`script_run` call:

```json
{
  "script": "scripts/search-immoscout.ts",
  "input": {
    "search": "berlin-apartments",
    "maxListings": 25
  }
}
```

Expected stdout shape:

```json
{
  "search": "berlin-apartments",
  "newListings": [
    {
      "id": "listing-123",
      "title": "2-room apartment near transit",
      "url": "https://example.invalid/listing-123",
      "price": "1200 EUR",
      "notes": ["new today", "matches commute filter"]
    }
  ],
  "changedListings": [],
  "seenCount": 25
}
```

## Persistent state convention

When `write: true`, keep durable state under the same agent folder, for example:

```json
// state/listing-log.json
{
  "seen": {
    "listing-123": {
      "firstSeenAt": "2026-05-29T08:00:00.000Z",
      "lastSeenAt": "2026-05-29T08:00:00.000Z",
      "fingerprint": "title-price-location"
    }
  }
}
```

## Combining with mail

The agent should use `script_run` for deterministic search/extract/state, then use `mail_send` only for the final human-facing summary:

1. Call `script_run` with the search input.
2. Read the returned JSON/text.
3. If there are new or changed listings, call `mail_send` with a compact digest and links.
4. If there are no changes, finish without email unless the prompt asks for a heartbeat.
