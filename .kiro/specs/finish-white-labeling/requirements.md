# Requirements Document

## Introduction

The AI Visibility Matrix platform has partial white-labeling: a tenant config system (`config/tenant.json`), config accessor functions, a DB-backed matrix config for personas and stages, and an admin Matrix Studio page. However, the platform is not fully tenant-agnostic. Many source files hardcode "Lakewood Ranch" brand references, geography, competitors, and entity categories. The provider list is hardcoded. The admin panel only covers personas and stages — it lacks provider configuration, brand/geography setup, and the ability to manage the full tenant lifecycle. This feature completes the white-labeling so any operator can set up and run the platform for their brand, industry, and preferred AI providers without code changes.

## Glossary

- **Config_System**: The tenant configuration module at `src/lib/config/` that loads `config/tenant.json`, applies environment overrides, and exposes brand, competitor, persona, stage, entity, and geography data through typed accessor functions.
- **Brand_Name**: The `brand.name` field from tenant config, accessed via `getBrandName()`.
- **Brand_Terms**: The combined set of `brand.name` and `brand.aliases`, accessed via `getBrandTerms()`.
- **Competitor_Names**: The list of competitor names from tenant config, accessed via `getCompetitorNames()`.
- **Geography_Config**: The `geography` object from tenant config containing `region`, `localities`, and `nearbyMetros`.
- **Entity_Categories**: The `entityCategories` array from tenant config, each with `id`, `label`, and `examples`.
- **Prompt_Template_System**: The prompt loading and interpolation module at `src/lib/config/prompts.ts` that reads templates from `config/prompts/`, substitutes `{{variable}}` placeholders with config values, and caches results.
- **LLM_Prompt**: A text string sent to an AI model as system or user context during query generation, scoring extraction, analysis, or chat.
- **Provider_Config**: The configuration specifying which AI providers are active, their model identifiers, and their scoring weights.
- **Admin_Panel**: The web-based administration interface at `/admin` where operators configure the platform.
- **Matrix_Studio**: The existing admin page at `/admin/matrix` for managing personas and stages.
- **Setup_Wizard**: A guided first-run experience that walks a new operator through initial platform configuration.

## Requirements

### Requirement 1: Replace All Hardcoded Brand References with Config Lookups

**User Story:** As a platform operator, I want all brand references to come from tenant config, so that the platform displays and uses the correct brand for any tenant without code changes.

#### Acceptance Criteria

1. WHEN the system needs a default brand name, THE Config_System SHALL provide the value from `getBrandName()` instead of a hardcoded string.
2. WHEN the system needs default brand aliases, THE Config_System SHALL provide the values from `getBrandAliases()` instead of a hardcoded array.
3. WHEN building LLM_Prompts for query generation, THE Prompt_Template_System SHALL inject Brand_Name, Competitor_Names, and Geography_Config from the Config_System instead of hardcoded values.
4. WHEN building LLM_Prompts for scoring extraction, THE system SHALL use Brand_Name and Entity_Categories from the Config_System instead of hardcoded category lists and brand strings.
5. WHEN building LLM_Prompts for analysis, THE system SHALL inject Brand_Name from the Config_System instead of hardcoded brand strings.
6. WHEN building chat system prompts, THE system SHALL describe the brand's industry and name from the Config_System instead of hardcoded text.
7. WHEN formatting benchmark data for FileSearch upload, THE system SHALL default the brand parameter to Brand_Name from the Config_System instead of a hardcoded string.
8. WHEN generating compare-stage triggers, THE system SHALL use Brand_Name and Competitor_Names from the Config_System instead of hardcoded brand and competitor strings.
9. WHEN rendering UI page titles that include a brand name, THE system SHALL use Brand_Name from the Config_System.
10. WHEN building intent generator system prompts, THE system SHALL inject Brand_Name, Geography_Config, and Entity_Categories from the Config_System instead of hardcoded values.

### Requirement 2: Admin Panel for AI Provider Configuration

**User Story:** As a platform operator, I want to configure which AI providers to use and their models through an admin panel, so that I can choose the providers that fit my budget and needs.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a provider configuration page listing available AI providers (OpenAI, Anthropic, Google Gemini, xAI, and extensible to others).
2. WHEN an operator toggles a provider on or off, THE Admin_Panel SHALL update the active provider list and persist the change.
3. WHEN an operator edits a provider's model identifier, THE Admin_Panel SHALL validate the model string is non-empty and persist the change.
4. WHEN an operator adjusts a provider's scoring weight, THE Admin_Panel SHALL validate the weight is between 0 and 1 and persist the change.
5. WHEN the benchmark runner executes, THE system SHALL use only the providers marked as active in the Provider_Config instead of a hardcoded provider array.
6. IF an operator disables all providers, THEN THE Admin_Panel SHALL display a warning that benchmarks cannot run without at least one active provider.

### Requirement 3: Admin Panel for Stage Configuration with Rename and Reorder

