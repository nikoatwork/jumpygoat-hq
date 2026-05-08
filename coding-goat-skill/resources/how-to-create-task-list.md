---
description: Instructions for generating structured task lists for coding projects
globs:
alwaysApply: false
---
# Creating Task Lists for Code

## Purpose

Generate a detailed, step-by-step task list from a brief. The output guides implementation while keeping user outcomes front and center.

## Strategy Context

Before creating tasks, check `docs/STRATEGY.md` for context on:
- What product/company we're building for
- North Star Metric (current business goal)
- Key opportunities (user problems worth solving)

If the strategy file is empty or missing, ask the user for brief context on what they're building. This helps ensure tasks align with bigger picture goals.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `tasks/todo/` folder in project root
- **Filename:** `tasks-[feature].md` (e.g., `tasks-user-auth.md`)

## Process

1. **Check Strategy:** Read `docs/STRATEGY.md` for product context (skip if empty/missing)
2. **Receive Brief:** User points to a brief file or describes what to build
3. **Analyze Brief:** Read and understand the desired outcome
4. **Ask Clarifying Questions:** Ask 1-3 questions to fill gaps. Wait for response.
5. **Create Context Section:** Write the `# Context` section preserving original brief. Summarize if >500 words.
6. **Phase 1 - Parent Tasks:** Generate 4-6 high-level tasks. Say: "Here are the high-level tasks. Ready to generate sub-tasks? Respond 'Go' to proceed."
7. **Wait for "Go":** Pause until user confirms
8. **Phase 2 - Sub-Tasks:** Break each parent into actionable sub-tasks. Include a **Clarify** question as the first sub-task of each parent.
9. **Identify Relevant Files:** List files that will be created or modified, including test files
10. **Save:** Save to `tasks/todo/tasks-[feature].md`

## Output Format

```markdown
# Context

[Original brief content. Summarize if >500 words while preserving key details.]

## Brief

[1-3 sentence description of objective and desired outcome]

## Relevant Files

- `src/components/Feature.tsx` - Main component for this feature
- `src/components/Feature.test.tsx` - Tests for Feature component
- `src/lib/api.ts` - API functions to add/modify
- `src/lib/api.test.ts` - API tests

### Notes

- Run tests with `npm test` or `npx jest [path]`
- Any technical constraints or dependencies

## Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 **Clarify:** [Short question about critical element]?
  - [ ] 1.2 Sub-task description
  - [ ] 1.3 Sub-task description
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 **Clarify:** [Short question]?
  - [ ] 2.2 Sub-task description
- [ ] 3.0 Parent Task Title
  - [ ] 3.1 **Clarify:** [Short question]?
```

## Clarifying Questions

Each parent task should have a **Clarify** sub-task as its first item. This surfaces critical assumptions before execution.

**Purpose:** Reduce risk of wrong implementation by catching misaligned intent early.

**Guidelines:**
- Keep it short (one sentence)
- Be unbiased - don't lead toward an answer
- Focus on the element most likely to cause wrong execution
- Ask about outcomes and behavior, not just implementation

**Examples:**

| Task | Bad Question | Good Question |
|------|--------------|---------------|
| Add user auth | Should I use JWT? | What happens after successful login? |
| Create dashboard | Want a sidebar layout? | What data is most important to show? |
| Build API endpoint | REST or GraphQL? | What should the error response look like? |
| Add form validation | Use Zod? | Which fields are required vs optional? |

## Documentation Audit

Every task list should include a final parent task to update docs impacted by the implementation. Before generating tasks:

1. **Read the project's doc index** (e.g., `CLAUDE.md`) to understand the doc hierarchy
2. **Identify impacted docs** by checking which areas the feature touches:
   - **General docs** (`docs/`) — architecture, database schema, deployment, testing strategy
   - **Colocated docs** (`DOCS.md` in the package/directory being modified) — implementation patterns, module-specific conventions
3. **Add a "Update documentation" parent task** as the last task in the list, with sub-tasks for each impacted doc

### What to check

| If the feature touches... | Check these docs |
|--------------------------|-----------------|
| New DB tables or columns | `docs/DB.md` (schema diagram + table docs) |
| New API routes or endpoints | `docs/architecture.md` (monorepo layout) |
| New modules in a package | Package-level `DOCS.md` (e.g., `packages/agent/DOCS.md`) |
| New env vars or config | `docs/architecture.md` (env vars section) |
| Test count changes | Root `CLAUDE.md` (if it tracks test counts) |
| Deployment changes | `docs/DEPLOY.md` |
| New sub-directory with its own patterns | Create a colocated `DOCS.md` in that directory |

### Example task

```markdown
- [ ] 6.0 Update documentation
  - [ ] 6.1 Update `docs/DB.md` — add new tables to schema diagram and column docs
  - [ ] 6.2 Update `packages/agent/DOCS.md` — add section for new module
  - [ ] 6.3 Update `docs/architecture.md` — add new directory to monorepo layout
  - [ ] 6.4 Update `CLAUDE.md` — update test counts if changed
```

**Do NOT** create documentation tasks for trivial changes (bug fixes, config tweaks). Only include when the feature adds new concepts, tables, modules, or API surfaces that a future developer would need to discover.

## Coding-Specific Considerations

When generating tasks for code:

1. **Include test tasks** - If the project has tests, include sub-tasks for writing/updating tests
2. **Consider existing patterns** - Reference existing code patterns in clarifying questions
3. **Think about edge cases** - Include sub-tasks for error handling and edge cases
4. **Keep PRs reviewable** - Structure tasks so each could be a reasonable commit
5. **Visual check for frontend work** - If the feature adds or changes UI pages, add a sub-task under the last parent to visually verify with the project's Playwright debug script (check `CLAUDE.md` for the command). A screenshot confirms layout, data loading, and empty states without a full E2E suite.
6. **Log critical user-facing errors** - If the feature has failure points that directly impact a user's experience (e.g., sign-up fails, payment fails, data import breaks), add a sub-task to log those with `logger.error()` or `logger.success()` from `libs/monitoring/logger`. Always include the user's email in the log data so we can proactively reach out or investigate their account. Don't log routine/internal errors — only the ones where a real person is stuck.

## Interaction Model

1. **After analyzing input:** Ask 1-3 clarifying questions. Wait before proceeding.
2. **After parent tasks:** Pause for "Go" confirmation before adding sub-tasks.
3. **During execution:** The Clarify sub-task is answered before other sub-tasks begin.

## Target Audience

Assume the reader is a developer who needs clear, actionable steps that connect back to user value.
