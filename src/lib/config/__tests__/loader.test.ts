// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getTenantConfig,
  loadTenantConfig,
  loadTenantConfigAsync,
  initConfigFromDB,
  clearConfigCache,
} from "../loader";
import type { TenantConfig } from "../types";

// Mock the tenant DB module
vi.mock("@/lib/tenant/db", () => ({
  getTenantConfigFromDB: vi.fn(),
}));

// Mock fs module (must match the import path in loader.ts)
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  },
}));

import { getTenantConfigFromDB } from "@/lib/tenant/db";
import { readFileSync, existsSync } from "node:fs";

const mockedGetTenantConfigFromDB = vi.mocked(getTenantConfigFromDB);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);

/** A valid tenant config that would come from the DB */
const DB_CONFIG: TenantConfig = {
  brand: {
    name: "DB Brand",
    aliases: ["DBB"],
    highlightColor: "#aabbcc",
  },
  competitors: [{ name: "Rival Co", aliases: [], isPrimary: true }],
  personas: [{ id: "p1", label: "Persona 1", description: "Test persona" }],
  stages: [{ id: "explore", label: "Explore", description: "Exploring" }],
  entityCategories: [],
  providers: {
    weights: { openai: 0.25, gemini: 0.25, anthropic: 0.25, xai: 0.25 },
    models: {
      openai: "gpt-4.5-preview",
      gemini: "gemini-3-pro-preview",
      anthropic: "claude-3-5-haiku-20241022",
      xai: "grok-3-preview",
    },
  },
  thresholds: { strong: 0.7, moderate: 0.4, weak: 0.2 },
  industry: "real_estate",
  metadata: { version: "1.0.0" },
};

/** A valid tenant config JSON file content */
const FILE_CONFIG_JSON = JSON.stringify({
  brand: {
    name: "File Brand",
    aliases: ["FB"],
    highlightColor: "#112233",
  },
  competitors: [],
  personas: [{ id: "fp1", label: "File Persona", description: "" }],
  stages: [{ id: "explore", label: "Explore", description: "" }],
  entityCategories: [],
  providers: {},
  thresholds: {},
  industry: "education",
  metadata: {},
});

