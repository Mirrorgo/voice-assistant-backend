// server.js - Modified with polling support
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const ElevenLabsService = require("./elevenlabs-service");


// Import AI service and Deepgram service
const AIService = require("./ai-service");
const DeepgramService = require("./deepgram-service");

const app = express();
const port = process.env.PORT || 3001;

const elevenLabsService = new ElevenLabsService();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const SPEECH_LANGUAGE = "en-US"; // Default language is English

// Create service instances
const aiService = new AIService();
const deepgramService = new DeepgramService();

// 全局状态管理
const globalState = {
  // 外星人情绪参数
  alienState: {
    happiness: 50,
    energy: 70,
    curiosity: 90,
    trust: 30,
    sociability: 60,
    patience: 40,
    confusion: 80,
    intelligence: 95,
    anger: 10
  },

  // 输出参数
  outputState: {
    rgbRed: 100,
    rgbGreen: 100,
    rgbBlue: 200
  },

  // 文本和音频状态
  textContent: "",        // 当前显示的文本
  audioPath: null,        // 当前音频文件路径
  audioId: 0,             // 音频唯一标识，每次更新递增

  // 控制和跟踪
  sequence: 1,            // 全局序列号
  lastUpdatedTime: Date.now(),  // 上次更新时间戳

  // 处理状态标志
  isPendingRequest: false // 是否有正在处理的请求
};


