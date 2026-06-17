# Local script connector (`script.run`)

`script.run` exposes one Pi tool, `script_run`, for running allowlisted TypeScript scripts bundled inside the active agent folder.

It is for small deterministic workflows that need code close to an agent, for example fetching and normalizing search results, while keeping execution gated and audited.

## Gates

Both gates are required:

1. Agent frontmatter includes `script.run` in `allowedIntents`.
2. Agent or automation frontmatter enables `scripts.run` with `connector: local-script` and an `allow` list.

Example:

```yaml
allowedIntents:
  - script.run

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
```

## Script location and path rules

Scripts must live under the active agent bundle:

```text
workspace/agents/<agent>/scripts/*.ts
workspace/agents/<agent>/state/        # recommended durable state when write: true
```

`script_run` accepts only relative `.ts` or `.tsx` paths under `scripts/`:

```json
{ "script": "scripts/search-immoscout.ts", "input": { "search": "berlin-apartments" } }
```

Rejected paths include absolute paths, `..`, backslashes, non-TS extensions, unallowlisted scripts, and symlinks that resolve outside the agent folder.

## Script contract

- Runs with `tsx` from the runner environment.
- Current working directory is the agent folder.
- Receives JSON input on stdin.
- Writes result text or JSON to stdout.
- May write persistent state only when `write: true`; keep it under the agent folder, preferably `state/`.
- Keep output bounded; the connector truncates stdout/stderr before returning content to Pi.

Scripts receive a minimal inherited process environment (`PATH`, home/temp/user/locale basics, and `NODE_OPTIONS` when present) plus jumpyGoatHq metadata. Useful environment variables provided to scripts:

- `JUMPYGOATHQ_AGENT_DIR`
- `JUMPYGOATHQ_SCRIPT_PATH`
- `JUMPYGOATHQ_SCRIPT_REAL_PATH`
- `JUMPYGOATHQ_SCRIPT_NETWORK`
- `JUMPYGOATHQ_SCRIPT_WRITE`
- `JUMPYGOATHQ_SCRIPT_TIMEOUT_MS`
- `JUMPYGOATHQ_SCRIPT_INPUT=stdin-json`

## Safety model and limitations

`script.run` is a governed connector, not an agent-local bypass. The runner gates registration, validates paths/allowlists, resolves symlinks, sets the agent folder as cwd, bounds runtime and output, and records compact connector summaries with script path, exit code, duration, output chars, truncation, and network/write flags.

V1 does not provide OS-level network or filesystem sandboxing. `network: true` and `write: true` are explicit policy flags and audit metadata; scripts must honor them. Scripts receive bounded runtime metadata such as `JUMPYGOATHQ_AGENT_DIR`, `JUMPYGOATHQ_REPO_ROOT`, and script path flags, but do not receive full runner secrets by default; pass secrets through your own reviewed runtime mechanism if a script genuinely needs them. Keep agent folders private, review scripts before enabling them, and do not store secrets in markdown.

Run `pnpm run doctor` to verify `tsx` is available.
