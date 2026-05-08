---
description: Guidelines for working through coding task lists
globs:
alwaysApply: false
---
# Working Through Task Lists

## Execution Protocol

### Default Mode (One at a time)
- **One sub-task at a time:** Do NOT start the next sub-task until user says "yes" or "y"
- Stop after each sub-task and wait for go-ahead

### Batch Mode
If user says "batch", "do a few", or similar:
- Execute 2-3 related sub-tasks before pausing
- Summarize what was done and pause for approval
- Return to default mode after batch completes

## Task Marking

### Completion States

| Marker | Meaning | When to use |
|--------|---------|-------------|
| `[ ]` | Pending | Not started |
| `[x]` | Complete | Fully done, tests pass |
| `[~]` | Skipped | Not needed, with reason |
| `[/]` | Partial | In progress, needs more work |

### Examples
```markdown
- [x] 2.1 Create UserProfile component
- [~] 2.2 Add avatar upload - Skipped: using external service instead
- [/] 2.3 Write unit tests (3 of 5 tests done)
- [ ] 2.4 Add error handling
```

### Marking Rules
1. When you finish a sub-task, immediately mark it `[x]`
2. When ALL sub-tasks under a parent are `[x]` or `[~]`, mark the parent `[x]`
3. When skipping, always add reason after the dash: `[~] Task - Reason`
4. For partial completion, note progress in parentheses

## Coding Workflow

### Before Starting a Sub-Task
1. Read relevant existing code first
2. Check if there are related tests to understand expected behavior
3. Check for colocated `DOCS.md` in the directory you're about to modify — it may have conventions to follow
4. If it's a Clarify task, ask the question and wait for answer

### After Completing a Sub-Task
1. Run relevant tests if they exist
2. Note any files created or modified in the Relevant Files section
3. Mark the task complete
4. Wait for user approval before continuing

### Commit Guidance
- Don't commit automatically unless asked
- Each completed parent task is typically a good commit point
- Keep commits focused on the task at hand

## Blockers Log

When you encounter a blocker during execution, add it to a `### Blockers` section under Notes:

```markdown
### Blockers

- **2024-01-15:** Waiting on API endpoint from backend team
- **2024-01-16:** Need design specs for error states, using placeholder
```

Continue with other tasks if possible. Return to blocked tasks when resolved.

## Maintenance

1. **Update as you work:**
   - Mark tasks complete per protocol above
   - Add new tasks as they emerge
   - Log blockers when encountered

2. **Keep "Relevant Files" current:**
   - List every file created or modified
   - One-line description for each

## Finalization

### Test Gate (mandatory)

**Every commit must have passing tests.** Before finalization (and before any commit):

1. Run the full test suite (`pnpm turbo test` or project equivalent)
2. If **any** test fails — even tests unrelated to your changes — you **cannot** finalize or commit
3. Instead: add a new sub-task under the current (or a new) parent task to fix the failing test(s)
4. Mark the parent task `[/]` partial until the test fix sub-task is `[x]`
5. Only proceed to finalization once all tests pass

This applies regardless of whether the failure was introduced by this task or was pre-existing.

### Detecting Completion

After marking any task complete:

1. **Count status:** Total parent tasks vs completed parent tasks
2. **Run full test suite:** All tests must pass (see Test Gate above)
3. **Check for 100%:** If all parent tasks are `[x]` and tests pass, trigger finalization
4. **Ask user:** "All tasks complete. Should we finalize this task list?"

### Finalization Workflow

When user confirms (responds "y" or "yes"):

1. **Add TL;DR to Context section:**

   At the end of the `# Context` section, add:
   ```markdown
   ## TL;DR

   **Completed:** [Date]

   **What we built:**
   - [1-3 bullet summary of main accomplishments]

   **What changed along the way:**
   - [Any scope changes, pivots, or discoveries]

   **Skipped/Deferred:**
   - [Any tasks skipped and why, or "None"]
   ```

2. **Add metadata** to top of file:
   ```markdown
   ---
   STATUS: COMPLETED
   COMPLETED_DATE: 2024-01-15
   FEATURE: [feature-name]
   ---
   ```

3. **Append to changelog** (`tasks/done/CHANGELOG.md`):
   - Add one line under today's date heading: `- feat/fix/chore: [concise summary] — [link to task file]`
   - Link the completed task file so readers can find deeper context
   - If today's date heading doesn't exist yet, create it
   - Example:
     ```markdown
     ## 2024-01-15
     - feat: Company insights primitive — table, CRUD API, agent auto-injection, eval queries ([task](tasks/done/2024-01-15_tasks-insights.md))
     ```

4. **Documentation audit:** Before committing, verify docs are up to date:
   - Check `docs/` for any general docs impacted by the work (DB schema, architecture, deployment)
   - Check colocated `DOCS.md` files in modified packages/directories
   - Update root `CLAUDE.md` if test counts or doc index changed
   - If the task list didn't include a doc update task but docs are stale, update them now

5. **Commit:** Create a git commit with all changes from this task list
   - Run the full test suite first — do not commit if any test fails
   - Use a descriptive commit message summarizing the work done
   - The pre-commit hook will run build + tests automatically as a safety net

6. **Move file:**
   - From: `/todo/tasks-[feature].md`
   - To: `/done/YYYY-MM-DD_tasks-[feature].md`

7. **Confirm:** "Completed on [date]. Files moved to done folder."

## Working Instructions

1. **Before starting:** Check which sub-task is next
2. **After each sub-task:** Update file, run tests if applicable, pause for approval
3. **When blocked:** Log blocker, move to next unblocked task
4. **When skipping:** Mark `[~]` with reason, continue
5. **After marking complete:** Check if ALL parent tasks are now `[x]`
6. **New requirements:** Add to task list and continue workflow

## Error Handling

- If file movement fails, keep originals and report error
- If user declines finalization, continue normal workflow
- If tests fail, keep task as `[/]` partial until fixed
- If uncertain about completion, ask user to verify
