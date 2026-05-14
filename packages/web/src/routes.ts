import { readFile } from "node:fs/promises";

import {
  createAutomation,
  createAgent,
  createProject,
  createTask,
  defaultAgentContent,
  defaultProjectBody,
  deleteAutomation,
  deleteAgent,
  parseAutomationForm,
  parseAgentForm,
  parseProjectForm,
  parseTaskForm,
  readAutomationRaw,
  readAgentRaw,
  readProjectRaw,
  readTaskRaw,
  runNow,
  setTaskStatus,
  updateAutomation,
  updateAgent,
  updateProject,
  updateTaskFile,
  validateAutomation,
  validateAgent,
  validateProject,
  validateTask,
  type AutomationFormValues,
  type AgentFormValues,
  type ProjectFormValues,
  type TaskFormValues,
} from "./actions.js";
import { TASK_STATUSES, type TaskStatus } from "../../shared/tasks.js";
import { badge, date, duration, emptyState, errorPage, escapeHtml, icon, inlineActions, layout, metaTable, notFound, notice, pageHeader, raw, runLink, section, status, table, toolbar } from "./html.js";
import { agenthqHome, dbPath } from "./paths.js";
import { getRun, listAutomations, listInstalledCronBlocks, listRuns, listAgents, listProjects, listTasks, readProject, readSchedulePageView, runAgentName, type TaskView } from "./readers.js";
import { formatTraceLog, type TraceLogEntry } from "./trace-log.js";

export type ResponseData = { status: number; headers?: Record<string, string>; body: string };

export async function route(method: string, url: URL, form?: URLSearchParams): Promise<ResponseData> {
  try {
    if (method === "GET" && url.pathname === "/styles.css") return staticFile("../public/styles.css", "text/css; charset=utf-8");
    if (method === "GET" && url.pathname === "/kanban.js") return staticFile("../public/kanban.js", "application/javascript; charset=utf-8");
    if (method === "GET" && url.pathname === "/") return html(await dashboard());
    if (method === "GET" && url.pathname === "/automations") return html(await automationsPage(url));
    if (method === "GET" && url.pathname === "/schedule") return html(await schedulePage());
    if (method === "GET" && url.pathname === "/projects") return html(await projectsPage(url));
    if (method === "GET" && url.pathname === "/projects/new") return html(await projectFormPage("Create project", parseProjectForm(new URLSearchParams()), []));
    if (method === "POST" && url.pathname === "/projects") return await createProjectRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/tasks") return html(await kanbanPage(url));
    if (method === "GET" && url.pathname === "/tasks/new") return html(await taskFormPage("Create task", parseTaskForm(new URLSearchParams(), url.searchParams.get("project") || ""), []));
    if (method === "POST" && url.pathname === "/tasks") return await createTaskRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/automations/new") return html(await automationFormPage("Create automation", parseAutomationForm(new URLSearchParams()), []));
    if (method === "POST" && url.pathname === "/automations") return await createAutomationRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/agents") return html(await agentsPage(url));
    if (method === "GET" && url.pathname === "/agents/new") return html(agentFormPage("Create agent", { name: "", content: defaultAgentContent("") }, []));
    if (method === "POST" && url.pathname === "/agents") return await createAgentRoute(form || new URLSearchParams());
    if (method === "GET" && url.pathname === "/runs") return html(runsPage(url));

    const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/);
    if (method === "GET" && runMatch) return html(runDetailPage(decodeURIComponent(runMatch[1]!)));

    const projectEditMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && projectEditMatch) {
      const name = decodeURIComponent(projectEditMatch[1]!);
      return html(await projectFormPage(`Edit project ${name}`, await readProjectRaw(name), [], name));
    }

    const projectViewMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)$/);
    if (method === "GET" && projectViewMatch) return html(await projectDetailPage(decodeURIComponent(projectViewMatch[1]!), url));
    if (method === "POST" && projectViewMatch) return await updateProjectRoute(decodeURIComponent(projectViewMatch[1]!), form || new URLSearchParams());

    const taskEditMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)\/edit$/);
    if (method === "GET" && taskEditMatch) {
      const project = decodeURIComponent(taskEditMatch[1]!);
      const id = decodeURIComponent(taskEditMatch[2]!);
      return html(await taskFormPage(`Edit task ${project}/${id}`, await readTaskRaw(project, id), [], project, id));
    }

    const taskStatusMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)\/status$/);
    if (method === "POST" && taskStatusMatch) return await updateTaskStatusRoute(decodeURIComponent(taskStatusMatch[1]!), decodeURIComponent(taskStatusMatch[2]!), form || new URLSearchParams());

    const taskViewMatch = url.pathname.match(/^\/projects\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)$/);
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