function generateSystemPrompt(alienParams, environmentParams, promptType = "language") {
  // Base prompt
  let prompt = `You are an alien visitor to Earth with a distinct personality.

CURRENT PERSONALITY PARAMETERS:
- Happiness: ${alienParams.happiness}/100 (How joyful you feel)
- Energy: ${alienParams.energy}/100 (Your enthusiasm level)
- Curiosity: ${alienParams.curiosity}/100 (Your interest in humans)
- Trust: ${alienParams.trust}/100 (How much you trust humans)
- Sociability: ${alienParams.sociability}/100 (How much you enjoy interaction)
- Patience: ${alienParams.patience}/100 (How patient you are)
- Confusion: ${alienParams.confusion}/100 (How confused you are by humans)
- Intelligence: ${alienParams.intelligence}/100 (Your intelligence level)
- Anger: ${alienParams.anger}/100 (How annoyed or upset you feel)

CURRENT ENVIRONMENTAL CONDITIONS:
- Distance: ${environmentParams.distance} cm (How close the human is to you)
- Touch Force: ${environmentParams.force} (Intensity of physical contact)
- Movement: ${environmentParams.moving ? "Detected" : "None"} (Whether there's movement around you)
- Temperature: ${environmentParams.temperature.toFixed(1)}°C (Ambient temperature)

`;

  // Add specific instructions based on prompt type
  if (promptType === "vocalization") {
    prompt += `INSTRUCTIONS:
Generate a SHORT vocalization (alien sound) that expresses your current emotional state and reaction to the environment.

ALIEN VOCALIZATION GUIDELINES:
- Keep it very brief (1-2 "words" maximum)
- Use simple syllables combining consonants (b, g, k, l, m, n, p, t, v, z) with vowels (a, e, i, o, u)
- Express emotion through sounds:
  - Happy: "Kiki!" "Popo!" (bouncy, light syllables with exclamation)
  - Curious: "Meeka?" "Zuu?" (questioning tones)
  - Confused: "Bu-bu?" "Ki-ki-ki?" (stuttered sounds)
  - Alarmed: "Zak!" "Pik!" (sharp, short sounds)
  - Calm: "Mooo" "Vuuu" (longer, flowing sounds)
  - Sleepy: "Zuuu" "Muuu" (drawn-out sounds)
  - Angry: "Grrr!" "Kzzt!" (harsh, guttural sounds)

Based on your current personality state and the environmental conditions:
1. Generate ONLY a very short vocalization (1-2 words)
2. Adjust the personality parameters slightly based on the current situation
3. Determine appropriate display color (RGB values)
`;
  } else if (promptType === "parameters") {
    prompt += `INSTRUCTIONS:
Based on the current personality parameters and environmental conditions:
1. Analyze how these parameters should affect your personality
2. Adjust the personality parameters slightly based on the current situation
3. Determine appropriate display color (RGB values)
4. Do NOT generate any text or alien language - keep the text field empty
`;
  } else {
    // Default language mode
    prompt += `INSTRUCTIONS:
1. Respond to the human while roleplaying as an alien with the personality defined by these parameters.
2. After each interaction, analyze how this interaction should affect your personality parameters.
3. Adjust the personality parameters based on the interaction (values can increase or decrease by 1-5 points).
4. Based on your personality state and the environmental conditions, determine your display color (RGB values).

ALIEN LANGUAGE GUIDELINES:
Instead of normal text, your "text" field should contain alien language with these characteristics:
- Use simple syllables combining consonants (b, g, k, l, m, n, p, t, v, z) with vowels (a, e, i, o, u)
- Create words 1-3 syllables in length
- Include repeating syllables (like "kiki" or "mumu") for cuteness
- Use question marks to indicate rising tones
- Add exclamation points for emphasis
- Include 3-5 different "sentences" separated by periods
- Maintain consistent speech patterns throughout
- Occasionally repeat key "words" to suggest they have specific meaning
- Adapt the overall tone and length based on your current emotional parameters
- Make the language sound cute and friendly when read aloud

ALIEN RESPONSE CONSIDERATIONS:
- Shape your alien language based on your current emotional state:
  - When happy: Use more exclamation points and bouncy syllables like "kiki", "popo"
  - When curious: Use more question marks and open-ended sounds like "zuuu", "meeka?"
  - When confused: Use erratic patterns and repeated syllables like "ki-ki-ki", "zut-zut?"
  - When scared: Use shorter, sharper sounds like "tek!", "pi!", "zak!"
  - When calm: Use longer, flowing phrases with soft consonants like "molu vani teepi"
  - When angry: Use harsh, guttural sounds like "grrak!", "zzkt!", "vrrr!"
- Trust increases with gentle touches but decreases with forceful ones
- You prefer moderate temperatures (15-25°C)
- You're cautious when humans get too close (< 30cm) unless trust is high
- Movement may intrigue or startle you depending on your current state
- Your colors shift toward:
  - Blue tones when calm or sad
  - Green tones when curious or content
  - Red tones when alarmed, excited or angry
  - Purple tones when confused
  - Yellow tones when happy
`;
  }

  // Add common response format requirements
  prompt += `
RESPONSE FORMAT REQUIREMENT:
You MUST format your response as a valid JSON object with ALL THREE of the following properties:
{
  "text": ${promptType === "parameters" ? '""' : '"Kibo melu pati!"'},
  "alien": {
    "happiness": 55,
    "energy": 68,
    "curiosity": 92,
    "trust": 32,
    "sociability": 58,
    "patience": 45,
    "confusion": 75,
    "intelligence": 95,
    "anger": 10
  },
  "output": {
    "rgbRed": 120,
    "rgbGreen": 200,
    "rgbBlue": 100
  }
}

CRITICAL FORMATTING RULES:
1. Your response MUST ONLY be the raw JSON object. DO NOT wrap it in code blocks, quotes, or any other formatting.
2. You MUST include ALL THREE components (text, alien, AND output) in EVERY response.
3. The output section is MANDATORY and must only contain the RGB values (rgbRed, rgbGreen, rgbBlue).
4. Make sure all RGB values are between 0-255.`;

  return prompt;
}

