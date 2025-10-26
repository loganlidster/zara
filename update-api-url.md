# API URL Update Checklist

When Cloud Run deployment finishes, we need to update these files:

## Files to Update:

1. `web-ui/src/components/SimulationForm.jsx`
   - Line with: `fetch('/api/simulate'`
   
2. `web-ui/src/pages/BatchGridSearch/BatchGridSearch.jsx`
   - Line with: `fetch('http://localhost:3001/api/batch-simulate'`
   
3. `web-ui/src/pages/BatchDaily/BatchDaily.jsx`
   - Line with: `fetch('http://localhost:3001/api/batch-daily'`
   
4. `web-ui/src/pages/FastDaily/FastDaily.jsx`
   - Line with: `fetch('http://localhost:3001/api/fast-daily'`

## Better Approach: Use Environment Variable

Create `web-ui/.env.production`:
```
VITE_API_URL=https://tradiac-api-xxxxx-uc.a.run.app
```

Then update all fetch calls to use:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
fetch(`${API_URL}/api/simulate`, ...)
```

This way:
- Local dev uses localhost
- Production uses Cloud Run
- Easy to change later