async function createProjectRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseProjectForm(form);
  const result = await validateProject(values, "create");
  if (!result.ok) return html(await projectFormPage("Create project", result.values, result.errors), 400);
  await createProject(result.values);
  return redirect("/projects?created=" + encodeURIComponent(result.values.id));
}

async function updateProjectRoute(id: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseProjectForm(form, id);
  const result = await validateProject(values, "update");
  if (!result.ok) return html(await projectFormPage(`Edit project ${id}`, result.values, result.errors, id), 400);
  await updateProject(id, result.values);
  return redirect("/projects?updated=" + encodeURIComponent(id));
}

async function createTaskRoute(form: URLSearchParams): Promise<ResponseData> {
  const values = parseTaskForm(form);
  const result = await validateTask(values, "create");
  if (!result.ok) return html(await taskFormPage("Create task", result.values, result.errors), 400);
  const task = await createTask(result.values);
  return redirect(`/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}?created=1`);
}

async function updateTaskRoute(project: string, id: string, form: URLSearchParams): Promise<ResponseData> {
  const values = parseTaskForm(form, project, id);
  const result = await validateTask(values, "update");
  if (!result.ok) return html(await taskFormPage(`Edit task ${project}/${id}`, result.values, result.errors, project, id), 400);
  await updateTaskFile(project, id, result.values);
  return redirect(`/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(id)}?updated=1`);
}

async function updateTaskStatusRoute(project: string, id: string, form: URLSearchParams): Promise<ResponseData> {
  const next = String(form.get("status") || "");
  try {
    await setTaskStatus(project, id, next);
  } catch (error) {
    if (form.get("format") === "json") return { status: 400, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) };
    return html(layout("Task status error", `<h2>Task status error</h2><p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p><p><a href="/tasks">Back to tasks</a></p>`), 400);
  }
  if (form.get("format") === "json") return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true }) };
  return redirect(form.get("return") || "/tasks");
}

