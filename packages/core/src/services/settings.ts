import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { settingsPath } from "../../../shared/paths.js";
import { defaultSettingsText, loadSettings, parseSettingsText } from "../../../shared/settings.js";
import type { RevisionPrecondition, SettingsDto } from "../dto.js";
import { assertRevision, fileMeta, writeAtomic } from "../files.js";

export type SettingsUpdateInput = RevisionPrecondition & {
  content: string;
};

export interface SettingsService {
  get(): Promise<SettingsDto>;
  update(input: SettingsUpdateInput): Promise<SettingsDto>;
}

export async function getSettings(): Promise<SettingsDto> {
  const file = settingsPath();
  const exists = existsSync(file);
  if (!exists) {
    return { path: file, exists: false, content: defaultSettingsText(), settings: parseSettingsText(defaultSettingsText()) };
  }
  const content = await readFile(file, "utf8");
  return {
    exists: true,
    content,
    settings: loadSettings(file),
    ...(await fileMeta(file)),
  };
}

export async function updateSettings(input: SettingsUpdateInput): Promise<SettingsDto> {
  if (existsSync(settingsPath())) await assertRevision(settingsPath(), input.ifMatch);
  parseSettingsText(input.content);
  await writeAtomic(settingsPath(), input.content.trimEnd() + "\n");
  return getSettings();
}
