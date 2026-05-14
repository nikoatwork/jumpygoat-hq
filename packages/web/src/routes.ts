import { readFile } from "node:fs/promises";
import { apiRoute, type RequestBody } from "./api.js";

import {
  createAutomation,
  createAgent,
  createBoard,
  createTask,
  defaultAgentContent,
  defaultBoardBody,
  deleteAutomation,
  deleteAgent,
  parseAutomationForm,
  parseAgentForm,
  parseBoardForm,
  parseSettingsForm,
  parseTaskForm,
  readAutomationRaw,
  readAgentRaw,
  readBoardRaw,
  readSettingsRaw,
  readTaskRaw,
  runNow,
  setTaskStatus,
  updateSettings,
  updateAutomation,
  updateAgent,
  updateBoard,
  updateTaskFile,
  validateAutomation,
  validateAgent,
  validateBoard,
  validateSettings,
  validateTask,
  type AutomationFormValues,
  type AgentFormValues,
  type BoardFormValues,
  type SettingsFormValues,
  type TaskFormValues,
} from "./actions.js";
import { TASK_STATUSES, taskStatusLabel, type TaskStatus } from "../../shared/tasks.js";
import { badge, date, duration, emptyState, errorPage, escapeHtml, icon, inlineActions, layout, metaTable, notFound, notice, pageHeader, raw, runLink, section, status, table, toolbar } from "./html.js";
import { jumpyGoatHqHome } from "./paths.js";
import { getRun, listAutomations, listBoards, listInstalledCronBlocks, listModelProfileKeys, listRuns, listAgents, listTasks, readBoard, readSchedulePageView, readSettingsView, readTaskHeartbeatCronStatus, runAgentName, usageSummary, type TaskView, type UsageSummaryRow } from "./readers.js";
import { formatTraceLog, type TraceLogEntry } from "./trace-log.js";

export type ResponseData = { status: number; headers?: Record<string, string>; body: string };

export async function route(method: string, url: URL, requestBody?: URLSearchParams | RequestBody): Promise<ResponseData> {
  const body = normalizeRequestBody(requestBody);
  const form = body.form;
  try {
    const apiResponse = await apiRoute(method, url, body);
    if (apiResponse) return apiResponse;
    if (method === "GET" && url.pathname === "/styles.css") return staticFile("../public/styles.css", "text/css; charset=utf-8");
    if (method === "GET" && url.pathname === "/kanban.js") return staticFile("../public/kanban.js", "application/javascript; charset=utf-8");
    if (method === "GET" && url.pathname === "/") return html(await dashboard());
    if (method === "GET" && url.pathname === "/automations") return html(await automationsPage(url));
    if (method === "GET" && url.pathname === "/schedule") return html(await schedulePage());
    if (method === "GET" && url.pathname === "/settings") return html(await settingsPage(url));
    if (method === "POST" && url.pathname === "/settings") return await updateSettingsRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/projects") return redirect("/boards");
    if (method === "GET" && url.pathname === "/projects/new") return redirect("/boards/new");
    if (method === "GET" && url.pathname === "/boards") return html(await boardsPage(url));
    if (method === "GET" && url.pathname === "/boards/new") return html(await boardFormPage("Create board", parseBoardForm(new URLSearchParams()), []));
    if (method === "POST" && url.pathname === "/boards") return await createBoardRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/tasks") return html(await kanbanPage(url));
    if (method === "GET" && url.pathname === "/tasks/new") return html(await taskFormPage("Create task", parseTaskForm(url.searchParams, url.searchParams.get("board") || url.searchParams.get("project") || ""), []));
    if (method === "POST" && url.pathname === "/tasks") return await createTaskRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/automations/new") return html(await automationFormPage("Create automation", parseAutomationForm(new URLSearchParams()), []));
    if (method === "POST" && url.pathname === "/automations") return await createAutomationRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/agents") return html(await agentsPage(url));
    if (method === "GET" && url.pathname === "/agents/new") return html(agentFormPage("Create agent", { name: "", content: defaultAgentContent("") }, []));
    if (method === "POST" && url.pathname === "/agents") return await createAgentRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/runs") return html(runsPage(url));

    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (method === "GET" && runMatch) return html(runDetailPage(decodeURIComponent(runMatch[1]!)));

    const legacyProjectTaskMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)(\/edit|\/status)?$/);
    if (method === "GET" && legacyProjectTaskMatch) return redirect(`/boards/${encodeURIComponent(decodeURIComponent(legacyProjectTaskMatch[1]!))}/tasks/${encodeURIComponent(decodeURIComponent(legacyProjectTaskMatch[2]!))}${legacyProjectTaskMatch[3] || ""}`);

    const legacyProjectMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)(\/edit)?$/);
    if (method === "GET" && legacyProjectMatch) return redirect(`/boards/${encodeURIComponent(decodeURIComponent(legacyProjectMatch[1]!))}${legacyProjectMatch[2] || ""}`);

    const boardEditMatch = url.pathname.match(/^\/boards\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && boardEditMatch) {
      const name = decodeURIComponent(boardEditMatch[1]!);
      return html(await boardFormPage(`Edit board ${name}`, await readBoardRaw(name), [], name));
    }

    const boardViewMatch = url.pathname.match(/^\/boards\/([a-z0-9-]+)$/);
    if (method === "GET" && boardViewMatch) return html(await boardDetailPage(decodeURIComponent(boardViewMatch[1]!), url));
    if (method === "POST" && boardViewMatch) return await updateBoardRoute(decodeURIComponent(boardViewMatch[1]!), form || new URLSearchParams());

    const taskEditMatch = url.pathname.match(/^\/boards\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && taskEditMatch) {
      const board = decodeURIComponent(taskEditMatch[1]!);
      const id = decodeURIComponent(taskEditMatch[2]!);
      return html(await taskFormPage(`Edit task ${board}/${id}`, await readTaskRaw(board, id), [], board, id));
    }

    const taskStatusMatch = url.pathname.match(/^\/boards\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)\/status$/);
    if (method === "POST" && taskStatusMatch) return await updateTaskStatusRoute(decodeURIComponent(taskStatusMatch[1]!), decodeURIComponent(taskStatusMatch[2]!), form || new URLSearchParams());

    const taskViewMatch = url.pathname.match(/^\/boards\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)$/);
    if (method === "GET" && taskViewMatch) return html(await taskDetailPage(decodeURIComponent(taskViewMatch[1]!), decodeURIComponent(taskViewMatch[2]!)));
    if (method === "POST" && taskViewMatch) return await updateTaskRoute(decodeURIComponent(taskViewMatch[1]!), decodeURIComponent(taskViewMatch[2]!), form || new URLSearchParams());

    const automationEditMatch = url.pathname.match(/^\/automations\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && automationEditMatch) {
      const name = decodeURIComponent(automationEditMatch[1]!);
      return html(await automationFormPage(`Edit automation ${name}`, await readAutomationRaw(name), [], name));
    }

    const automationViewMatch = url.pathname.match(/^\/automations\/([a-z0-9-]+)$/);
    if (method === "GET" && automationViewMatch) return html(await automationDetailPage(decodeURIComponent(automationViewMatch[1]!)));
    if (method === "POST" && automationViewMatch) return await updateAutomationRoute(decodeURIComponent(automationViewMatch[1]!), form || new URLSearchParams());

    const automationDeleteMatch = url.pathname.match(/^\/automations\/([a-z0-9-]+)\/delete$/);
    if (method === "POST" && automationDeleteMatch) return await deleteAutomationRoute(decodeURIComponent(automationDeleteMatch[1]!), form || new URLSearchParams());

    const runNowMatch = url.pathname.match(/^\/automations\/([a-z0-9-]+)\/run$/);
    if (method === "POST" && runNowMatch) {
      await runNow(runNowMatch[1]!);
      return redirect(`/runs?ran=${encodeURIComponent(runNowMatch[1]!)}`);
    }

    const agentEditMatch = url.pathname.match(/^\/agents\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && agentEditMatch) {
      const name = decodeURIComponent(agentEditMatch[1]!);
      return html(agentFormPage(`Edit agent ${name}`, await readAgentRaw(name), [], name));
    }

    const agentViewMatch = url.pathname.match(/^\/agents\/([a-z0-9-]+)$/);
    if (method === "GET" && agentViewMatch) return html(await agentDetailPage(decodeURIComponent(agentViewMatch[1]!)));
    if (method === "POST" && agentViewMatch) return await updateAgentRoute(decodeURIComponent(agentViewMatch[1]!), form || new URLSearchParams());

    const agentDeleteMatch = url.pathname.match(/^\/agents\/([a-z0-9-]+)\/delete$/);
    if (method === "POST" && agentDeleteMatch) return await deleteAgentRoute(decodeURIComponent(agentDeleteMatch[1]!), form || new URLSearchParams());

    return { status: 404, body: notFound() };
  } catch (error) {
    return { status: 500, body: errorPage("Error", error) };
  }
}

