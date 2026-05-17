#!/bin/bash
# Wakeel Production Deployment Script
echo "Starting Wakeel Backend Deployment..."

# 1. Pull latest code
echo "Pulling latest code from GitHub..."
git pull origin main

# 2. Install dependencies (in case package.json changed)
echo "Installing dependencies..."
npm install --production

# 3. Reload PM2 Cluster without dropping connections (Zero Downtime)
echo "Reloading PM2 Cluster..."
pm2 reload wakeel-backend --update-env

echo "Deployment Successful! 🚀"
pm2 status
