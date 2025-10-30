# Report Enhancement Fixes - Implementation Plan

## Issues to Fix

### 1. Best Performer - Multi-Select Symbols
**Current State:** Single symbol dropdown
**Required:** Multi-select to run multiple symbols simultaneously
**Impact:** Frontend + Backend changes needed

### 2. Best Performer - Per-Stock Top Performers
**Current State:** Shows overall top performers (CAN dominates all results)
**Required:** Show top N performers for EACH stock separately
**Impact:** Backend logic change + Frontend display change

### 3. Daily Curve - Session-Specific Baselines for ALL Mode
**Current State:** When session="ALL", uses single baseline
**Required:** Use RTH baseline for RTH bars, AH baseline for AH bars
**Impact:** Backend endpoint needs to handle dual baselines

### 4. Daily Curve - ALL Mode Not Working
**Current State:** Error "Range testing requires a specific symbol"
**Root Cause:** This error is from Best Performers page, not Daily Curve
**Required:** Verify Daily Curve ALL mode actually works

## Implementation Strategy

### Phase 1: Best Performer Multi-Select (Issue #1)
1. Update frontend to use multi-select component
2. Update API call to send array of symbols
3. Backend already supports filtering by symbol or "All"
4. No backend changes needed - just frontend

### Phase 2: Best Performer Per-Stock View (Issue #2)
1. Add new query mode: "per-stock" vs "overall"
2. Backend: Group results by symbol, take top N from each
3. Frontend: Add toggle for view mode
4. Display results grouped by symbol

### Phase 3: Daily Curve Session-Specific Baselines (Issue #3)
1. Backend: When session="ALL", fetch both RTH and AH baselines
2. For each event, use appropriate baseline based on bar's session
3. Frontend: Already has UI for separate RTH/AH thresholds
4. Need to pass these to backend and use correctly

### Phase 4: Daily Curve ALL Mode Fix (Issue #4)
1. Investigate actual error - may be confusion with Best Performers
2. Test Daily Curve with session="ALL"
3. Verify it works with current code
4. If broken, fix the validation logic

## Files to Modify

### Frontend
- frontend-dashboard/app/reports/best-performers/page.tsx - Multi-select + per-stock view
- frontend-dashboard/app/reports/daily-curve/page.tsx - Session-specific threshold passing
- frontend-dashboard/lib/api.ts - Update API call signatures if needed

### Backend
- api-server/best-performers-two-step.js - Per-stock grouping logic
- api-server/daily-curve-endpoint.js - Session-specific baseline handling

## Testing Plan
1. Test multi-select with 2-3 symbols
2. Test per-stock view shows results for all symbols
3. Test Daily Curve ALL mode with different RTH/AH thresholds
4. Verify ALL mode works without errors