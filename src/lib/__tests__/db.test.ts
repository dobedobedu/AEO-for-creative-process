import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the postgres module
vi.mock("postgres", () => {
  return {
    default: vi.fn(),
  };
});

describe("db retry logic", () => {
  let originalDatabaseUrl: string | undefined;

  beforeEach(() => {
    originalDatabaseUrl = process.env.DATABASE_URL;
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("retries once on CONNECTION_CLOSED and succeeds", async () => {
    const postgres = (await import("postgres")).default as ReturnType<typeof vi.fn>;

    let callCount = 0;
    const mockSql = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error = new Error("Connection closed") as Error & { code: string };
        error.code = "CONNECTION_CLOSED";
        throw error;
      }
      return Promise.resolve([{ id: 1 }]);
    });

    // Add required helper methods to mock
    mockSql.array = vi.fn();
    mockSql.json = vi.fn();
    mockSql.end = vi.fn();
    mockSql.unsafe = vi.fn();
    mockSql.begin = vi.fn();

    postgres.mockReturnValue(mockSql);

    // Set env before importing
    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const { withRetry } = await import("../db");

    const result = await withRetry(() => mockSql`SELECT 1`);

    expect(callCount).toBe(2);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("rethrows after second CONNECTION_CLOSED failure", async () => {
    const postgres = (await import("postgres")).default as ReturnType<typeof vi.fn>;

    const mockSql = vi.fn().mockImplementation(() => {
      const error = new Error("Connection closed") as Error & { code: string };
      error.code = "CONNECTION_CLOSED";
      throw error;
    });

    mockSql.array = vi.fn();
    mockSql.json = vi.fn();
    mockSql.end = vi.fn();
    mockSql.unsafe = vi.fn();
    mockSql.begin = vi.fn();

    postgres.mockReturnValue(mockSql);

    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const { withRetry } = await import("../db");

    await expect(withRetry(() => mockSql`SELECT 1`)).rejects.toThrow("Connection closed");
  });

  it("retries once on ECONNRESET and succeeds", async () => {
    const postgres = (await import("postgres")).default as ReturnType<typeof vi.fn>;

    let callCount = 0;
    const mockSql = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error = new Error("Connection reset") as Error & { code: string };
        error.code = "ECONNRESET";
        throw error;
      }
      return Promise.resolve([{ id: 1 }]);
    });

    mockSql.array = vi.fn();
    mockSql.json = vi.fn();
    mockSql.end = vi.fn();
    mockSql.unsafe = vi.fn();
    mockSql.begin = vi.fn();

    postgres.mockReturnValue(mockSql);

    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const { withRetry } = await import("../db");

    const result = await withRetry(() => mockSql`SELECT 1`);

    expect(callCount).toBe(2);
    expect(result).toEqual([{ id: 1 }]);
  });

  it("does not retry on non-retryable errors", async () => {
    const postgres = (await import("postgres")).default as ReturnType<typeof vi.fn>;

    let callCount = 0;
    const mockSql = vi.fn().mockImplementation(() => {
      callCount++;
      const error = new Error("Some other error") as Error & { code: string };
      error.code = "SYNTAX_ERROR";
      throw error;
    });

    mockSql.array = vi.fn();
    mockSql.json = vi.fn();
    mockSql.end = vi.fn();
    mockSql.unsafe = vi.fn();
    mockSql.begin = vi.fn();

    postgres.mockReturnValue(mockSql);

    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const { withRetry } = await import("../db");

    await expect(withRetry(() => mockSql`SELECT 1`)).rejects.toThrow("Some other error");
    expect(callCount).toBe(1);
  });

  it("sql template tag retries on CONNECTION_CLOSED", async () => {
    const postgres = (await import("postgres")).default as ReturnType<typeof vi.fn>;

    let callCount = 0;
    const mockSql = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const error = new Error("Connection closed") as Error & { code: string };
        error.code = "CONNECTION_CLOSED";
        throw error;
      }
      return Promise.resolve([{ value: 1 }]);
    });

    mockSql.array = vi.fn();
    mockSql.json = vi.fn();
    mockSql.end = vi.fn();
    mockSql.unsafe = vi.fn();
    mockSql.begin = vi.fn();

    postgres.mockReturnValue(mockSql);

    process.env.DATABASE_URL = "postgres://localhost:5432/test";

    const { sql } = await import("../db");

    // The sql template tag should internally use withRetry
    const result = await sql`SELECT 1 as value`;

    expect(callCount).toBe(2);
    expect(result).toEqual([{ value: 1 }]);
  });

  // Note: sql.unsafe and sql.begin also use withRetry internally.
  // The "sql template tag retries" test above proves the pattern works.
  // Additional tests for these methods would require more complex mock isolation
  // due to globalThis client caching, but the implementation is identical.
});
