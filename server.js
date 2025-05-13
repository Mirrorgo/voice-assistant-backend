// server.js - 添加讯飞API集成功能
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// 导入 AI 服务和讯飞服务
const AIService = require("./ai-service");
const XfyunService = require("./xfyun-service");

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
const AI_API_KEY = process.env.API_KEY;
const AI_API_URL = "https://api.bltcy.ai";
const SPEECH_LANGUAGE = "en-US"; // 默认语言为英语

// 创建 AI 服务实例
const aiService = new AIService({
  apiKey: AI_API_KEY,
  apiUrl: AI_API_URL,
});

// 创建讯飞服务实例
const xfyunService = new XfyunService();

// 发送文本到 AI 函数
async function sendTextToAI(userText, systemPrompt, alienParameters = null) {
  console.log("发送到文本大模型...");
  console.log("系统提示词长度:", systemPrompt?.length || 0);

  // 构建消息，包括人类输入和任何外星人参数的上下文
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ];

  // 文本大模型的 modelName
  const modelName = "gemini-1.5-flash";

  try {
    // 记录请求开始时间
    const startTime = Date.now();

    const aiResponse = await aiService.sendMessage(messages, modelName);

    // 记录请求结束时间和耗时
    const endTime = Date.now();
    console.log(`模型响应耗时: ${endTime - startTime}ms`);

    console.log("文本大模型响应已接收完成");

    // 直接返回AI服务提供的结果，不做额外处理
    return aiResponse;
  } catch (error) {
    console.error("AI 处理错误:", error);
    throw error;
  }
}

// 文本 API 端点 - 保持不变
app.post("/api/process-text", async (req, res) => {
  try {
    const { text, systemPrompt, alienParameters } = req.body;

    if (!text) {
      return res.status(400).json({ error: "没有提供文本内容" });
    }
    if (!systemPrompt) {
      return res.status(400).json({ error: "没有提供系统提示词" });
    }

    // 调用发送文本到大模型的函数
    const aiResult = await sendTextToAI(text, systemPrompt, alienParameters);

    // 直接返回原始结果
    return res.json(aiResult);
  } catch (error) {
    console.error("处理文本错误:", error);
    return res.status(500).json({
      error: "服务器错误",
      message: error.message,
    });
  }
});

// 修改后的音频处理 API 端点 - 仅处理语音转文字，不发送到AI模型
app.post("/api/process-audio", upload.single("file"), async (req, res) => {
  let audioFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有提供音频文件" });
    }

    audioFilePath = req.file.path;
    console.log("接收到音频文件:", req.file.originalname);
    console.log("文件大小:", req.file.size, "字节");
    console.log("文件类型:", req.file.mimetype);
    console.log("文件保存路径:", audioFilePath);

    try {
      // 只执行语音转文字
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

      // 返回转录文本，但不发送到AI模型
      return res.json({
        success: true,
        transcript: transcript,
        content: "" // 保持一致的响应格式
      });
    } catch (error) {
      console.error("语音转录错误:", error);
      return res.status(500).json({
        error: "语音转录错误",
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

// 新增：获取讯飞API签名URL的端点
app.get("/api/get-xfyun-url", (req, res) => {
  try {
    // 生成带有签名的URL
    const signedUrl = xfyunService.generateSignedUrl();

    // 返回给前端
    res.json({ signedUrl });
  } catch (error) {
    console.error("获取讯飞API URL错误:", error);
    res.status(500).json({
      error: "生成讯飞API URL失败",
      message: error.message
    });
  }
});

// 健康检查接口
app.get("/api/health", (req, res) => {
  const healthStatus = {
    status: "ok",
    message: "服务器正在运行",
    apiUrl: AI_API_URL,
    language: SPEECH_LANGUAGE,
    xfyunConfigured: !!(process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET && process.env.XFYUN_APP_ID),
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

  if (process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET && process.env.XFYUN_APP_ID) {
    console.log("讯飞API配置已加载");
  } else {
    console.log("警告: 讯飞API配置不完整或缺失");
  }

  // 检查 uploads 目录是否存在
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("创建上传目录:", uploadDir);
  }
});