describe("loader.ts", () => {
  beforeEach(() => {
    clearConfigCache();
    vi.clearAllMocks();
    // Clear env overrides
    delete process.env.BRAND_NAME;
    delete process.env.BRAND_ALIASES;
    delete process.env.BRAND_DOMAIN;
    delete process.env.BRAND_HIGHLIGHT_COLOR;
  });

  afterEach(() => {
    clearConfigCache();
  });

  describe("getTenantConfig (sync)", () => {
    it("returns cached config if cache is populated", () => {
      // Populate cache via loadTenantConfig with file fallback
      mockedExistsSync.mockReturnValue(false);
      const first = getTenantConfig();
      const second = getTenantConfig();
      expect(first).toBe(second); // same reference = cached
      // existsSync only called once (first load)
      expect(mockedExistsSync).toHaveBeenCalledTimes(1);
    });

    it("falls back to DEFAULT_CONFIG when no file exists", () => {
      mockedExistsSync.mockReturnValue(false);
      const config = getTenantConfig();
      expect(config.brand.name).toBe("My Brand");
    });

    it("loads from file when file exists", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(FILE_CONFIG_JSON);
      const config = getTenantConfig();
      expect(config.brand.name).toBe("File Brand");
    });
  });

  describe("loadTenantConfig (sync, forceReload)", () => {
    it("reloads from file when forceReload is true", () => {
      mockedExistsSync.mockReturnValue(false);
      loadTenantConfig(); // populates cache with default

      // Now make file available and force reload
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(FILE_CONFIG_JSON);
      const config = loadTenantConfig(true);
      expect(config.brand.name).toBe("File Brand");
    });
  });

  describe("loadTenantConfigAsync", () => {
    it("loads from DB when DB returns config", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(DB_CONFIG);
      const config = await loadTenantConfigAsync();
      expect(config.brand.name).toBe("DB Brand");
      expect(config.industry).toBe("real_estate");
      // File should not be checked
      expect(mockedExistsSync).not.toHaveBeenCalled();
    });

    it("falls back to file when DB returns null", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(null);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(FILE_CONFIG_JSON);

      const config = await loadTenantConfigAsync();
      expect(config.brand.name).toBe("File Brand");
    });

    it("falls back to file when DB throws", async () => {
      mockedGetTenantConfigFromDB.mockRejectedValue(new Error("DB connection failed"));
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(FILE_CONFIG_JSON);

      const config = await loadTenantConfigAsync();
      expect(config.brand.name).toBe("File Brand");
    });

    it("falls back to DEFAULT_CONFIG when DB and file both unavailable", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(null);
      mockedExistsSync.mockReturnValue(false);

      const config = await loadTenantConfigAsync();
      expect(config.brand.name).toBe("My Brand");
    });

    it("applies env overrides on top of DB config", async () => {
      process.env.BRAND_NAME = "Env Override Brand";
      mockedGetTenantConfigFromDB.mockResolvedValue(DB_CONFIG);

      const config = await loadTenantConfigAsync();
      expect(config.brand.name).toBe("Env Override Brand");
      // Other DB fields preserved
      expect(config.industry).toBe("real_estate");
    });

    it("applies env overrides on top of file config", async () => {
      process.env.BRAND_ALIASES = "Alias1, Alias2";
      mockedGetTenantConfigFromDB.mockResolvedValue(null);
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(FILE_CONFIG_JSON);

      const config = await loadTenantConfigAsync();
      expect(config.brand.aliases).toEqual(["Alias1", "Alias2"]);
      expect(config.brand.name).toBe("File Brand");
    });

    it("applies env overrides on top of DEFAULT_CONFIG", async () => {
      process.env.BRAND_DOMAIN = "example.com";
      mockedGetTenantConfigFromDB.mockResolvedValue(null);
      mockedExistsSync.mockReturnValue(false);

      const config = await loadTenantConfigAsync();
      expect(config.brand.domain).toBe("example.com");
      expect(config.brand.name).toBe("My Brand");
    });

    it("populates cache so sync getTenantConfig returns DB value", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(DB_CONFIG);
      await loadTenantConfigAsync();

      // Now sync call should return the cached DB config
      const syncConfig = getTenantConfig();
      expect(syncConfig.brand.name).toBe("DB Brand");
      // No file access needed
      expect(mockedExistsSync).not.toHaveBeenCalled();
    });
  });

  describe("initConfigFromDB", () => {
    it("pre-populates cache from DB", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(DB_CONFIG);
      await initConfigFromDB();

      const config = getTenantConfig();
      expect(config.brand.name).toBe("DB Brand");
    });

    it("falls back gracefully when DB is unavailable", async () => {
      mockedGetTenantConfigFromDB.mockRejectedValue(new Error("no DB"));
      mockedExistsSync.mockReturnValue(false);

      await initConfigFromDB();
      const config = getTenantConfig();
      expect(config.brand.name).toBe("My Brand");
    });
  });

  describe("clearConfigCache", () => {
    it("forces next getTenantConfig to reload", () => {
      mockedExistsSync.mockReturnValue(false);
      getTenantConfig(); // populate cache
      expect(mockedExistsSync).toHaveBeenCalledTimes(1);

      clearConfigCache();
      getTenantConfig(); // should reload
      expect(mockedExistsSync).toHaveBeenCalledTimes(2);
    });

    it("forces next loadTenantConfigAsync to re-fetch from DB", async () => {
      mockedGetTenantConfigFromDB.mockResolvedValue(DB_CONFIG);
      await loadTenantConfigAsync();
      expect(mockedGetTenantConfigFromDB).toHaveBeenCalledTimes(1);

      clearConfigCache();
      await loadTenantConfigAsync();
      expect(mockedGetTenantConfigFromDB).toHaveBeenCalledTimes(2);
    });
  });

  describe("environment variable overrides", () => {
    it("overrides brand name", () => {
      process.env.BRAND_NAME = "Override Name";
      mockedExistsSync.mockReturnValue(false);
      const config = getTenantConfig();
      expect(config.brand.name).toBe("Override Name");
    });

    it("overrides brand aliases as comma-separated list", () => {
      process.env.BRAND_ALIASES = "A1, A2, A3";
      mockedExistsSync.mockReturnValue(false);
      const config = getTenantConfig();
      expect(config.brand.aliases).toEqual(["A1", "A2", "A3"]);
    });

    it("overrides brand domain", () => {
      process.env.BRAND_DOMAIN = "test.com";
      mockedExistsSync.mockReturnValue(false);
      const config = getTenantConfig();
      expect(config.brand.domain).toBe("test.com");
    });

    it("overrides highlight color", () => {
      process.env.BRAND_HIGHLIGHT_COLOR = "#ff0000";
      mockedExistsSync.mockReturnValue(false);
      const config = getTenantConfig();
      expect(config.brand.highlightColor).toBe("#ff0000");
    });
  });
});
