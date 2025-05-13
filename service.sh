#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 默认端口
PORT=$(grep -o 'PORT=[0-9]*' .env 2>/dev/null | cut -d= -f2)
if [ -z "$PORT" ]; then
  PORT=3001
fi

case "$1" in
  start)
    echo -e "${YELLOW}启动语音助手服务...${NC}"
    PID=$(pgrep -f "node $SCRIPT_DIR/server.js")
    if [ -n "$PID" ]; then
      echo -e "${YELLOW}服务已经在运行 (PID $PID)${NC}"
    else
      nohup node server.js > logs.txt 2>&1 &
      echo -e "${GREEN}服务已启动，PID: $!${NC}"
      echo -e "${GREEN}服务运行在: http://localhost:$PORT${NC}"
    fi
    ;;
    
  stop)
    echo -e "${YELLOW}停止语音助手服务...${NC}"
    PID=$(pgrep -f "node $SCRIPT_DIR/server.js")
    if [ -n "$PID" ]; then
      kill $PID
      echo -e "${GREEN}服务已停止${NC}"
    else
      echo -e "${YELLOW}未发现运行中的服务${NC}"
    fi
    ;;
    
  restart)
    echo -e "${YELLOW}重启语音助手服务...${NC}"
    PID=$(pgrep -f "node $SCRIPT_DIR/server.js")
    if [ -n "$PID" ]; then
      kill $PID
      echo -e "${YELLOW}已停止旧服务${NC}"
    fi
    sleep 2
    nohup node server.js > logs.txt 2>&1 &
    echo -e "${GREEN}服务已重启，PID: $!${NC}"
    echo -e "${GREEN}服务运行在: http://localhost:$PORT${NC}"
    ;;
    
  status)
    PID=$(pgrep -f "node $SCRIPT_DIR/server.js")
    if [ -n "$PID" ]; then
      echo -e "${GREEN}服务正在运行 (PID $PID)${NC}"
      echo -e "${GREEN}服务运行在: http://localhost:$PORT${NC}"
    else
      echo -e "${YELLOW}服务未运行${NC}"
    fi
    ;;
    
  logs)
    if [ -f "$SCRIPT_DIR/logs.txt" ]; then
      tail -n 50 "$SCRIPT_DIR/logs.txt"
    else
      echo -e "${YELLOW}日志文件不存在${NC}"
    fi
    ;;
    
  *)
    echo -e "用法: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac

exit 0