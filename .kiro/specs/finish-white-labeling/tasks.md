# Implementation Plan: Finish White-Labeling

## Overview

Incrementally complete the white-labeling of the AI Visibility Matrix platform. Tasks are ordered to build foundational config changes first, then admin UI, then prompt externalization, then reliability fixes, and finally test cleanup. Each task builds on the previous ones.

## Tasks

- [x] 1. Create tenant_config DB table and tenant DB layer
  - [x] 1.1 Create SQL migration `sql/2026-xx-xx-tenant-config.sql` with the `tenant_config` table schema (id, brand_json, competitors_json, geography_json, entity_categories_json, providers_json, industry, setup_complete, timestamps)
    - _Requirements: 5.6, 2.2_
  - [x] 1.2 Create `src/lib/tenant/db.ts` with functions: `getTenantConfigFromDB()`, `saveTenantConfig()`, `isSetupComplete()`, `markSetupComplete()`
    - Use the `sql` tagged template from `@/lib/db`
    - Validate with Zod schemas from `src/lib/config/types.ts`
    - _Requirements: 5.6, 2.2_
  - [ ]* 1.3 Write property test for tenant config round-trip (Property 1)
    - **Property 1: Config accessor round-trip**
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Extend config loader with DB-first strategy
  - [x] 2.1 Update `src/lib/config/loader.ts` to add `loadTenantConfigAsync()` that reads from DB first, falls back to file, then defaults, then env overrides
    - Keep sync `getTenantConfig()` for backward compatibility (uses cached value)
    - Add `initConfigFromDB()` to pre-populate cache at app startup
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 Update `src/lib/config/providers.ts` to support the new `ProviderEntry[]` format
    - Add `ProviderEntrySchema` to `src/lib/config/types.ts`
    - Keep backward-compatible `getProviderWeight()`, `getProviderModel()`, `getEnabledProviders()` functions that derive from the new format
    - Update `DEFAULT_CONFIG` in loader.ts to use the new provider format
    - _Requirements: 2.5_
  - [ ]* 2.3 Write property test for provider config round-trip with validation (Property 4)
    - **Property 4: Provider config round-trip with validation**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 3. Replace hardcoded brand references in runtime code
  - [x] 3.1 Replace `DEFAULT_BRAND` and `DEFAULT_ALIASES` in `src/lib/runs/utils.ts` with `getBrandName()` and `getBrandAliases()` from config
    - Update all callers that pass brand to benchmark runner
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 Replace hardcoded brand strings in `src/lib/scoring/schemas.ts`
    - Remove `ENTITY_EXTRACTION_SUFFIX` constant and `STAGE_EXTRACTION_PROMPTS` constant
    - Update `src/lib/scoring/extractor.ts` to load prompts via `getExtractionPrompt()` from the Prompt_Template_System
    - _Requirements: 1.4, 6.5_
  - [x] 3.3 Replace hardcoded brand strings in `src/lib/chat/systemPrompt.ts`
    - Use `getChatSystemPrompt()` from Prompt_Template_System for the base prompt
    - Replace hardcoded persona/stage label maps with config lookups
    - Replace `"Lakewood Ranch"` fallback in `formatBenchmarkData()` with `getBrandName()`
    - _Requirements: 1.6, 6.3_
  - [x] 3.4 Replace hardcoded brand strings in `src/lib/intents/generator.ts` and `src/lib/intents/queryGenerator.ts`
    - Replace hardcoded `PERSONA_DESCRIPTIONS`, `STAGE_CONTEXT` brand references with config lookups
    - Use `getQueryGenerationPrompt()` from Prompt_Template_System where possible
    - _Requirements: 1.10, 6.4_
  - [x] 3.5 Replace hardcoded brand strings in `src/app/api/run/analyze/route.ts`
    - Create `config/prompts/analysis/consultant.txt` and `config/prompts/analysis/hypothesis.txt` templates
    - Replace `buildConsultantPrompt()` and `buildHypothesisPrompt()` to use `getPrompt("analysis", ...)` with interpolation
    - _Requirements: 1.5, 6.1_
  - [x] 3.6 Replace hardcoded brand strings in `src/app/api/query/generate/route.ts`
    - Replace hardcoded stage guardrails and brand focus text with config-driven values
    - Use `getPrompt("query-generation", ...)` for stage-specific guardrails
    - _Requirements: 1.3, 6.2_
  - [x] 3.7 Make `src/lib/triggers.ts` config-driven
    - Replace hardcoded "Lakewood Ranch vs ..." triggers with dynamic generation from `getBrandName()` and `getCompetitorNames()`
    - Keep generic triggers (e.g., "Compare amenities and lifestyle") as-is
    - _Requirements: 1.8, 8.2_
  - [x] 3.8 Replace hardcoded brand in `src/app/visibility-board/page.tsx` page title and `src/components/visibility-matrix/IntentEditorPanel.tsx` placeholder
    - Use `getBrandName()` or `useBrandConfig()` hook for client components
    - _Requirements: 1.9_
  - [ ]* 3.9 Write property test for prompt interpolation (Property 2)
    - **Property 2: Prompt interpolation reflects config**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.10, 6.1, 6.2, 6.3, 6.4, 6.5**
  - [ ]* 3.10 Write property test for dynamic triggers (Property 3)
    - **Property 3: Dynamic triggers from config**
    - **Validates: Requirements 1.8, 8.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Admin panel for provider configuration
  - [x] 5.1 Create `POST /api/tenant/providers` API route
    - Accept `{ providers: ProviderEntry[] }` body
    - Validate with Zod: at least one active provider, weights in [0,1], non-empty model strings
    - Save to `tenant_config.providers_json` via `saveTenantConfig()`
    - Clear config cache after save
    - _Requirements: 2.2, 2.3, 2.4, 2.6_
  - [x] 5.2 Create `src/app/admin/providers/page.tsx` admin page
    - List all providers with active toggle, model text input, weight slider (0-1)
    - Show warning banner when all providers are disabled
    - Save button calls `POST /api/tenant/providers`
    - Use shadcn/ui components (Card, Input, Slider, Button, Badge)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  - [ ]* 5.3 Write property test for benchmark using only active providers (Property 5)
    - **Property 5: Benchmark uses only active providers**
    - **Validates: Requirements 2.5**

