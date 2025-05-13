#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量 - 请替换为你的实际GitHub仓库地址
GITHUB_REPO="https://github.com/Mirrorgo/voice-assistant-backend.git"
INSTALL_DIR="$HOME/voice-assistant"

# 打印标题
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}   语音助手简易安装脚本   ${NC}"
echo -e "${BLUE}================================${NC}"

# 确保已安装必要的工具
check_requirements() {
  echo -e "${YELLOW}检查必要工具...${NC}"
  
  # 检查Node.js (最低版本18)
  if ! command -v node &> /dev/null; then
    echo -e "${RED}未检测到Node.js，请先安装Node.js v18+${NC}"
    exit 1
  fi
  
  NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js版本过低，需要v18+版本，当前版本: $(node -v)${NC}"
    exit 1
  fi
  
  # 检查pnpm
  if command -v pnpm &> /dev/null; then
    PACKAGE_MANAGER="pnpm"
  else
    echo -e "${YELLOW}未检测到pnpm，将尝试安装pnpm...${NC}"
    npm install -g pnpm
    if [ $? -ne 0 ]; then
      echo -e "${RED}安装pnpm失败，请手动安装pnpm${NC}"
      exit 1
    fi
    PACKAGE_MANAGER="pnpm"
  fi
  
  echo -e "${GREEN}将使用 $PACKAGE_MANAGER 安装依赖${NC}"
  
  # 检查git
  if ! command -v git &> /dev/null; then
    echo -e "${RED}未检测到git，请先安装git${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ 所有必要工具已准备就绪${NC}"
}

# 准备安装目录
prepare_directory() {
  echo -e "${YELLOW}准备安装目录...${NC}"
  
  # 如果目录已存在，询问是否更新
  if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}安装目录已存在: $INSTALL_DIR${NC}"
    read -p "是否覆盖现有安装? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}将覆盖现有安装...${NC}"
      # 仅保留.env文件和uploads目录
      if [ -f "$INSTALL_DIR/.env" ]; then
        mv "$INSTALL_DIR/.env" "/tmp/voice-assistant-env-backup"
      fi
      if [ -d "$INSTALL_DIR/uploads" ]; then
        mv "$INSTALL_DIR/uploads" "/tmp/voice-assistant-uploads-backup"
      fi
      
      # 删除目录并重新创建
      rm -rf "$INSTALL_DIR"
      mkdir -p "$INSTALL_DIR"
      echo -e "${GREEN}✓ 已准备安装目录${NC}"
    else
      echo -e "${YELLOW}安装已取消${NC}"
      exit 0
    fi
  else
    # 创建安装目录
    mkdir -p "$INSTALL_DIR"
    echo -e "${GREEN}✓ 已创建安装目录${NC}"
  fi
}

# 下载代码
download_code() {
  echo -e "${YELLOW}从GitHub下载代码...${NC}"
  
  cd "$INSTALL_DIR"
  git clone --depth 1 "$GITHUB_REPO" .
  if [ $? -ne 0 ]; then
    echo -e "${RED}克隆仓库失败${NC}"
    exit 1
  fi
  
  # 恢复备份的.env和uploads
  if [ -f "/tmp/voice-assistant-env-backup" ]; then
    mv "/tmp/voice-assistant-env-backup" "$INSTALL_DIR/.env"
    echo -e "${GREEN}✓ 已恢复.env配置文件${NC}"
  fi
  
  if [ -d "/tmp/voice-assistant-uploads-backup" ]; then
    rm -rf "$INSTALL_DIR/uploads"
    mv "/tmp/voice-assistant-uploads-backup" "$INSTALL_DIR/uploads"
    echo -e "${GREEN}✓ 已恢复uploads目录${NC}"
  else
    # 确保uploads目录存在
    mkdir -p "$INSTALL_DIR/uploads"
  fi
  
  # 确保service.sh有执行权限
  chmod +x "$INSTALL_DIR/service.sh"
  chmod +x "$INSTALL_DIR/update.sh"
  
  echo -e "${GREEN}✓ 代码已下载${NC}"
}

