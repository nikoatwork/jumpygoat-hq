import { readFile } from "node:fs/promises";

import {
  createAutomation,
  createSkill,
  defaultSkillContent,
  deleteAutomation,
  deleteSkill,
  parseAutomationForm,
  parseSkillForm,
  readAutomationRaw,
  readSkillRaw,
  runNow,
  updateAutomation,
  updateSkill,
  validateAutomation,
  validateSkill,
  type AutomationFormValues,
  type SkillFormValues,
} from "./actions.js";
import { date, duration, errorPage, escapeHtml, icon, layout, notFound, runLink, status } from "./html.js";
import { dbPath } from "./paths.js";
import { getRun, listAutomations, listInstalledCronBlocks, listRuns, listSkills } from "./readers.js";
import { formatTraceLog, type TraceLogEntry } from "./trace-log.js";

export type ResponseData = { status: number; headers?: Record<string, string>; body: string };

export async function route(method: string, url: URL, form?: URLSearchParams): Promise<ResponseData> {
  try {
    if (method === "GET" && url.pathname === "/styles.css") return stylesheet();
    if (method === "GET" && url.pathname === "/") return html(await dashboard());
    if (method === "GET" && url.pathname === "/automations") return html(await automationsPage(url));
    if (method === "GET" && url.pathname === "/automations/new") return html(await automationFormPage("Create automation", parseAutomationForm(new URLSearchParams()), []));
    if (method === "POST" && url.pathname === "/automations") return await createAutomationRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/skills") return html(await skillsPage(url));
    if (method === "GET" && url.pathname === "/skills/new") return html(skillFormPage("Create skill", { name: "", content: defaultSkillContent("") }, []));
    if (method === "POST" && url.pathname === "/skills") return await createSkillRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/runs") return html(runsPage(url));

    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (method === "GET" && runMatch) return html(runDetailPage(decodeURIComponent(runMatch[1]!)));

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

    const skillEditMatch = url.pathname.match(/^\/skills\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && skillEditMatch) {
      const name = decodeURIComponent(skillEditMatch[1]!);
      return html(skillFormPage(`Edit skill ${name}`, await readSkillRaw(name), [], name));
    }

    const skillViewMatch = url.pathname.match(/^\/skills\/([a-z0-9-]+)$/);
    if (method === "GET" && skillViewMatch) return html(await skillDetailPage(decodeURIComponent(skillViewMatch[1]!)));
    if (method === "POST" && skillViewMatch) return await updateSkillRoute(decodeURIComponent(skillViewMatch[1]!), form || new URLSearchParams());

    const skillDeleteMatch = url.pathname.match(/^\/skills\/([a-z0-9-]+)\/delete$/);
    if (method === "POST" && skillDeleteMatch) return await deleteSkillRoute(decodeURIComponent(skillDeleteMatch[1]!), form || new URLSearchParams());

    return { status: 404, body: notFound() };
  } catch (error) {
    return { status: 500, body: errorPage("Error", error) };
  }
}

function html(body: string, status = 200): ResponseData {
  return { status, headers: { "content-type": "text/html; charset=utf-8" }, body };
}

async function stylesheet(): Promise<ResponseData> {
  const body = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  return { status: 200, headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" }, body };
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

async function createSkillRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseSkillForm(form);
  const result = validateSkill(values, "create");
  if (!result.ok) return html(skillFormPage("Create skill", result.values, result.errors), 400);
  await createSkill(result.values);
  return redirect("/skills?created=" + encodeURIComponent(result.values.name));
}

async function updateSkillRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseSkillForm(form, name);
  const result = validateSkill(values, "update");
  if (!result.ok) return html(skillFormPage(`Edit skill ${name}`, result.values, result.errors, name), 400);
  await updateSkill(name, result.values);
  return redirect("/skills?updated=" + encodeURIComponent(name));
}

async function deleteSkillRoute(name: string, form: URLSearchParams): Promise<ResponseData> {
  if (form.get("confirm") !== name) return html(layout("Delete skill", `<h2>Delete skill <code>${escapeHtml(name)}</code></h2><p class="error">Type the skill name to confirm deletion.</p>${deleteSkillForm(name)}`), 400);
  try {
    await deleteSkill(name);
  } catch (error) {
    return html(layout("Delete skill", `<h2>Delete skill <code>${escapeHtml(name)}</code></h2><p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>${deleteSkillForm(name)}`), 400);
  }
  return redirect("/skills?deleted=" + encodeURIComponent(name));
}

async function dashboard(): Promise<string> {
  const [automations, skills] = await Promise.all([listAutomations(), listSkills()]);
  const cron = listInstalledCronBlocks();
  const runs = listRuns(10);
  const failures = runs.filter((r) => r.status !== "ok").slice(0, 5);
  return layout("Dashboard", `
    <h2>Dashboard</h2>
    <p class="muted">DB: <code>${escapeHtml(dbPath())}</code></p>
    <ul>
      <li>Automations: ${automations.length}</li>
      <li>Skills: ${skills.length}</li>
      <li>Installed cron jobs: ${cron.length}</li>
      <li>Recent runs shown: ${runs.length}</li>
      <li>Recent failures/running: ${failures.length}</li>
    </ul>
    <h3>Recent failures / running</h3>
    ${runsTable(failures)}
    <h3>Recent runs</h3>
    ${runsTable(runs)}
  `);
}

