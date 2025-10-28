#!/bin/bash

# RAAS Frontend Deployment Script
# This script deploys the frontend to Vercel using token authentication

echo "🚀 Deploying RAAS Frontend to Vercel..."

# Read token from file
TOKEN=$(cat ../VERCEL_TOKEN.txt)

# Deploy to production
npx vercel --prod --token=$TOKEN --yes

echo "✅ Deployment complete!"
echo "🌐 Live at: https://raas.help"