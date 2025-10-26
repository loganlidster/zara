# 🎯 STEP 1: Download and Setup Files

## Your Action Items (Next 5 Minutes)

### 1. Create the project folder structure on your machine:
```powershell
cd C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing
mkdir simulation-engine
mkdir simulation-engine\src
mkdir simulation-engine\src\core
```

### 2. Download these files from the workspace:

**Save to root folder** (`C:\Users\logan\OneDrive\Desktop\tradiac-live\tradiac-testing\`):
- `import_calendar.js`
- `import_calendar.sql`

**Save to simulation-engine folder** (`...\tradiac-testing\simulation-engine\`):
- `package.json`

**Save to simulation-engine\src folder** (`...\simulation-engine\src\`):
- `index.js`

**Save to simulation-engine\src\core folder** (`...\simulation-engine\src\core\`):
- `simulator.js`

### 3. Create the .env file manually:

In `simulation-engine` folder, create a file named `.env` with this content:
```
DB_HOST=34.41.97.179
DB_PORT=5432
DB_NAME=tradiac_testing
DB_USER=postgres
DB_PASSWORD=Fu3lth3j3t!
```

---

## ✅ When You're Done

Tell me: **"Files downloaded and ready"**

Then I'll give you Step 2 (installing dependencies and importing the calendar).