**User Story:** As a platform operator, I want to add, remove, rename, and reorder journey stages through the admin panel, so that I can model the buyer journey that fits my industry.

#### Acceptance Criteria

1. THE Matrix_Studio SHALL allow operators to add new stages with a custom id, label, and description.
2. WHEN an operator renames a stage label, THE Matrix_Studio SHALL persist the new label and display it across the entire platform.
3. WHEN an operator reorders stages, THE Matrix_Studio SHALL update the `orderIndex` and persist the new order.
4. WHEN an operator removes a stage, THE Matrix_Studio SHALL deactivate the stage and exclude it from future benchmark runs.
5. WHEN an operator adds a new stage, THE Matrix_Studio SHALL require a `coreStageMapping` selection (explore, consider, compare, or decide) so the scoring system can extract the correct metrics.
6. WHEN the platform renders the visibility matrix grid, THE system SHALL use the active stages from the database in their configured order.

### Requirement 4: Admin Panel for Persona Configuration

**User Story:** As a platform operator, I want to add, remove, rename, and reorder personas through the admin panel, so that I can define the audience segments relevant to my brand.

#### Acceptance Criteria

1. THE Matrix_Studio SHALL allow operators to add new personas with a custom id, label, description, and optional full-text prompt context.
2. WHEN an operator renames a persona label, THE Matrix_Studio SHALL persist the new label and display it across the entire platform.
3. WHEN an operator reorders personas, THE Matrix_Studio SHALL update the `orderIndex` and persist the new order.
4. WHEN an operator removes a persona, THE Matrix_Studio SHALL deactivate the persona and exclude it from future benchmark runs.
5. WHEN the platform renders the visibility matrix grid, THE system SHALL use the active personas from the database in their configured order.

### Requirement 5: Setup Wizard for Initial Tenant Configuration

**User Story:** As a new platform operator, I want a guided setup process on first run, so that I can configure my brand, competitors, geography, providers, personas, and stages before running benchmarks.

#### Acceptance Criteria

1. WHEN an operator accesses the platform for the first time with no existing configuration, THE Setup_Wizard SHALL guide the operator through brand setup (name, aliases, domain).
2. WHEN the operator completes brand setup, THE Setup_Wizard SHALL prompt for competitor configuration (names and aliases).
3. WHEN the operator completes competitor setup, THE Setup_Wizard SHALL prompt for geography configuration (region, localities, nearby metros).
4. WHEN the operator completes geography setup, THE Setup_Wizard SHALL prompt for provider selection and model configuration.
5. WHEN the operator completes provider setup, THE Setup_Wizard SHALL prompt for persona and stage configuration, offering industry templates as starting points.
6. WHEN the operator completes all setup steps, THE Setup_Wizard SHALL persist the configuration to the database and tenant config, then redirect to the main dashboard.
7. IF the operator skips a step, THEN THE Setup_Wizard SHALL use sensible defaults from the selected industry template.

### Requirement 6: Externalize All LLM Prompts as Config-Driven Templates

**User Story:** As a platform operator, I want all LLM prompts to be externalized as templates with variable interpolation, so that I can customize prompt content per tenant without code changes.

#### Acceptance Criteria

1. WHEN the analysis route builds consultant or hypothesis prompts, THE Prompt_Template_System SHALL provide externalized templates with Config_System variable interpolation.
2. WHEN the query generation API route builds stage guardrails and brand focus text, THE Prompt_Template_System SHALL provide externalized templates with Config_System variable interpolation.
3. WHEN the chat module builds system prompts, THE Prompt_Template_System SHALL provide externalized templates with Config_System variable interpolation.
4. WHEN the intent generator builds system prompts, THE Prompt_Template_System SHALL provide externalized templates with Config_System variable interpolation.
5. WHEN the scoring extractor builds extraction prompts, THE Prompt_Template_System SHALL provide externalized templates with Config_System variable interpolation.

### Requirement 7: Update Test Fixtures to Be Tenant-Agnostic

**User Story:** As a developer, I want test fixtures to work with any tenant config, so that tests remain valid when the configured brand changes.

#### Acceptance Criteria

1. WHEN test fixtures reference a brand name, THE test suite SHALL either import the value from the Config_System or use a clearly parameterized test constant.
2. WHEN test assertions check for brand-specific strings in outputs, THE test suite SHALL derive expected values from the same source as the production code.
3. IF a test requires a specific brand name for snapshot stability, THEN THE test suite SHALL mock the Config_System to return a deterministic value.

### Requirement 8: Remove or Replace Static Brand-Specific Data Files

**User Story:** As a platform operator, I want static data files to be config-driven, so that switching tenants does not leave stale brand-specific data in the application.

#### Acceptance Criteria

1. WHEN the system loads kanban or visibility board data, THE system SHALL derive brand-specific content from the Config_System or a config-driven data source instead of a hardcoded JSON file.
2. WHEN the system loads trigger data for compare stages, THE system SHALL generate trigger options dynamically from Brand_Name and Competitor_Names.
