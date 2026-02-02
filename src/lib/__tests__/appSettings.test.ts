import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
}));

import { clearSearchModeCache, getSearchMode } from "@/lib/appSettings";
import { sql } from "@/lib/db";

describe("getSearchMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchModeCache();
  });

  it("defaults to x_search when setting is missing", async () => {
    vi.mocked(sql).mockResolvedValueOnce([] as never[]);

    await expect(getSearchMode()).resolves.toBe("x_search");
  });
});
