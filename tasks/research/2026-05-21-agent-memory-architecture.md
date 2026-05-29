# Research brief: markdown-native agent memory architecture

Date: 2026-05-21
Updated: 2026-05-29
Status: research / architecture direction, not implementation-ready by itself

## Research question

How should jumpyGoatHq evolve from simple private Markdown memory into a small, useful, portable memory system for coding agents while staying auditable, local-first, and potentially extractable as an npm package?

The target is not merely “a Markdown notes folder.” A useful memory layer should cover some combination of:

- automatic capture from agent sessions or transcripts
- durable, human-readable memory files
- indexing and semantic/keyword recall
- compression/distillation of raw experience
- staleness, supersession, and conflict handling
- bounded hot-cache rendering for prompt injection
- install/injection paths that work in an arbitrary repo

## Current direction: memsearch-style, TypeScript-first

The preferred direction is now **memsearch-style**:

1. Install a package/CLI once, ideally via npm or `npx`.
2. Wire agent hosts through plugins/hooks/MCP/skills, not by adding a dependency to every app repo.
3. Store canonical memories as Markdown in or near the working repo/workspace.
4. Treat search indexes and ranking state as rebuildable shadow state.
5. Capture agent conversations automatically through host hooks when available.
6. Recall through explicit slash command/tool calls first; only auto-inject small hot-cache context when the budget and safety tradeoff are clear.

This differs from the earlier plan that put memory primarily under `workspace/agents/<agent>/memory/`. Agent-local memory is still useful for jumpyGoatHq-owned agents, but the more portable package shape should be repo/workspace-local memory with host adapters.

## Core architectural decision

Use a **Markdown source-of-truth + rebuildable index + optional hot cache** stack.

```text
agent host hooks / transcripts
  -> capture/summarize
  -> repo/workspace-local Markdown memory files
  -> SQLite / QMD / hybrid shadow index
  -> recall: search -> expand -> source/provenance
  -> optional generated hot cache for prompt injection
```

Markdown remains canonical. SQLite/QMD/vector state is derived. If the index is lost, rebuild it from Markdown. If Markdown is lost, memory is lost.

## What not to assume yet

Keep these uncertain until implementation research proves them:

- Exact repo-local directory name: `.jumpygoat/`, `.jumpygoathq/`, `.memory/`, or configurable.
- Whether canonical memory should be committed by default or gitignored by default.
- Whether per-agent isolation should be encoded by directory, frontmatter, or both.
- Whether QMD is the right first semantic backend versus SQLite FTS/BM25 first.
- Whether an npm package should ship a long-running daemon, a CLI-only tool, an MCP server, or all three.
- Whether automatic context injection should be enabled by default. Existing projects show this can burn tokens quickly.
- How much memory extraction should rely on LLM summaries versus deterministic capture and later compaction.
- Whether jumpyGoatHq should write into arbitrary app repos, or only into a user-owned jumpyGoatHq home with a project key.

## Design principles

- **Markdown-native:** durable memory bodies are readable, greppable, diffable, editable, and portable.
- **Repo/workspace-aware:** default scope is the current git repo or explicit workspace root.
- **Private by default:** do not leak memories across repos, agents, or users unless explicitly configured.
- **Index is disposable:** search state, embeddings, recall counters, and cache state can be rebuilt or recomputed.
- **No deletion by default:** forgetting usually means lower rank, stale status, or supersession, not erasure.
- **Supersede, don’t rewrite history:** old memory can be marked stale/superseded while preserving provenance.
- **Hot cache is generated:** prompt-sized files/blocks are not canonical; they are rendered from current memory state.
- **Adapters are separate from the engine:** the core package should know Markdown, indexes, and recall APIs; host adapters know Claude/Codex/pi/OpenCode hook formats.
- **Surface provenance:** recalled snippets should identify source file/section/session when possible.
- **Benchmark retrieval claims:** do not rely on aesthetics alone; measure recall, stale-memory errors, latency, and token cost.

## Proposed storage layout

Exact names are undecided. A memsearch-inspired npm package could default to something like:

