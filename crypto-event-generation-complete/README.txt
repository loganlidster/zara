CRYPTO EVENT GENERATION - COMPLETE PACKAGE
===========================================

This package contains everything needed to generate crypto trading events.

QUICK START
-----------
1. Read COMPLETE_WORKFLOW_GUIDE.md for full understanding
2. Open Google Cloud Shell (project: tradiac-testing)
3. Paste the 4 command blocks from deployment_blocks/ in order
4. Monitor progress in Cloud Console
5. Verify results using scripts in verification/

PACKAGE CONTENTS
----------------
COMPLETE_WORKFLOW_GUIDE.md          - Complete documentation (READ THIS FIRST)

cloudshell_crypto/
  ├── Dockerfile                    - Docker build configuration
  ├── package.json                  - Node.js dependencies
  ├── crypto-event-generation.js    - Main event generation script
  └── deploy.sh                     - Optional automated deployment

deployment_blocks/
  ├── BLOCK_1_create_script.sh      - Create updated script (13x13, Oct 2024-Nov 2025)
  ├── BLOCK_2_clear_tables.sh       - Clear old event tables
  ├── BLOCK_3_deploy.sh             - Build and deploy to Cloud Run
  └── BLOCK_4_execute.sh            - Execute both jobs (CORRECTED)

verification/
  ├── check_event_counts.sh         - Verify event generation completed
  ├── check_baselines.sh            - Verify baseline coverage
  └── check_sample_events.sh        - View sample events

DEPLOYMENT STEPS
----------------
1. Paste BLOCK_1_create_script.sh into Cloud Shell
   → Creates crypto-event-generation.js with 13x13 combos

2. Paste BLOCK_2_clear_tables.sh into Cloud Shell
   → Clears old event tables

3. Paste BLOCK_3_deploy.sh into Cloud Shell
   → Builds Docker image and deploys to Cloud Run (~5 minutes)

4. Paste BLOCK_4_execute.sh into Cloud Shell
   → Starts both EQUAL_MEAN and WINSORIZED jobs (~20 minutes)

5. Monitor at: https://console.cloud.google.com/run/jobs?project=tradiac-testing

6. After completion, run verification/check_event_counts.sh
   → Should show ~8.5M events per method (~17M total)

IMPORTANT NOTES
---------------
- NO GITHUB: We do NOT use git push/pull workflows
- All files created directly in Cloud Shell via command blocks
- Use --update-env-vars (NOT --set-env-vars) in BLOCK_4
- Expected cost: ~$3 per full backfill
- Expected time: ~25 minutes total (5 min deploy + 20 min processing)

CONFIGURATION
-------------
- Thresholds: 0.3, 0.6, 0.8, 1.0, 1.4, 1.8, 2.0, 2.4, 2.8, 3.0, 3.5, 4.0, 5.0
- Combinations: 169 (13x13)
- Date Range: Oct 1, 2024 - Nov 2, 2025 (13 months)
- Symbols: 19 cryptos (SHIB excluded)
- Methods: EQUAL_MEAN, WINSORIZED

DATABASE
--------
- Host: 34.41.97.179
- Port: 5432
- Database: tradiac_testing
- User: postgres
- Password: Fu3lth3j3t!

SUPPORT
-------
For questions or issues, refer to COMPLETE_WORKFLOW_GUIDE.md
All troubleshooting steps and common issues are documented there.

VERSION
-------
Package Version: 1.0
Last Updated: November 2, 2025
Created by: SuperNinja AI Agent