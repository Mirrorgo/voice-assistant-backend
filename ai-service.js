// ai-service.js - 极简版（保持不变）
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

/**
 * 极简版 AI 服务类 - 最小化处理响应
 */
class AIService {
  /**
   * 创建一个 AI 服务实例
   * @param {Object} config - 配置对象
   * @param {string} config.apiKey - API 密钥
   * @param {string} [config.apiUrl="https://api.bltcy.ai"] - API 基础 URL
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  /**
   * 发送消息到文本 API
   * @param {Array} messages - 消息数组，每个消息包含 role 和 content
   * @param {string} [modelName="qwen-plus"] - 模型名称
   * @returns {Promise<Object>} - 返回包含 content, success 和可能的 error 的对象
   */
  async sendMessage(messages, modelName) {
    try {
      // 确保有系统消息
      let formattedMessages = [...messages];
      if (!formattedMessages.some((msg) => msg.role === "system")) {
        formattedMessages.unshift({
          role: "system",
          content: "You are a helpful assistant.",
        });
      }

      // 完整的 API URL
      const apiUrl = `${this.apiUrl}/v1/chat/completions`;

      console.log(`发送请求到 ${apiUrl}`);
      console.log("使用模型:", modelName);

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

      console.log("收到响应状态:", response.status);

      if (response.data.choices && response.data.choices.length > 0) {
        const aiResponseText = response.data.choices[0].message.content;

        // 在控制台打印原始响应
        console.log("原始AI响应:", aiResponseText);

        // 尝试解析JSON
        try {
          const parsedResponse = JSON.parse(aiResponseText);
          console.log("成功解析JSON响应");

          // 直接返回解析后的对象，保留所有原始字段
          return {
            ...parsedResponse,
            success: true
          };
        } catch (e) {
          console.log("响应不是JSON格式，尝试从代码块中提取");

          // 尝试从代码块中提取JSON
          const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
          const match = aiResponseText.match(codeBlockRegex);

          if (match && match[1]) {
            try {
              const parsedJson = JSON.parse(match[1].trim());
              console.log("从代码块中提取到JSON");
              return {
                ...parsedJson,
                success: true
              };
            } catch (e2) {
              console.error("代码块中的内容不是有效JSON:", e2.message);
            }
          }

          // 如果无法解析为JSON，直接返回文本内容
          return {
            content: aiResponseText,
            success: true
          };
        }
      } else {
        console.error("没有返回有效的选项:", response.data);
        return {
          content: "",
          success: false,
          error: response.data.error?.message || "API 未返回有效内容",
        };
      }
    } catch (error) {
      console.error("文本 API 错误:", error.response?.data || error.message);
      return {
        content: "",
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * 将音频转录为文本
   * @param {string} filePath - 音频文件路径
   * @param {Object} [options={}] - 转录选项
   * @returns {Promise<string>} - 转录的文本
   */
  async transcribeAudio(audioFilePath, options = {}) {
    try {
      const fileStream = fs.createReadStream(audioFilePath);
      const form = new FormData();

      // Add the file
      form.append('file', fileStream);

      // Add all options as separate form fields
      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null) {
          form.append(key, String(value));
        }
      }

      // Use the question mark in the URL as shown in the standard example
      const response = await axios({
        method: 'post',
        url: `${this.apiUrl}/v1/audio/transcriptions?`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...form.getHeaders() // Explicitly spread the FormData headers
        },
        data: form,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      if (response.data && response.data.text) {
        return response.data.text;
      } else {
        console.log("Unexpected response format:", response.data);
        throw new Error("语音转录失败: 未找到转录文本");
      }
    } catch (error) {
      console.error("错误响应状态:", error.response?.status);
      console.error("错误响应数据:", error.response?.data);

      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new Error(`语音转录失败: ${errorMessage}`);
    }
  }
}

module.exports = AIService;