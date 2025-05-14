// ai-service.js - Minimal version (modified for new response format)
const axios = require("axios");

/**
 * Minimal AI service class - minimizing response processing
 */
class AIService {
  /**
   * Create an AI service instance
   * @param {Object} config - Configuration object
   * @param {string} config.apiKey - API key
   * @param {string} [config.apiUrl="https://api.bltcy.ai"] - API base URL
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  /**
   * Send message to text API
   * @param {Array} messages - Array of messages, each with role and content
   * @param {string} [modelName="qwen-plus"] - Model name
   * @returns {Promise<Object>} - Returns object with text, alien, output and possible error
   */
  async sendMessage(messages, modelName) {
    try {
      // Ensure there's a system message
      let formattedMessages = [...messages];
      if (!formattedMessages.some((msg) => msg.role === "system")) {
        formattedMessages.unshift({
          role: "system",
          content: "You are a helpful assistant.",
        });
      }

      // Complete API URL
      const apiUrl = `${this.apiUrl}/v1/chat/completions`;

      console.log(`Sending request to ${apiUrl}`);
      console.log("Using model:", modelName);

      const response = await axios.post(
        apiUrl,
        {
          model: modelName,
          messages: formattedMessages,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
        }
      );

      console.log("Received response status:", response.status);

      if (response.data.choices && response.data.choices.length > 0) {
        const aiResponseText = response.data.choices[0].message.content;

        // Print raw response to console
        console.log("Raw AI response:", aiResponseText);

        // Try to parse JSON
        try {
          const parsedResponse = JSON.parse(aiResponseText);
          console.log("Successfully parsed JSON response");

          // Check and convert to the new format if needed
          if (parsedResponse.content && !parsedResponse.text) {
            // Convert from old format to new format
            return {
              text: parsedResponse.content,
              alien: parsedResponse.parameters || parsedResponse.alienParameters || {},
              output: parsedResponse.outputParams || {},
              success: true
            };
          } else if (parsedResponse.text && parsedResponse.alien && parsedResponse.output) {
            // Already in the new format
            return {
              ...parsedResponse,
              success: true
            };
          } else {
            // Some other format, try to adapt
            return {
              text: parsedResponse.text || parsedResponse.content || "Communication error",
              alien: parsedResponse.alien || parsedResponse.parameters || parsedResponse.alienParameters || {},
              output: parsedResponse.output || parsedResponse.outputParams || {},
              success: true
            };
          }
        } catch (e) {
          console.log("Response is not JSON, trying to extract from code block");

          // Try to extract JSON from code block
          const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
          const match = aiResponseText.match(codeBlockRegex);

          if (match && match[1]) {
            try {
              const parsedJson = JSON.parse(match[1].trim());
              console.log("Extracted JSON from code block");

              // Check and convert to the new format if needed
              if (parsedJson.content && !parsedJson.text) {
                return {
                  text: parsedJson.content,
                  alien: parsedJson.parameters || parsedJson.alienParameters || {},
                  output: parsedJson.outputParams || {},
                  success: true
                };
              } else if (parsedJson.text && parsedJson.alien && parsedJson.output) {
                return {
                  ...parsedJson,
                  success: true
                };
              } else {
                return {
                  text: parsedJson.text || parsedJson.content || "Communication error",
                  alien: parsedJson.alien || parsedJson.parameters || parsedJson.alienParameters || {},
                  output: parsedJson.output || parsedJson.outputParams || {},
                  success: true
                };
              }
            } catch (e2) {
              console.error("Content in code block is not valid JSON:", e2.message);
            }
          }

          // If unable to parse as JSON, return text content
          return {
            text: aiResponseText,
            alien: {},
            output: {},
            success: false,
            error: "Failed to parse AI response as JSON"
          };
        }
      } else {
        console.error("No valid options returned:", response.data);
        return {
          text: "",
          alien: {},
          output: {},
          success: false,
          error: response.data.error?.message || "API did not return valid content",
        };
      }
    } catch (error) {
      console.error("Text API error:", error.response?.data || error.message);
      return {
        text: "",
        alien: {},
        output: {},
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }
}

module.exports = AIService;