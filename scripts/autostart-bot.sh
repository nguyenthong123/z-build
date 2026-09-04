#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Đợi 2 phút (120 giây) để macOS mount ổ DATA_SSD và nạp mạng hoàn tất
sleep 120

# Khởi động Ollama nếu chưa chạy
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve > /dev/null 2>&1 &
    sleep 5
fi

# Tải trước model vào RAM
ollama run qwen2.5-coder:7b "" > /dev/null 2>&1

# Khởi chạy Bot và Web API Server
pkill -f "telegram-bot.cjs"
/usr/local/bin/node /Volumes/DATA_SSD/Projects/zbuild/nexus-store/scripts/telegram-bot.cjs >> /tmp/telegram-bot.log 2>&1 || /opt/homebrew/bin/node /Volumes/DATA_SSD/Projects/zbuild/nexus-store/scripts/telegram-bot.cjs >> /tmp/telegram-bot.log 2>&1
