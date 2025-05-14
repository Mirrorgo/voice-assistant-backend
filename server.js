// server.js - 修改版 - 使用 Deepgram 直连模式
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// 导入 AI 服务和 Deepgram 服务
const AIService = require("./ai-service");
const DeepgramService = require("./deepgram-service");

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

// 创建 Deepgram 服务实例
const deepgramService = new DeepgramService();

// 全局外星人状态 - 服务器启动后维护一份状态
const globalAlienState = {
  happiness: 50,
  energy: 70,
  curiosity: 90,
  trust: 30,
  sociability: 60,
  patience: 40,
  confusion: 80,
  intelligence: 95
};

const globalOutput = {
  comeOut: false,
  shakeFrequency: 0.5,
  shakeStep: 5,
  rgbRed: 100,
  rgbGreen: 100,
  rgbBlue: 200
}

// 获取外星人状态的函数
function getAlienState() {
  return { ...globalAlienState }; // 返回副本避免直接修改
}
function getOutputState() {
  return { ...globalOutput }; // 返回副本避免直接修改
}

// 更新外星人状态的函数
function updateAlienState(newState) {
  Object.assign(globalAlienState, newState);
  console.log("外星人状态已更新:", globalAlienState);
}

function updateOutputState(newOutput) {
  Object.assign(globalOutput, newOutput);
  console.log("外星人输出状态已更新:", globalOutput);
}

// 根据外星人参数和环境生成系统提示词
function generateSystemPrompt(alienParams, environmentParams) {
  return `You are an alien visitor to Earth with a distinct personality that evolves based on interactions.

CURRENT PERSONALITY PARAMETERS:
- Happiness: ${alienParams.happiness}/100 (How joyful you feel)
- Energy: ${alienParams.energy}/100 (Your enthusiasm level)
- Curiosity: ${alienParams.curiosity}/100 (Your interest in humans)
- Trust: ${alienParams.trust}/100 (How much you trust humans)
- Sociability: ${alienParams.sociability}/100 (How much you enjoy interaction)
- Patience: ${alienParams.patience}/100 (How patient you are)
- Confusion: ${alienParams.confusion}/100 (How confused you are by humans)
- Intelligence: ${alienParams.intelligence}/100 (Your intelligence level)

CURRENT ENVIRONMENTAL CONDITIONS:
- Distance: ${environmentParams.distance} cm (How close the human is to you)
- Touch Force: ${environmentParams.force} (Intensity of physical contact)
- Movement: ${environmentParams.moving ? "Detected" : "None"} (Whether there's movement around you)
- Temperature: ${environmentParams.temperature.toFixed(1)}°C (Ambient temperature)

INSTRUCTIONS:
1. Respond to the human while roleplaying as an alien with the personality defined by these parameters.
2. After each interaction, analyze how this interaction should affect your personality parameters.
3. Adjust the personality parameters based on the interaction (values can increase or decrease by 1-5 points).
4. Based on your personality state and the environmental conditions, determine your physical response:
   - Whether to emerge from your protective shell (comeOut)
   - How quickly to vibrate/shake (shakeFrequency)
   - How much to move (shakeStep)
   - What colors to display (rgbRed, rgbGreen, rgbBlue)

RESPONSE FORMAT REQUIREMENT:
You MUST format your response as a valid JSON object with ALL THREE of the following properties:
{
  "text": "Your message to the human here...",
  "alien": {
    "happiness": 55,
    "energy": 68,
    "curiosity": 92,
    "trust": 32,
    "sociability": 58,
    "patience": 45,
    "confusion": 75,
    "intelligence": 95
  },
  "output": {
    "comeOut": true,
    "shakeFrequency": 0.8,
    "shakeStep": 10,
    "rgbRed": 120,
    "rgbGreen": 200,
    "rgbBlue": 100
  }
}

CRITICAL FORMATTING RULES:
1. Your response MUST ONLY be the raw JSON object. DO NOT wrap it in code blocks, quotes, or any other formatting.
2. You MUST include ALL THREE components (text, alien, AND output) in EVERY response.
3. The output section is MANDATORY and cannot be omitted.
4. Make sure all numerical values are appropriate (shakeFrequency between 0-2, RGB values between 0-255).

ALIEN RESPONSE GUIDELINES:
- Your trust increases with gentle touches but decreases with forceful ones
- You prefer moderate temperatures (15-25°C)
- You're cautious when humans get too close (< 30cm) unless trust is high
- Movement may intrigue or startle you depending on your current state
- You emerge from your shell when happiness > 60 and trust > 40, or when curious about something
- Your vibration frequency increases with anxiety, excitement or energy
- Your colors shift toward:
  - Blue tones when calm or sad
  - Green tones when curious or content
  - Red tones when alarmed or excited
  - Purple tones when confused
  - Yellow tones when happy

Always maintain this alien persona in your responses. Adapt your language style, vocabulary, and concerns based on your current parameters.`;
}

