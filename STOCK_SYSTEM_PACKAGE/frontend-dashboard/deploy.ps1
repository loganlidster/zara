# RAAS Frontend Deployment Script (PowerShell)
# This script deploys the frontend to Vercel using token authentication

Write-Host "🚀 Deploying RAAS Frontend to Vercel..." -ForegroundColor Cyan

# Read token from file
$TOKEN = Get-Content -Path "..\VERCEL_TOKEN.txt" -Raw
$TOKEN = $TOKEN.Trim()

# Deploy to production
npx vercel --prod --token=$TOKEN --yes

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Live at: https://raas.help" -ForegroundColor Cyan