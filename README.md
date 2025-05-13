# 语音助手后端服务

这是一个提供语音转文本和AI处理功能的后端服务。

## 功能特性

- 语音转文本（支持多种音频格式）
- 文本AI处理
- 讯飞API集成
- 健康检查接口

## 一键安装

运行以下命令进行安装：

```bash
curl -s https://raw.githubusercontent.com/Mirrorgo/voice-assistant-backend/master/install.sh | bash
```

## 使用方法

安装完成后，你可以：

1. **启动服务**：
   ```bash
   ~/voice-assistant/service.sh start
   ```

2. **停止服务**：
   ```bash
   ~/voice-assistant/service.sh stop
   ```

3. **查看状态**：
   ```bash
   ~/voice-assistant/service.sh status
   ```

4. **查看日志**：
   ```bash
   ~/voice-assistant/service.sh logs
   ```

5. **更新到最新版本**：
   ```bash
   ~/voice-assistant/update.sh
   ```

## API端点

- **POST /api/process-text**: 处理文本
- **POST /api/process-audio**: 处理音频文件
- **GET /api/get-xfyun-url**: 获取讯飞API签名URL
- **GET /api/health**: 健康检查

## 环境变量配置

在安装过程中，会创建一个`.env`文件，你需要在其中设置以下变量：

```
# API 配置
API_KEY=your_api_key_here
PORT=3001

# API URL 配置
API_URL=https://api.bltcy.ai

# 语音设置
SPEECH_LANGUAGE=zh-CN

# 讯飞API设置（可选）
# XFYUN_API_KEY=your_xfyun_api_key
# XFYUN_API_SECRET=your_xfyun_secret
# XFYUN_APP_ID=your_xfyun_app_id
```

## 系统要求

- Node.js 18+
- pnpm
- Git