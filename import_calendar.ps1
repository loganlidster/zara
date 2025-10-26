# Set password
$env:PGPASSWORD="Fu3lth3j3t!"

# Step 1: Create temp table
Write-Host "Creating temp table..."
psql -h 34.41.97.179 -p 5432 -U postgres -d tradiac_testing -c "CREATE TEMP TABLE temp_calendar (cal_date TEXT, day_of_week TEXT, is_open TEXT, session_open_et TEXT, session_close_et TEXT, prev_open_date TEXT, next_open_date TEXT, notes TEXT, created_at TEXT, updated_at TEXT);"

# Step 2: Import to temp table
Write-Host "Importing CSV to temp table..."
psql -h 34.41.97.179 -p 5432 -U postgres -d tradiac_testing -c "\copy temp_calendar FROM 'C:\Users\logan\Downloads\studio_results_20251024_0333.csv' WITH (FORMAT csv, HEADER true)"

# Step 3: Copy to real table with conversions
Write-Host "Converting and inserting to real table..."
psql -h 34.41.97.179 -p 5432 -U postgres -d tradiac_testing -c "INSERT INTO trading_calendar (cal_date, day_of_week, is_open, session_open_et, session_close_et, prev_open_date, next_open_date, notes, created_at, updated_at) SELECT cal_date::date, day_of_week, is_open::boolean, session_open_et, session_close_et, NULLIF(prev_open_date, '')::date, NULLIF(next_open_date, '')::date, notes, created_at::timestamptz, updated_at::timestamptz FROM temp_calendar;"

# Step 4: Verify
Write-Host "Verifying import..."
psql -h 34.41.97.179 -p 5432 -U postgres -d tradiac_testing -c "SELECT COUNT(*) FROM trading_calendar;"

# Step 5: Test Monday lookup
Write-Host "Testing Monday lookup..."
psql -h 34.41.97.179 -p 5432 -U postgres -d tradiac_testing -c "SELECT cal_date, day_of_week, prev_open_date FROM trading_calendar WHERE cal_date = '2025-10-20';"

Write-Host "Done!"