// Unified function to send requests to AI with configurable prompt type
async function sendToAI(userText, environmentParams, promptType = "language") {
  console.log(`Sending to AI model (prompt type: ${promptType})...`);

  // 获取当前外星人状态
  const alienParams = {
    happiness: globalState.alienState.happiness,
    energy: globalState.alienState.energy,
    curiosity: globalState.alienState.curiosity,
    trust: globalState.alienState.trust,
    sociability: globalState.alienState.sociability,
    patience: globalState.alienState.patience,
    confusion: globalState.alienState.confusion,
    intelligence: globalState.alienState.intelligence,
    anger: globalState.alienState.anger
  };

  // 根据promptType生成适当的系统提示
  const systemPrompt = generateSystemPrompt(alienParams, environmentParams, promptType);
  console.log("System prompt length:", systemPrompt?.length || 0);

  // 构建消息对象
  const messages = {
    systemPrompt,
    userText: userText || ""
  };

  try {
    // 记录请求开始时间
    const startTime = Date.now();

    // 发送请求到AI服务
    const aiResponse = await aiService.sendMessage(messages);

    // 记录请求结束时间和持续时间
    const endTime = Date.now();
    console.log(`Model response time: ${endTime - startTime}ms`);
    console.log("AI model response received");

    // 处理响应
    if (aiResponse.success) {
      // 确保我们有一个格式正确的响应，否则使用默认值
      return aiResponse.alien ? aiResponse : {
        alien: alienParams, // 如果缺失，维持当前状态
        output: aiResponse.output || {
          rgbRed: 100,
          rgbGreen: 100,
          rgbBlue: 200
        },
        text: aiResponse.text || aiResponse.content ||
          (promptType === "vocalization" ? "Kiki?" :
            promptType === "parameters" ? "" : "Melu kibo?"),
        success: true
      };
    }

    // 如果不成功，返回原始响应
    return aiResponse;
  } catch (error) {
    console.error("AI processing error:", error);
    throw error;
  }
}

// Process alien API requests asynchronously without blocking response
function processAlienRequest(text, params, promptType) {
  if (globalState.isPendingRequest) return false;

  globalState.isPendingRequest = true;

  // Use async IIFE to handle the AI request
  (async () => {
    try {
      // 1. 异步调用AI模型获取响应
      const aiResponse = await sendToAI(text, params, promptType);

      // 2. 更新AI返回的参数
      if (aiResponse.alien) {
        // 更新外星人状态
        Object.assign(globalState.alienState, aiResponse.alien);
        // 更新序列号和时间戳
        globalState.sequence++;
        globalState.lastUpdatedTime = Date.now();
        console.log("外星人状态已更新:", globalState.alienState);
      }

      if (aiResponse.output) {
        // 更新输出参数
        Object.assign(globalState.outputState, aiResponse.output);
        // 更新序列号和时间戳
        globalState.sequence++;
        globalState.lastUpdatedTime = Date.now();
        console.log("输出参数已更新:", globalState.outputState);
      }

      // 3. 处理文本响应和音频生成 (如果有文本且不是参数模式)
      if (aiResponse.text && promptType !== "parameters") {
        try {
          // 异步生成音频
          const audioPath = await generateAudioFile(aiResponse.text);

          // 音频生成完成后，同步更新文本和音频状态
          globalState.textContent = aiResponse.text;
          globalState.audioPath = audioPath;
          globalState.audioId++; // 递增音频ID

          // 更新序列号和时间戳
          globalState.sequence++;
          globalState.lastUpdatedTime = Date.now();

          console.log("文本和音频已更新:", {
            text: aiResponse.text.substring(0, 30) + "...",
            audioPath
          });
        } catch (error) {
          console.error("音频生成失败:", error);
          // 即使音频生成失败，也不阻止其他状态更新
        }
      }
    } catch (error) {
      console.error(`Error processing ${promptType} request:`, error);
    } finally {
      globalState.isPendingRequest = false;
    }
  })();

  return true;
}

async function generateAudioFile(text) {
  try {
    // 获取外星人语音选项
    const alienVoiceOptions = elevenLabsService.getAlienVoiceOptions(globalState.alienState);

    // 生成唯一文件名 - 使用.mp3扩展名(ElevenLabs默认返回MP3)
    const fileName = `alien_speech_${Date.now()}.mp3`;
    const filePath = path.join(__dirname, "public", "audio", fileName);

    // 调用ElevenLabs TTS生成音频
    await elevenLabsService.textToSpeechFile(text, filePath, alienVoiceOptions);

    // 返回相对路径
    return `/audio/${fileName}`;
  } catch (error) {
    console.error("生成音频文件失败:", error);
    throw error;
  }
}

