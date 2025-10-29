#!/bin/bash

# Backfill script for October 24-28, 2025
# Usage: POLYGON_API_KEY=your_key ./backfill-oct-24-28.sh

set -e

if [ -z "$POLYGON_API_KEY" ]; then
    echo "❌ Error: POLYGON_API_KEY environment variable is required"
    echo "Usage: POLYGON_API_KEY=your_key ./backfill-oct-24-28.sh"
    exit 1
fi

echo "🚀 Backfilling data for October 24-28, 2025"
echo "==========================================="
echo ""

dates=("2025-10-24" "2025-10-25" "2025-10-28")

for date in "${dates[@]}"; do
    echo "📅 Processing $date..."
    export TARGET_DATE=$date
    node daily-update-job.js
    
    if [ $? -eq 0 ]; then
        echo "✅ $date completed successfully"
    else
        echo "❌ $date failed"
        exit 1
    fi
    
    echo ""
    sleep 2
done

echo "==========================================="
echo "✅ Backfill Complete!"
echo ""
echo "📊 Dates processed:"
echo "  • October 24, 2025 (Thursday)"
echo "  • October 25, 2025 (Friday)"
echo "  • October 28, 2025 (Monday)"
echo ""
echo "Note: Oct 26-27 (weekend) skipped - no trading data"
echo ""