#!/bin/bash

# Run Historical Backfill
# This script runs the event-based processor to backfill historical data

set -e

echo "=========================================="
echo "Event-Based System Backfill"
echo "=========================================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found. Please install Node.js."
    exit 1
fi

# Configuration
START_DATE="${1:-2024-01-01}"
END_DATE="${2:-2024-12-31}"

echo "Start Date: $START_DATE"
echo "End Date: $END_DATE"
echo ""

# Confirm before proceeding
read -p "This will process all combinations for the date range. Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Starting backfill process..."
echo "This may take 1-2 hours for a full year of data."
echo ""

# Run the processor
cd processor
node event-based-processor.js "$START_DATE" "$END_DATE"

echo ""
echo "=========================================="
echo "Backfill Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Verify data in database: SELECT COUNT(*) FROM trade_events;"
echo "2. Check metadata: SELECT COUNT(*) FROM simulation_metadata WHERE status='completed';"
echo "3. Test queries using test-event-system.sh"
echo ""