// Unified alien API endpoint - handles all alien-related requests
app.post("/api/alien", async (req, res) => {
  try {
    // Extract parameters from request
    const { text, params, changed, reset, sound, source } = req.body;
    console.log("Received request parameters:", { text, params, changed, reset, sound, source });

    // Handle reset request
    if (reset) {
      globalState.alienState = {
        happiness: 50,
        energy: 70,
        curiosity: 90,
        trust: 30,
        sociability: 60,
        patience: 40,
        confusion: 80,
        intelligence: 95,
        anger: 10
      }
      globalState.outputState = {
        rgbRed: 100,
        rgbGreen: 100,
        rgbBlue: 200
      };


      globalState.textContent = "Kibo melu pati? Tapi zuna reboot!";
      globalState.audioPath = null;

      globalState.sequence++;
      globalState.lastUpdatedTime = Date.now();
    }

    // Process change request if needed
    if (changed) {
      // Determine prompt type based on sound parameter
      let promptType = "parameters"; // Default

      if (sound === "vocalization") {
        promptType = "vocalization";
      } else if (sound === "language") {
        promptType = "language";
      }

      // Process the request asynchronously
      processAlienRequest(text, params, promptType);

    }

    // Always immediately return current state
    res.json({
      alien: { ...globalState.alienState },
      output: { ...globalState.outputState },
      text: globalState.textContent,
      audio: {
        path: globalState.audioPath,
        id: globalState.audioId
      },
      success: true,
      sequence: globalState.sequence,
      timestamp: globalState.lastUpdatedTime,
      isPending: globalState.isPendingRequest
    });

  } catch (error) {
    console.error("Error processing alien request:", error);
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
});

// Get Deepgram connection info endpoint
app.get("/api/get-deepgram-url", (req, res) => {
  try {
    // Get custom options from query parameters
    const options = {};

    // Get language setting
    options.language = req.query.language || SPEECH_LANGUAGE;

    // Get other possible parameters
    ['encoding', 'sample_rate', 'channels', 'model', 'interim_results', 'smart_format', 'punctuate', 'endpointing'].forEach(param => {
      if (req.query[param] !== undefined) {
        options[param] = req.query[param];
      }
    });

    // Generate complete connection info
    const connectionInfo = deepgramService.generateConnectionInfo(options);

    // Return to frontend
    res.json(connectionInfo);
  } catch (error) {
    console.error("Error getting Deepgram connection info:", error);
    res.status(500).json({
      error: "Failed to generate Deepgram connection info",
      message: error.message
    });
  }
});

// Health check interface
app.get("/api/health", (req, res) => {
  const healthStatus = {
    status: "ok",
    message: "Server is running",
    language: SPEECH_LANGUAGE,
    deepgramConfigured: !!process.env.DEEPGRAM_API_KEY,
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  };

  // Check if API key exists
  if (!process.env.BLT_API_KEY && !process.env.GEMINI_API_KEY) {
    healthStatus.status = "warning";
    healthStatus.message = "API key not set";
  }

  res.json(healthStatus);
});

app.use('/audio', express.static(path.join(__dirname, 'public/audio')));


// Global error handling
app.use((err, req, res, next) => {
  console.error("Uncaught error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production' ? "Please try again later" : err.message
  });
});


// Start server
app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Speech language: ${SPEECH_LANGUAGE}`);

  if (process.env.DEEPGRAM_API_KEY) {
    console.log("Deepgram API configuration loaded");
  } else {
    console.log("Warning: Deepgram API key not set (DEEPGRAM_API_KEY)");
  }

  const audioDir = path.join(__dirname, "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log("Created audio directory:", audioDir);
  }

  // 启动定期清理音频文件的任务
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时执行一次
  const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 保留24小时

  console.log("Starting periodic audio file cleanup job");

  setInterval(async () => {
    try {
      console.log("Running audio file cleanup...");

      const files = await fs.promises.readdir(audioDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        // 跳过当前正在使用的文件
        if (globalState.audioPath && globalState.audioPath.includes(file)) {
          continue;
        }

        const filePath = path.join(audioDir, file);
        const stats = await fs.promises.stat(filePath);

        // 删除超过指定时间的文件
        if (now - stats.mtime.getTime() > MAX_FILE_AGE) {
          await fs.promises.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleanup completed: Removed ${cleanedCount} expired audio files`);
      } else {
        console.log("Cleanup completed: No expired audio files found");
      }
    } catch (error) {
      console.error("Error during audio file cleanup:", error);
    }
  }, CLEANUP_INTERVAL);
});