import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/app-settings/route";

const mockGetSearchMode = vi.fn();
const mockSetAppSetting = vi.fn();
const mockClearSearchModeCache = vi.fn();

vi.mock("@/lib/appSettings", () => ({
  getSearchMode: () => mockGetSearchMode(),
  setAppSetting: (...args: unknown[]) => mockSetAppSetting(...args),
  clearSearchModeCache: () => mockClearSearchModeCache(),
}));

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/auth/supabase", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

describe("/api/app-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns search mode", async () => {
    mockGetSearchMode.mockResolvedValueOnce("x_search");

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.searchMode).toBe("x_search");
  });

  it("PUT updates search mode", async () => {
    mockCookies.mockResolvedValueOnce({});
    mockGetCurrentUser.mockResolvedValueOnce({ id: "user-1" });

    const req = new Request("http://localhost/api/app-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchMode: "web_search" }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSetAppSetting).toHaveBeenCalledWith("xai_search_mode", "web_search", "user-1");
    expect(mockClearSearchModeCache).toHaveBeenCalled();
  });
});
