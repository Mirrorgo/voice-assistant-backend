// server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// 导入简化版 AI 服务
const AIService = require("./ai-service");

const app = express();
const port = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 允许的音频格式
const allowedMimeTypes = [
  'audio/mpeg',   // mp3
  'audio/wav',    // wav
  'audio/webm',   // webm
  'audio/ogg',    // ogg
  'audio/mp4'     // m4a
];

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 如果上传目录不存在，则创建它
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名，保留原始扩展名
    const originalExt = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + originalExt);
  },
});

// 文件过滤器，检查文件类型
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    // 接受文件
    cb(null, true);
  } else {
    // 拒绝文件
    cb(new Error('不支持的文件类型。请上传 MP3, WAV, WebM, OGG 或 M4A 格式的音频文件。'), false);
  }
};

// 配置 multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 限制文件大小为 25MB
  }
});

// 环境变量
const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_URL = process.env.AI_API_URL || "https://api.bltcy.ai";
const SPEECH_LANGUAGE = process.env.SPEECH_LANGUAGE || "en-US"; // 默认语言为英语

// 创建 AI 服务实例
const aiService = new AIService({
  apiKey: AI_API_KEY,
  apiUrl: AI_API_URL,
});

// API 端点，处理音频
app.post("/api/process-audio", upload.single("file"), async (req, res) => {
  let audioFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有提供音频文件" });
    }
    if (!req.body.systemPrompt) {
      return res.status(400).json({ error: "没有提供系统提示词" });
    }

    const systemPrompt = req.body.systemPrompt;
    console.log("使用系统提示词:", systemPrompt);

    // 获取 alienParameters 如果提供了
    let alienParameters = null;
    if (req.body.alienParameters) {
      try {
        alienParameters = JSON.parse(req.body.alienParameters);
        console.log("当前外星人参数:", alienParameters);
      } catch (e) {
        console.error("解析外星人参数时出错:", e);
      }
    }

    audioFilePath = req.file.path;
    console.log("接收到音频文件:", req.file.originalname);
    console.log("文件大小:", req.file.size, "字节");
    console.log("文件类型:", req.file.mimetype);
    console.log("文件保存路径:", audioFilePath);

    try {
      // 步骤 1: 语音转文字
      console.log("开始转录语音...");

      // 转录选项
      const transcriptionOptions = {
        model: "whisper-1",
      };

      // 添加语言设置
      if (SPEECH_LANGUAGE) {
        transcriptionOptions.language = SPEECH_LANGUAGE;
      }

      const transcript = await aiService.transcribeAudio(
        audioFilePath,
        transcriptionOptions
      );

      if (!transcript || transcript.trim() === "") {
        return res.status(422).json({
          error: "语音转录失败",
          message: "没有从音频中识别出文本内容。请确保音频清晰可辨。"
        });
      }

      console.log("转录完成:", transcript);

      // 步骤 2: 将文本发送给 AI 处理
      console.log("发送到文本大模型...");

      // 构建消息，包括人类输入和任何外星人参数的上下文
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ];

      // 文本大模型的 modelName
      const modelName = "qwen-turbo";

      const aiResponse = await aiService.sendMessage(messages, modelName);
      console.log("文本大模型响应已收到");

      // 提取响应中的参数更新
      let cleanedResponse = aiResponse.content;
      let updatedAlienParams = null;

      const paramRegex = /\[PARAMETERS_UPDATE\]([\s\S]*?)\[\/PARAMETERS_UPDATE\]/;
      const match = aiResponse.content.match(paramRegex);

      if (match) {
        try {
          // 提取并解析参数 JSON
          const paramsJson = match[1].trim();
          updatedAlienParams = JSON.parse(paramsJson);

          console.log("提取到更新的外星人参数:", updatedAlienParams);

          // 前端会处理响应中的参数标记，所以这里不移除它们
        } catch (e) {
          console.error("解析参数更新时出错:", e);
        }
      }

      // 步骤 3: 返回结果
      return res.json({
        transcript: transcript,
        content: aiResponse.content,
        success: aiResponse.success,
        error: aiResponse.error,
        alienParameters: updatedAlienParams || alienParameters,
      });
    } catch (error) {
      console.error("AI 处理错误:", error);
      return res.status(500).json({
        error: "AI 处理错误",
        message: error.message,
      });
    }
  } catch (error) {
    // 处理 multer 错误
    if (error instanceof multer.MulterError) {
      console.error("Multer 错误:", error);

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: "文件太大",
          message: "音频文件不能超过 25MB"
        });
      }

      return res.status(400).json({
        error: "文件上传错误",
        message: error.message
      });
    }

    console.error("服务器错误:", error);
    return res.status(500).json({
      error: "服务器错误",
      message: error.message,
    });
  } finally {
    // 清理: 删除上传的文件
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      fs.unlink(audioFilePath, (err) => {
        if (err) console.error("删除文件错误:", err);
      });
    }
  }
});

// 健康检查接口
app.get("/api/health", (req, res) => {
  const healthStatus = {
    status: "ok",
    message: "服务器正在运行",
    apiUrl: AI_API_URL,
    language: SPEECH_LANGUAGE,
    timestamp: new Date().toISOString()
  };

  // 检查 API 密钥是否存在
  if (!AI_API_KEY) {
    healthStatus.status = "warning";
    healthStatus.message = "API 密钥未设置";
  }

  res.json(healthStatus);
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error("未捕获的错误:", err);
  res.status(500).json({
    error: "服务器内部错误",
    message: process.env.NODE_ENV === 'production' ? "请稍后再试" : err.message
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`后端服务器运行在 http://localhost:${port}`);
  console.log(`API URL: ${AI_API_URL}`);
  console.log(`语音语言: ${SPEECH_LANGUAGE}`);

  // 检查 uploads 目录是否存在
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("创建上传目录:", uploadDir);
  }
});