function normalizeRequestBody(body?: URLSearchParams | RequestBody): RequestBody {
  if (!body) return {};
  if (body instanceof URLSearchParams) return { form: body };
  return body;
}

function html(body: string, status = 200): ResponseData {
  return { status, headers: { "content-type": "text/html; charset=utf-8" }, body };
}

async function staticFile(relativePath: string, contentType: string): Promise<ResponseData> {
  const body = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return { status: 200, headers: { "content-type": contentType, "cache-control": "no-store" }, body };
}

function redirect(location: string): ResponseData {
  return { status: 303, headers: { location }, body: "" };
}

async function createAutomationRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseAutomationForm(form);
  const result = await validateAutomation(values, "create");
  if (!result.ok) return html(await automationFormPage("Create automation", result.values, result.errors), 400);
  await createAutomation(result.values);
  return redirect("/automations?created=" + encodeURIComponent(result.values.name));
}

async function updateAutomationRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseAutomationForm(form, name);
  const result = await validateAutomation(values, "update");
  if (!result.ok) return html(await automationFormPage(`Edit automation ${name}`, result.values, result.errors, name), 400);
  await updateAutomation(name, result.values);
  return redirect("/automations?updated=" + encodeURIComponent(name));
}

async function deleteAutomationRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  if (form.get("confirm") !== name) return html(layout("Delete automation", `<h2>Delete automation <code>${escapeHtml(name)}</code></h2><p class="error">Type the automation name to confirm deletion.</p>${deleteAutomationForm(name)}`), 400);
  await deleteAutomation(name);
  return redirect("/automations?deleted=" + encodeURIComponent(name));
}

async function createAgentRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseAgentForm(form);
  const result = validateAgent(values, "create");
  if (!result.ok) return html(agentFormPage("Create agent", result.values, result.errors), 400);
  await createAgent(result.values);
  return redirect("/agents?created=" + encodeURIComponent(result.values.name));
}

async function updateAgentRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseAgentForm(form, name);
  const result = validateAgent(values, "update");
  if (!result.ok) return html(agentFormPage(`Edit agent ${name}`, result.values, result.errors, name), 400);
  await updateAgent(name, result.values);
  return redirect("/agents?updated=" + encodeURIComponent(name));
}

async function deleteAgentRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  if (form.get("confirm") !== name) return html(layout("Delete agent", `<h2>Delete agent <code>${escapeHtml(name)}</code></h2><p class="error">Type the agent name to confirm deletion.</p>${deleteAgentForm(name)}`), 400);
  try {
    await deleteAgent(name);
  } catch (error) {
    return html(layout("Delete agent", `<h2>Delete agent <code>${escapeHtml(name)}</code></h2><p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>${deleteAgentForm(name)}`), 400);
  }
  return redirect("/agents?deleted=" + encodeURIComponent(name));
}

async function createBoardRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseBoardForm(form);
  const result = await validateBoard(values, "create");
  if (!result.ok) return html(await boardFormPage("Create board", result.values, result.errors), 400);
  await createBoard(result.values);
  return redirect("/boards?created=" + encodeURIComponent(result.values.id));
}

async function updateBoardRoute(id: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseBoardForm(form, id);
  const result = await validateBoard(values, "update");
  if (!result.ok) return html(await boardFormPage(`Edit board ${id}`, result.values, result.errors, id), 400);
  await updateBoard(id, result.values);
  return redirect("/boards?updated=" + encodeURIComponent(id));
}

async function createTaskRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseTaskForm(form);
  const result = await validateTask(values, "create");
  if (!result.ok) return html(await taskFormPage("Create task", result.values, result.errors), 400);
  const task = await createTask(result.values);
  return redirect(`/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}?created=1`);
}

async function updateTaskRoute(board: string, id: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseTaskForm(form, board, id);
  const result = await validateTask(values, "update");
  if (!result.ok) return html(await taskFormPage(`Edit task ${board}/${id}`, result.values, result.errors, board, id), 400);
  await updateTaskFile(board, id, result.values);
  return redirect(`/boards/${encodeURIComponent(board)}/tasks/${encodeURIComponent(id)}?updated=1`);
}

async function updateTaskStatusRoute(board: string, id: string, form: URLSearchParams): Promise<ResponseData> {
  const next = String(form.get("status") || "");
  try {
    await setTaskStatus(board, id, next);
  } catch (error) {
    if (form.get("format") === "json") return { status: 400, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) };
    return html(layout("Task status error", `<h2>Task status error</h2><p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p><p><a href="/tasks">Back to tasks</a></p>`), 400);
  }
  if (form.get("format") === "json") return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true }) };
  return redirect(form.get("return") || "/tasks");
}

async function updateSettingsRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseSettingsForm(form);
  const result = validateSettings(values);
  if (!result.ok) return html(layout("Settings", `${pageHeader("Settings", { description: "Instance-local configuration. Pi owns provider auth, API keys, and concrete model availability." })}${settingsFormPage(result.values, result.errors)}`), 400);
  await updateSettings(result.values);
  return redirect("/settings?updated=1");
}