- [x] 6. Admin panel for brand and geography configuration
  - [x] 6.1 Create `POST /api/tenant/config` API route
    - Accept `Partial<TenantConfig>` body
    - Validate with Zod, save to `tenant_config` table
    - Clear config cache after save
    - _Requirements: 1.1, 1.2_
  - [x] 6.2 Create `src/app/admin/brand/page.tsx` admin page
    - Form sections: Brand (name, aliases, domain, highlight color), Geography (region, localities, nearby metros), Competitors (add/remove/edit list), Entity Categories (add/remove/edit list)
    - Save button calls `POST /api/tenant/config`
    - Use shadcn/ui components
    - _Requirements: 1.1, 1.2_

- [x] 7. Extend Matrix Studio for full persona and stage management
  - [x] 7.1 Update `src/components/admin/StageList.tsx` to include `coreStageMapping` dropdown (explore/consider/compare/decide) when adding or editing stages
    - Require coreStageMapping for new stages
    - _Requirements: 3.1, 3.5_
  - [x] 7.2 Update `src/components/admin/PersonaList.tsx` to include optional `fullText` textarea for detailed persona prompt context
    - _Requirements: 4.1_
  - [ ]* 7.3 Write property test for matrix config round-trip (Property 6)
    - **Property 6: Matrix config round-trip**
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3**
  - [ ]* 7.4 Write property test for deactivation exclusion (Property 7)
    - **Property 7: Deactivation excludes from active list**
    - **Validates: Requirements 3.4, 3.6, 4.4, 4.5**

