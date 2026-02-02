import { sql } from "@/lib/db";

export type SearchMode = "x_search" | "web_search";

const SEARCH_MODE_KEY = "xai_search_mode";
const DEFAULT_SEARCH_MODE: SearchMode = "x_search";

let cachedSearchMode: { value: SearchMode; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const rows = await sql`
    SELECT value FROM app_settings WHERE key = ${key} LIMIT 1;
  `;

  if (rows.length === 0) return null;
  return rows[0].value as T;
}

export async function setAppSetting(key: string, value: unknown, actorUserId?: string | null): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_by)
    VALUES (${key}, ${sql.json(value)}, ${actorUserId ?? null})
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW();
  `;
}

export function clearSearchModeCache(): void {
  cachedSearchMode = null;
}

export async function getSearchMode(): Promise<SearchMode> {
  if (cachedSearchMode && cachedSearchMode.expiresAt > Date.now()) {
    return cachedSearchMode.value;
  }

  const setting = await getAppSetting<{ mode?: string } | SearchMode>(SEARCH_MODE_KEY);
  let mode = DEFAULT_SEARCH_MODE;

  if (typeof setting === "string" && (setting === "x_search" || setting === "web_search")) {
    mode = setting;
  } else if (setting && typeof setting === "object") {
    const candidate = setting.mode;
    if (candidate === "x_search" || candidate === "web_search") {
      mode = candidate;
    }
  }

  cachedSearchMode = { value: mode, expiresAt: Date.now() + CACHE_TTL_MS };
  return mode;
}
