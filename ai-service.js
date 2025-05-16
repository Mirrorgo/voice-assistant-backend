const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");

/**
 * Optimized AI service class supporting multiple AI providers
 */
class AIService {
  constructor() {
    this.bltApiKey = process.env.BLT_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;

    // Initialize Google GenAI SDK if API key exists
    if (this.geminiApiKey) {
      this.googleAI = new GoogleGenAI({ apiKey: this.geminiApiKey });
      console.log("Google GenAI SDK initialized");
    }
  }

  async sendMessage(messages) {
    const provider = "gemini";
    // const provider = "blt";

    console.log(`Sending request to ${provider}`);
    console.log("Request messages:", messages);

    try {
      let response;
      if (provider === "gemini") {
        response = await this.sendGeminiRequest(messages);
      } else if (provider === "blt") {
        response = await this.sendBltRequest(messages);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      // 根据不同提供商处理响应
      return provider === "gemini"
        ? this.processGeminiResponse(response)
        : this.processBltResponse(response);
    } catch (error) {
      console.error(`${provider} API error:`, error.response?.data || error.message);
      return {
        text: "",
        alien: {},
        output: {},
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  async sendGeminiRequest(messages) {
    const model = "gemini-2.0-flash";
    if (!this.googleAI) {
      throw new Error("Google GenAI SDK not initialized. Check GEMINI_API_KEY.");
    }

    return await this.googleAI.models.generateContent({
      model: model,
      contents: messages.userText,
      config: {
        systemInstruction: messages.systemPrompt
      }
    });
  }

  async sendBltRequest(messages) {
    const model = "gemini-2.0-flash";
    if (!this.bltApiKey) {
      throw new Error("BLT API Key not found. Check BLT_API_KEY environment variable.");
    }

    const apiUrl = `https://api.bltcy.ai/v1/chat/completions`;
    return axios.post(
      apiUrl,
      {
        model: model,
        messages: [
          { role: "system", content: messages.systemPrompt },
          { role: "user", content: messages.userText },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.bltApiKey}`,
        },
      }
    );
  }

  // Modified Gemini response processing function
  processGeminiResponse(response) {
    console.log("Processing Gemini response");
    // Check response structure
    if (!response || !response.candidates || !response.candidates[0] || !response.candidates[0].content) {
      throw new Error("Invalid Gemini response format");
    }

    // Get response content part
    const content = response.candidates[0].content;
    const parts = content.parts || [];

    // Log raw response for debugging
    console.log("Gemini raw response:", JSON.stringify(parts).substring(0, 200) + "...");

    // Extract text content from response
    const textContent = parts.map(part => part.text || "").join("");

    // Try to extract JSON from text (possibly in code blocks)
    try {
      // Extract JSON code block
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = textContent.match(codeBlockRegex);

      if (match && match[1]) {
        const jsonContent = match[1].trim();
        const parsedJson = JSON.parse(jsonContent);

        console.log("Successfully extracted JSON from Gemini response");

        // Ensure response format is consistent
        return {
          text: parsedJson.text || "",
          alien: parsedJson.alien || {},
          output: {
            rgbRed: parsedJson.output?.rgbRed || 100,
            rgbGreen: parsedJson.output?.rgbGreen || 100,
            rgbBlue: parsedJson.output?.rgbBlue || 200
          },
          success: true
        };
      } else {
        // If no JSON code block found, try parsing entire response
        const parsedJson = JSON.parse(textContent);
        return {
          text: parsedJson.text || "",
          alien: parsedJson.alien || {},
          output: {
            rgbRed: parsedJson.output?.rgbRed || 100,
            rgbGreen: parsedJson.output?.rgbGreen || 100,
            rgbBlue: parsedJson.output?.rgbBlue || 200
          },
          success: true
        };
      }
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON:", e.message);
      // If parsing fails, return original text
      return {
        text: textContent || "Failed to parse Gemini response",
        alien: {},
        output: {
          rgbRed: 100,
          rgbGreen: 100,
          rgbBlue: 200
        },
        success: false,
        error: "Failed to parse JSON response"
      };
    }
  }

  // Similarly for BLT response processing
  processBltResponse(response) {
    console.log("Processing BLT response");
    console.log("Received response status:", response.status || "N/A");

    // Validate response data
    if (!response.data || !response.data.choices || !response.data.choices.length) {
      throw new Error("Invalid BLT API response format");
    }

    const aiResponseText = response.data.choices[0].message.content;
    console.log("BLT raw response:", aiResponseText?.substring(0, 100) + "...");

    // Try parsing JSON response
    try {
      const parsedResponse = JSON.parse(aiResponseText);
      console.log("Successfully parsed BLT JSON response");

      // Check and return expected format
      return {
        text: parsedResponse.text || "",
        alien: parsedResponse.alien || {},
        output: {
          rgbRed: parsedResponse.output?.rgbRed || 100,
          rgbGreen: parsedResponse.output?.rgbGreen || 100,
          rgbBlue: parsedResponse.output?.rgbBlue || 200
        },
        success: true
      };
    } catch (e) {
      console.log("BLT response is not valid JSON, trying to extract from code block");

      // Try extracting JSON from code block
      const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = aiResponseText.match(codeBlockRegex);

      if (match && match[1]) {
        try {
          const parsedJson = JSON.parse(match[1].trim());
          console.log("Extracted JSON from BLT code block");

          return {
            text: parsedJson.text || "",
            alien: parsedJson.alien || {},
            output: {
              rgbRed: parsedJson.output?.rgbRed || 100,
              rgbGreen: parsedJson.output?.rgbGreen || 100,
              rgbBlue: parsedJson.output?.rgbBlue || 200
            },
            success: true
          };
        } catch (e2) {
          console.error("Content in BLT code block is not valid JSON:", e2.message);
        }
      }

      // If cannot parse as JSON, return text content
      return {
        text: aiResponseText || "Failed to parse response",
        alien: {},
        output: {
          rgbRed: 100,
          rgbGreen: 100,
          rgbBlue: 200
        },
        success: true
      };
    }
  }
}

module.exports = AIService;