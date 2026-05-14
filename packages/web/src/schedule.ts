export type CronField = {
  any: boolean;
  values: Set<number>;
};

export type ParsedCron = {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
};

export type CronParseResult = { ok: true; cron: ParsedCron } | { ok: false; warning: string };

const FIELD_SPECS = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day of month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "day of week", min: 0, max: 7 },
] as const;

export function parseCronExpression(expression: string): CronParseResult {
  const parts = expression.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) return { ok: false, warning: `Only 5-field cron expressions are supported: ${expression || "<empty>"}` };

  const fields = parts.map((part, index) => parseCronField(part, FIELD_SPECS[index]!));
  const failed = fields.find((field): field is { ok: false; warning: string } => !field.ok);
  if (failed) return failed;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.map((field) => (field as { ok: true; field: CronField }).field);
  return { ok: true, cron: { minute, hour, dayOfMonth, month, dayOfWeek } };
}

export function nextOccurrences(schedule: string, from: Date, until: Date, limit = 50): { occurrences: Date[]; warning?: string } {
  const parsed = parseCronExpression(schedule);
  if (!parsed.ok) return { occurrences: [], warning: parsed.warning };
  if (until.getTime() <= from.getTime() || limit <= 0) return { occurrences: [] };

  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const occurrences: Date[] = [];
  while (cursor.getTime() <= until.getTime() && occurrences.length < limit) {
    if (matchesCron(parsed.cron, cursor)) occurrences.push(new Date(cursor.getTime()));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return { occurrences };
}

function parseCronField(
  value: string,
  spec: { name: string; min: number; max: number },
): { ok: true; field: CronField } | { ok: false; warning: string } {
  const values = new Set<number>();
  const any = value === "*";

  for (const rawPart of value.split(",")) {
    const part = rawPart.trim();
    if (!part) return { ok: false, warning: `Malformed ${spec.name} field: ${value}` };

    const [base, stepText, extra] = part.split("/");
    if (extra !== undefined || base === undefined || base === "") return { ok: false, warning: `Malformed ${spec.name} field: ${value}` };

    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step <= 0) return { ok: false, warning: `Invalid ${spec.name} step: ${part}` };

    const range = parseRange(base, spec);
    if (!range.ok) return range;

    for (let number = range.start; number <= range.end; number += step) {
      values.add(normalizeValue(number, spec));
    }
  }

  if (values.size === 0) return { ok: false, warning: `No values matched ${spec.name} field: ${value}` };
  return { ok: true, field: { any, values } };
}

function parseRange(
  base: string,
  spec: { name: string; min: number; max: number },
): { ok: true; start: number; end: number } | { ok: false; warning: string } {
  if (base === "*") return { ok: true, start: spec.min, end: spec.max };

  if (base.includes("-")) {
    const [startText, endText, extra] = base.split("-");
    if (extra !== undefined || !startText || !endText) return { ok: false, warning: `Malformed ${spec.name} range: ${base}` };
    const start = Number(startText);
    const end = Number(endText);
    if (!isAllowedNumber(start, spec) || !isAllowedNumber(end, spec) || start > end) return { ok: false, warning: `Invalid ${spec.name} range: ${base}` };
    return { ok: true, start, end };
  }

  const number = Number(base);
  if (!isAllowedNumber(number, spec)) return { ok: false, warning: `Invalid ${spec.name} value: ${base}` };
  return { ok: true, start: number, end: number };
}

function isAllowedNumber(value: number, spec: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= spec.min && value <= spec.max;
}

function normalizeValue(value: number, spec: { name: string }): number {
  return spec.name === "day of week" && value === 7 ? 0 : value;
}

function matchesCron(cron: ParsedCron, date: Date): boolean {
  if (!cron.minute.values.has(date.getMinutes())) return false;
  if (!cron.hour.values.has(date.getHours())) return false;
  if (!cron.month.values.has(date.getMonth() + 1)) return false;

  const domMatches = cron.dayOfMonth.values.has(date.getDate());
  const dowMatches = cron.dayOfWeek.values.has(date.getDay());
  if (!cron.dayOfMonth.any && !cron.dayOfWeek.any) return domMatches || dowMatches;
  return domMatches && dowMatches;
}
