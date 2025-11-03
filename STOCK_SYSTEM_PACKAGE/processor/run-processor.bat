@echo off
echo Setting up environment...
set DB_HOST=34.41.97.179
set DB_PORT=5432
set DB_NAME=tradiac_testing
set DB_USER=postgres
set DB_PASSWORD=Fu3lth3j3t!
set DB_SSL=true

echo Running nightly processor...
node nightly-processor.js %*
pause