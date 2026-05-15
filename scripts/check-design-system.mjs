#!/usr/bin/env node
import { readFileSync } from "node:fs";

const failures = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function fail(message) {
  failures.push(message);
}

function requireText(file, text, label = text) {
  const content = read(file);
  if (!content.includes(text)) fail(`${file}: missing ${label}`);
}

function requireRegex(file, regex, label = String(regex)) {
  const content = read(file);
  if (!regex.test(content)) fail(`${file}: missing ${label}`);
}

function checkNoFrontendPlatformDeps() {
  const manifests = ["package.json", "packages/web/package.json"];
  const forbidden = new Set([
    "@emotion/react",
    "@emotion/styled",
    "@mui/material",
    "@vitejs/plugin-react",
    "bootstrap",
    "bulma",
    "chakra-ui",
    "less",
    "next",
    "react",
    "react-dom",
    "sass",
    "styled-components",
    "tailwindcss",
    "vite",
    "vue",
    "svelte",
  ]);

  for (const manifest of manifests) {
    const parsed = JSON.parse(read(manifest));
    const deps = {
      ...(parsed.dependencies || {}),
      ...(parsed.devDependencies || {}),
      ...(parsed.optionalDependencies || {}),
    };
    for (const name of Object.keys(deps)) {
      if (forbidden.has(name)) fail(`${manifest}: forbidden frontend platform dependency "${name}"; keep web UI raw HTML/CSS`);
    }
  }
}

function checkHtmlHelpers() {
  const helpers = ["raw", "escapeHtml", "pageHeader", "section", "toolbar", "inlineActions", "notice", "badge", "emptyState", "table", "metaTable"];
  for (const helper of helpers) {
    requireRegex("packages/web/src/html.ts", new RegExp(`export function ${helper}\\s*\\(`), `exported helper ${helper}()`);
  }
}

function checkCssVocabulary() {
  const sections = ["Tokens", "Base", "Layout primitives", "Components", "Utilities", "Page-specific rules", "Responsive rules"];
  for (const section of sections) requireText("packages/web/public/styles.css", `/* ${section} */`, `section comment /* ${section} */`);

  const classes = [
    "page-header",
    "page-actions",
    "section",
    "toolbar",
    "inline-actions",
    "empty-state",
    "notice",
    "badge",
    "form-stack",
    "form-grid",
    "table-wrap",
    "meta-table",
  ];
  for (const className of classes) {
    requireRegex("packages/web/public/styles.css", new RegExp(`\\.${className}(?![\\w-])`), `canonical .${className} class`);
  }
}

function checkCssQualityGuards() {
  const css = read("packages/web/public/styles.css");
  const hexMatches = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (hexMatches.length) fail(`packages/web/public/styles.css: hard-coded hex colors found (${[...new Set(hexMatches)].join(", ")}); use OKLCH tokens`);
  if (/backdrop-filter\s*:/.test(css)) fail("packages/web/public/styles.css: decorative backdrop-filter is not allowed on the raw HTML console");
  if (!css.includes("@media (prefers-reduced-motion: reduce)")) fail("packages/web/public/styles.css: missing reduced-motion media query");
  requireRegex("packages/web/public/styles.css", /min-height:\s*2\.75rem/, "44px action target token");
  requireText("packages/web/public/styles.css", "table.responsive-table", "responsive table rules");
}

function checkDocs() {
  requireText("packages/web/DOCS.md", "## UI conventions", "UI conventions section");
  requireText("packages/web/DOCS.md", "Do not add frontend dependencies", "no frontend dependencies guidance");
  requireText("packages/web/DOCS.md", "Use shared helpers from `src/html.ts`", "helper usage guidance");
  requireText("packages/web/DOCS.md", "## UX acceptance checklist", "UX acceptance checklist");
}

checkNoFrontendPlatformDeps();
checkHtmlHelpers();
checkCssVocabulary();
checkCssQualityGuards();
checkDocs();

if (failures.length) {
  console.error("Design-system check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Design-system check passed.");