# 安装依赖
install_dependencies() {
  echo -e "${YELLOW}安装依赖...${NC}"
  cd "$INSTALL_DIR"
  
  # 使用pnpm安装依赖
  pnpm install --frozen-lockfile
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}安装依赖失败${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ 依赖安装完成${NC}"
}

# 配置应用
configure_app() {
  echo -e "${YELLOW}配置应用...${NC}"
  cd "$INSTALL_DIR"
  
  # 检查是否已有.env文件
  if [ ! -f .env ]; then
    # 创建一个基本的.env文件
    cat > .env << EOF
# API 配置
API_KEY=your_api_key_here
PORT=3001

# API URL 配置
API_URL=https://api.bltcy.ai

# 语音设置
SPEECH_LANGUAGE=zh-CN

# 讯飞API设置
# XFYUN_API_KEY=your_xfyun_api_key
# XFYUN_API_SECRET=your_xfyun_secret
# XFYUN_APP_ID=your_xfyun_app_id
EOF
      echo -e "${YELLOW}已创建基本的.env文件，请编辑此文件设置您的API密钥${NC}"
    
    # 打开.env文件供用户编辑
    if command -v nano &> /dev/null; then
      echo -e "${YELLOW}按Enter键继续编辑.env文件...${NC}"
      read
      nano .env
    elif command -v vi &> /dev/null; then
      echo -e "${YELLOW}按Enter键继续编辑.env文件...${NC}"
      read
      vi .env
    else
      echo -e "${YELLOW}请手动编辑 $INSTALL_DIR/.env 文件设置您的API密钥${NC}"
      echo -e "${YELLOW}按Enter键继续...${NC}"
      read
    fi
  else
    echo -e "${GREEN}✓ .env文件已存在${NC}"
  fi
}

# 创建桌面快捷方式
create_desktop_shortcut() {
  echo -e "${YELLOW}是否创建桌面快捷方式? (y/n): ${NC}"
  read -p "" -n 1 -r
  echo
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 检查是否为Linux桌面环境
    if [ -d "$HOME/Desktop" ]; then
      DESKTOP_DIR="$HOME/Desktop"
    elif [ -d "$HOME/桌面" ]; then
      DESKTOP_DIR="$HOME/桌面"
    else
      echo -e "${YELLOW}未找到桌面目录，跳过创建快捷方式${NC}"
      return
    fi
    
    # 创建启动快捷方式
    cat > "$DESKTOP_DIR/语音助手.desktop" << EOF
[Desktop Entry]
Name=语音助手
Comment=启动语音助手服务
Exec=bash -c "cd $INSTALL_DIR && ./service.sh start && xdg-open http://localhost:3001"
Icon=utilities-terminal
Terminal=true
Type=Application
Categories=Application;
EOF

    # 赋予执行权限
    chmod +x "$DESKTOP_DIR/语音助手.desktop"
    
    echo -e "${GREEN}✓ 桌面快捷方式已创建${NC}"
  fi
}

# 显示安装完成信息
show_completion() {
  echo -e "${BLUE}================================${NC}"
  echo -e "${GREEN}语音助手安装完成!${NC}"
  echo -e "${BLUE}================================${NC}"
  echo -e "${YELLOW}安装目录: ${NC}$INSTALL_DIR"
  echo -e "${YELLOW}启动服务: ${NC}$INSTALL_DIR/service.sh start"
  echo -e "${YELLOW}停止服务: ${NC}$INSTALL_DIR/service.sh stop"
  echo -e "${YELLOW}查看状态: ${NC}$INSTALL_DIR/service.sh status"
  echo -e "${YELLOW}查看日志: ${NC}$INSTALL_DIR/service.sh logs"
  echo -e "${YELLOW}更新软件: ${NC}$INSTALL_DIR/update.sh"
  echo -e "${YELLOW}服务URL: ${NC}http://localhost:3001"
  echo
  echo -e "${YELLOW}是否现在启动服务? (y/n): ${NC}"
  read -p "" -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$INSTALL_DIR"
    ./service.sh start
  fi
  echo
  echo -e "${BLUE}================================${NC}"
}

# 主流程
main() {
  check_requirements
  prepare_directory
  download_code
  install_dependencies
  configure_app
  create_desktop_shortcut
  show_completion
}

# 执行主流程
main