@echo off
cd /d "%~dp0"
echo Starting baseline recalculation...
echo Current directory: %CD%
node recalculate-baselines-with-sessions.js 2024-01-01 2025-10-26
pause