async function automationsPage(url: URL): Promise<string> {
  const automations = await listAutomations();
  const cronNames = new Set(listInstalledCronBlocks().map((b) => b.name));
  const message = pageMessage(url, ["ran", "created", "updated", "deleted"]);
  const rows = automations.map((a) => `<tr>
    <td><a href="/automations/${encodeURIComponent(a.name)}"><code>${escapeHtml(a.name)}</code></a>${a.warning ? `<br><b>${escapeHtml(a.warning)}</b>` : ""}</td>
    <td>${escapeHtml(a.skill)}</td>
    <td>${scheduleLabel(a.schedule)}</td>
    <td>${escapeHtml(a.model || "default")}</td>
    <td>${cronNames.has(a.name) ? "yes" : "no"}</td>
    <td>${clamp(a.promptPreview)}</td>
    <td class="actions">
      <form method="post" action="/automations/${encodeURIComponent(a.name)}/run"><button type="submit">${icon("play")}Run now</button></form>
      <a href="/automations/${encodeURIComponent(a.name)}/edit">${icon("pen")}Edit</a>
      <details><summary>${icon("trash")}Delete</summary>${deleteAutomationForm(a.name)}</details>
    </td>
  </tr>`).join("");
  return layout("Automations", `
    <h2>Automations</h2>
    <p><a href="/automations/new" class="button-link">${icon("plus")}Create automation</a></p>
    ${message}
    ${automations.length === 0 ? "<p>No automations found.</p>" : `<table><tr><th>Name</th><th>Skill</th><th>Schedule</th><th>Model</th><th>Cron installed</th><th>Prompt</th><th>Action</th></tr>${rows}</table>`}
  `);
}

async function automationDetailPage(name: string): Promise<string> {
  const automation = await readAutomationRaw(name);
  return layout(`Automation ${name}`, `
    <h2>Automation <code>${escapeHtml(name)}</code></h2>
    <p><a href="/automations/${encodeURIComponent(name)}/edit">Edit</a> <a href="/automations">Back to automations</a></p>
    <table>
      <tr><th>Skill</th><td>${escapeHtml(automation.skill)}</td></tr>
      <tr><th>Schedule</th><td>${scheduleLabel(automation.schedule)}</td></tr>
      <tr><th>Model</th><td>${escapeHtml(automation.model || "default")}</td></tr>
    </table>
    <h3>Prompt</h3>
    <pre>${escapeHtml(automation.prompt)}</pre>
  `);
}

