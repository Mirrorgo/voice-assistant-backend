// elevenlabs-service.js 修改版
require('dotenv').config();
const { ElevenLabsClient } = require("elevenlabs");
const fs = require('fs').promises;
const path = require('path');

/**
 * ElevenLabs服务类 - 处理与ElevenLabs API的通信
 */
class ElevenLabsService {
  constructor() {
    // 从环境变量中获取ElevenLabs API密钥
    this.apiKey = process.env.ELEVENLABS_API_KEY;

    // 如果未配置API密钥，记录警告
    if (!this.apiKey) {
      console.warn('警告: 未设置ElevenLabs API密钥 (ELEVENLABS_API_KEY)');
    }

    // 初始化ElevenLabs客户端
    this.client = new ElevenLabsClient({
      apiKey: this.apiKey
    });

    // 默认TTS选项
    this.defaultTtsOptions = {
      model_id: "eleven_multilingual_v2",  // 多语言模型，兼容性更好
      output_format: "mp3_44100_128",  // 高质量MP3格式
      voice_settings: {
        stability: 0.5,  // 声音稳定性
        similarity_boost: 0.75,  // 相似度提升
        style: 0.5  // 风格强度
      }
    };

    // 默认使用的声音ID (可以替换为适合外星宠物的声音ID)
    this.alienVoiceId = "tTdCI0IDTgFa2iLQiWu4"; // 这是示例ID，需要替换为实际可爱风格的voice ID
  }

  /**
   * 将ReadableStream转换为Buffer
   * @param {ReadableStream} stream 可读流
   * @returns {Promise<Buffer>} 包含数据的Buffer
   */
  async streamToBuffer(stream) {
    const reader = stream.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  }

  /**
   * 使用ElevenLabs API将文本转换为语音
   * @param {string} text 要转换为语音的文本
   * @param {Object} [options={}] TTS选项，覆盖默认值
   * @returns {Promise<Buffer>} 包含音频数据的Buffer
   */
  async textToSpeech(text, options = {}) {
    try {
      // 确保客户端已初始化
      if (!this.client) {
        throw new Error('ElevenLabs客户端未初始化，请检查API密钥');
      }

      // 合并默认选项和自定义选项
      const mergedOptions = {
        ...this.defaultTtsOptions,
        ...options,
        text
      };

      console.log(`开始将文本转换为语音，长度: ${text.length} 字符`);
      console.log('使用TTS选项:', {
        model_id: mergedOptions.model_id,
        output_format: mergedOptions.output_format,
        voice_settings: mergedOptions.voice_settings
      });

      // 获取要使用的声音ID
      const voiceId = options.voiceId || this.alienVoiceId;

      // 使用ElevenLabs API发送请求
      const audioStream = await this.client.textToSpeech.convert(voiceId, mergedOptions);

      // 将ReadableStream转换为Buffer
      const audioBuffer = await this.streamToBuffer(audioStream);

      console.log(`语音生成成功，获取到${audioBuffer.length}字节音频数据`);

      return audioBuffer;
    } catch (error) {
      console.error('ElevenLabs TTS处理错误:', error);
      throw new Error(`生成语音失败: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * 生成语音并直接保存到文件
   * @param {string} text 要转换为语音的文本
   * @param {string} filePath 文件保存路径
   * @param {Object} [options={}] TTS选项
   * @returns {Promise<string>} 保存的文件路径
   */
  async textToSpeechFile(text, filePath, options = {}) {
    try {
      // 获取音频数据
      const audioBuffer = await this.textToSpeech(text, options);

      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // 写入文件
      await fs.writeFile(filePath, audioBuffer);
      console.log(`音频已保存到: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('保存音频文件失败:', error);
      throw error;
    }
  }

  /**
   * 配置外星人语音特性的TTS选项
   * @param {Object} alienState 外星人情绪状态
   * @returns {Object} 定制的TTS选项
   */
  getAlienVoiceOptions(alienState) {
    // 基于外星人情绪状态调整声音设置
    let stability = 0.5;
    let similarity_boost = 0.75;
    let style = 0.5;

    // 高兴度影响声音风格 - 越高兴声音风格越明显
    if (alienState.happiness > 70) {
      style += 0.3;  // 很高兴 → 更夸张的声音风格
    } else if (alienState.happiness < 30) {
      style -= 0.2;  // 不高兴 → 较少的声音风格表现
    }

    // 能量影响声音相似度 - 越有能量相似度越高
    if (alienState.energy > 70) {
      similarity_boost += 0.2;  // 精力充沛 → 声音更加特征化
    } else if (alienState.energy < 30) {
      similarity_boost -= 0.2;  // 能量低 → 声音更标准
    }

    // 信任影响稳定性 - 信任度高时声音更稳定
    if (alienState.trust > 70) {
      stability += 0.2;  // 信任度高 → 声音稳定
    } else if (alienState.trust < 30) {
      stability -= 0.2;  // 信任度低 → 声音变化更大
    }

    // 确保值在有效范围内(ElevenLabs的参数范围是0-1)
    stability = Math.max(0, Math.min(1, stability));
    similarity_boost = Math.max(0, Math.min(1, similarity_boost));
    style = Math.max(0, Math.min(1, style));

    // 返回定制选项
    return {
      model_id: "eleven_multilingual_v2",  // 使用多语言模型
      output_format: "mp3_44100_128",      // 高质量输出
      voice_settings: {
        stability,           // 定制稳定性
        similarity_boost,    // 定制相似度
        style                // 定制风格强度
      }
    };
  }
}

module.exports = ElevenLabsService;