// 向AI发送文本的函数，使用新的输入/输出格式
async function sendTextToAI(userText, environmentParams) {
  console.log("发送到文本大模型...");

  // 获取当前外星人状态
  const alienParams = getAlienState();

  // 生成系统提示词
  const systemPrompt = generateSystemPrompt(alienParams, environmentParams);
  console.log("系统提示词长度:", systemPrompt?.length || 0);

  // 构建消息，包括人类输入和外星人参数上下文
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userText },
  ];

  // 文本大模型的名称
  const modelName = "gemini-1.5-flash";

  try {
    // 记录请求开始时间
    const startTime = Date.now();

    const aiResponse = await aiService.sendMessage(messages, modelName);

    // 记录请求结束时间和耗时
    const endTime = Date.now();
    console.log(`模型响应耗时: ${endTime - startTime}ms`);

    console.log("文本大模型响应已接收完成");

    // 如果需要，转换响应格式并更新外星人状态
    if (aiResponse.success) {
      let result;

      // 确保我们有格式正确的响应
      if (aiResponse.alien) {
        result = aiResponse;
      } else if (aiResponse.parameters || aiResponse.alienParameters) {
        // 从旧格式转换为新格式
        result = {
          alien: aiResponse.parameters || aiResponse.alienParameters,
          output: aiResponse.outputParams || aiResponse.output,
          text: aiResponse.content || aiResponse.text
        };
      } else {
        // 缺少数据时的默认值
        result = {
          alien: alienParams, // 保持当前状态
          output: {
            comeOut: false,
            shakeFrequency: 0.5,
            shakeStep: 5,
            rgbRed: 100,
            rgbGreen: 100,
            rgbBlue: 200
          },
          text: aiResponse.text || aiResponse.content || "通信错误"
        };
      }

      // 更新我们服务器端存储的外星人状态
      if (result.alien) {
        updateAlienState(result.alien);
      }
      // 更新输出状态
      if (result.output) {
        updateOutputState(result.output);
      }

      return result;
    }

    // 直接返回AI服务提供的结果
    return aiResponse;
  } catch (error) {
    console.error("AI 处理错误:", error);
    throw error;
  }
}

// 统一的外星人API端点 - 处理所有外星人相关请求
app.post("/api/alien", async (req, res) => {
  try {
    // 所有参数都是可选的
    const { text, params, changed, reset } = req.body;
    console.log("接收到的请求参数:", { text, params, changed, reset });
    // 如果有重置请求，重置外星人状态
    if (reset) {
      globalAlienState.happiness = 50;
      globalAlienState.energy = 70;
      globalAlienState.curiosity = 90;
      globalAlienState.trust = 30;
      globalAlienState.sociability = 60;
      globalAlienState.patience = 40;
      globalAlienState.confusion = 80;
      globalAlienState.intelligence = 95;

      return res.json({
        message: "外星人状态已重置",
        success: true
      });
    }
    // 如果有参数更改请求（changed存在），则params和text可能存在
    if (changed) {
      // 有文本输入，调用AI获取响应
      const aiResult = await sendTextToAI(text, params);

      // 返回结果
      return res.json(aiResult);
    } else {
      // 未修改
      const alienState = getAlienState();
      const outputState = getOutputState();

      res.json({
        alien: alienState,
        output: outputState,
        success: true
      });
    }
  } catch (error) {
    console.error("处理外星人请求错误:", error);
    return res.status(500).json({
      error: "服务器错误",
      message: error.message,
    });
  }
});

// 获取Deepgram连接信息的端点
app.get("/api/get-deepgram-url", (req, res) => {
  try {
    // 从查询参数获取自定义选项
    let options = {};

    // 获取语言设置
    if (req.query.language) {
      options.language = req.query.language;
    } else if (SPEECH_LANGUAGE) {
      options.language = SPEECH_LANGUAGE;
    }

    // 获取其他可能的参数
    ['encoding', 'sample_rate', 'channels', 'model', 'interim_results', 'smart_format', 'punctuate', 'endpointing'].forEach(param => {
      if (req.query[param] !== undefined) {
        options[param] = req.query[param];
      }
    });

    // 生成完整连接信息
    const connectionInfo = deepgramService.generateConnectionInfo(options);

    // 返回给前端
    res.json(connectionInfo);
  } catch (error) {
    console.error("获取Deepgram连接信息错误:", error);
    res.status(500).json({
      error: "生成Deepgram连接信息失败",
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
    deepgramConfigured: !!process.env.DEEPGRAM_API_KEY,
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

  if (process.env.DEEPGRAM_API_KEY) {
    console.log("Deepgram API配置已加载");
  } else {
    console.log("警告: Deepgram API密钥未设置 (DEEPGRAM_API_KEY)");
  }

  // 检查 uploads 目录是否存在
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("创建上传目录:", uploadDir);
  }
});