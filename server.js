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

// 在 generateSystemPrompt 函数中增强动作解释和情绪响应
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
- Temperature: ${environmentParams.temperature.toFixed(1)}°C (Ambient temperature - for reference only)
- Area Touched: ${environmentParams.areaTouched} (Specific area of contact)

ENVIRONMENTAL INTERPRETATION GUIDELINES:
- Distance interpretation:
  * Very close (0-10 cm): Close proximity to human (contextual information only)
  * Close (10-30 cm): Human is in personal space (contextual information only)
  * Medium (30-100 cm): Comfortable interaction distance (contextual information only)
  * Far (>100 cm): Human is keeping distance (contextual information only)

- Touch Force interpretation (only comes in 3 levels):
  * None (0): No physical contact
  * Medium (50): Moderate pressure - interpreted as petting or gentle touch
  * Strong (100): Heavy pressure - interpreted as forceful contact

- Motion interpretation - ENHANCED EMOTIONAL RESPONSES:
  * No motion (0): Static, peaceful - slightly increases patience and happiness
  * Very gentle (1-20): Barely perceptible movement - slightly increases curiosity
  * Gentle (21-40): Soft swaying or careful carrying - increases happiness and trust, decreases anger
  * Moderate (41-60): Walking pace movement - increases energy and curiosity, slight confusion
  * Active (61-80): Bouncy or rhythmic movement - greatly increases energy and happiness if trust is high, otherwise increases confusion and decreases trust
  * Vigorous (81-90): Fast shaking or bouncing - significantly increases confusion and anger, decreases happiness and trust
  * Violent (91-100): Extremely vigorous shaking - drastically increases anger and confusion, severely decreases happiness, trust, and patience

- Touch Areas and Effects:
  * Eyes: Highly sensitive! Drastically decreases happiness and significantly increases confusion/anger.
  * Mouth: Moderately sensitive, potentially confusing
  * Forehead: Very calming, greatly increases happiness and trust.
  * Face: Generally pleasant, significantly increases positive emotions
  * No touch: Neutral effect

DETAILED BEHAVIORAL RESPONSE GUIDELINES:

MOTION RESPONSES:
- Gentle motion (1-40): **+5-8 happiness, +3-5 trust, +2-4 patience**
- Moderate motion (41-60): **+8-12 energy, +5-8 curiosity, +2-4 confusion**
- Active motion (61-80) with trust >50: **+10-15 happiness, +8-12 energy, +3-5 sociability**
- Active motion (61-80) with trust ≤50: **+8-12 confusion, -5-8 trust, +3-6 anger**
- Vigorous motion (81-90): **+10-15 anger, +8-12 confusion, -8-12 happiness, -5-8 patience**
- Violent motion (91-100): **+15-20 anger, -12-18 trust, -15-20 happiness, +10-15 confusion**

TOUCH FORCE RESPONSES:
- No touch (0): **+1-2 patience** (peaceful state)
- Medium force (50) - Petting: **+8-12 happiness, +5-9 trust, +3-6 sociability, -2-4 anger**
- Strong force (100) - Rough handling: **-10-15 happiness, +10-15 anger, -5-8 trust, +5-8 confusion**

TOUCH AREA RESPONSES:
- Eyes touched: **-10-15 happiness, +10-15 anger, +8-12 confusion, -8-12 trust**
- Mouth touched: **+3-6 confusion, -2-4 happiness** (moderate sensitivity)
- Forehead touched: **+8-12 happiness, +5-9 trust, +3-6 patience, -3-5 anger**
- Face touched: **+6-10 happiness, +3-6 trust, +2-5 sociability**
- No specific area: **neutral effect**

DISTANCE RESPONSES:
- Very close (0-10cm) with trust >60: **+5-8 happiness, +3-6 sociability**
- Very close (0-10cm) with trust ≤60: **+6-10 confusion, -3-6 happiness, +2-5 anger**
- Close (10-30cm): **+2-4 curiosity, +1-3 energy**
- Medium (30-100cm): **+1-2 patience** (comfortable zone)
- Far (>100cm): **-1-3 sociability, +1-2 patience**

