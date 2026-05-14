#!/usr/bin/env tsx
import { loadDotEnv } from "../packages/runner/src/env.js";
import { openDb, dbPath } from "../packages/runner/src/db.js";
import { agenthqHome } from "../packages/shared/paths.js";

loadDotEnv();

const db = openDb();
db.close();
console.log(`AgentHQ workspace ready: ${agenthqHome()}`);
console.log(`SQLite database ready: ${dbPath()}`);
