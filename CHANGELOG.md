# CHANGELOG

```
    _    ___   __     ___     _ _     _ _ _ _
   / \  |_ _|  \ \   / (_)___(_) |__ (_) (_) |_ _   _
  / _ \  | |    \ \ / /| / __| | '_ \| | | | __| | | |
 / ___ \ | |     \ V / | \__ \ | |_) | | | | |_| |_| |
/_/   \_\___|     \_/  |_|___/_|_.__/|_|_|_|\__|\__, |
                                                |___/
```

All notable changes to the AI Visibility Baseline app are documented here.

---

## [Unreleased]

### Added
- Intent Library modal for centralized intent management
- Model logos (OpenAI, Claude, Gemini, Grok) on visibility matrix
- Home page redirect to visibility matrix

### Changed
- Deprecated old Market Visibility Dashboard (replaced with redirect)
- Updated role parameter from 'buyer' to 'cpo' in query generation

### Fixed
- Test expectations for role parameter mismatch

---

## 2025-01-16

### Features
```
+------------------------------------------+
|  feat(intents): Intent Library Modal     |
+------------------------------------------+
|  - Centralized intent management         |
|  - Tabbed spreadsheet view               |
|  - Auto-save with 500ms debounce         |
|  - Stage-based organization              |
+------------------------------------------+
```

```
+------------------------------------------+
|  feat(ui): Model Logos & Home Redirect   |
+------------------------------------------+
|  - OpenAI, Claude, Gemini, Grok logos    |
|  - Provider KPI section visual upgrade   |
|  - Home redirects to /visibility-matrix  |
+------------------------------------------+
```

### Documentation
```
+------------------------------------------+
|  docs: UI documentation & dev settings   |
+------------------------------------------+
|  - Updated design system reference       |
|  - Component patterns documented         |
+------------------------------------------+
```

---

## 2025-01-15

### Features
```
+------------------------------------------+
|  feat: Neon PostgreSQL Migration         |
+------------------------------------------+
|  - Migrated from JSON files to Neon DB   |
|  - Benchmark storage in PostgreSQL       |
|  - Improved data persistence             |
+------------------------------------------+
```

### Documentation
```
+------------------------------------------+
|  docs: PRD v3.0 + CLAUDE.md + diagrams   |
+------------------------------------------+
|  - Product requirements document v3.0    |
|  - Claude Code guidance file             |
|  - Architecture diagrams                 |
+------------------------------------------+
```

---

## Earlier Releases

```
+------------------------------------------+
|  KPI Chart & Selector Improvements       |
+------------------------------------------+
|  - Refresh functionality                 |
|  - Selector cleanup                      |
+------------------------------------------+

+------------------------------------------+
|  Feature Kanban UI                       |
+------------------------------------------+
|  - Refined kanban board interface        |
|  - Documentation updates                 |
+------------------------------------------+
```

---

## Commit History

```
   +---------+----------------------------------------+
   | Hash    | Message                                |
   +---------+----------------------------------------+
   | 86551ab | docs: update UI documentation          |
   | aea484c | test: fix role parameter expectation   |
   | fb351a7 | feat(ui): model logos + redirect       |
   | 535f0ea | feat(intents): Intent Library modal    |
   | 9a733b8 | feat: migrate to Neon PostgreSQL       |
   | 0cf0660 | docs: PRD v3.0 + CLAUDE.md             |
   | 0860dff | kpi chart refresh + selector cleanup   |
   | c3bc117 | refine feature kanban UI + docs        |
   +---------+----------------------------------------+
```

---

```
  _____           _
 | ____|_ __   __| |
 |  _| | '_ \ / _` |
 | |___| | | | (_| |
 |_____|_| |_|\__,_|
```
