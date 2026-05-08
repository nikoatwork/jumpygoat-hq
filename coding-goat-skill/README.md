# Coding Goat Task Manager

A Claude Code skill for structured task management in coding projects. Break down features into actionable task lists and implement them incrementally with AI assistance.

## Why Use This?

Most AI coding interactions are one-shot: you ask for a feature, it generates code, done. But real development is iterative - features need planning, edge cases need handling, tests need writing, and code needs reviewing.

This skill brings structure to AI-assisted development:

- **Break down features** into parent tasks and sub-tasks
- **Execute incrementally** with approval checkpoints between steps
- **Track progress** with markdown task lists you can review
- **Include tests** in the workflow naturally
- **Archive completed work** for future reference

## Prerequisites

- [Claude Code](https://claude.ai/download) installed
- Anthropic API key configured (or Claude Max subscription)

## Installation

Copy the `coding-goat-skill` folder into your project's `.claude/skills/` directory:

```
your-project/
├── .claude/
│   └── skills/
│       └── coding-goat-skill/
│           ├── SKILL.md
│           └── resources/
│               ├── how-to-create-task-list.md
│               └── how-to-work-task-list.md
├── todo/
├── done/
└── src/
```

Or clone directly:

```bash
mkdir -p .claude/skills
cp -r /path/to/coding-goat-skill .claude/skills/
```

## Folder Structure

Create two folders in your project root:

```bash
mkdir todo done
```

- **`/todo`** - Active task lists live here (e.g., `tasks-user-auth.md`)
- **`/done`** - Completed task lists are archived here with date prefix (e.g., `2024-01-15_tasks-user-auth.md`)

## Quick Start

### 1. Create a Task List

Start with a brain dump or brief. Create a file in `/todo/`:

```markdown
# todo/tasks-user-settings.md

Need to add a user settings page. Should include:
- Profile editing (name, email)
- Password change
- Notification preferences
- Delete account option

Use the existing UI components. Need tests.
```

Then tell Claude:

> "Create a task list from @todo/tasks-user-settings.md"

Claude will:
1. Ask 1-3 clarifying questions
2. Generate parent tasks (wait for your "Go")
3. Break down into sub-tasks with Clarify questions
4. Save the structured task list

### 2. Work Through Tasks

Tell Claude:

> "Let's work on @todo/tasks-user-settings.md"

Claude will:
1. Pick up the next incomplete sub-task
2. Execute it (write code, run tests)
3. Mark it complete and pause
4. Wait for your "y" to continue

### 3. Complete and Archive

When all tasks are done, Claude will prompt:

> "All tasks complete. Should we finalize this task list?"

Say "y" and the file moves to `/done/2024-01-15_tasks-user-settings.md` with completion metadata and a TL;DR summary.

## Tips

- **Be messy in your brief** - Brain dumps are fine. Claude will ask clarifying questions and structure it for you.
- **Review parent tasks before "Go"** - This is your checkpoint to adjust scope before diving into details.
- **Answer the Clarify questions** - They prevent misaligned implementations.
- **Use batch mode for simple tasks** - Say "batch" to let Claude do 2-3 sub-tasks before pausing.
- **Reference files with @** - Use `@todo/tasks-xyz.md` to point Claude to specific task lists.
- **Tests are part of the flow** - Claude will run tests after relevant changes.

## Key Features

- Two-phase task creation: parent tasks first, sub-tasks after "Go"
- Each parent task starts with a Clarify question to prevent misaligned implementations
- Task marking states: `[ ]`, `[x]`, `[~]` (skipped), `[/]` (partial)
- Blockers log for tracking impediments
- Batch mode for faster execution
- Test-running integrated into the workflow
- Auto-finalization with TL;DR summary when complete
