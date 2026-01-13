# Comprehensive Testing Plan

## Overview

This document outlines the testing strategy for the AI Visibility Baseline cost optimization features.

---

## Test Categories

### 1. Unit Tests (Automated - `npm test`)

| Component | Test File | Coverage |
|-----------|-----------|----------|
| Response Cache | `lib/cache/__tests__/responseCache.test.ts` | Core CRUD operations |
| Response Cache Extended | `lib/cache/__tests__/responseCache.extended.test.ts` | Expiration, edge cases |
| Anthropic Provider | `lib/providers/__tests__/anthropic.test.ts` | Prompt caching headers |
| Benchmark Runner | `lib/benchmark/__tests__/runner.test.ts` | Cache integration |
| Scheduled Endpoint | `api/benchmark/scheduled/__tests__/route.test.ts` | Auth, execution |

### 2. Integration Tests

| Test | How to Run | Expected Result |
|------|------------|-----------------|
| Cache dedup | Run same query twice via UI | Second run shows 0ms latency |
| Prompt caching | Check Anthropic dashboard | Cache hit rate > 0 after repeated queries |
| Scheduled run | `curl /api/benchmark/scheduled` | Returns success with runId |

### 3. Manual Verification Checklist

#### Pre-Deployment
- [ ] `npm run build` completes without errors
- [ ] `npm test` shows all tests passing
- [ ] Review `vercel.json` cron schedule is correct

#### Post-Deployment (Vercel Pro)
- [ ] Verify cron job appears in Vercel dashboard
- [ ] Trigger manual cron execution
- [ ] Verify run saved to `/data/runs/`
- [ ] Verify Gemini File Search upload succeeds
- [ ] Check function execution time < 300s

---

## Test Scenarios

### Response Cache

| Scenario | Steps | Expected |
|----------|-------|----------|
| Fresh query | Query new provider/model/text combination | API called, response cached |
| Cached query | Repeat same query within 24h | Cache hit, 0ms latency |
| Different model | Same query, different model | API called (different key) |
| Expired cache | Wait 25h, repeat query | API called (cache expired) |
| Skip cache | Set `skipCache: true` | API called despite cache |

### Anthropic Prompt Caching

| Scenario | Steps | Expected |
|----------|-------|----------|
| First call | Send query to Anthropic | Full token charge |
| Repeated call | Send different query | 90% reduced input tokens |
| System prompt | Inspect API body | `cache_control` present |
| Beta header | Inspect API headers | `anthropic-beta` present |

### Scheduled Benchmarks

| Scenario | Steps | Expected |
|----------|-------|----------|
| Unauthorized | Call without `CRON_SECRET` when set | 401 response |
| Authorized | Call with correct bearer token | Success response |
| Full matrix | Check cells processed | 16 cells (4×4) |
| Error handling | Intentionally fail one provider | Partial success, errors array |

---

## Running Tests

### All Unit Tests
```bash
cd /Users/spacegreyodyssey/Business/SMR\ AEO/AI\ Visibility\ Baseline/app
npm test
```

### Specific Test File
```bash
npm test -- src/lib/cache/__tests__/responseCache.test.ts
```

### Watch Mode (Development)
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm test -- --coverage
```

---

## Expected Test Results

```
 ✓ src/lib/cache/__tests__/responseCache.test.ts (8 tests)
 ✓ src/lib/cache/__tests__/responseCache.extended.test.ts (7 tests)
 ✓ src/lib/providers/__tests__/anthropic.test.ts (4 tests)
 ✓ src/app/api/benchmark/scheduled/__tests__/route.test.ts (4 tests)
 ✓ src/lib/benchmark/__tests__/runner.test.ts (7 tests)
 ✓ src/lib/benchmark/__tests__/scoring.test.ts (12 tests)
 ... existing tests ...

Test Files  11+ passed
Tests       80+ passed
```

---

## CI/CD Integration

For GitHub Actions or Vercel CI, add:

```yaml
- name: Run Tests
  run: npm test
  
- name: Build
  run: npm run build
```

---

## Monitoring Post-Deployment

### Vercel Logs
- Check cron execution logs daily
- Monitor function duration

### API Provider Dashboards
- **Anthropic**: Check cache_read_input_tokens vs cache_creation_input_tokens
- **OpenAI**: Monitor standard token usage

### Application Metrics
- Track runs created per day
- Monitor cache hit rate via log analysis