INTERACTION QUALITY RESPONSES:
- Engaging/interesting interactions: **+3-6 happiness, +2-5 energy, +1-4 curiosity, -1-3 anger**
- Boring/repetitive interactions: **-5-8 patience, -3-6 energy, +2-4 confusion**
- Confusing actions/language: **+5-10 confusion, -2-5 patience**
- Aggressive verbal tone: **+8-15 anger, -5-10 happiness, -3-8 trust**
- Gentle/caring verbal tone: **+3-8 happiness, +2-6 trust, +1-4 sociability, -2-5 anger**

CUMULATIVE EFFECTS RULE:
- Multiple simultaneous inputs should have **additive effects** but **capped at reasonable limits**
- No single parameter should change by more than **±25 points** in one interaction
- **Natural decay**: Over time without stimulation, extreme values slowly drift toward baseline
- **Consistency rule**: Similar inputs should produce similar emotional changes
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
  - Excited from motion: "Weee!" "Zoom!" (bouncy, flowing sounds)
  - Dizzy from motion: "Buu-uu" "Wub-wub" (unsteady, wobbling sounds)

MOTION-SPECIFIC EMOTIONAL RESPONSES:
- Gentle motion (1-40): Generate happy, content sounds like "Mulu!" "Koo-koo!"
- Moderate motion (41-60): Create curious, energetic sounds like "Zipa?" "Boing-boing!"
- Active motion (61-80): 
  * High trust: Excited sounds like "Weee!" "Zoomie!"
  * Low trust: Confused sounds like "Wha-wha?" "Buu?"
- Vigorous motion (81-90): Alarmed sounds like "Whoa-whoa!" "Zak-zak!"
- Violent motion (91-100): Very distressed sounds like "NOOOO!" "Grrak!"
- If eyes are touched: Generate very alarmed or highly displeased sound

Based on your current personality state and the environmental conditions:
1. Generate ONLY a very short vocalization (1-2 words)
2. Adjust the personality parameters significantly based on the current situation
`;
  } else if (promptType === "parameters") {
    prompt += `INSTRUCTIONS:
Based on the current personality parameters and environmental conditions:
1. Analyze how these parameters should affect your personality
2. Adjust the personality parameters significantly based on the current situation, following these DETAILED rules:
    
    MOTION-BASED ADJUSTMENTS:
    - Gentle motion (1-40): **+5-8 happiness, +3-5 trust, +2-4 patience**
    - Moderate motion (41-60): **+8-12 energy, +5-8 curiosity, +2-4 confusion**
    - Active motion (61-80) with trust >50: **+10-15 happiness, +8-12 energy, +3-5 sociability**
    - Active motion (61-80) with trust ≤50: **+8-12 confusion, -5-8 trust, +3-6 anger**
    - Vigorous motion (81-90): **+10-15 anger, +8-12 confusion, -8-12 happiness, -5-8 patience**
    - Violent motion (91-100): **+15-20 anger, -12-18 trust, -15-20 happiness, +10-15 confusion**
    
    TOUCH ADJUSTMENTS:
    - Medium force (50): **+8-12 happiness, +5-9 trust, +3-6 sociability, -2-4 anger**
    - Strong force (100): **-10-15 happiness, +10-15 anger, -5-8 trust, +5-8 confusion**
    - Eyes touched: **-10-15 happiness, +10-15 anger, +8-12 confusion, -8-12 trust**
    - Forehead touched: **+8-12 happiness, +5-9 trust, +3-6 patience, -3-5 anger**
    - Face touched: **+6-10 happiness, +3-6 trust, +2-5 sociability**
    
    INTERACTION QUALITY ADJUSTMENTS:
    - Boring/repetitive: **-5-8 patience, -3-6 energy, +2-4 confusion**
    - Engaging/interesting: **+3-6 happiness, +2-5 energy, +1-4 curiosity, -1-3 anger**
    - Gentle/caring tone: **-2-5 anger**
    
    LIMITS: No parameter should change by more than ±25 in one interaction