async function dashboard(): Promise<string> {
  const [automations, agents, projects, tasks] = await Promise.all([listAutomations(), listAgents(), listProjects(), listTasks()]);
  const cron = listInstalledCronBlocks();
  const runs = listRuns(10);
  const failures = runs.filter((r) => r.status !== "ok").slice(0, 5);
  return layout("Dashboard", `
    ${pageHeader("Dashboard", { meta: `Workspace: <code>${escapeHtml(agenthqHome())}</code>${process.env.AGENTHQ_HOME ? ` (AGENTHQ_HOME=${escapeHtml(process.env.AGENTHQ_HOME)})` : " (default local workspace)"}<br>DB: <code>${escapeHtml(dbPath())}</code>` })}
    ${section("Workspace summary", `<ul>
      <li>Automations: ${automations.length}</li>
      <li>Agents: ${agents.length}</li>
      <li>Projects: ${projects.length}</li>
      <li>Tasks: ${tasks.length}</li>
      <li>Installed cron jobs: ${cron.length}</li>
      <li>Recent runs shown: ${runs.length}</li>
      <li>Recent failures/running: ${failures.length}</li>
    </ul>`)}
    ${section("Recent failures / running", runsTable(failures, "No recent failures or running jobs."))}
    ${section("Recent runs", runsTable(runs))}
  `);
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
    ${pageHeader("Automations", { actions: `<a href="/automations/new" class="button-link">${icon("plus")}Create automation</a>` })}
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
    ${pageHeader("Schedule", { description: `Read-only agenda for scheduled agent runs from ${escapeHtml(formatDateTime(view.from))} through ${escapeHtml(formatDateTime(view.until))}. Source of truth: automation markdown schedules. Crontab blocks are install status/evidence only.` })}
    ${warningsList(view.warnings)}
    ${section("Upcoming agenda", agenda)}
    ${section("Scheduled run summary", table(["Automation", "Agent", "Schedule", "Model", "Cron", "Next run", "Count", "Warnings"], rows, { empty: "No automations found." }))}
    ${section("Manual automations", table(["Automation", "Agent", "Status", "Warnings"], manualRows, { empty: "No manual automations found." }))}
    ${section("Installed cron orphans", table(["Name", "Command", "Warning"], orphanRows, { empty: "No orphan AgentHQ cron blocks found." }))}
    ${toolbar(`<span class="muted">Scheduled automations in window: ${scheduled.length}. Manual automations are excluded from the occurrence list.</span>`)}
  `);
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
  const action = editingName ? `/automations/${encodeURIComponent(editingName)}` : "/automations";
  const nameAttrs = editingName ? "readonly" : "required";
  return layout(title, `
    ${pageHeader(title)}
    ${errorsList(errors)}
    <form method="post" action="${action}" class="form-stack">
      <label>Name <input name="name" value="${escapeHtml(values.name)}" ${nameAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Agent <select name="agent" required>${agents.map((s) => `<option value="${escapeHtml(s.name)}" ${s.name === values.agent ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}</select></label>
      ${scheduleFields(values.schedule || "manual")}
      <label>Model <input name="model" value="${escapeHtml(values.model)}" placeholder="default"></label>
      <label>Prompt <textarea name="prompt" rows="16" required>${escapeHtml(values.prompt)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/automations">Cancel</a></p>
    </form>
  `);
}

async function projectsPage(url: URL): Promise<string> {
  const projects = await listProjects();
  const message = pageMessage(url, ["created", "updated"]);
  const rows = projects.map((project) => `<tr>
    <td><a href="/projects/${encodeURIComponent(project.id)}"><code>${escapeHtml(project.id)}</code></a>${project.warning ? `<br><b class="error">${escapeHtml(project.warning)}</b>` : ""}</td>
    <td>${escapeHtml(project.name)}</td>
    <td>${clamp(project.description)}</td>
    <td>${escapeHtml(project.default_agent || "")}</td>
    <td>${project.taskCount}</td>
    <td class="actions"><a href="/projects/${encodeURIComponent(project.id)}/edit">${icon("pen")}Edit</a><a href="/tasks?project=${encodeURIComponent(project.id)}">Kanban</a><a href="/tasks/new?project=${encodeURIComponent(project.id)}">${icon("plus")}Task</a></td>
  </tr>`).join("");
  return layout("Projects", `
    <h2>Projects</h2>
    <p><a href="/projects/new" class="button-link">${icon("plus")}Create project</a> <a href="/tasks" class="button-link">Tasks kanban</a></p>
    ${message}
    ${projects.length === 0 ? "<p>No projects found. Create one to start assigning tasks.</p>" : `<table><tr><th>Id</th><th>Name</th><th>Description</th><th>Default agent</th><th>Tasks</th><th>Action</th></tr>${rows}</table>`}
  `);
}

async function projectDetailPage(id: string, url: URL): Promise<string> {
  const project = await readProject(id);
  if (!project) return layout("Project not found", `<h2>Project not found</h2><p>No project found for <code>${escapeHtml(id)}</code>.</p>`);
  const tasks = await listTasks(id);
  return layout(`Project ${id}`, `
    <h2>Project <code>${escapeHtml(id)}</code></h2>
    ${pageMessage(url, ["created", "updated"])}
    <p><a href="/projects/${encodeURIComponent(id)}/edit">Edit</a> <a href="/tasks/new?project=${encodeURIComponent(id)}">Create task</a> <a href="/tasks?project=${encodeURIComponent(id)}">Kanban</a> <a href="/projects">Back to projects</a></p>
    <table>
      <tr><th>Name</th><td>${escapeHtml(project.name)}</td></tr>
      <tr><th>Description</th><td>${escapeHtml(project.description)}</td></tr>
      <tr><th>Default agent</th><td>${escapeHtml(project.default_agent || "")}</td></tr>
      <tr><th>Path</th><td><code>${escapeHtml(project.path || "")}</code></td></tr>
    </table>
    <h3>Project body</h3>
    ${project.body ? `<pre>${escapeHtml(project.body)}</pre>` : "<p class=\"muted\">No project body.</p>"}
    <h3>Tasks</h3>
    ${tasksTable(tasks)}
  `);
}

async function kanbanPage(url: URL): Promise<string> {
  const project = url.searchParams.get("project") || undefined;
  const tasks = await listTasks(project);
  const columns = TASK_STATUSES.map((statusName) => {
    const cards = tasks.filter((task) => task.status === statusName).map(taskCard).join("");
    return `<section class="kanban-column" data-status="${escapeHtml(statusName)}"><h3>${escapeHtml(statusName)} <span class="muted">${tasks.filter((task) => task.status === statusName).length}</span></h3><div class="kanban-dropzone">${cards || "<p class=\"muted\">No tasks.</p>"}</div></section>`;
  }).join("");
  return layout("Tasks", `
    <h2>Tasks${project ? ` for <code>${escapeHtml(project)}</code>` : ""}</h2>
    <p><a href="/tasks/new${project ? `?project=${encodeURIComponent(project)}` : ""}" class="button-link">${icon("plus")}Create task</a> <a href="/projects" class="button-link">Projects</a></p>
    ${pageMessage(url, ["created", "updated"])}
    <div class="kanban-board" data-kanban>${columns}</div>
    <script src="/kanban.js" defer></script>
  `);
}

async function projectFormPage(title: string, values: ProjectFormValues, errors: string[], editingId?: string): Promise<string> {
  const agents = await listAgents();
  const action = editingId ? `/projects/${encodeURIComponent(editingId)}` : "/projects";
  const idAttrs = editingId ? "readonly" : "required";
  const body = values.body || defaultProjectBody(values.name || values.id);
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Project id <input name="id" value="${escapeHtml(values.id)}" ${idAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Name <input name="name" value="${escapeHtml(values.name)}" required></label>
      <label>Description <input name="description" value="${escapeHtml(values.description)}"></label>
      <label>Default agent <select name="default_agent"><option value="">none</option>${agents.map((agent) => `<option value="${escapeHtml(agent.name)}" ${agent.name === values.default_agent ? "selected" : ""}>${escapeHtml(agent.name)}</option>`).join("")}</select></label>
      <label>Project body <textarea name="body" rows="14">${escapeHtml(body)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/projects">Cancel</a></p>
    </form>
  `);
}

async function taskFormPage(title: string, values: TaskFormValues, errors: string[], editingProject?: string, editingId?: string): Promise<string> {
  const [projects, agents] = await Promise.all([listProjects(), listAgents()]);
  const action = editingProject && editingId ? `/projects/${encodeURIComponent(editingProject)}/tasks/${encodeURIComponent(editingId)}` : "/tasks";
  const idAttrs = editingId ? "readonly required" : "placeholder=\"auto-generated\"";
  return layout(title, `
    <h2>${escapeHtml(title)}</h2>
    ${errorsList(errors)}
    <form method="post" action="${action}" class="stack">
      <label>Project <select name="project" required ${editingProject ? "readonly" : ""}>${projects.map((project) => `<option value="${escapeHtml(project.id)}" ${project.id === values.project ? "selected" : ""}>${escapeHtml(project.id)}</option>`).join("")}</select></label>
      <label>Task id <input name="id" value="${escapeHtml(values.id)}" ${idAttrs} pattern="[a-z0-9][a-z0-9-]*"></label>
      <label>Title <input name="title" value="${escapeHtml(values.title)}" required></label>
      <label>Status <select name="status" required>${TASK_STATUSES.map((entry) => `<option value="${entry}" ${entry === values.status ? "selected" : ""}>${entry}</option>`).join("")}</select></label>
      <label>Assignee <select name="assignee"><option value="">unassigned</option>${agents.map((agent) => `<option value="${escapeHtml(agent.name)}" ${agent.name === values.assignee ? "selected" : ""}>${escapeHtml(agent.name)}</option>`).join("")}</select></label>
      <label>Priority <select name="priority">${["low", "normal", "high", "urgent"].map((entry) => `<option value="${entry}" ${entry === values.priority ? "selected" : ""}>${entry}</option>`).join("")}</select></label>
      <label>Task body <textarea name="body" rows="16">${escapeHtml(values.body)}</textarea></label>
      <p><button type="submit">${icon("checkmark")}Save</button> <a href="/tasks${values.project ? `?project=${encodeURIComponent(values.project)}` : ""}">Cancel</a></p>
    </form>
  `);
}

async function taskDetailPage(project: string, id: string): Promise<string> {
  const task = (await listTasks(project)).find((entry) => entry.id === id);
  if (!task) return layout("Task not found", `<h2>Task not found</h2><p>No task found for <code>${escapeHtml(project)}/${escapeHtml(id)}</code>.</p>`);
  return layout(`Task ${project}/${id}`, `
    <h2>Task <code>${escapeHtml(project)}/${escapeHtml(id)}</code></h2>
    <p><a href="/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(id)}/edit">Edit</a> <a href="/tasks?project=${encodeURIComponent(project)}">Kanban</a> <a href="/projects/${encodeURIComponent(project)}">Project</a></p>
    ${task.warning ? `<p class="error">${escapeHtml(task.warning)}</p>` : ""}
    <table>
      <tr><th>Title</th><td>${escapeHtml(task.title)}</td></tr>
      <tr><th>Status</th><td>${escapeHtml(task.status)}</td></tr>
      <tr><th>Assignee</th><td>${escapeHtml(task.assignee)}</td></tr>
      <tr><th>Priority</th><td>${escapeHtml(task.priority)}</td></tr>
      <tr><th>Attempts</th><td>${task.attempts}</td></tr>
      <tr><th>Latest run</th><td>${task.latestRun ? runLink(task.latestRun) : ""}</td></tr>
      <tr><th>Path</th><td><code>${escapeHtml(task.path || "")}</code></td></tr>
    </table>
    <h3>Status actions</h3>
    <div class="inline-actions">${statusActionForms(task, `/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(id)}`)}</div>
    <h3>Body</h3>
    ${task.body ? `<pre>${escapeHtml(task.body)}</pre>` : "<p class=\"muted\">No task body.</p>"}
  `);
}

function tasksTable(tasks: TaskView[]): string {
  const rows = tasks.map((task) => [
    raw(`<a href="/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}"><code>${escapeHtml(task.id)}</code></a><br>${escapeHtml(task.title)}${task.warning ? `<br><b class="error">${escapeHtml(task.warning)}</b>` : ""}`),
    task.status,
    task.assignee,
    task.priority,
    raw(task.latestRun ? runLink(task.latestRun) : ""),
    raw(inlineActions(`<a href="/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}/edit">${icon("pen")}Edit</a>${statusActionForms(task, `/projects/${encodeURIComponent(task.project)}`)}`)),
  ]);
  return table(["Task", "Status", "Assignee", "Priority", "Latest run", "Action"], rows, { empty: "No tasks found." });
}

function taskCard(task: TaskView): string {
  return `<article class="kanban-card" draggable="true" data-project="${escapeHtml(task.project)}" data-task-id="${escapeHtml(task.id)}">
    <h4><a href="/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}">${escapeHtml(task.title)}</a></h4>
    <p><code>${escapeHtml(task.project)}/${escapeHtml(task.id)}</code></p>
    <p class="muted">${escapeHtml(task.priority)}${task.assignee ? ` · ${escapeHtml(task.assignee)}` : " · unassigned"}</p>
    ${task.latestRun ? `<p>Run ${runLink(task.latestRun)} ${status(task.latestRun.status)}</p>` : ""}
    ${task.warning ? `<p class="error">${escapeHtml(task.warning)}</p>` : ""}
    <div class="card-actions">${statusActionForms(task, `/tasks${task.project ? `?project=${encodeURIComponent(task.project)}` : ""}`)} <a href="/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}/edit">Edit</a></div>
  </article>`;
}

function statusActionForms(task: Pick<TaskView, "project" | "id" | "status">, returnPath: string): string {
  const actions: TaskStatus[] = ["ready", "blocked", "review", "done"];
  return actions.filter((next) => next !== task.status).map((next) => `<form method="post" action="/projects/${encodeURIComponent(task.project)}/tasks/${encodeURIComponent(task.id)}/status"><input type="hidden" name="status" value="${next}"><input type="hidden" name="return" value="${escapeHtml(returnPath)}"><button type="submit">${escapeHtml(next)}</button></form>`).join(" ");
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
  const agents = await listAgents();
  const message = pageMessage(url, ["created", "updated", "deleted"]);
  const rows = agents.map((s) => [
    raw(`<a href="/agents/${encodeURIComponent(s.name)}"><code>${escapeHtml(s.name)}</code></a>${s.warning ? `<br><b>${escapeHtml(s.warning)}</b>` : ""}`),
    raw(clamp(s.description)),
    raw(clampCode(s.path)),
    raw(inlineActions(`<a href="/agents/${encodeURIComponent(s.name)}/edit">${icon("pen")}Edit</a><details><summary>${icon("trash")}Delete</summary>${deleteAgentForm(s.name)}</details>`)),
  ]);
  return layout("Agents", `
    ${pageHeader("Agents", { actions: `<a href="/agents/new" class="button-link">${icon("plus")}Create agent</a>` })}
    ${message}
    ${section("Agent files", table(["Name", "Description", "Path", "Action"], rows, { empty: "No agents found." }))}
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
    ${pageHeader(title, { description: "Advanced: agents are Pi instructions/system-prompt-like files. Edit raw AGENT.md carefully." })}
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
  return layout("Runs", `${pageHeader("Runs")}${message}${section("History", runsTable(runs))}`);
}

function runDetailPage(id: string): string {
  const run = getRun(id);
  if (!run) return layout("Run not found", `${pageHeader("Run not found")}<p>No run found for <code>${escapeHtml(id)}</code>.</p>`);
  return layout(`Run ${id}`, `
    ${pageHeader(`Run ${run.id}`)}
    ${section("Details", metaTable([
      ["Automation", run.automation],
      ["Agent", runAgentName(run)],
      ["Project/task", raw(run.project && run.task_id ? `<a href="/projects/${encodeURIComponent(run.project)}/tasks/${encodeURIComponent(run.task_id)}"><code>${escapeHtml(run.project)}/${escapeHtml(run.task_id)}</code></a>` : "")],
      ["Status", raw(status(run.status))],
      ["Started", raw(date(run.started_at))],
      ["Finished", raw(date(run.finished_at))],
      ["Duration", duration(run.duration_ms)],
      ["Exit", run.exit_code ?? ""],
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
    r.automation,
    runAgentName(r),
    raw(r.project && r.task_id ? `<a href="/projects/${encodeURIComponent(r.project)}/tasks/${encodeURIComponent(r.task_id)}"><code>${escapeHtml(r.project)}/${escapeHtml(r.task_id)}</code></a>` : ""),
    raw(status(r.status)),
    raw(clamp(connectorSummary(r.connector_actions_json))),
    raw(date(r.started_at)),
    duration(r.duration_ms),
    r.exit_code ?? "",
  ]);
  return table(["Run", "Automation", "Agent", "Task", "Status", "Connector", "Started", "Duration", "Exit"], rows, { empty });
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
