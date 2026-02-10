/**
 * Tenant Context Utility
 *
 * Provides tenant context for API routes and database operations.
 * Currently single-tenant per deployment, with hooks for future multi-tenancy.
 */

import { getTenantConfig } from "@/lib/config/loader";
import type { TenantConfig } from "@/lib/config/types";

// Default tenant ID - matches the one in migration 003
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Tenant context object passed to API handlers and database operations
 */
export interface TenantContext {
  /** UUID of the tenant */
  tenantId: string;
  /** Brand name from config */
  brandName: string;
  /** Full tenant configuration */
  config: TenantConfig;
}

/**
 * Get tenant context from a request.
 *
 * Currently returns the default tenant for single-tenant deployments.
 * In the future, this will:
 * - Extract tenant from subdomain (e.g., tenant1.app.com)
 * - Extract tenant from path (e.g., /t/tenant-slug/)
 * - Extract tenant from custom header (for enterprise proxy setups)
 * - Validate tenant exists and is active
 *
 * @param _request - The incoming request (unused in single-tenant mode)
 * @returns TenantContext with tenant information
 */
export async function getTenantContext(_request?: Request): Promise<TenantContext> {
  const config = getTenantConfig();

  return {
    tenantId: DEFAULT_TENANT_ID,
    brandName: config.brand.name,
    config,
  };
}

/**
 * Get just the tenant ID from a request.
 * Convenience wrapper for when only the ID is needed.
 *
 * @param request - The incoming request
 * @returns The tenant UUID
 */
export async function getTenantId(_request?: Request): Promise<string> {
  // In single-tenant mode, always return the default tenant
  // Future: extract from subdomain/path/header
  return DEFAULT_TENANT_ID;
}

/**
 * Validate that a tenant ID is valid.
 * Currently just checks it's a valid UUID format.
 * Future: will check against tenant_configs table.
 *
 * @param tenantId - The tenant ID to validate
 * @returns true if valid
 */
export function isValidTenantId(tenantId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
}