- [x] 8. Setup wizard
  - [x] 8.1 Create `GET /api/tenant/setup-status` API route
    - Return `{ setupComplete: boolean }` from `isSetupComplete()`
    - _Requirements: 5.1_
  - [x] 8.2 Update `src/middleware.ts` to check setup status and redirect to `/admin/setup` when `setup_complete` is false
    - Skip redirect for `/admin/setup`, `/api/tenant/setup-status`, `/login`, `/auth/callback` paths
    - _Requirements: 5.1_
  - [x] 8.3 Create `src/app/admin/setup/page.tsx` multi-step setup wizard
    - Step 1: Industry template selection (load from `config/templates/`)
    - Step 2: Brand name, aliases, domain
    - Step 3: Competitors (pre-populated from template)
    - Step 4: Geography (region, localities, nearby metros)
    - Step 5: Provider selection and model configuration
    - Step 6: Persona and stage review (pre-populated from template)
    - Final: Save all config via `POST /api/tenant/config`, mark setup complete, redirect to `/visibility-matrix`
    - Allow skipping steps (use template defaults)
    - Use shadcn/ui components
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [ ]* 8.4 Write property test for wizard config persistence (Property 8)
    - **Property 8: Wizard config persistence**
    - **Validates: Requirements 5.6, 5.7**

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Benchmark runner reliability fixes
  - [x] 10.1 Migrate xAI provider to Responses API in `src/lib/providers/xai.ts`
    - Switch from `/v1/chat/completions` to the Responses API endpoint
    - Use tool-based payload semantics for web search
    - Update response parsing to handle new response format
    - Update `XaiResponseSchema` Zod schema
    - _Requirements: N/A (reliability fix)_
  - [x] 10.2 Implement batched parallel execution in `src/app/api/benchmark/run/route.ts`
    - Replace sequential `for (const cell of data.cells)` loop with batched `Promise.allSettled` execution
    - Batch size: 4 cells at a time
    - On individual cell failure: log error, continue with remaining cells, include failure info in response
    - Update progress tracking to handle partial failures
    - _Requirements: N/A (reliability fix)_
  - [ ]* 10.3 Write unit tests for xAI Responses API parsing and batched execution error handling
    - Test xAI response parsing with new format
    - Test partial failure tolerance (some cells succeed, some fail)
    - _Requirements: N/A (reliability fix)_

- [x] 11. Update test fixtures to be tenant-agnostic
  - [x] 11.1 Update `src/lib/benchmark/__tests__/scoring.test.ts` and `runner.test.ts`
    - Replace hardcoded `"Lakewood Ranch"` with a `TEST_BRAND` constant or import from a shared test helper
    - Update mock response texts to use the test brand constant
    - _Requirements: 7.1, 7.2_
  - [x] 11.2 Update `src/lib/scoring/__tests__/extractor.test.ts` and `src/lib/matrix/__tests__/history.test.ts`
    - Replace hardcoded brand references with test constants
    - _Requirements: 7.1, 7.2_
  - [x] 11.3 Update `src/components/visibility-matrix/__tests__/InsightModal.test.tsx`
    - Replace hardcoded `brand="Lakewood Ranch"` props with test constant
    - _Requirements: 7.1, 7.2_
  - [x] 11.4 Update `src/lib/intents/__tests__/queryGenerator.test.ts`
    - Replace hardcoded brand assertions with config-derived values
    - Mock the Config_System to return deterministic test values
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 12. Remove or replace static brand-specific data files
  - [x] 12.1 Replace hardcoded `src/data/visibility-kanban.json` with config-driven data
    - Either generate kanban columns dynamically from entity categories or load from a config-driven source
    - Remove brand-specific lane content
    - _Requirements: 8.1_
  - [x] 12.2 Remove deprecated hardcoded constants from `src/lib/runs/utils.ts`
    - Remove `DEFAULT_BRAND`, `DEFAULT_ALIASES`, `ALL_PERSONAS`, `ALL_STAGES` constants
    - Update any remaining callers to use config accessors
    - _Requirements: 1.1, 1.2_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check` with vitest
- Unit tests validate specific examples and edge cases
- The xAI and batched execution fixes (task 10) are reliability improvements from the baseline repo, not directly tied to white-labeling requirements