```text
.<tool-name>/
  memory/
    2026-05-29.md          # daily summarized session journal
    project.md             # optional durable project facts
    user.md                # optional user preferences, if user permits
    agents/
      operator.md          # optional agent-specific notes
    entries/
      mem_<id>.md          # optional structured entries for extracted facts
  hot.md                   # generated, prompt-sized hot cache
  index.sqlite             # rebuildable local shadow index, maybe gitignored
  config.json              # local project config
```

Alternative for jumpyGoatHq-only integration:

```text
jumpyGoatHqHome()/memory/<project-id>/...
jumpyGoatHqHome()/agents/<agent>/memory.md     # generated hot cache for that agent
```

Decision needed: writing into arbitrary repos is more memsearch-like and user-friendly for coding agents, but jumpyGoatHq surfaces must respect the constraint that chat/browser/Slack mutate only user-owned workspace content through domain services.

## Memory layers

| Layer | Purpose | Canonical? | Candidate storage |
|---|---|---:|---|
| Raw experience | transcripts, tool events, run logs | sometimes | host transcript stores, JSONL, jumpyGoatHq DB |
| Daily/session journal | compressed turn summaries | yes | `memory/YYYY-MM-DD.md` |
| Structured entries | extracted facts/decisions/preferences | yes | `memory/entries/*.md` with frontmatter |
| Project/user summaries | compact durable summaries | yes-ish | `project.md`, `user.md`, or generated from entries |
| Hot cache | prompt-sized current context | no | `hot.md` / `memory.md` generated file |
| Search index | keyword/vector chunks | no | SQLite/QMD/Milvus/etc. |
| Recall state | counts, recency, salience, decay | no | SQLite |

## Minimal frontmatter candidate

For structured entry files:

```yaml
id: mem_20260529_001
scope: repo | agent | user
project: jumpygoat-hq
agent: operator
kind: observation | summary | core | decision | preference
created_at: 2026-05-29T10:00:00Z
source_type: chat | automation | manual | import
source_sessions: [chat_abc]
source_runs: []
tags: [architecture, memory]
confidence: low | medium | high | stale
salience: low | medium | high
superseded_by: null
consolidated_into: null
```

Likely keep volatile fields out of Markdown unless checkpointed periodically:

- `observed_count`
- `recalled_count`
- `last_seen_at`
- `last_recalled_at`
- dynamic salience/decay score
- embedding/index hashes

## SQLite / shadow state candidate

SQLite can support filtering and weighted ranking that Markdown/frontmatter alone handles poorly:

```sql
memory_entries (
  id text primary key,
  scope text not null,
  project_id text not null,
  agent_id text,
  path text not null,
  kind text not null,
  confidence text not null,
  salience text,
  salience_score real not null default 0,
  decay_score real not null default 0,
  tags_json text not null default '[]',
  created_at text not null,
  last_seen_at text,
  last_recalled_at text,
  observed_count integer not null default 1,
  recalled_count integer not null default 0,
  superseded_by text,
  consolidated_into text,
  body_hash text,
  indexed_at text
);

memory_recall_events (
  id text primary key,
  memory_id text not null,
  query text,
  retrieval_context text,
  recalled_at text not null,
  used boolean,
  score real
);
```

Uncertainty: for a memsearch-like MVP, SQLite may start as a pure index/cache and not yet include salience/decay. That is acceptable if the API leaves room for it.

## Recall model

Start with progressive recall:

1. Search memory chunks by keyword/semantic query.
2. Expand a result to its surrounding Markdown section/file.
3. Optionally trace back to source transcript/session if stored.
4. Return bounded context with provenance.

Ranking should eventually combine semantic/keyword relevance with memory state:

```text
final_score =
  semantic_or_hybrid_score
  + confidence/salience adjustment
  + recency or decay adjustment
  - stale/superseded penalty
```

Do not hard-code unproven weights. Start simple and benchmark.

## Capture and compression model

A memsearch-style capture path is:

```text
host stop/session hook
  -> parse last turn or transcript delta
  -> summarize durable content with host LLM or configured provider
  -> append to today's Markdown journal
  -> index changed Markdown chunks
```

Possible later passes:

- **Extract:** turn recent journals into structured facts/decisions/preferences.
- **Consolidate:** merge repeated observations into summaries/core memories.
- **Decay:** lower rank of old unrecalled/unreinforced memories without deleting them.
- **Supersede:** mark contradicted memories stale and link replacements.
- **Render hot cache:** produce a small prompt block from high-confidence/high-salience current memory.

