#!/bin/bash
# Chạy ainovel-cli (chế độ headless) để viết một cuốn truyện mới, rồi import vào MongoDB.
#   scripts/ainovel_write.sh <ten-truyen> "<yêu cầu viết truyện>"
# Cần: ainovel-cli đã cài và đã cấu hình ~/.ainovel/config.json (chạy `ainovel-cli` một lần để thiết lập).
set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Cách dùng: $0 <ten-truyen> \"<yêu cầu>\"" >&2
    exit 1
fi
command -v ainovel-cli >/dev/null || { echo "Chưa cài ainovel-cli: https://github.com/voocel/ainovel-cli" >&2; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="$1"; PROMPT="$2"
WORKDIR="${AINOVEL_WORKSPACE:-$APP_DIR/workspace}/$NAME"

mkdir -p "$WORKDIR/.ainovel/rules"
# Quy tắc ngôn ngữ/văn phong tiếng Việt, áp dụng riêng cho cuốn này
cp "$APP_DIR/ainovel/rules/"*.md "$WORKDIR/.ainovel/rules/"

cd "$WORKDIR"
# Chạy tiếp tục từ checkpoint nếu thư mục đã có dữ liệu; chỉ truyền --prompt khi bắt đầu mới
if [ -d output/novel/meta ]; then
    ainovel-cli --headless
else
    ainovel-cli --headless --prompt "$PROMPT"
fi

cd "$APP_DIR"
node scripts/import_ainovel.js "$WORKDIR" --slug "$NAME"
