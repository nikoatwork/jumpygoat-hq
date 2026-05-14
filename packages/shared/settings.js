import { existsSync, readFileSync } from "node:fs";
import { agenthqHome, settingsPath } from "./paths.js";

export const DEFAULT_SETTINGS = Object.freeze({
  defaultModelProfile: undefined,
  modelProfiles: Object.freeze({}),
});

const PROFILE_KEY = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_SELECTOR_LENGTH = 200;
const MAX_LABEL_LENGTH = 80;

export function loadSettings(file = settingsPath()) {
  if (!existsSync(file)) return { ...DEFAULT_SETTINGS, modelProfiles: {} };
  try {
    return parseSettingsText(readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse AgentHQ settings at ${file}: ${message}`);
  }
}

export function parseSettingsText(text) {
  const raw = parseSimpleYaml(text);
  if (!isObject(raw)) throw new Error("Settings must be a YAML object.");

  const defaultModelProfile = raw.defaultModelProfile == null || raw.defaultModelProfile === "" ? undefined : String(raw.defaultModelProfile);
  const profilesRaw = raw.modelProfiles == null ? {} : raw.modelProfiles;
  if (!isObject(profilesRaw)) throw new Error("modelProfiles must be a mapping of profile keys to Pi model selectors.");

  const modelProfiles = {};
  for (const [key, value] of Object.entries(profilesRaw)) {
    assertProfileKey(key);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const selector = String(value).trim();
      assertSelector(selector, `modelProfiles.${key}`);
      modelProfiles[key] = { selector };
      continue;
    }
    if (!isObject(value)) throw new Error(`modelProfiles.${key} must be a selector string or object.`);
    const selector = value.selector == null ? "" : String(value.selector).trim();
    assertSelector(selector, `modelProfiles.${key}.selector`);
    const label = value.label == null || value.label === "" ? undefined : String(value.label).trim();
    if (label) assertLabel(label, `modelProfiles.${key}.label`);
    modelProfiles[key] = label ? { selector, label } : { selector };
  }

  if (defaultModelProfile) {
    assertProfileKey(defaultModelProfile, "defaultModelProfile");
    if (!modelProfiles[defaultModelProfile]) {
      throw new Error(`defaultModelProfile must reference a configured modelProfiles key: ${defaultModelProfile}`);
    }
  }

  return { defaultModelProfile, modelProfiles };
}

export function formatSettings(settings) {
  const lines = ["# AgentHQ instance settings", "# Secrets/API keys stay in Pi config or environment, never here."];
  if (settings.defaultModelProfile) lines.push(`defaultModelProfile: ${quoteYaml(settings.defaultModelProfile)}`);
  else lines.push("defaultModelProfile: null");
  lines.push("modelProfiles:");
  const entries = Object.entries(settings.modelProfiles || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    lines.push("  # fast: \"provider:fast-model\"");
    lines.push("  # super-smart:");
    lines.push("  #   selector: \"provider:smart-model\"");
    lines.push("  #   label: \"Super smart\"");
  } else {
    for (const [key, profile] of entries) {
      lines.push(`  ${key}:`);
      lines.push(`    selector: ${quoteYaml(profile.selector)}`);
      if (profile.label) lines.push(`    label: ${quoteYaml(profile.label)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function defaultSettingsText() {
  return formatSettings(DEFAULT_SETTINGS);
}

export function resolveModelRequest(requestedModel, settings = DEFAULT_SETTINGS) {
  const requested = typeof requestedModel === "string" && requestedModel.trim() ? requestedModel.trim() : settings.defaultModelProfile;
  if (!requested) return { requestedModel: undefined, resolvedModel: undefined, profileKey: undefined, warning: undefined };

  const profile = settings.modelProfiles?.[requested];
  if (profile) {
    return { requestedModel: requested, resolvedModel: profile.selector, profileKey: requested, warning: undefined };
  }

  return {
    requestedModel: requested,
    resolvedModel: requested,
    profileKey: undefined,
    warning: `Model profile '${requested}' is not configured; passing it through as a concrete Pi model selector.`,
  };
}

export function settingsLocation() {
  return { home: agenthqHome(), path: settingsPath() };
}

function assertProfileKey(value, field = "profile key") {
  if (!PROFILE_KEY.test(value)) {
    throw new Error(`${field} must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens (max 64 chars): ${value}`);
  }
}

function assertSelector(value, field) {
  if (!value) throw new Error(`${field} is required.`);
  if (value.length > MAX_SELECTOR_LENGTH) throw new Error(`${field} must be ${MAX_SELECTOR_LENGTH} characters or fewer.`);
  if (/[^\x20-\x7e]/.test(value)) throw new Error(`${field} must not contain control characters or newlines.`);
}

function assertLabel(value, field) {
  if (value.length > MAX_LABEL_LENGTH) throw new Error(`${field} must be ${MAX_LABEL_LENGTH} characters or fewer.`);
  if (/[^\x20-\x7e]/.test(value)) throw new Error(`${field} must not contain control characters or newlines.`);
}

function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = text.split(/\r?\n/);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawLine = lines[lineNumber];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.match(/^ */)?.[0].length || 0;
    if (indent % 2 !== 0) throw new Error(`Line ${lineNumber + 1}: indentation must use multiples of two spaces.`);
    const line = stripComment(rawLine.slice(indent)).trimEnd();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error(`Line ${lineNumber + 1}: expected key: value.`);
    const key = line.slice(0, separator).trim();
    if (!key) throw new Error(`Line ${lineNumber + 1}: empty keys are not allowed.`);
    const rest = line.slice(separator + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;
    if (!isObject(parent)) throw new Error(`Line ${lineNumber + 1}: nested value cannot contain keys.`);
    if (Object.prototype.hasOwnProperty.call(parent, key)) throw new Error(`Line ${lineNumber + 1}: duplicate key: ${key}`);

    if (rest === "") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key] = parseScalar(rest);
    }
  }

  return root;
}

function stripComment(value) {
  let quote = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if ((char === '"' || char === "'") && value[i - 1] !== "\\") quote = quote === char ? "" : quote || char;
    if (char === "#" && !quote && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i);
  }
  return value;
}

function parseScalar(value) {
  if (value === "null" || value === "~") return undefined;
  if (value === "{}") return {};
  if (value === "true") return true;
  if (value === "false") return false;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const inner = value.slice(1, -1);
    return value.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\") : inner.replace(/''/g, "'");
  }
  return value;
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