Key safety rules:

- Skip secrets, credentials, tokens, and one-off guesses.
- Prefer durable preferences, architecture facts, recurring gotchas, and decisions.
- Reinforce existing similar memory before creating duplicates.
- Mark contradictions conservatively; stale should mean contradicted or obsolete, not merely old.

## Injection model

Observed patterns:

- MCP tools make memory available when the model chooses to call them.
- Slash commands/skills make recall explicit and debuggable.
- Hooks can auto-capture telemetry and transcript deltas.
- Hooks can auto-inject by writing context to stdout in some hosts, but this can silently increase token use.
- Hot-cache injection is useful only if bounded, current, and observable.

Recommended order:

1. Capture automatically if host hooks allow it.
2. Provide explicit recall/search commands first.
3. Generate a small hot cache but do not inject it everywhere by default until token cost is measured.
4. Add opt-in auto-injection per repo/agent with strict budgets and provenance labels.

## npm package shape

A TypeScript-first package could expose:

```ts
interface Experience {
  id: string;
  projectId: string;
  agentId?: string;
  sourceType: string;
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface MemoryEngine {
  capture(experience: Experience): Promise<CaptureResult>;
  index(options?: IndexOptions): Promise<IndexResult>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  expand(resultId: string, options?: ExpandOptions): Promise<ExpandedMemory>;
  renderHotCache(options?: HotCacheOptions): Promise<string>;
}
```

Package surfaces could be split:

- `@jumpygoat/memory` or similar: core engine library.
- CLI: `jumpy-memory index/search/capture/compact/config`.
- MCP server: exposes search, remember, expand, forget/stale tools.
- Host adapters: Claude Code plugin, Codex plugin, pi extension, OpenCode plugin.

Uncertainty: package naming and scope should wait until an internal prototype proves value.

## Competitor / adjacent project findings

### Summary table

| Project | Install model | Canonical storage | Capture/injection | Strongest lesson | Uncertainty / gap |
|---|---|---|---|---|---|
| memsearch | Python CLI + host plugins | Markdown files; Milvus shadow index | hooks capture turns; slash/tool recall | best fit for desired UX: repo-local Markdown + plugins | uses Python/Milvus; decay/supersession not central |
| memweave | Python library/CLI | Markdown + SQLite | app/agent calls API manually | small Markdown+SQLite retrieval substrate with decay/MMR | not an end-to-end agent hook system |
| agentmemory | npm daemon + plugins/MCP | runtime/server oriented; Markdown unclear | broad hooks, MCP, stdout injection | mature operational integration across agents | less aligned with Markdown as source of truth |
| ClawVault | npm CLI, explicit vault | Markdown vault | CLI context/inject; observer/compressor | structured vault, fact extraction, conflict-aware design | auto host injection less clear; decay unclear |
| Memory MCP / hot-memory | Python MCP + Claude plugin | SQLite/MCP oriented | hot cache auto-injected | explicit hot-cache/promotion model | Markdown-native weak/unclear |
| MemPalace | Python CLI/MCP | palace/vector backend, verbatim drawers | mine/sweep/wake-up/hooks | verbatim retention + high-recall retrieval can beat summaries | not Markdown-first |
| sqlite-memory | SQLite extension/CLI | SQLite core, Markdown-aware | building block | useful lower-level FTS/vector/file sync ideas | not a full memory system |
| YourMemory | Python/MCP | DuckDB/vector oriented | MCP workflow | forgetting curve and replacement semantics | non-commercial license; not Markdown-first |

### memsearch

- GitHub: https://github.com/zilliztech/memsearch
- Docs: https://zilliztech.github.io/memsearch/
- PyPI: https://pypi.org/project/memsearch/

Relevant architecture:

- Markdown is source of truth.
- Daily `.md` memory files are appended by plugins.
- Milvus is a rebuildable shadow index.
- Plugins exist for Claude Code, OpenClaw, OpenCode, Codex CLI.
- Hooks capture conversation turns automatically.
- LLM summaries are appended to Markdown files.
- Retrieval is progressive: search -> expand -> transcript.
- Search is hybrid: BM25 + dense vector + RRF.
- File watcher and SHA-256 hashing avoid unnecessary re-indexing.
- Advanced project/user review files can be generated in the background.

