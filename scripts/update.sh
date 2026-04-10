#!/bin/bash
# update.sh — Update Prism to the latest version
#
# Run this from the prism directory to pull the latest code and restart.
# Database migrations run automatically when the container restarts.
#
# Usage: ./scripts/update.sh

set -e

echo "Pulling latest code..."
git pull

echo "Rebuilding and restarting containers..."
docker-compose up -d --build

echo ""
echo "Prism updated. Migrations run automatically on startup."
echo "Check logs with: docker-compose logs -f app"
