# Baseline Date Mismatch Bug - Investigation

## Problem Summary
The system is using the **previous day's baseline** instead of the **current day's baseline** for trade calculations.

## Evidence
From HIVE 9/24-9/25 test:
- 9/24 trades use 9/23's baseline (29520.68) - should use 28616.78
- 9/25 trades use 9/24's baseline (28616.78) - should use 30059.78

Expected baselines (from your data):
- 9/24: 28616.780459
- 9/25: 30059.776703

## Root Cause Analysis Needed

### 1. Check Database Content
- [ ] Query baseline_daily table for HIVE 9/23-9/25
- [ ] Verify what baseline values are stored
- [ ] Check if prev_baseline_date column exists and what it contains

### 2. Check Baseline Calculation
- [ ] Review how baselines are calculated in nightly-processor-dual.js
- [ ] Verify the baseline is calculated for the correct day
- [ ] Check if there's an off-by-one error in date handling

### 3. Check Baseline Retrieval
- [ ] Verify the API query is getting the right day's baseline
- [ ] Check if there's any date shifting logic
- [ ] Verify timezone handling isn't causing date shifts

## Hypothesis
The baseline_daily table might be storing baselines with the wrong trading_day:
- Baseline calculated from 9/24 data is stored as 9/23
- Baseline calculated from 9/25 data is stored as 9/24

This would explain why:
- Querying for 9/24 returns 9/23's baseline
- Querying for 9/25 returns 9/24's baseline

## Next Steps
1. Run check_baseline_table.sql to see actual database content
2. Identify where the date offset is happening
3. Fix the baseline calculation or storage logic
4. Recalculate baselines for affected dates