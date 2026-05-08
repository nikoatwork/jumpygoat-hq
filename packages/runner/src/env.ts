import dotenv from "dotenv";
import path from "node:path";
import { repoRoot } from "./paths.js";

export function loadDotEnv(): void {
  // Load local secrets first so they win over .env, while preserving shell env precedence.
  for (const name of [".env.local", ".env"]) {
    dotenv.config({ path: path.join(repoRoot(), name) });
  }
}