Why it matters: this is the closest UX target for an npm package, except the implementation language/backend differs.

Open questions for us:

- Do we need a vector DB at all, or can SQLite/QMD be enough?
- Should daily journals be the only canonical memory at first, with structured entries later?
- What host adapters are worth building first: pi, Codex, Claude, OpenCode?

### memweave

- GitHub: https://github.com/sachinsharma9780/memweave
- PyPI: https://pypi.org/project/memweave/

Relevant architecture:

- Plain Markdown files are source of truth.
- Local SQLite index uses FTS5 and sqlite-vec.
- Hybrid search combines BM25 and vector scores.
- Temporal decay ranking and MMR reranking are built in.
- Agent namespaces are path-derived.
- Embedding cache and file hash detection reduce churn.
- CLI supports index/add/files/search/stats.

Why it matters: best small substrate model for TypeScript to emulate if we want zero external services.

Reported benchmarks:

- LongMemEval-S held-out: 98.00% R@5, 99.11% R@10, 93.75% NDCG@5.
- 5-seed cross-validation: 97.24% R@5 mean.

Uncertainty: independent reproduction is required before using these as target claims.

### agentmemory

- GitHub: https://github.com/rohitg00/agentmemory
- npm: https://www.npmjs.com/package/@agentmemory/agentmemory
- Site: https://agent-memory.dev/

Relevant architecture:

- Install globally or run with `npx @agentmemory/agentmemory`.
- Runs a local memory server on `localhost:3111` and viewer on `3113`.
- `agentmemory connect <agent>` writes MCP config for some hosts.
- Claude/Codex plugins register hooks, skills, and MCP.
- Hooks observe prompt/tool/session events.
- Some hooks can write recalled context to stdout for prompt injection.
- Project identity is inferred from cwd/git root basename, overrideable with env.
- It supports many agents and imports old transcripts.

Why it matters: strongest reference for installation and host wiring, but not the preferred canonical storage model.

Important caution: auto-injection via hooks can create token surprises. In agentmemory, some context injection is opt-in via env because pre-tool enrichment was costly.

### ClawVault

- Website: https://clawvault.dev/
- npm: https://www.npmjs.com/package/clawvault
- GitHub: https://github.com/Versatly/clawvault

Relevant architecture:

- Local-first Markdown vault.
- Structured categories: decisions, lessons, people, projects, tasks, handoffs, inbox.
- Session watcher / observer compressor.
- Fact extraction at write time.
- Entity graph and wiki-link graph.
- Conflict resolution / deduplication.
- Hybrid search: BM25 + semantic embeddings + RRF.
- Context profiles: default, planning, incident, handoff.
- CLI primitives: `wake`, `sleep`, `checkpoint`, `remember`, `capture`, `context`, `inject`.

Why it matters: strong structured Markdown memory model and npm precedent.

Uncertainty: current docs do not make decay or automatic host-level injection as clear as memsearch/agentmemory.

### Memory MCP / hot-memory

- GitHub: https://github.com/michael-denyer/memory-mcp
- PyPI: https://pypi.org/project/hot-memory-mcp/

Relevant architecture:

- Two-tier memory: hot cache auto-injected, cold semantic search by tool.
- Promotion after repeated usage; demotion after staleness/unused period.
- Trust scoring.
- Project-aware isolation by repo.
- Knowledge graph and pattern mining.
- Local SQLite.
- MCP server, Claude Code plugin, dashboard.

Why it matters: best source of hot-cache mechanics.

Uncertainty: Markdown source-of-truth is weak/unclear.

### MemPalace

- GitHub: https://github.com/MemPalace/mempalace
- Docs: https://mempalaceofficial.com/

Relevant architecture:

- Stores conversation/project history as verbatim text rather than summary-first memory.
- Palace hierarchy: wings, rooms, halls, tunnels, drawers, closets.
- Default retrieval backend is ChromaDB; backend is pluggable.
- Semantic search is scoped by metadata.
- Temporal entity-relationship knowledge graph uses SQLite validity windows/invalidation.
- MCP tools cover reads/writes, graph ops, navigation, drawers, diaries.
- Hooks auto-save Claude Code sessions and before compaction.
- Benchmarks are strong.

