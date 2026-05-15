# Product

## Register

product

## Users

jumpyGoatHq serves technical operators, indie builders, and small-team maintainers who want a local, file-native way to run Pi agents on schedules or from task queues. They use it in short focused sessions: checking what is queued, moving work to ready, running an automation, reviewing a trace, or editing source markdown.

## Product Purpose

jumpyGoatHq is the smallest useful open-source agent operations layer for local Pi agents. It should make agents, automations, boards, tasks, and runs easy to inspect and mutate without hiding the markdown source of truth. Success means an operator can understand what will run, why it ran, what happened, and where to edit the underlying file.

## Brand Personality

Clear, local, capable. The interface should feel like a reliable workshop bench for agent operations: calm, legible, direct, and respectful of technical users. It should not pretend to be a broad workflow suite.

## Anti-references

Avoid generic SaaS dashboards, cyberpunk neon control rooms, glassy AI consoles, card-grid marketing layouts, and workflow-builder complexity. Avoid designs that obscure file paths, cron evidence, raw markdown, trace details, or local safety boundaries.

## Design Principles

1. Show the source of truth. Every UI surface should make it clear which file, schedule, task, or run record is being represented.
2. Prefer task clarity over spectacle. Visual treatment should help operators decide what needs attention and what action is safe.
3. Keep primitives sharp. Agents, automations, boards, tasks, and runs should stay distinct in copy, navigation, and page structure.
4. Progressive enhancement only. The UI must remain usable with server-rendered HTML and form posts before any JavaScript enhancement.
5. Local safety is part of UX. Destructive actions, cron evidence, model settings, connector boundaries, and secrets guidance should be explicit.

## Accessibility & Inclusion

Target WCAG AA for the web UI. Maintain visible focus states, labeled form controls, non-color-only status cues, 44px touch targets for controls, responsive layouts for narrow screens, and reduced-motion support. Dense technical data is allowed, but core workflows must stay usable on a phone without drag/drop.
