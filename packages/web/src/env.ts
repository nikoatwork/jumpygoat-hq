import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

export function loadDotEnv(): void {
  // Load local secrets first so they win over .env, while preserving shell env precedence.
  for (const name of [".env.local", ".env"]) {
    const file = path.join(repoRoot(), name);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
