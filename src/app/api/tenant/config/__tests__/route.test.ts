// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/tenant/config/route";

vi.mock("@/lib/config/loader", () => ({
  loadTenantConfigAsync: vi.fn(),
  clearConfigCache: vi.fn(),
}));

vi.mock("@/lib/tenant/db", () => ({
  saveTenantConfig: vi.fn(),
}));

vi.mock("@/lib/matrix/db", () => ({
  publishConfig: vi.fn(),
}));

vi.mock("@/lib/matrix/runtime", () => ({
  clearConfigCache: vi.fn(),
}));

import { loadTenantConfigAsync, clearConfigCache } from "@/lib/config/loader";
import { saveTenantConfig } from "@/lib/tenant/db";
import { publishConfig } from "@/lib/matrix/db";
import { clearConfigCache as clearMatrixConfigCache } from "@/lib/matrix/runtime";

describe("tenant config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns config payload", async () => {
    vi.mocked(loadTenantConfigAsync).mockResolvedValue({
      brand: { name: "Test Brand", aliases: [], highlightColor: "#dcf3dc" },
      competitors: [],
      personas: [],
      stages: [],
      entityCategories: [],
      providers: {},
      thresholds: {},
      industry: "other",
      metadata: {},
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brand.name).toBe("Test Brand");
  });

  it("POST rejects persona-only matrix payload", async () => {
    const req = new Request("http://localhost/api/tenant/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personas: [{ id: "p1", label: "Persona 1", description: "desc" }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(saveTenantConfig).not.toHaveBeenCalled();
    expect(publishConfig).not.toHaveBeenCalled();
  });

  it("POST publishes matrix config and saves tenant config", async () => {
    vi.mocked(loadTenantConfigAsync).mockResolvedValue({
      brand: { name: "Saved", aliases: [], highlightColor: "#dcf3dc" },
      competitors: [],
      personas: [],
      stages: [],
      entityCategories: [],
      providers: {},
      thresholds: {},
      industry: "other",
      metadata: {},
    });

    const req = new Request("http://localhost/api/tenant/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brand: { name: "Saint Stephen's Episcopal School", aliases: ["SSES"], highlightColor: "#1f3b2c" },
        industry: "education",
        personas: [
          { id: "parent", label: "Parent", description: "Decision-maker" },
          { id: "student", label: "Student", description: "Learner" },
        ],
        stages: [
          { id: "discover", label: "Discover", description: "Initial search" },
          { id: "apply", label: "Apply", description: "Enrollment decision" },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(publishConfig).toHaveBeenCalledTimes(1);
    expect(saveTenantConfig).toHaveBeenCalledWith({
      brand: { name: "Saint Stephen's Episcopal School", aliases: ["SSES"], highlightColor: "#1f3b2c" },
      industry: "education",
    });
    expect(clearMatrixConfigCache).toHaveBeenCalledTimes(1);
    expect(clearConfigCache).toHaveBeenCalledTimes(1);
  });
});

