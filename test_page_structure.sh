#!/bin/bash

echo "Checking page.tsx files exist..."
for page in crypto-grid-search-new crypto-fast-daily-new crypto-daily-curve-new; do
  file="frontend-dashboard/app/reports/$page/page.tsx"
  if [ -f "$file" ]; then
    echo "✓ $page/page.tsx exists"
    # Check if it has the required exports
    if grep -q "export default" "$file"; then
      echo "  ✓ Has default export"
    else
      echo "  ✗ Missing default export"
    fi
  else
    echo "✗ $page/page.tsx MISSING"
  fi
done

echo ""
echo "Checking if files are in git..."
git ls-tree -r HEAD --name-only | grep "crypto.*new/page.tsx"

echo ""
echo "Latest commits:"
git log --oneline -5