async function dashboard(): Promise<string> {
  const [automations, agents, boards, tasks] = await Promise.all([listAutomations(), listAgents(), listBoards(), listTasks()]);
  const cron = listInstalledCronBlocks();
  const taskHeartbeat = readTaskHeartbeatCronStatus();
  const runs = listRuns(10);
  const failures = runs.filter((r) => r.status !== "ok").slice(0, 5);
  const scheduledAutomations = automations.filter((automation) => automation.schedule !== "manual");
  const readyTasks = tasks.filter((task) => task.status === "ready");
  const workingTasks = tasks.filter((task) => task.status === "working-on-it");
  return layout("Dashboard", `
    ${pageHeader("Overview", { description: "A plain-language map of your agent workspace: who can help, what work is waiting, and what happened recently." })}
    ${section("How jumpyGoat thinks about work", `
      <div class="concept-grid">
        ${conceptCard("1", "Agents are your helpers", "Create reusable teammates with a role, instructions, knowledge, and safety boundaries.", "/agents", "Meet your agents")}
        ${conceptCard("2", "Automations are recurring asks", "Give an agent a prompt that can run manually or on a schedule, like a morning briefing.", "/automations", "Review automations")}
        ${conceptCard("3", "Boards hold one-off tasks", "Group requests, assign them to an agent, then move them to ready when you want work to start.", "/tasks", "Open tasks")}
        ${conceptCard("4", "Runs are the receipt", "Every finished or in-progress job leaves an activity record you can inspect when you need details.", "/runs", "See activity")}
      </div>
    `)}
    ${section("At a glance", `
      <div class="stat-grid">
        ${statCard("Agents", agents.length, "Reusable helpers", "/agents")}
        ${statCard("Automations", automations.length, `${scheduledAutomations.length} scheduled`, "/automations")}
        ${statCard("Tasks", tasks.length, `${readyTasks.length} ready · ${workingTasks.length} in progress`, "/tasks")}
        ${statCard("Boards", boards.length, "Task groups", "/boards")}
      </div>
    `)}
    ${section("Needs attention", `
      <div class="attention-list">
        ${taskHeartbeat.installed && !taskHeartbeat.warning ? `<p>${badge("Task dispatch on", "success")} Ready tasks can be picked up automatically.</p>` : `<p>${badge("Task dispatch off", "warning")} Ready tasks will not run periodically until the task heartbeat is installed.</p>`}
        ${cron.length ? `<p>${badge(`${cron.length} automation cron`, "installed")} Scheduled automations have local cron evidence.</p>` : `<p>${badge("No automation cron", "manual")} Automations can still be run manually.</p>`}
        ${failures.length ? `<p>${badge(`${failures.length} needs review`, "warning")} Some recent activity is running or did not finish cleanly.</p>` : `<p>${badge("All clear", "success")} No recent failures or running jobs in the latest activity.</p>`}
      </div>
    `)}
    ${section("Recent activity", overviewActivity(runs))}
    <details class="local-details"><summary>Local setup details</summary><p class="muted">Workspace: <code>${escapeHtml(jumpyGoatHqHome())}</code>${process.env.JUMPYGOATHQ_HOME ? ` using <code>JUMPYGOATHQ_HOME</code>` : " using the default local workspace"}.</p><p class="muted">Run details, paths, raw traces, and technical IDs live on the detail pages.</p></details>
  `);
}

function conceptCard(step: string, title: string, body: string, href: string, action: string): string {
  return `<article class="concept-card"><span class="step-pill">${escapeHtml(step)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><a href="${escapeHtml(href)}">${escapeHtml(action)} →</a></article>`;
}

function statCard(label: string, value: number, helper: string, href: string): string {
  return `<a class="stat-card" href="${escapeHtml(href)}"><strong>${value}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(helper)}</small></a>`;
}

function overviewActivity(runs: ReturnType<typeof listRuns>): string {
  if (!runs.length) return emptyState("No activity yet. Run an automation or move an assigned task to ready to create your first run.");
  return `<div class="activity-list">${runs.slice(0, 6).map((run) => `
    <article class="activity-card">
      <div><h4>${escapeHtml(readableRunTitle(run))}</h4><p class="muted">${escapeHtml(runAgentName(run) || "No agent recorded")} · ${date(run.started_at)}${duration(run.duration_ms) ? ` · ${duration(run.duration_ms)}` : ""}</p></div>
      <div class="activity-card-actions">${status(run.status)} <a href="/runs/${encodeURIComponent(run.id)}">View details</a></div>
    </article>`).join("")}</div>`;
}

function readableRunTitle(run: Pick<ReturnType<typeof listRuns>[number], "automation" | "source_type" | "source_id" | "project" | "task_id">): string {
  if ((run.source_type || "automation") === "task") return run.project && run.task_id ? `Task: ${run.project}/${run.task_id}` : `Task: ${run.source_id || "unknown"}`;
  return `Automation: ${run.source_id || run.automation || "unknown"}`;
}

async function automationsPage(url: URL): Promise<string> {
  const automations = await listAutomations();
  const cronNames = new Set(listInstalledCronBlocks().map((b) => b.name));
  const message = pageMessage(url, ["ran", "created", "updated", "deleted"]);
  const rows = automations.map((a) => [
    raw(`<a href="/automations/${encodeURIComponent(a.name)}"><code>${escapeHtml(a.name)}</code></a>${a.warning ? `<br><b>${escapeHtml(a.warning)}</b>` : ""}`),
    a.agent,
    raw(scheduleLabel(a.schedule)),
    a.model || "default",
    cronNames.has(a.name) ? "yes" : "no",
    raw(clamp(a.promptPreview)),
    raw(inlineActions(`<form method="post" action="/automations/${encodeURIComponent(a.name)}/run"><button type="submit">${icon("play")}Run now</button></form><a href="/automations/${encodeURIComponent(a.name)}/edit">${icon("pen")}Edit</a><details><summary>${icon("trash")}Delete</summary>${deleteAutomationForm(a.name)}</details>`)),
  ]);
  return layout("Automations", `
    ${pageHeader("Automations", { description: "Reusable prompts that can run manually or on a schedule.", actions: `<a href="/automations/new" class="button-link">${icon("plus")}Create automation</a>` })}
    ${message}
    ${section("Automation files", table(["Name", "Agent", "Schedule", "Model", "Cron installed", "Prompt", "Action"], rows, { empty: "No automations found." }))}
  `);
}

