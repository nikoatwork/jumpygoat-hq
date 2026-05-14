export type ModelProfile = {
  selector: string;
  label?: string;
};

export type InstanceSettings = {
  defaultModelProfile?: string;
  modelProfiles: Record<string, ModelProfile>;
};

export type ModelResolution = {
  requestedModel?: string;
  resolvedModel?: string;
  profileKey?: string;
  warning?: string;
};

export const DEFAULT_SETTINGS: InstanceSettings;
export function loadSettings(file?: string): InstanceSettings;
export function parseSettingsText(text: string): InstanceSettings;
export function formatSettings(settings: InstanceSettings): string;
export function defaultSettingsText(): string;
export function resolveModelRequest(requestedModel?: string | null, settings?: InstanceSettings): ModelResolution;
export function settingsLocation(): { home: string; path: string };