async function automationFormPage(title: string, values: AutomationFormValues, errors: string[], editingName?: string): Promise<string> {
  const skills = await listSkills();
  const action = editingName ? `/automations/${encodeURIComponent(editingName)}` : "/automations";
  const nameAttrs = editingName ? "readonly" : "required";
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Name <input name="name" value="${escapeHtml(values.name)}" ${nameAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Skill <select name="skill" required>${skills.map((s) => `<option value="${escapeHtml(s.name)}" ${s.name === values.skill ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
      ${scheduleFields(values.schedule || "manual")}
      <label>Model <input name="model" value="${escapeHtml(values.model)}" placeholder="default"></label>
      <label>Prompt <textarea name="prompt" rows="16" required>${escapeHtml(values.prompt)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/automations">Cancel</a></p>
    </form>
  `);
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

async function skillsPage(url: URL): Promise<string> {
  const skills = await listSkills();
  const message = pageMessage(url, ["created", "updated", "deleted"]);
  const rows = skills.map((s) => `<tr><td><a href="/skills/${encodeURIComponent(s.name)}"><code>${escapeHtml(s.name)}</code></a>${s.warning ? `<br><b>${escapeHtml(s.warning)}</b>` : ""}</td><td>${clamp(s.description)}</td><td>${clampCode(s.path)}</td><td class="actions"><a href="/skills/${encodeURIComponent(s.name)}/edit">${icon("pen")}Edit</a><details><summary>${icon("trash")}Delete</summary>${deleteSkillForm(s.name)}</details></td></tr>`).join("");
  return layout("Skills", `<h2>Skills</h2><p><a href="/skills/new" class="button-link">${icon("plus")}Create skill</a></p>${message}${skills.length === 0 ? "<p>No skills found.</p>" : `<table><tr><th>Name</th><th>Description</th><th>Path</th><th>Action</th></tr>${rows}</table>`}`);
}

async function skillDetailPage(name: string): Promise<string> {
  const skill = await readSkillRaw(name);
  return layout(`Skill ${name}`, `
    <h2>Skill <code>${escapeHtml(name)}</code></h2>
    <p><a href="/skills/${encodeURIComponent(name)}/edit">Edit</a> <a href="/skills">Back to skills</a></p>
    <pre>${escapeHtml(skill.content)}</pre>
  `);
}

function skillFormPage(title: string, values: SkillFormValues, errors: string[], editingName?: string): string {
  const action = editingName ? `/skills/${encodeURIComponent(editingName)}` : "/skills";
  const nameAttrs = editingName ? "readonly" : "required";
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    <p class="muted">Advanced: skills are Pi instructions/system-prompt-like files. Edit raw <code>SKILL.md</code> carefully.</p>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Name <input name="name" value="${escapeHtml(values.name)}" ${nameAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>SKILL.md <textarea name="content" rows="24" required>${escapeHtml(values.content)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/skills">Cancel</a></p>
    </form>
  `);
}

function runsPage(url: URL): string {
  const runs = listRuns(100);
  const message = url.searchParams.get("ran") ? `<p>Finished run request for: <code>${escapeHtml(url.searchParams.get("ran"))}</code></p>` : "";
  return layout("Runs", `<h2>Runs</h2>${message}${runsTable(runs)}`);
}

function runDetailPage(id: string): string {
  const run = getRun(id);
  if (!run) return layout("Run not found", `<h2>Run not found</h2><p>No run found for <code>${escapeHtml(id)}</code>.</p>`);
  return layout(`Run ${id}`, `
    <h2>Run <code>${escapeHtml(run.id)}</code></h2>
    <table>
      <tr><th>Automation</th><td>${escapeHtml(run.automation)}</td></tr>
      <tr><th>Skill</th><td>${escapeHtml(run.skill)}</td></tr>
      <tr><th>Status</th><td>${status(run.status)}</td></tr>
      <tr><th>Started</th><td>${date(run.started_at)}</td></tr>
      <tr><th>Finished</th><td>${date(run.finished_at)}</td></tr>
      <tr><th>Duration</th><td>${duration(run.duration_ms)}</td></tr>
      <tr><th>Exit</th><td>${escapeHtml(run.exit_code ?? "")}</td></tr>
      <tr><th>Connector actions</th><td><pre>${escapeHtml(formatConnectorActions(run.connector_actions_json))}</pre></td></tr>
    </table>
    <h3>Timeline</h3>
    ${traceLog(formatTraceLog(run.trace_text))}
    <h3>Output</h3>
    ${run.output_text ? `<pre>${escapeHtml(run.output_text)}</pre>` : "<p class=\"muted\">No output text captured.</p>"}
    ${run.error_text ? `<h3>Error</h3><pre>${escapeHtml(run.error_text)}</pre>` : ""}
    <details><summary>Raw trace JSONL</summary><pre>${escapeHtml(run.trace_text)}</pre></details>
  `);
}

function traceLog(entries: TraceLogEntry[]): string {
  if (entries.length === 0) return "<p class=\"muted\">No trace events captured.</p>";
  return `<table class="trace-log"><tr><th>Kind</th><th>Event</th><th>Detail</th></tr>${entries.map((entry) => `<tr><td><span class="trace-kind trace-${escapeHtml(entry.category)}">${escapeHtml(entry.category)}</span></td><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(entry.detail || "")}</td></tr>`).join("")}</table>`;
}

function runsTable(runs: ReturnType<typeof listRuns>): string {
  if (runs.length === 0) return "<p>No runs found.</p>";
  return `<table><tr><th>Run</th><th>Automation</th><th>Skill</th><th>Status</th><th>Connector</th><th>Started</th><th>Duration</th><th>Exit</th></tr>${runs.map((r) => `<tr><td>${runLink(r)}</td><td>${escapeHtml(r.automation)}</td><td>${escapeHtml(r.skill)}</td><td>${status(r.status)}</td><td>${clamp(connectorSummary(r.connector_actions_json))}</td><td>${date(r.started_at)}</td><td>${duration(r.duration_ms)}</td><td>${escapeHtml(r.exit_code ?? "")}</td></tr>`).join("")}</table>`;
}

function clamp(value: string): string {
  return `<div tabindex="0" data-tooltip="${escapeHtml(value)}"><div class="cell-clamp">${escapeHtml(value)}</div></div>`;
}

function clampCode(value: string): string {
  return `<div tabindex="0" data-tooltip="${escapeHtml(value)}"><div class="cell-clamp"><code>${escapeHtml(value)}</code></div></div>`;
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

function errorsList(errors: string[]): string {
  if (!errors.length) return "";
  return `<ul class="error">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
}

function deleteAutomationForm(name: string): string {
  return `<form method="post" action="/automations/${encodeURIComponent(name)}/delete"><input name="confirm" placeholder="type ${escapeHtml(name)}"><button type="submit">${icon("trash")}Delete</button></form>`;
}

function deleteSkillForm(name: string): string {
  return `<form method="post" action="/skills/${encodeURIComponent(name)}/delete"><input name="confirm" placeholder="type ${escapeHtml(name)}"><button type="submit">${icon("trash")}Delete</button></form>`;
}

function pageMessage(url: URL, keys: string[]): string {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value) return `<p>${escapeHtml(key)}: <code>${escapeHtml(value)}</code></p>`;
  }
  return "";
}