Why it matters: do not over-compress too early; verbatim retention plus good retrieval can perform very well.

Reported benchmarks:

- LongMemEval raw semantic search: 96.6% R@5.
- LongMemEval Hybrid v4 held-out: 98.4% R@5.
- LoCoMo hybrid v5 top-10: 88.9% R@10.
- ConvoMem avg recall: 92.9%.
- MemBench R@5: 80.3%.

Uncertainty: not Markdown-first, so storage model is less aligned.

### sqlite-memory

Useful as a lower-level idea source:

- Markdown-aware chunking.
- Hybrid vector + FTS5.
- Local embeddings through llama.cpp.
- SQL interface.
- Content-hash change detection.
- Transactional file/directory sync.
- Offline-first sync ideas.

Gap: not a full capture/compression/hot-cache memory system.

### YourMemory

Useful ideas:

- Ebbinghaus-style forgetting curve.
- Strength score with recall reinforcement.
- Categories with different decay rates.
- Update/replace with audit trail.
- Subject-aware deduplication.

Gap: not Markdown-first, and licensing appears non-commercial in docs, so avoid code reuse unless license is clarified.

## Benchmarks to run

### Primary benchmark candidates

1. **LongMemEval / LongMemEval-S**
   - GitHub: https://github.com/xiaowu0162/LongMemEval
   - Data: https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
   - Paper: https://arxiv.org/abs/2410.10813
   - Tests information extraction, multi-session reasoning, knowledge updates, temporal reasoning, abstention.
   - Good first retrieval benchmark.
   - Metrics: Recall@5, Recall@10, NDCG@5, downstream QA with fixed reader.

2. **MemEval**
   - GitHub: https://github.com/ProsusAI/MemEval
   - Standardizes LoCoMo + LongMemEval evaluation.
   - Tracks quality and token cost.
   - Baselines include PropMem, OpenClaw, Full Context, Hindsight, Graphiti, SimpleMem, Mem0, Memory-R1, MemU.
   - Useful for end-to-end quality/cost claims.
   - Previously observed README targets: LoCoMo top PropMem F1 0.605 / judge 0.823 / 5.9M tokens; LongMemEval top PropMem F1 0.550 / judge 0.716 / 23.1M tokens. Reconfirm before citing.

3. **LongMemEval-V2**
   - GitHub: https://github.com/xiaowu0162/LongMemEval-V2
   - Data: https://huggingface.co/datasets/xiaowu0162/longmemeval-v2
   - Leaderboard: https://xiaowu0162.github.io/longmemeval-v2/#leaderboard
   - Paper: https://arxiv.org/abs/2605.12493
   - More agentic/contextual benchmark with workflow knowledge and environment gotchas.
   - Useful after MVP retrieval works.

4. **LoCoMo**
   - Project: https://snap-research.github.io/locomo/
   - GitHub/data: https://github.com/snap-research/locomo
   - Paper: https://arxiv.org/abs/2402.17753
   - Long conversation memory benchmark.
   - Use through MemEval where possible to avoid metric mismatch.

5. **MemoryAgentBench**
   - GitHub: https://github.com/HUST-AI-HYZ/MemoryAgentBench
   - Data: https://huggingface.co/datasets/ai-hyz/MemoryAgentBench
   - Paper: https://arxiv.org/abs/2507.05257
   - Useful for conflict resolution and test-time learning.
   - Relevant to supersession/stale behavior.

6. **MemBench**
   - ACL page: https://aclanthology.org/2025.findings-acl.989/
   - GitHub: https://github.com/import-myself/Membench
   - arXiv: https://arxiv.org/abs/2506.21605
   - Later-stage benchmark for effectiveness, efficiency, and capacity.

7. **LMEB**
   - Paper: https://arxiv.org/abs/2603.12572
   - GitHub: https://github.com/KaLM-Embedding/LMEB
   - Useful for embedding backend selection, not full memory system evaluation.

### Project-specific benchmark plan

MVP phases:

1. Retrieval-only harness over Markdown memories.
   - Compare BM25-only, semantic-only, and hybrid.
   - Metrics: R@5/R@10/NDCG@5/p50/p95 latency.

