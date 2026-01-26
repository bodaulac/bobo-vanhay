#!/bin/bash

echo "🕐 Setting up hourly cron job for Văn Hay crawler..."

# Create the cron job entry
CRON_JOB="0 * * * * cd /home/jay/bobo-vanhoc-v2 && /usr/bin/node scripts/simple_crawler.js >> /home/jay/bobo-vanhoc-v2/logs/crawler.log 2>&1"

# Add to crontab
(crontab -l 2>/dev/null | grep -v "simple_crawler.js"; echo "$CRON_JOB") | crontab -

echo "✅ Cron job added: Runs every hour"
echo "📝 Logs will be saved to: /home/jay/bobo-vanhoc-v2/logs/crawler.log"

# Create logs directory if it doesn't exist
mkdir -p /home/jay/bobo-vanhoc-v2/logs

echo ""
echo "📋 Current crontab:"
crontab -l