async function schedulePage(): Promise<string> {
  const view = await readSchedulePageView(7);
  const scheduled = view.runs.filter((run) => !run.manual);
  const manual = view.runs.filter((run) => run.manual);
  const rows = view.runs.map((run) => [
    raw(`<a href="/automations/${encodeURIComponent(run.name)}"><code>${escapeHtml(run.name)}</code></a>`),
    raw(`${escapeHtml(run.agent || "missing")}${run.agentDescription ? `<br><span class="muted">${escapeHtml(run.agentDescription)}</span>` : ""}`),
    raw(scheduleLabel(run.schedule)),
    run.model,
    raw(scheduleStatus(run)),
    run.upcoming[0] ? formatDateTime(run.upcoming[0]!) : "",
    run.upcoming.length,
    raw(warningsList(run.warnings)),
  ]);

  const groups = groupOccurrencesByDate(view.occurrences);
  const agenda = groups.length === 0 ? emptyState("No upcoming scheduled agent runs in this window.") : groups.map(([label, occurrences]) => `
    <section class="agenda-day panel">
      <h3>${escapeHtml(label)}</h3>
      <ol class="agenda-list">
        ${occurrences.map((occurrence) => `<li>
          <time>${escapeHtml(formatTimeOnly(occurrence.time))}</time>
          <span><a href="/automations/${encodeURIComponent(occurrence.automation)}"><code>${escapeHtml(occurrence.automation)}</code></a> runs agent <code>${escapeHtml(occurrence.agent || "missing")}</code></span>
          <span class="muted"><code>${escapeHtml(occurrence.schedule)}</code> · ${occurrence.installed ? badge("installed", "installed") : badge("not installed", "missing")}</span>
        </li>`).join("")}
      </ol>
    </section>`).join("");

  const manualRows = manual.map((run) => [
    raw(`<a href="/automations/${encodeURIComponent(run.name)}"><code>${escapeHtml(run.name)}</code></a>`),
    run.agent,
    run.installed ? "installed cron present" : "manual only",
    raw(warningsList(run.warnings)),
  ]);
  const orphanRows = view.orphanCronBlocks.map((block) => [raw(`<code>${escapeHtml(block.name)}</code>`), block.line || "no command line found", block.warning || "No matching automation file."]);

  return layout("Schedule", `
    ${pageHeader("Schedule", { description: `Timeline view of scheduled automations from ${escapeHtml(formatDateTime(view.from))} through ${escapeHtml(formatDateTime(view.until))}. Source of truth: automation markdown schedules. Crontab blocks are install status/evidence only.` })}
    ${warningsList(view.warnings)}
    ${section("Upcoming agenda", agenda)}
    ${section("Scheduled run summary", table(["Automation", "Agent", "Schedule", "Model", "Cron", "Next run", "Count", "Warnings"], rows, { empty: "No automations found." }))}
    ${section("Manual automations", table(["Automation", "Agent", "Status", "Warnings"], manualRows, { empty: "No manual automations found." }))}
    ${section("Installed cron orphans", table(["Name", "Command", "Warning"], orphanRows, { empty: "No orphan jumpyGoatHq cron blocks found." }))}
    ${toolbar(`<span class="muted">Scheduled automations in window: ${scheduled.length}. Manual automations are excluded from the occurrence list.</span>`)}
  `);
}

async function settingsPage(url: URL): Promise<string> {
  const view = readSettingsView();
  const values = await readSettingsRaw();
  const message = pageMessage(url, ["updated"]);
  const profileRows = view.settings ? Object.entries(view.settings.modelProfiles).sort(([a], [b]) => a.localeCompare(b)).map(([key, profile]) => [
    raw(`<code>${escapeHtml(key)}</code>`),
    profile.label || "",
    raw(`<code>${escapeHtml(profile.selector)}</code>`),
    view.settings?.defaultModelProfile === key ? badge("default", "installed") : "",
  ]) : [];
  return layout("Settings", `
    ${pageHeader("Settings", { description: "Instance-local configuration. Pi owns provider auth, API keys, and concrete model availability." })}
    ${message}
    ${view.error ? notice(view.error, "error") : ""}
    ${section("Settings file", metaTable([
      ["Path", raw(`<code>${escapeHtml(view.path)}</code>`)],
      ["Exists", view.exists ? "yes" : "no (defaults shown below)"],
      ["Default model profile", view.settings?.defaultModelProfile || "Pi default"],
    ]))}
    ${section("Model profiles", table(["Key", "Label", "Pi selector", "Default"], profileRows, { empty: "No model profiles configured." }))}
    ${section("Usage by model", usageSummaryTable(usageSummary()))}
    ${settingsFormPage(values, [])}
  `);
}

function settingsFormPage(values: SettingsFormValues, errors: string[]): string {
  return section("Edit settings YAML", `
    ${errorsList(errors)}
    <form method="post" action="/settings" class="form-stack">
      <label>settings.yml <textarea name="content" rows="18" required>${escapeHtml(values.content)}</textarea></label>
      <p class="muted">Allowed fields: <code>defaultModelProfile</code> and <code>modelProfiles</code>. Do not put secrets or API keys here.</p>
      <p><button type="submit">${icon("checkmark")}Save settings</button></p>
    </form>
  `);
}

function usageSummaryTable(rows: UsageSummaryRow[]): string {
  return table(["Profile", "Resolved selector", "Pi model", "Provider", "Runs", "Input", "Output", "Reasoning", "Total", "Reported cost"], rows.map((row) => [
    row.profile || "direct/Pi default",
    raw(row.resolvedModel ? `<code>${escapeHtml(row.resolvedModel)}</code>` : ""),
    row.piModel,
    row.provider,
    row.runs,
    formatNumber(row.inputTokens),
    formatNumber(row.outputTokens),
    formatNumber(row.reasoningTokens),
    formatNumber(row.totalTokens),
    formatCost(row.costTotal, row.currency),
  ]), { empty: "No usage emitted by Pi has been recorded yet." });
}

async function automationDetailPage(name: string): Promise<string> {
  const automation = await readAutomationRaw(name);
  return layout(`Automation ${name}`, `
    ${pageHeader(`Automation ${name}`, { actions: `<a href="/automations/${encodeURIComponent(name)}/edit" class="button-link">${icon("pen")}Edit</a><a href="/automations" class="button-link">Back to automations</a>` })}
    ${section("Details", metaTable([
      ["Agent", automation.agent],
      ["Schedule", raw(scheduleLabel(automation.schedule))],
      ["Model", automation.model || "default"],
    ]))}
    ${section("Prompt", `<pre>${escapeHtml(automation.prompt)}</pre>`)}
  `);
}

