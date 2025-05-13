#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 配置变量 - 与install.sh中的一致
GITHUB_REPO="https://github.com/Mirrorgo/voice-assistant-backend.git"

# 打印标题
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}   语音助手简易更新脚本   ${NC}"
echo -e "${BLUE}================================${NC}"

# 停止当前运行的服务
echo -e "${YELLOW}停止当前运行的服务...${NC}"
./service.sh stop
sleep 2

# 备份重要文件
echo -e "${YELLOW}备份配置文件...${NC}"
if [ -f .env ]; then
  cp .env .env.backup
  echo -e "${GREEN}✓ 已备份.env文件${NC}"
fi

# 备份uploads目录
if [ -d uploads ]; then
  mkdir -p uploads.backup
  cp -r uploads/* uploads.backup/ 2>/dev/null
  echo -e "${GREEN}✓ 已备份uploads目录${NC}"
fi

# 更新代码
echo -e "${YELLOW}获取最新代码...${NC}"

# 检查是否为git仓库
if [ -d .git ]; then
  # 保存当前修改（如果有）
  git stash
  
  # 获取最新代码
  git pull origin main || git pull origin master
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}拉取代码异常，尝试强制更新...${NC}"
    # 保存所有未在git中的文件（除了node_modules）
    mkdir -p ../temp_backup
    find . -not -path "*/node_modules/*" -not -path "*/\.*" -type f | grep -v "^./.git" | while read file; do
      if [ ! -z "$(git ls-files --error-unmatch "$file" 2>/dev/null)" ]; then
        continue
      fi
      dir=$(dirname "$file")
      mkdir -p "../temp_backup/$dir"
      cp "$file" "../temp_backup/$file"
    done
    
    # 重新克隆仓库
    cd ..
    rm -rf "$SCRIPT_DIR"
    git clone --depth 1 "$GITHUB_REPO" "$(basename "$SCRIPT_DIR")"
    cd "$SCRIPT_DIR"
    
    # 恢复未在git中的文件
    if [ -d ../temp_backup ]; then
      cp -r ../temp_backup/* ./ 2>/dev/null
      rm -rf ../temp_backup
    fi
  fi
else
  echo -e "${YELLOW}不是git仓库，需要重新下载...${NC}"
  
  # 创建临时目录保存非git文件
  mkdir -p ../temp_files
  # 复制.env和uploads到临时目录
  cp .env ../temp_files/ 2>/dev/null
  cp -r uploads ../temp_files/ 2>/dev/null
  
  # 删除当前目录（保留备份）
  cd ..
  rm -rf "$SCRIPT_DIR"
  
  # 重新克隆
  git clone --depth 1 "$GITHUB_REPO" "$(basename "$SCRIPT_DIR")"
  
  # 恢复文件
  cp ../temp_files/.env "$SCRIPT_DIR/" 2>/dev/null
  cp -r ../temp_files/uploads/* "$SCRIPT_DIR/uploads/" 2>/dev/null
  rm -rf ../temp_files
  
  # 返回到脚本目录
  cd "$SCRIPT_DIR"
fi

# 恢复备份（如果原始备份丢失）
if [ ! -f .env ] && [ -f .env.backup ]; then
  cp .env.backup .env
  echo -e "${GREEN}✓ 已恢复.env文件${NC}"
fi

# 恢复uploads目录
if [ -d uploads.backup ]; then
  mkdir -p uploads
  cp -r uploads.backup/* uploads/ 2>/dev/null
  rm -rf uploads.backup
  echo -e "${GREEN}✓ 已恢复uploads目录${NC}"
fi

# 确保脚本有执行权限
chmod +x service.sh
chmod +x update.sh

# 更新依赖
echo -e "${YELLOW}更新依赖...${NC}"
if command -v pnpm &> /dev/null; then
  pnpm install --frozen-lockfile
else
  npm install
fi

# 完成
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}语音助手更新完成!${NC}"
echo -e "${BLUE}================================${NC}"

# 询问是否重启服务
echo -e "${YELLOW}是否重启服务? (y/n): ${NC}"
read -p "" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  ./service.sh start
fi