2. Memory-state ablation.
   - Compare search only vs search + confidence/stale filtering vs search + salience/decay.
   - Directly tests whether memory-state layer adds value over QMD/search alone.

3. Conflict/supersession evaluation.
   - Use knowledge-update subsets or MemoryAgentBench conflict resolution.
   - Track stale-memory error rate.

4. End-to-end answer quality.
   - Use MemEval adapter once search is stable.
   - Track token cost and latency, not just accuracy.

5. Coding-agent workflow corpus.
   - Use jumpyGoatHq task logs, repo decisions, stale decisions, user preferences, recurring gotchas.
   - Track task success, context tokens, memory precision, and stale-memory errors.

### Metrics to report

Quality:

- Recall@5 / Recall@10
- NDCG@5
- QA F1 / judge score
- stale-memory error rate
- supersession correctness

Efficiency:

- ingest latency
- query p50/p95 latency
- index size
- prompt tokens rendered
- extraction/consolidation token cost
- rebuild time from Markdown

Operational properties:

- durable memory recoverable from Markdown alone
- index rebuildable from Markdown
- no Markdown churn on recall
- deterministic hot-cache rendering
- provenance links to files/sections/transcripts
- git diff readability

## Validation ideas

### Capture smoke

- Seed a temporary repo/workspace.
- Simulate a host session transcript with one durable decision, one preference, and one transient/noisy turn.
- Run capture/summarize.
- Verify today's Markdown memory file is created and excludes obvious noise/secrets.

### Index/search smoke

- Seed active and stale Markdown entries.
- Index them.
- Query a relevant topic.
- Verify active relevant memory returns first, stale is excluded by default, and audit mode can include stale.

### Hot-cache smoke

- Seed entries with varying kind/confidence/salience.
- Render hot cache.
- Verify deterministic output, provenance labels, line/token cap, and no stale entries by default.

### Rebuild smoke

- Delete shadow index.
- Rebuild from Markdown.
- Verify search returns equivalent results apart from volatile recall counters.

### Adapter smoke

- Run a fake hook payload through each host adapter.
- Verify it resolves repo/project identity, appends memory, and never blocks the host for more than a short timeout.

## Related research directories

Useful discovery lists, not architecture decisions by themselves:

- Awesome Agent Memory: https://github.com/TeleAI-UAGI/Awesome-Agent-Memory
- Awesome Memory for Agents: https://github.com/TsinghuaC3I/Awesome-Memory-for-Agents
- Awesome AI Memory: https://github.com/IAAR-Shanghai/Awesome-AI-Memory
- GitHub topic `markdown-memory`: https://github.com/topics/markdown-memory
- GitHub topic `ai-memory`: https://github.com/topics/ai-memory
- PulseMCP memory directory: https://www.pulsemcp.com/servers?q=memory

## Recommended near-term plan

1. Prototype a TypeScript `packages/memory` or separate local package with repo-local Markdown storage.
2. Start with CLI commands: `init`, `capture`, `index`, `search`, `expand`, `render-hot`.
3. Use Markdown daily journals as the first canonical memory format; add structured `entries/*.md` only when needed for stale/supersession/hot-cache quality.
4. Use a rebuildable local index. Prefer SQLite/FTS first if it is enough; add QMD/semantic adapter behind an interface.
5. Build the first host adapter for the agent harness we actually use most. For jumpyGoatHq this may be pi; for broader value it may be Codex/Claude-style hooks.
6. Keep context injection explicit at first: slash command/MCP/search output. Make automatic hot-cache injection opt-in.
7. Benchmark retrieval before making claims or adding complex decay/consolidation.
8. Only publish npm after one internal repo and one host adapter prove the APIs.

## Consequences for current jumpyGoatHq tasks

The memory MVP tasks should be adjusted away from “agent folder only” memory and toward a memsearch-style core:

- canonical memories are repo/workspace-local Markdown files;
- jumpyGoatHq agent memory can be an adapter/view over that store;
- index/search state is rebuildable;
- CLI/debuggability comes before background scheduling;
- automatic prompt injection is opt-in and bounded;
- uncertainty about exact path and host adapter should remain explicit in task docs.
