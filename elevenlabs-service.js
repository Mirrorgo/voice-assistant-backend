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
    // this.alienVoiceId = "tTdCI0IDTgFa2iLQiWu4"; // 这是示例ID，需要替换为实际可爱风格的voice ID
    this.alienVoiceId = "07ELl6XlU9grWbdaHhSA"; // 这是示例ID，需要替换为实际可爱风格的voice ID
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
  /**
  * 配置外星宠物语音特性的TTS选项，基于前端计算的主导情绪
  * @param {Object} alienState 外星宠物情绪状态
  * @returns {Object} 定制的TTS选项
  */
  getAlienVoiceOptions(alienState) {
    // 基础语音参数
    let stability = 0.5;        // 声音稳定性
    let similarity_boost = 0.5; // 相似度提升
    let style = 0.5;            // 风格强度
    let speed = 1.0;            // 语速调整

    // 计算每种情绪得分，与前端逻辑保持一致
    const happyScore =
      0.5 * alienState.happiness +
      0.3 * alienState.trust +
      0.2 * alienState.energy;

    const sadScore =
      0.5 * (100 - alienState.happiness) +
      0.3 * (100 - alienState.trust) +
      0.2 * (100 - alienState.energy);

    const curiousScore =
      0.5 * alienState.curiosity +
      0.3 * alienState.intelligence +
      0.2 * alienState.energy;

    const sleepyScore =
      0.7 * (100 - alienState.energy) +
      0.3 * alienState.patience;

    const confusedScore =
      0.6 * alienState.confusion +
      0.4 * (100 - alienState.intelligence);

    const madScore =
      0.3 * (100 - alienState.patience) +
      0.5 * alienState.anger +
      0.2 * (100 - alienState.trust);

    const scaredScore =
      0.3 * (100 - alienState.trust) +
      0.5 * (100 - alienState.sociability) +
      0.1 * (100 - alienState.energy) +
      0.1 * (100 - alienState.happiness);

    // 情绪得分及对应名称
    const emotions = [
      { name: "happy", score: happyScore },
      { name: "sad", score: sadScore },
      { name: "curious", score: curiousScore },
      { name: "sleepy", score: sleepyScore },
      { name: "confused", score: confusedScore },
      { name: "mad", score: madScore },
      { name: "scared", score: scaredScore }
    ];

    // 找出得分最高的情绪
    const dominantEmotion = emotions.reduce((prev, current) =>
      (prev.score > current.score) ? prev : current
    );

    // 次高分情绪（用于混合情绪状态）
    emotions.sort((a, b) => b.score - a.score);
    const secondaryEmotion = emotions[1];

    // 计算主导情绪的强度（与次高情绪的分差）
    const emotionIntensity = Math.min(1, (dominantEmotion.score - secondaryEmotion.score) / 30);

    // 记录主导情绪和强度
    console.log(`主导情绪: ${dominantEmotion.name}, 得分: ${dominantEmotion.score.toFixed(1)}, 强度: ${emotionIntensity.toFixed(2)}`);
    console.log(`次要情绪: ${secondaryEmotion.name}, 得分: ${secondaryEmotion.score.toFixed(1)}`);

    // 根据主导情绪设置语音参数
    switch (dominantEmotion.name) {
      case "happy":
        // 快乐：稳定、响亮、有活力的声音
        stability = 0.7 + (emotionIntensity * 0.2);      // 0.7-0.9，非常稳定
        similarity_boost = 0.6 + (emotionIntensity * 0.2); // 0.6-0.8，较高的相似度
        style = 0.7 + (emotionIntensity * 0.3);          // 0.7-1.0，高度风格化，活泼
        speed = 1.15 + (emotionIntensity * 0.2);         // 1.15-1.35，稍快的语速
        break;

      case "sad":
        // 悲伤：稳定但略低沉的声音，语速稍慢
        stability = 0.6 + (emotionIntensity * 0.2);      // 0.6-0.8，较稳定
        similarity_boost = 0.4 - (emotionIntensity * 0.2); // 0.4-0.2，相似度较低
        style = 0.4 - (emotionIntensity * 0.2);          // 0.4-0.2，风格弱化
        speed = 0.9 - (emotionIntensity * 0.15);         // 0.9-0.75，语速较慢
        break;

      case "curious":
        // 好奇：活跃、变化多的声音，语调上扬
        stability = 0.5 - (emotionIntensity * 0.1);      // 0.5-0.4，适中稳定性
        similarity_boost = 0.6 + (emotionIntensity * 0.2); // 0.6-0.8，较高相似度
        style = 0.8 + (emotionIntensity * 0.2);          // 0.8-1.0，高度风格化，探索性
        speed = 1.1 + (emotionIntensity * 0.15);         // 1.1-1.25，稍快语速
        break;

      case "sleepy":
        // 困倦：非常稳定、缓慢的声音
        stability = 0.8 + (emotionIntensity * 0.2);      // 0.8-1.0，极度稳定
        similarity_boost = 0.3;                          // 保持中低相似度
        style = 0.3 - (emotionIntensity * 0.15);         // 0.3-0.15，弱风格
        speed = 0.8 - (emotionIntensity * 0.2);          // 0.8-0.6，很慢的语速
        break;

      case "confused":
        // 困惑：不稳定、断断续续的声音，不规则节奏
        stability = 0.4 - (emotionIntensity * 0.2);      // 0.4-0.2，不稳定
        similarity_boost = 0.3 + (emotionIntensity * 0.1); // 0.3-0.4，中等相似度
        style = 0.6 + (emotionIntensity * 0.2);          // 0.6-0.8，较高风格，怪异感
        speed = 0.95 + (Math.random() * 0.2 - 0.1);      // 0.85-1.05，不规则语速
        break;

      case "mad":
        // 愤怒：极不稳定、高强度、速度可快可慢
        stability = 0.3 - (emotionIntensity * 0.2);      // 0.3-0.1，极不稳定
        similarity_boost = 0.7 + (emotionIntensity * 0.3); // 0.7-1.0，高相似度，保持独特性
        style = 0.8 + (emotionIntensity * 0.2);          // 0.8-1.0，极高风格，强烈情感

        // 愤怒时语速根据能量决定：高能量快速，低能量缓慢但重音强
        if (alienState.energy > 50) {
          speed = 1.2 + (emotionIntensity * 0.3);        // 1.2-1.5，急促语速
        } else {
          speed = 0.9 - (emotionIntensity * 0.1);        // 0.9-0.8，缓慢但重语速
        }
        break;

      case "scared":
        // 害怕：不稳定、颤抖的声音，语速快且急促
        stability = 0.3 - (emotionIntensity * 0.15);     // 0.3-0.15，不稳定
        similarity_boost = 0.5 - (emotionIntensity * 0.2); // 0.5-0.3，较低相似度
        style = 0.7 - (emotionIntensity * 0.2);          // 0.7-0.5，中等风格
        speed = 1.2 + (emotionIntensity * 0.3);          // 1.2-1.5，快速语速，急促感
        break;

      default:
        // 默认中性状态，适中参数
        break;
    }

    // 混合情绪影响（当主导情绪不是特别强烈时）
    if (emotionIntensity < 0.5) {
      // 如果主导情绪不明显，则次要情绪也会影响声音
      const blendFactor = 0.3 * (1 - emotionIntensity); // 混合强度

      switch (secondaryEmotion.name) {
        case "happy":
          stability += blendFactor * 0.1;
          style += blendFactor * 0.1;
          speed += blendFactor * 0.1;
          break;

        case "sad":
          speed -= blendFactor * 0.1;
          style -= blendFactor * 0.1;
          break;

        case "curious":
          style += blendFactor * 0.1;
          stability -= blendFactor * 0.05;
          break;

        case "sleepy":
          speed -= blendFactor * 0.15;
          break;

        case "confused":
          stability -= blendFactor * 0.1;
          break;

        case "mad":
          stability -= blendFactor * 0.1;
          style += blendFactor * 0.1;
          break;

        case "scared":
          speed += blendFactor * 0.1;
          stability -= blendFactor * 0.05;
          break;
      }
    }

    // 确保所有值在ElevenLabs的合法范围内
    stability = Math.max(0.1, Math.min(1, stability));
    similarity_boost = Math.max(0, Math.min(1, similarity_boost));
    style = Math.max(0, Math.min(1, style));

    // 语速约束，不同情绪有不同的语速范围
    let speedMin = 0.5;
    let speedMax = 2.0;

    // 为某些情绪调整语速极限
    if (dominantEmotion.name === "sleepy") {
      speedMin = 0.3;
      speedMax = 1.0;
    } else if (dominantEmotion.name === "mad" || dominantEmotion.name === "scared") {
      speedMin = 0.5;
      speedMax = 2.5;
    }

    speed = Math.max(speedMin, Math.min(speedMax, speed));

    // 返回定制的TTS选项
    return {
      model_id: "eleven_multilingual_v2",  // 多语言模型
      output_format: "mp3_44100_128",      // 高质量输出
      voice_settings: {
        stability,          // 声音稳定性
        similarity_boost,   // 相似度提升
        style,              // 风格强度
      },
      // 添加语速参数
      speed
    };
  }
}

module.exports = ElevenLabsService;