async function automationFormPage(title: string, values: AutomationFormValues, errors: string[], editingName?: string): Promise<string> {
  const agents = await listAgents();
  const profiles = listModelProfileKeys();
  const action = editingName ? `/automations/${encodeURIComponent(editingName)}` : "/automations";
  const nameAttrs = editingName ? "readonly" : "required";
  return layout(title, `
    ${pageHeader(title)}
    ${errorsList(errors)}
    <form method="post" action="${action}" class="form-stack">
      <label>Name <input name="name" value="${escapeHtml(values.name)}" ${nameAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Agent <select name="agent" required>${agents.map((s) => `<option value="${escapeHtml(s.name)}" ${s.name === values.agent ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
      ${scheduleFields(values.schedule || "manual")}
      <label>Model <input name="model" value="${escapeHtml(values.model)}" placeholder="default" list="model-profiles"></label>
      <datalist id="model-profiles">${profiles.map((profile) => `<option value="${escapeHtml(profile)}"></option>`).join("")}</datalist>
      ${profiles.length ? `<p class="muted">Available model profiles: ${profiles.map((profile) => `<code>${escapeHtml(profile)}</code>`).join(", ")}. Direct Pi selectors also pass through.</p>` : ""}
      <label>Prompt <textarea name="prompt" rows="16" required>${escapeHtml(values.prompt)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/automations">Cancel</a></p>
    </form>
  `);
}

async function boardsPage(url: URL): Promise<string> {
  const boards = await listBoards();
  const message = pageMessage(url, ["created", "updated"]);
  const rows = boards.map((board) => `<tr>
    <td><a href="/boards/${encodeURIComponent(board.id)}"><code>${escapeHtml(board.id)}</code></a>${board.warning ? `<br><b class="error">${escapeHtml(board.warning)}</b>` : ""}</td>
    <td>${escapeHtml(board.name)}</td>
    <td>${clamp(board.description)}</td>
    <td>${escapeHtml(board.default_agent || "")}</td>
    <td>${board.taskCount}</td>
    <td class="actions"><a href="/boards/${encodeURIComponent(board.id)}/edit">${icon("pen")}Edit</a><a href="/tasks?board=${encodeURIComponent(board.id)}">Kanban</a><a href="/tasks/new?board=${encodeURIComponent(board.id)}">${icon("plus")}Task</a></td>
  </tr>`).join("");
  return layout("Boards", `
    ${pageHeader("Boards", { description: "Boards group related one-off tasks and shared context.", actions: `<a href="/boards/new" class="button-link">${icon("plus")}Create board</a><a href="/tasks" class="button-link">Tasks kanban</a>` })}
    ${message}
    ${boards.length === 0 ? "<p>No boards found. Create one to start assigning tasks.</p>" : `<table><tr><th>Id</th><th>Name</th><th>Description</th><th>Default agent</th><th>Tasks</th><th>Action</th></tr>${rows}</table>`}
  `);
}

async function boardDetailPage(id: string, url: URL): Promise<string> {
  const board = await readBoard(id);
  if (!board) return layout("Board not found", `<h2>Board not found</h2><p>No board found for <code>${escapeHtml(id)}</code>.</p>`);
  const tasks = await listTasks(id);
  return layout(`Board ${id}`, `
    <h2>Board <code>${escapeHtml(id)}</code></h2>
    ${pageMessage(url, ["created", "updated"])}
    <p><a href="/boards/${encodeURIComponent(id)}/edit">Edit</a> <a href="/tasks/new?board=${encodeURIComponent(id)}">Create task</a> <a href="/tasks?board=${encodeURIComponent(id)}">Kanban</a> <a href="/boards">Back to boards</a></p>
    <table>
      <tr><th>Name</th><td>${escapeHtml(board.name)}</td></tr>
      <tr><th>Description</th><td>${escapeHtml(board.description)}</td></tr>
      <tr><th>Default agent</th><td>${escapeHtml(board.default_agent || "")}</td></tr>
      <tr><th>Path</th><td><code>${escapeHtml(board.path || "")}</code></td></tr>
    </table>
    <h3>Board body</h3>
    ${board.body ? `<pre>${escapeHtml(board.body)}</pre>` : "<p class=\"muted\">No board body.</p>"}
    <h3>Tasks</h3>
    ${tasksTable(tasks)}
  `);
}

async function kanbanPage(url: URL): Promise<string> {
  const board = url.searchParams.get("board") || url.searchParams.get("project") || undefined;
  const focusedStatus = parseFocusedStatus(url.searchParams.get("status"));
  const tasks = await listTasks(board);
  const taskHeartbeat = readTaskHeartbeatCronStatus();
  const columns = TASK_STATUSES.map((statusName) => {
    const columnTasks = tasks.filter((task) => task.status === statusName);
    const cards = columnTasks.map(taskCard).join("");
    const newTaskHref = taskNewHref(statusName, board);
    const focusHref = tasksHref(board, statusName);
    const isCollapsed = Boolean(focusedStatus && focusedStatus !== statusName);
    if (isCollapsed) {
      return `<a class="kanban-column kanban-column-collapsed" href="${escapeHtml(focusHref)}" data-status="${escapeHtml(statusName)}"><span>${escapeHtml(taskStatusLabel(statusName))}</span><strong>${columnTasks.length}</strong></a>`;
    }
    return `<section class="kanban-column${focusedStatus === statusName ? " focused" : ""}" data-status="${escapeHtml(statusName)}"><div class="kanban-column-header"><h3>${escapeHtml(taskStatusLabel(statusName))} <span class="muted">${columnTasks.length}</span></h3><a class="button-link kanban-new-task" href="${escapeHtml(newTaskHref)}">+ new task</a></div><div class="kanban-dropzone">${cards || "<p class=\"muted\">No tasks.</p>"}</div></section>`;
  }).join("");
  const focusActions = focusedStatus ? `<a href="${escapeHtml(tasksHref(board))}" class="button-link">All columns</a>` : "";
  return layout("Tasks", `
    ${pageHeader(`Tasks${board ? ` for ${board}` : ""}`, { description: "One-off prompts assigned to agents. Move cards to ready when they should dispatch.", actions: `<a href="${escapeHtml(taskNewHref(undefined, board))}" class="button-link">${icon("plus")}Create task</a><a href="/boards" class="button-link">Boards</a>${focusActions}` })}
    ${pageMessage(url, ["created", "updated"])}
    ${focusedStatus ? `<p class="notice">Focused on <strong>${escapeHtml(taskStatusLabel(focusedStatus))}</strong>.</p>` : ""}
    ${notice(taskHeartbeat.installed ? `Task heartbeat cron installed: ${taskHeartbeat.line || "command missing"}${taskHeartbeat.warning ? ` (${taskHeartbeat.warning})` : ""}` : "Task heartbeat cron is not installed. Run `pnpm install:task-cron` to periodically dispatch ready assigned tasks.", taskHeartbeat.installed && !taskHeartbeat.warning ? "success" : "warning")}
    <div class="kanban-board${focusedStatus ? " focused" : ""}" data-kanban>${columns}</div>
    <script src="/kanban.js" defer></script>
  `);
}

function parseFocusedStatus(value: string | null): TaskStatus | undefined {
  return value && TASK_STATUSES.includes(value as TaskStatus) ? value as TaskStatus : undefined;
}

function tasksHref(board?: string, statusName?: string): string {
  const params = new URLSearchParams();
  if (board) params.set("board", board);
  if (statusName) params.set("status", statusName);
  const suffix = params.toString();
  return `/tasks${suffix ? `?${suffix}` : ""}`;
}

function taskNewHref(statusName?: string, board?: string): string {
  const params = new URLSearchParams();
  if (statusName) params.set("status", statusName);
  if (board) params.set("board", board);
  const suffix = params.toString();
  return `/tasks/new${suffix ? `?${suffix}` : ""}`;
}

async function boardFormPage(title: string, values: BoardFormValues, errors: string[], editingId?: string): Promise<string> {
  const agents = await listAgents();
  const action = editingId ? `/boards/${encodeURIComponent(editingId)}` : "/boards";
  const idAttrs = editingId ? "readonly" : "required";
  const body = values.body || defaultBoardBody(values.name || values.id);
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Board id <input name="id" value="${escapeHtml(values.id)}" ${idAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Name <input name="name" value="${escapeHtml(values.name)}" required></label>
      <label>Description <input name="description" value="${escapeHtml(values.description)}"></label>
      <label>Default agent <select name="default_agent"><option value="">none</option>${agents.map((agent) => `<option value="${escapeHtml(agent.name)}" ${agent.name === values.default_agent ? "selected" : ""}>${escapeHtml(agent.name)}</option>`).join("")}</select></label>
      <label>Board body <textarea name="body" rows="14">${escapeHtml(body)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/boards">Cancel</a></p>
    </form>
  `);
}

async function taskFormPage(title: string, values: TaskFormValues, errors: string[], editingBoard?: string, editingId?: string): Promise<string> {
  const [boards, agents] = await Promise.all([listBoards(), listAgents()]);
  const action = editingBoard && editingId ? `/boards/${encodeURIComponent(editingBoard)}/tasks/${encodeURIComponent(editingId)}` : "/tasks";
  const idAttrs = editingId ? "readonly required" : "placeholder=\"auto-generated\"";
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Board <select name="board" required ${editingBoard ? "readonly" : ""}>${boards.map((board) => `<option value="${escapeHtml(board.id)}" ${board.id === values.board ? "selected" : ""}>${escapeHtml(board.id)}</option>`).join("")}</select></label>
      <label>Task id <input name="id" value="${escapeHtml(values.id)}" ${idAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Title <input name="title" value="${escapeHtml(values.title)}" required></label>
      <label>Status <select name="status" required>${TASK_STATUSES.map((entry) => `<option value="${entry}" ${entry === values.status ? "selected" : ""}>${escapeHtml(taskStatusLabel(entry))}</option>`).join("")}</select></label>
      <label>Assignee <select name="assignee"><option value="">unassigned</option>${agents.map((agent) => `<option value="${escapeHtml(agent.name)}" ${agent.name === values.assignee ? "selected" : ""}>${escapeHtml(agent.name)}</option>`).join("")}</select></label>
      <label>Priority <select name="priority">${["low", "normal", "high", "urgent"].map((entry) => `<option value="${entry}" ${entry === values.priority ? "selected" : ""}>${entry}</option>`).join("")}</select></label>
      <label>Task body <textarea name="body" rows="16">${escapeHtml(values.body)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="${escapeHtml(tasksHref(values.board))}">Cancel</a></p>
    </form>
  `);
}

async function taskDetailPage(board: string, id: string): Promise<string> {
  const task = (await listTasks(board)).find((entry) => entry.id === id);
  if (!task) return layout("Task not found", `<h2>Task not found</h2><p>No task found for <code>${escapeHtml(board)}/${escapeHtml(id)}</code>.</p>`);
  return layout(`Task ${board}/${id}`, `
    <h2>Task <code>${escapeHtml(board)}/${escapeHtml(id)}</code></h2>
    <p><a href="/boards/${encodeURIComponent(board)}/tasks/${encodeURIComponent(id)}/edit">Edit</a> <a href="/tasks?board=${encodeURIComponent(board)}">Kanban</a> <a href="/boards/${encodeURIComponent(board)}">Board</a></p>
    ${task.warning ? `<p class="error">${escapeHtml(task.warning)}</p>` : ""}
    <table>
      <tr><th>Title</th><td>${escapeHtml(task.title)}</td></tr>
      <tr><th>Status</th><td>${escapeHtml(taskStatusLabel(task.status))}</td></tr>
      <tr><th>Assignee</th><td>${escapeHtml(task.assignee)}</td></tr>
      <tr><th>Priority</th><td>${escapeHtml(task.priority)}</td></tr>
      <tr><th>Attempts</th><td>${task.attempts}</td></tr>
      <tr><th>Latest run</th><td>${task.latestRun ? runLink(task.latestRun) : ""}</td></tr>
      <tr><th>Path</th><td><code>${escapeHtml(task.path || "")}</code></td></tr>
    </table>
    <h3>Status actions</h3>
    <div class="inline-actions">${statusActionForms(task, `/boards/${encodeURIComponent(board)}/tasks/${encodeURIComponent(id)}`)}</div>
    <h3>Body</h3>
    ${task.body ? `<pre>${escapeHtml(task.body)}</pre>` : "<p class=\"muted\">No task body.</p>"}
  `);
}

function tasksTable(tasks: TaskView[]): string {
  const rows = tasks.map((task) => [
    raw(`<a href="/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}"><code>${escapeHtml(task.id)}</code></a><br>${escapeHtml(task.title)}${task.warning ? `<br><b class="error">${escapeHtml(task.warning)}</b>` : ""}`),
    taskStatusLabel(task.status),
    task.assignee,
    task.priority,
    raw(task.latestRun ? runLink(task.latestRun) : ""),
    raw(inlineActions(`<a href="/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}/edit">${icon("pen")}Edit</a>${statusActionForms(task, `/boards/${encodeURIComponent(task.board)}`)}`)),
  ]);
  return table(["Task", "Status", "Assignee", "Priority", "Latest run", "Action"], rows, { empty: "No tasks found." });
}

function taskCard(task: TaskView): string {
  return `<article class="kanban-card" draggable="true" data-board="${escapeHtml(task.board)}" data-task-id="${escapeHtml(task.id)}">
    <h4><a href="/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}">${escapeHtml(task.title)}</a></h4>
    <p><code>${escapeHtml(task.board)}/${escapeHtml(task.id)}</code></p>
    <p class="muted">${escapeHtml(task.priority)}${task.assignee ? ` · ${escapeHtml(task.assignee)}` : " · unassigned"}</p>
    ${task.latestRun ? `<p>Run ${runLink(task.latestRun)} ${status(task.latestRun.status)}</p>` : ""}
    ${task.warning ? `<p class="error">${escapeHtml(task.warning)}</p>` : ""}
    <div class="card-actions">${statusActionForms(task, tasksHref(task.board))} <a href="/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}/edit">Edit</a></div>
  </article>`;
}

function statusActionForms(task: Pick<TaskView, "board" | "id" | "status">, returnPath: string): string {
  return TASK_STATUSES.filter((next) => next !== task.status).map((next) => `<form method="post" action="/boards/${encodeURIComponent(task.board)}/tasks/${encodeURIComponent(task.id)}/status"><input type="hidden" name="status" value="${next}"><input type="hidden" name="return" value="${escapeHtml(returnPath)}"><button type="submit">${escapeHtml(taskStatusLabel(next))}</button></form>`).join(" ");
}

type ScheduleUi = { cadence: string; time: string; weekday: string; raw: string };

function scheduleFields(schedule: string): string {
  const ui = scheduleToUi(schedule);
  const cadenceOptions = [
    ["manual", "Manual"],
    ["hourly", "Hourly"],
    ["daily", "Daily"],
    ["weekly", "Weekly"],
    ["custom", "Custom cron"],
  ];
  const weekdayOptions = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `
    <fieldset class="schedule-card">
      <legend>Schedule</legend>
      <div class="schedule-grid">
        <label>Cadence <select name="scheduleCadence" required>${cadenceOptions.map(([value, label]) => `<option value="${value}" ${ui.cadence === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Time <input type="time" name="scheduleTime" value="${escapeHtml(ui.time)}"></label>
        <label>Weekday <select name="scheduleWeekday">${weekdayOptions.map((label, value) => `<option value="${value}" ${ui.weekday === String(value) ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      </div>
      <details ${ui.cadence === "custom" ? "open" : ""}>
        <summary>Advanced cron / raw value</summary>
        <input name="schedule" value="${escapeHtml(ui.raw)}" required>
        <p class="muted">Use <code>manual</code> or a 5-field cron expression. Simple cadence values above are saved as cron.</p>
      </details>
    </fieldset>`;
}

function scheduleLabel(schedule: string): string {
  const ui = scheduleToUi(schedule);
  const raw = `<code>${escapeHtml(schedule)}</code>`;
  if (ui.cadence === "manual") return `Manual <span class="muted">(${raw})</span>`;
  if (ui.cadence === "hourly") return `Hourly at ${escapeHtml(formatMinute(ui.time))} <span class="muted">(${raw})</span>`;
  if (ui.cadence === "daily") return `Daily at ${escapeHtml(formatTime(ui.time))} <span class="muted">(${raw})</span>`;
  if (ui.cadence === "weekly") return `${escapeHtml(weekdayName(ui.weekday))}s at ${escapeHtml(formatTime(ui.time))} <span class="muted">(${raw})</span>`;
  return raw;
}

function scheduleToUi(schedule: string): ScheduleUi {
  const raw = schedule || "manual";
  if (raw === "manual") return { cadence: "manual", time: "09:00", weekday: "1", raw };
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 5) return { cadence: "custom", time: "09:00", weekday: "1", raw };
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (numberIn(minute, 0, 59) && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") return { cadence: "hourly", time: `00:${pad2(minute)}`, weekday: "1", raw };
  if (numberIn(minute, 0, 59) && numberIn(hour, 0, 23) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") return { cadence: "daily", time: `${pad2(hour)}:${pad2(minute)}`, weekday: "1", raw };
  if (numberIn(minute, 0, 59) && numberIn(hour, 0, 23) && dayOfMonth === "*" && month === "*" && numberIn(dayOfWeek, 0, 6)) return { cadence: "weekly", time: `${pad2(hour)}:${pad2(minute)}`, weekday: dayOfWeek, raw };
  return { cadence: "custom", time: "09:00", weekday: "1", raw };
}

function numberIn(value = "", min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return number >= min && number <= max;
}

function pad2(value = "0"): string {
  return String(Number(value)).padStart(2, "0");
}

function formatTime(value: string): string {
  const [hourText = "0", minuteText = "0"] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText.padStart(2, "0")} ${suffix}`;
}

function formatMinute(value: string): string {
  const minute = value.split(":")[1] || "00";
  return `:${minute.padStart(2, "0")}`;
}

function weekdayName(value: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(value)] || "Monday";
}

async function agentsPage(url: URL): Promise<string> {
  const [agents, automations, tasks] = await Promise.all([listAgents(), listAutomations(), listTasks()]);
  const message = pageMessage(url, ["created", "updated", "deleted"]);
  const cards = agents.map((agent) => {
    const assignedAutomations = automations.filter((automation) => automation.agent === agent.name).length;
    const assignedTasks = tasks.filter((task) => task.assignee === agent.name).length;
    const description = agent.description || "No plain-language description yet. Add one so it is clear when to choose this agent.";
    return `<article class="agent-card">
      <header>
        <div><h3><a href="/agents/${encodeURIComponent(agent.name)}">${escapeHtml(agent.name)}</a></h3><p>${escapeHtml(description)}</p></div>
        ${agent.warning ? badge("Needs review", "warning") : ""}
      </header>
      ${agent.warning ? `<p class="error">${escapeHtml(agent.warning)}</p>` : ""}
      <ul class="agent-facts">
        <li><strong>${assignedAutomations}</strong> automation${assignedAutomations === 1 ? "" : "s"} choose this helper</li>
        <li><strong>${assignedTasks}</strong> open task${assignedTasks === 1 ? "" : "s"} assigned here</li>
        <li><strong>${agent.contextCount}</strong> extra context note${agent.contextCount === 1 ? "" : "s"}</li>
      </ul>
      ${inlineActions(`<a href="/agents/${encodeURIComponent(agent.name)}">View details</a><a href="/agents/${encodeURIComponent(agent.name)}/edit">${icon("pen")}Edit</a><details><summary>${icon("trash")}Delete</summary>${deleteAgentForm(agent.name)}</details>`)}
    </article>`;
  }).join("");
  return layout("Agents", `
    ${pageHeader("Agents", { description: "Your roster of reusable AI helpers. Start here when you want to decide who should do a job, not when you want to inspect logs.", actions: `<a href="/agents/new" class="button-link">${icon("plus")}Create agent</a>` })}
    ${message}
    ${section("How to think about agents", `
      <div class="concept-grid">
        ${conceptCard("Role", "What kind of helper is this?", "An agent is a reusable identity: purpose, tone, default model choice, and the instructions it should follow.", "/agents/new", "Create one")}
        ${conceptCard("Context", "What should it know?", "Add focused background notes for the agent instead of pasting the same context into every task.", "/agents", "Review roster")}
        ${conceptCard("Boundaries", "What is it allowed to do?", "External capabilities are governed by connector policy, so tools are explicit instead of hidden in the agent.", "/automations", "Assign work")}
        ${conceptCard("Work", "Where does it get jobs?", "Automations and tasks point at an agent. Runs are just the receipts after work happens.", "/runs", "See receipts")}
      </div>
    `)}
    ${section("Agent roster", agents.length ? `<div class="agent-grid">${cards}</div>` : emptyState("No agents yet. Create your first agent to define the helper you want.", `<a href="/agents/new">Create agent</a>`))}
  `);
}

async function agentDetailPage(name: string): Promise<string> {
  const agent = await readAgentRaw(name);
  return layout(`Agent ${name}`, `
    ${pageHeader(`Agent ${name}`, { actions: `<a href="/agents/${encodeURIComponent(name)}/edit" class="button-link">${icon("pen")}Edit</a><a href="/agents" class="button-link">Back to agents</a>` })}
    ${section("AGENT.md", `<pre>${escapeHtml(agent.content)}</pre>`)}
  `);
}

function agentFormPage(title: string, values: AgentFormValues, errors: string[], editingName?: string): string {
  const action = editingName ? `/agents/${encodeURIComponent(editingName)}` : "/agents";
  const nameAttrs = editingName ? "readonly" : "required";
  return layout(title, `
    ${pageHeader(title, { description: "Advanced: AGENT.md is the bundle entrypoint for identity, instructions, policy, and connector gates. Optional context/*.md files are loaded by the runner; reserved resource directories are not yet loaded." })}
    ${errorsList(errors)}
    <form method="post" action="${action}" class="form-stack">
      <label>Name <input name="name" value="${escapeHtml(values.name)}" ${nameAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>AGENT.md <textarea name="content" rows="24" required>${escapeHtml(values.content)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/agents">Cancel</a></p>
    </form>
  `);
}

function runsPage(url: URL): string {
  const runs = listRuns(100);
  const message = url.searchParams.get("ran") ? notice(`Finished run request for: ${url.searchParams.get("ran")}`, "success") : "";
  return layout("Runs", `${pageHeader("Runs", { description: "Activity history for automation and task invocations." })}${message}${section("History", runsTable(runs))}`);
}

function runDetailPage(id: string): string {
  const run = getRun(id);
  if (!run) return layout("Run not found", `${pageHeader("Run not found")}<p>No run found for <code>${escapeHtml(id)}</code>.</p>`);
  return layout(`Run ${id}`, `
    ${pageHeader(`Run ${run.id}`)}
    ${section("Details", metaTable([
      ["Source", raw(runSource(run))],
      ["Agent", runAgentName(run)],
      ["Board/task", raw(run.project && run.task_id ? `<a href="/boards/${encodeURIComponent(run.project)}/tasks/${encodeURIComponent(run.task_id)}"><code>${escapeHtml(run.project)}/${escapeHtml(run.task_id)}</code></a>` : "")],
      ["Status", raw(status(run.status))],
      ["Started", raw(date(run.started_at))],
      ["Finished", raw(date(run.finished_at))],
      ["Duration", duration(run.duration_ms)],
      ["Exit", run.exit_code ?? ""],
      ["Requested model", run.requested_model || run.model || ""],
      ["Resolved model", run.resolved_model || ""],
      ["Model profile", run.model_profile || ""],
      ["Pi-reported model", run.usage_model || ""],
      ["Usage", usageDetail(run)],
      ["Connector actions", raw(`<pre>${escapeHtml(formatConnectorActions(run.connector_actions_json))}</pre>`)],
    ]))}
    ${section("Timeline", traceLog(formatTraceLog(run.trace_text)))}
    ${section("Output", run.output_text ? `<pre>${escapeHtml(run.output_text)}</pre>` : emptyState("No output text captured."))}
    ${run.error_text ? section("Error", `<pre>${escapeHtml(run.error_text)}</pre>`) : ""}
    <details><summary>Raw trace JSONL</summary><pre>${escapeHtml(run.trace_text)}</pre></details>
  `);
}

function traceLog(entries: TraceLogEntry[]): string {
  const rows = entries.map((entry) => [raw(`<span class="trace-kind trace-${escapeHtml(entry.category)}">${escapeHtml(entry.category)}</span>`), entry.label, entry.detail || ""]);
  return table(["Kind", "Event", "Detail"], rows, { className: "trace-log", empty: "No trace events captured." });
}

function runsTable(runs: ReturnType<typeof listRuns>, empty = "No runs found."): string {
  const rows = runs.map((r) => [
    raw(runLink(r)),
    raw(runSource(r)),
    runAgentName(r),
    raw(r.project && r.task_id ? `<a href="/boards/${encodeURIComponent(r.project)}/tasks/${encodeURIComponent(r.task_id)}"><code>${escapeHtml(r.project)}/${escapeHtml(r.task_id)}</code></a>` : ""),
    raw(status(r.status)),
    r.model_profile || r.resolved_model || r.model || "",
    raw(clamp(connectorSummary(r.connector_actions_json))),
    raw(date(r.started_at)),
    duration(r.duration_ms),
    r.exit_code ?? "",
  ]);
  return table(["Run", "Source", "Agent", "Task", "Status", "Model", "Connector", "Started", "Duration", "Exit"], rows, { empty });
}

function runSource(run: Pick<ReturnType<typeof listRuns>[number], "automation" | "source_type" | "source_id">): string {
  const type = run.source_type || "automation";
  const id = run.source_id || run.automation;
  if (type === "automation") return `<a href="/automations/${encodeURIComponent(id)}"><code>${escapeHtml(id)}</code></a>`;
  return `${escapeHtml(type)} <code>${escapeHtml(id)}</code>`;
}

function clamp(value: string): string {
  return `<div tabindex="0" data-tooltip="${escapeHtml(value)}"><div class="cell-clamp">${escapeHtml(value)}</div></div>`;
}

function usageDetail(run: ReturnType<typeof getRun>): string {
  if (!run) return "";
  const parts = [
    run.usage_input_tokens != null ? `input ${formatNumber(run.usage_input_tokens)}` : undefined,
    run.usage_output_tokens != null ? `output ${formatNumber(run.usage_output_tokens)}` : undefined,
    run.usage_reasoning_tokens != null ? `reasoning ${formatNumber(run.usage_reasoning_tokens)}` : undefined,
    run.usage_cache_read_tokens != null ? `cache read ${formatNumber(run.usage_cache_read_tokens)}` : undefined,
    run.usage_cache_write_tokens != null ? `cache write ${formatNumber(run.usage_cache_write_tokens)}` : undefined,
    run.usage_total_tokens != null ? `total ${formatNumber(run.usage_total_tokens)}` : undefined,
    run.usage_cost_total != null ? `reported cost ${formatCost(run.usage_cost_total, run.usage_currency || "")}` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "unknown/not emitted";
}

function connectorSummary(json?: string): string {
  if (!json) return "none";
  try {
    const actions = JSON.parse(json) as Array<{ intent?: string; status?: string }>;
    if (!actions.length) return "none";
    return actions.map((action) => `${action.intent || "connector"}: ${action.status || "unknown"}`).join(", ");
  } catch {
    return "invalid metadata";
  }
}

function formatConnectorActions(json?: string): string {
  if (!json) return "[]";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function scheduleStatus(run: { manual: boolean; installed: boolean; warnings: string[] }): string {
  const problem = run.warnings.length > 0;
  if (run.manual) return badge(run.installed ? "manual + installed" : "manual", problem ? "warning" : "manual");
  return badge(run.installed ? "installed" : "not installed", problem ? "warning" : run.installed ? "installed" : "missing");
}

function warningsList(warnings: string[]): string {
  if (!warnings.length) return "";
  return `<ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function groupOccurrencesByDate<T extends { time: Date }>(occurrences: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  const labels = new Map<string, string>();
  for (const occurrence of occurrences) {
    const key = occurrence.time.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    if (!labels.has(key)) labels.set(key, formatDateOnly(occurrence.time));
    groups.get(key)!.push(occurrence);
  }
  return [...groups.entries()].map(([key, value]) => [labels.get(key) || key, value]);
}

function formatDateOnly(value: Date): string {
  return value.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function formatTimeOnly(value: Date): string {
  return value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value: Date): string {
  return `${formatDateOnly(value)} ${formatTimeOnly(value)}`;
}

function formatNumber(value: number | null): string {
  return value == null ? "unknown" : new Intl.NumberFormat().format(value);
}

function formatCost(value: number | null, currency: string): string {
  if (value == null) return "unknown";
  return `${currency ? `${escapeHtml(currency)} ` : ""}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)}`;
}

function errorsList(errors: string[]): string {
  if (!errors.length) return "";
  return `<ul class="notice error">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
}

function deleteAutomationForm(name: string): string {
  return `<form method="post" action="/automations/${encodeURIComponent(name)}/delete"><input name="confirm" placeholder="type ${escapeHtml(name)}"><button type="submit">${icon("trash")}Delete</button></form>`;
}

function deleteAgentForm(name: string): string {
  return `<form method="post" action="/agents/${encodeURIComponent(name)}/delete"><input name="confirm" placeholder="type ${escapeHtml(name)}"><button type="submit">${icon("trash")}Delete</button></form>`;
}

function pageMessage(url: URL, keys: string[]): string {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value) return notice(`${key}: ${value}`, "success");
  }
  return "";
}
