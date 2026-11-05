#!/bin/bash

# Thư mục dự án = thư mục cha của scripts/
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🕐 Setting up hourly cron job for Văn Hay crawler..."

# Create the cron job entry
CRON_JOB="0 * * * * cd $APP_DIR && $(command -v node) scripts/simple_crawler.js >> $APP_DIR/logs/crawler.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null | grep -v "simple_crawler.js"; echo "$CRON_JOB") | crontab -

echo "✅ Cron job added: Runs every hour"
echo "📝 Logs will be saved to: $APP_DIR/logs/crawler.log"

# Create logs directory if it doesn't exist
mkdir -p $APP_DIR/logs

echo ""
echo "📋 Current crontab:"
crontab -l