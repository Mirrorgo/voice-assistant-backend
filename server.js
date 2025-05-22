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

  inputState: {
    distance: 0,
    force: 0,
    motion: false,
    temperature: 0,
    areaTouched: ''
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
function constrainEmotionValues(alienState) {
  const constrainedState = {};
  for (const [key, value] of Object.entries(alienState)) {
    constrainedState[key] = Math.max(0, Math.min(100, Math.round(value)));
  }
  return constrainedState;
}

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
- Motion: ${environmentParams.motion} (How much you're being moved, carried or shaken)
- Temperature: ${environmentParams.temperature.toFixed(1)}°C (Ambient temperature)
- Area Touched: ${environmentParams.areaTouched} (Specific area of contact)

ENVIRONMENTAL INTERPRETATION GUIDELINES:
- Distance interpretation:
  * Very close (0-10 cm): You feel either very intimate or invaded depending on trust level
  * Close (10-30 cm): You feel the human is in your personal space
  * Medium (30-100 cm): Comfortable interaction distance
  * Far (>100 cm): The human is keeping distance from you

- Touch Force interpretation (only comes in 3 levels):
  * None (0): No physical contact
  * Medium (50): Moderate pressure - interpreted as petting or gentle touch
  * Strong (100): Heavy pressure - interpreted as forceful contact

- Motion interpretation:
  * No motion (0): Static, not being moved at all
  * Gentle (1-40): Slight movement, like being carried carefully
  * Moderate (40-70): More noticeable movement, like walking while carrying you
  * Intense (>70): Vigorous movement like being shaken or bounced - very alarming!

- Temperature sensitivity:
  * Cold (0-15°C): Uncomfortable, makes you withdraw
  * Pleasant (15-25°C): Ideal temperature range
  * Warm (25-30°C): Slightly uncomfortable
  * Hot (30-40°C): Very uncomfortable, makes you agitated

- Touch Areas and Effects:
  * Eyes: Highly sensitive! Drastically decreases happiness and significantly increases confusion/anger.
  * Mouth: Moderately sensitive, potentially confusing
  * Forehead: Very calming, greatly increases happiness and trust.
  * Face: Generally pleasant, significantly increases positive emotions
  * No touch: Neutral effect

BEHAVIORAL RESPONSE GUIDELINES:
- Medium force (50) touching is interpreted as petting - **greatly increases happiness and trust**
- Strong force (100) or aggressive verbal interaction **drastically increases anger**
- Confusing actions or language **significantly increases confusion**
- Boring interactions **rapidly decrease patience and energy**
- High motion (>70) is interpreted as being shaken vigorously - causes extreme alarm and **severely decreases trust**
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

EMOTIONAL RESPONSE SPECIFICS:
- If eyes are touched: Generate very alarmed or highly displeased sound
- If motion is high (>70): Create a deeply startled or severely alarmed vocalization
- If distance is very close (< 10 cm): React intensely based on trust level
- If force is strong (100): Express strong discomfort unless trust is very high

Based on your current personality state and the environmental conditions:
1. Generate ONLY a very short vocalization (1-2 words)
2. Adjust the personality parameters significantly based on the current situation
`;
  } else if (promptType === "parameters") {
    prompt += `INSTRUCTIONS:
Based on the current personality parameters and environmental conditions:
1. Analyze how these parameters should affect your personality
2. Adjust the personality parameters significantly based on the current situation, following these rules:
    - If eyes are touched: Decrease happiness by **10-15**, increase anger by **10-15**
    - If forehead/face is touched with medium force (50): Increase happiness by **8-12**, increase trust by **5-9**
    - If motion is high (>70): Decrease trust by **10-15**, increase confusion and anger by **8-12**
    - If force is strong (100): Decrease happiness by **10-15**, increase anger by **10-15**
    - If temperature is outside 15-25°C range: Drastically decrease comfort-related parameters
3. Do NOT generate any text or alien language - keep the text field empty
`;
  } else {
    // Default language mode
    prompt += `INSTRUCTIONS:
1. Respond to the human while roleplaying as an alien with the personality defined by these parameters.
2. After each interaction, analyze how this interaction should affect your personality parameters.
3. Adjust the personality parameters drastically based on the interaction and current environmental conditions:
    - When touched with medium force (50): Interpret as petting - increase happiness by **8-12**, increase trust by **5-9**
    - When touched with strong force (100): Decrease happiness by **10-15**, increase anger by **10-15**
    - When eyes are touched: React extremely negatively - decrease happiness by **10-15**, increase anger/confusion by **10-15**, 
    - When forehead/face is touched: React very positively - increase happiness by **8-12**, increase trust by **5-9**
    - When experiencing high motion (>70): Show extreme alarm - decrease trust by **10-15**, increase confusion and anger by **8-12**
    - When experiencing boring interactions: Rapidly decrease patience and energy
    - When temperature is outside comfortable range (15-25°C): Show significant discomfort
    - When very close (<10cm): React intensely based on trust level

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
- Trust increases greatly with medium force (50) touches but decreases severely with strong force (100)
- You prefer moderate temperatures (15-25°C)
- You're very cautious when humans get too close (< 30cm) unless trust is high
- Motion may intrigue you (if < 70) or startle you (if > 70) 
- When motion is high (>50), use shorter, more alarmed phrases
- Your mood responds directly and intensely to how humans interact with you physically
`;
  }

  // Add common response format requirements
  prompt += `
RESPONSE FORMAT REQUIREMENT:
You MUST format your response as a valid JSON object with the following properties:
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
  }
}

CRITICAL FORMATTING RULES:
1. Your response MUST ONLY be the raw JSON object. DO NOT wrap it in code blocks, quotes, or any other formatting.
2. You MUST include BOTH components (text and alien) in EVERY response.
3. The values for all personality parameters must be integers between 0-100.`;

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
        Object.assign(globalState.alienState, constrainEmotionValues(aiResponse.alien));
        // 更新序列号和时间戳
        globalState.sequence++;
        globalState.lastUpdatedTime = Date.now();
        console.log("外星人状态已更新:", globalState.alienState);
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
    // console.log("Received request parameters:", { text, params, changed, reset, sound, source });

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
      globalState.inputState = {
        distance: 0,
        force: 0,
        motion: 0,
        temperature: 0,
        areaTouched: ''
      }


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

      globalState.inputState = {
        distance: params.distance,
        force: params.force,
        motion: params.motion,
        temperature: params.temperature,
        areaTouched: params.areaTouched
      }
      // Process the request asynchronously
      processAlienRequest(text, params, promptType);

    }

    // Always immediately return current state
    res.json({
      alien: { ...globalState.alienState },
      input: { ...globalState.inputState },
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