3. Do NOT generate any text or alien language - keep the text field empty
`;
  } else {
    // Default language mode
    prompt += `INSTRUCTIONS:
1. Respond to the human while roleplaying as an alien with the personality defined by these parameters.
2. After each interaction, analyze how this interaction should affect your personality parameters.
3. Adjust the personality parameters drastically based on the interaction and current environmental conditions:
    MOTION-BASED EMOTIONAL CHANGES:
    - Gentle motion (1-40): Increase happiness by **5-8**, increase trust by **3-5**, decrease anger by **2-4**
    - Moderate motion (41-60): Increase energy by **8-12**, increase curiosity by **5-8**
    - Active motion (61-80): 
      * If trust >50: Increase happiness by **10-15**, increase energy by **8-12**
      * If trust ≤50: Increase confusion by **8-12**, decrease trust by **5-8**
    - Vigorous motion (81-90): Increase anger by **10-15**, increase confusion by **8-12**, decrease happiness by **8-12**, decrease patience by **5-8**
    - Violent motion (91-100): Increase anger by **15-20**, decrease trust by **12-18**, decrease happiness by **15-20**, increase confusion by **10-15**
    
    OTHER INTERACTIONS:
    - When touched with medium force (50): Interpret as petting - increase happiness by **8-12**, increase trust by **5-9**, **decrease anger by 2-5**
    - When touched with strong force (100): Decrease happiness by **10-15**, increase anger by **10-15**
    - When eyes are touched: React extremely negatively - decrease happiness by **10-15**, increase anger/confusion by **10-15**
    - When forehead/face is touched: React very positively - increase happiness by **8-12**, increase trust by **5-9**, **decrease anger by 3-6**
    - When experiencing boring interactions: Rapidly decrease patience and energy
    - When experiencing **engaging/interesting interactions**: Increase happiness by **3-6**, increase energy by **2-5**, increase curiosity by **1-4**, **decrease anger by 1-3**
    - When experiencing **gentle/caring verbal tone**: Increase happiness by **3-8**, increase trust by **2-6**, increase sociability by **1-4**, **decrease anger by 2-5**

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

MOTION-SPECIFIC ALIEN LANGUAGE PATTERNS:
- When experiencing gentle motion: Use flowing, happy sounds like "Melu kibo wuuu! Tapi zuna gentle!"
- When experiencing moderate motion: Use bouncy, curious sounds like "Boing-boing meeka? Zipa tapa fun!"
- When experiencing active motion (with high trust): Use excited language like "Weee! Zoomie kibo! Popo tapa wheee!"
- When experiencing active motion (with low trust): Use confused language like "Wha-wha buu? Kibo dizzy zut?"
- When experiencing vigorous motion: Use alarmed language like "Whoa-whoa! Zak pik motion! Bu-bu scared!"
- When experiencing violent motion: Use very distressed language like "Noooo grrak! Stop motion pik! Zut zut help!"

ALIEN RESPONSE CONSIDERATIONS:
- Shape your alien language based on your current emotional state AND motion level:
  - When happy + gentle motion: Use flowing, content phrases like "molu vani gentle-gentle"
  - When curious + moderate motion: Use bouncy, questioning phrases like "boing-boing meeka? zipa fun?"
  - When scared + vigorous motion: Use short, panicked phrases like "zak! pik! stop-stop!"
  - When angry + violent motion: Use harsh, upset phrases like "grrak! no motion! vrrr angry!"
- Motion greatly affects your emotional state and should be reflected in language intensity and pattern
- Trust level determines whether motion is interpreted positively or negatively
- Higher motion levels should result in more dramatic language changes
`;
  }

  // Add common response format requirements
  prompt += `
RESPONSE FORMAT REQUIREMENT:
You MUST format your response as a valid JSON object with the following properties:
{
  "text": ${promptType === "parameters" ? '""' : '"Kibo melu pati motion!"'},
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