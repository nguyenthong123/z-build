#!/bin/bash
# Auto rebuild + restart vite preview when src files change
PROJECT="/Volumes/DATA_SSD/Projects/zbuild/nexus-store"
PORT=3000

cd "$PROJECT"

echo "👀 Theo dõi thay đổi code, tự động rebuild..."
echo "📡 Đang chạy preview lần đầu..."

# Kill existing
lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Build + start
npm run build && npx vite preview --host 0.0.0.0 --port $PORT &
PREVIEW_PID=$!

echo "✅ Preview: http://localhost:$PORT"
echo "🔄 Tự động rebuild khi lưu file..."

fswatch -o "$PROJECT/src/" --event=Updated --event=Created | while read; do
  echo "📝 Phát hiện thay đổi... rebuilding..."
  npm run build 2>&1 | tail -1
  if [ $? -eq 0 ]; then
    # Restart preview
    kill $PREVIEW_PID 2>/dev/null
    sleep 1
    npx vite preview --host 0.0.0.0 --port $PORT &
    PREVIEW_PID=$!
    echo "✅ Done! F5 browser để thấy thay đổi."
  else
    echo "❌ Build lỗi, chưa restart"
  fi
done
