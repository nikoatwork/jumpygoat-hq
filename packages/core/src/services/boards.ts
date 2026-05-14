import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { agentPath, boardDir, boardPath, boardsDir, tasksDir } from "../../../shared/paths.js";
import { boardExists, loadBoard, parseBoardMarkdown, writeBoard, type Board } from "../../../shared/tasks.js";
import type { BoardDto, ListOptions, RevisionPrecondition } from "../dto.js";
import { conflictError, notFoundError, validationError } from "../errors.js";
import { assertRevision, fileMeta } from "../files.js";
import { assertBoardName, isSafeName } from "../names.js";

export type BoardCreateInput = {
  id: string;
  name: string;
  description: string;
  defaultAgent?: string;
  body: string;
};

export type BoardUpdateInput = RevisionPrecondition & BoardCreateInput;

export interface BoardService {
  list(options?: ListOptions): Promise<BoardDto[]>;
  get(id: string, options?: ListOptions): Promise<BoardDto>;
  create(input: BoardCreateInput): Promise<BoardDto>;
  update(id: string, input: BoardUpdateInput): Promise<BoardDto>;
  delete(id: string): Promise<void>;
}

export async function listBoards(options: ListOptions = {}): Promise<BoardDto[]> {
  if (!existsSync(boardsDir())) return [];
  const entries = await readdir(boardsDir(), { withFileTypes: true });
  const boards: BoardDto[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    try {
      boards.push(await readBoardFile(entry.name, options));
    } catch (error) {
      boards.push({
        id: entry.name,
        name: entry.name,
        description: "",
        body: "",
        path: boardPath(entry.name),
        taskCount: 0,
        warning: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return boards;
}

export async function getBoard(id: string, options: ListOptions = {}): Promise<BoardDto> {
  assertBoardName(id);
  if (!existsSync(boardPath(id))) throw notFoundError(`Board not found: ${id}`);
  return readBoardFile(id, options);
}

export async function createBoard(input: BoardCreateInput): Promise<BoardDto> {
  validateBoardInput(input, "create");
  await writeBoard(boardFromInput(input));
  return getBoard(input.id, { includeRaw: true });
}

export async function updateBoard(id: string, input: BoardUpdateInput): Promise<BoardDto> {
  assertBoardName(id);
  if (id !== input.id) throw conflictError("Renaming boards is not supported. Create a new board instead.");
  validateBoardInput(input, "update");
  await assertRevision(boardPath(id), input.ifMatch);
  await writeBoard(boardFromInput(input));
  return getBoard(id, { includeRaw: true });
}

export async function deleteBoard(id: string): Promise<void> {
  assertBoardName(id);
  if (!existsSync(boardPath(id))) throw notFoundError(`Board not found: ${id}`);
  await rm(boardDir(id), { recursive: true, force: false });
}

export function defaultBoardBody(name: string): string {
  return `# ${name || "Board"}\n\nDescribe the board context, constraints, and definition of done for assigned tasks.\n`;
}

async function readBoardFile(id: string, options: ListOptions): Promise<BoardDto> {
  const file = boardPath(id);
  const raw = await readFile(file, "utf8");
  const board = parseBoardMarkdown(id, raw, file);
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    defaultAgent: board.default_agent,
    body: board.body,
    taskCount: await countBoardTasks(id),
    ...(options.includeRaw ? { rawMarkdown: raw } : {}),
    ...(await fileMeta(file)),
  };
}

async function countBoardTasks(board: string): Promise<number> {
  const dir = tasksDir(board);
  if (!existsSync(dir)) return 0;
  return (await readdir(dir)).filter((file) => file.endsWith(".md")).length;
}

export function validateBoardInput(input: BoardCreateInput, mode: "create" | "update"): void {
  const fields = [];
  if (!isSafeName(input.id)) fields.push({ field: "id", message: "Board id must use lowercase letters, numbers, and hyphens only." });
  if (!input.name) fields.push({ field: "name", message: "Board name is required." });
  if (input.defaultAgent && !existsSync(agentPath(input.defaultAgent))) fields.push({ field: "defaultAgent", message: `Default agent does not exist: ${input.defaultAgent}` });
  if (isSafeName(input.id)) {
    const exists = boardExists(input.id);
    if (mode === "create" && exists) fields.push({ field: "id", message: `Board already exists: ${input.id}` });
    if (mode === "update" && !exists) fields.push({ field: "id", message: `Board does not exist: ${input.id}` });
  }
  if (fields.length) throw validationError("Board validation failed.", fields);
}

function boardFromInput(input: BoardCreateInput): Board {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    default_agent: input.defaultAgent || undefined,
    body: input.body,
  };
}

export const listProjects = listBoards;
export const getProject = getBoard;
export const createProject = createBoard;
export const updateProject = updateBoard;
export const deleteProject = deleteBoard;
export const defaultProjectBody = defaultBoardBody;
