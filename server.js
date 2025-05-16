// server.js - Modified with polling support
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Import AI service and Deepgram service
const AIService = require("./ai-service");
const DeepgramService = require("./deepgram-service");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const SPEECH_LANGUAGE = "en-US"; // Default language is English

// Create service instances
const aiService = new AIService();
const deepgramService = new DeepgramService();

// Global alien state - maintained after server start
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
  rgbRed: 100,
  rgbGreen: 100,
  rgbBlue: 200
};

// Store the latest text response
let latestTextResponse = "";

// Pending API request flag and sequence counter
let isPendingRequest = false;
let sequenceNumber = 1;
let lastUpdatedTime = Date.now();

// State management functions
function getAlienState() {
  return { ...globalAlienState }; // Return a copy to avoid direct modification
}

function getOutputState() {
  return { ...globalOutput }; // Return a copy to avoid direct modification
}

function getLatestTextResponse() {
  return latestTextResponse;
}

function updateAlienState(newState) {
  Object.assign(globalAlienState, newState);
  lastUpdatedTime = Date.now();
  sequenceNumber++;
  console.log("Alien state updated:", globalAlienState);
}

function updateOutputState(newOutput) {
  Object.assign(globalOutput, newOutput);
  lastUpdatedTime = Date.now();
  sequenceNumber++;
  console.log("Alien output state updated:", globalOutput);
}

function updateTextResponse(newText) {
  if (newText && newText.trim() !== "") {
    latestTextResponse = newText;
    lastUpdatedTime = Date.now();
    sequenceNumber++;
    console.log("New alien text response:", latestTextResponse);
  }
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
- Trust increases with gentle touches but decreases with forceful ones
- You prefer moderate temperatures (15-25°C)
- You're cautious when humans get too close (< 30cm) unless trust is high
- Movement may intrigue or startle you depending on your current state
- Your colors shift toward:
  - Blue tones when calm or sad
  - Green tones when curious or content
  - Red tones when alarmed or excited
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
    "intelligence": 95
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

  // Get current alien state
  const alienParams = getAlienState();

  // Generate appropriate system prompt based on promptType
  const systemPrompt = generateSystemPrompt(alienParams, environmentParams, promptType);
  console.log("System prompt length:", systemPrompt?.length || 0);

  // Build messages object for AI service
  const messages = {
    systemPrompt,
    userText: userText || ""
  };

  try {
    // Record request start time
    const startTime = Date.now();

    // Send request to AI service
    const aiResponse = await aiService.sendMessage(messages);

    // Record request end time and duration
    const endTime = Date.now();
    console.log(`Model response time: ${endTime - startTime}ms`);
    console.log("AI model response received");

    // Process response if successful
    if (aiResponse.success) {
      // Ensure we have a correctly formatted response or use defaults
      const result = aiResponse.alien ? aiResponse : {
        alien: alienParams, // Maintain current state if missing
        output: aiResponse.output || {
          rgbRed: 100,
          rgbGreen: 100,
          rgbBlue: 200
        },
        text: aiResponse.text || aiResponse.content ||
          (promptType === "vocalization" ? "Kiki?" :
            promptType === "parameters" ? "" : "Melu kibo?")
      };

      // Update server-side states
      if (result.alien) updateAlienState(result.alien);
      if (result.output) updateOutputState(result.output);

      // Only update text for non-parameter requests
      if (result.text && promptType !== "parameters") {
        updateTextResponse(result.text);
      }

      return result;
    }

    // Return the original response if not successful
    return aiResponse;
  } catch (error) {
    console.error("AI processing error:", error);
    throw error;
  }
}

// Process alien API requests asynchronously without blocking response
function processAlienRequest(text, params, promptType) {
  if (isPendingRequest) return false;

  isPendingRequest = true;

  // Use async IIFE to handle the AI request
  (async () => {
    try {
      await sendToAI(text, params, promptType);
    } catch (error) {
      console.error(`Error processing ${promptType} request:`, error);
    } finally {
      isPendingRequest = false;
    }
  })();

  return true;
}

// Unified alien API endpoint - handles all alien-related requests
app.post("/api/alien", async (req, res) => {
  try {
    // Extract parameters from request
    const { text, params, changed, reset, sound } = req.body;
    console.log("Received request parameters:", { text, params, changed, reset, sound });

    // Handle reset request
    if (reset) {
      // Reset alien state to defaults
      globalAlienState.happiness = 50;
      globalAlienState.energy = 70;
      globalAlienState.curiosity = 90;
      globalAlienState.trust = 30;
      globalAlienState.sociability = 60;
      globalAlienState.patience = 40;
      globalAlienState.confusion = 80;
      globalAlienState.intelligence = 95;

      // Reset output state
      globalOutput.rgbRed = 100;
      globalOutput.rgbGreen = 100;
      globalOutput.rgbBlue = 200;

      // Reset text response
      latestTextResponse = "Kibo melu pati? Tapi zuna reboot!";

      // Update sequence and timestamp
      sequenceNumber++;
      lastUpdatedTime = Date.now();

      return res.json({
        message: "Alien state reset",
        success: true,
        alien: getAlienState(),
        output: getOutputState(),
        text: latestTextResponse,
        sequence: sequenceNumber,
        timestamp: lastUpdatedTime
      });
    }

    // Process change request if needed
    if (changed && !isPendingRequest) {
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
      alien: getAlienState(),
      output: getOutputState(),
      text: getLatestTextResponse(),
      success: true,
      sequence: sequenceNumber,
      timestamp: lastUpdatedTime,
      isPending: isPendingRequest
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

  // Check if uploads directory exists
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("Created uploads directory:", uploadDir);
  }
});