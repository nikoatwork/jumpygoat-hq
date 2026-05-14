import assert from "node:assert/strict";

import { parseSettingsText, resolveModelRequest } from "../../shared/settings.js";
import { extractUsageFromTraceText } from "../src/usage.js";

const settings = parseSettingsText(`
defaultModelProfile: fast
modelProfiles:
  fast: gpt-5.4-mini
  super-smart:
    selector: gpt-5.5
    label: Super smart
`);

assert.equal(settings.defaultModelProfile, "fast");
assert.deepEqual(resolveModelRequest(undefined, settings), {
  requestedModel: "fast",
  resolvedModel: "gpt-5.4-mini",
  profileKey: "fast",
  warning: undefined,
});
assert.deepEqual(resolveModelRequest("super-smart", settings), {
  requestedModel: "super-smart",
  resolvedModel: "gpt-5.5",
  profileKey: "super-smart",
  warning: undefined,
});
const passThrough = resolveModelRequest("openai:gpt-5.9", settings);
assert.equal(passThrough.resolvedModel, "openai:gpt-5.9");
assert.match(passThrough.warning || "", /passing it through/);

assert.throws(() => parseSettingsText("defaultModelProfile: missing\nmodelProfiles: {}\n"), /modelProfiles/);
assert.throws(() => parseSettingsText("modelProfiles:\n  Bad_Key: gpt-5\n"), /profile key/);

const trace = [
  { type: "message_update", assistantMessageEvent: { partial: { role: "assistant", responseId: "resp_1", model: "gpt-5.5", usage: { input: 10, output: 4, totalTokens: 14 } } } },
  { type: "message_end", message: { role: "assistant", responseId: "resp_1", provider: "openai", model: "gpt-5.5", usage: { input: 11, output: 5, reasoning: 2, cacheRead: 3, totalTokens: 18, cost: { total: 0.02, currency: "USD" } } } },
  { type: "message_end", message: { role: "assistant", responseId: "resp_2", provider: "openai", model: "gpt-5.5", usage: { input: 7, output: 1, totalTokens: 8 } } },
].map((event) => JSON.stringify(event)).join("\n");

const usage = extractUsageFromTraceText(trace);
assert.ok(usage);
assert.equal(usage.inputTokens, 18);
assert.equal(usage.outputTokens, 6);
assert.equal(usage.reasoningTokens, 2);
assert.equal(usage.cacheReadTokens, 3);
assert.equal(usage.totalTokens, 26);
assert.equal(usage.costTotal, 0.02);
assert.equal(usage.currency, "USD");
assert.equal(usage.provider, "openai");
assert.equal(usage.model, "gpt-5.5");
assert.equal(usage.events.length, 2);

console.log("model settings and usage tests passed");
