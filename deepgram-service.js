// deepgram-service.js
require('dotenv').config();
const { createClient } = require("@deepgram/sdk");
const fs = require('fs').promises;
const path = require('path');

/**
 * Deepgram服务类 - 处理与Deepgram API的通信
 */
class DeepgramService {
	constructor() {
		// 从环境变量中获取Deepgram API密钥
		this.apiKey = process.env.DEEPGRAM_API_KEY;

		// 如果未配置API密钥，记录警告
		if (!this.apiKey) {
			console.warn('警告: 未设置Deepgram API密钥 (DEEPGRAM_API_KEY)');
		} else {
			// 初始化Deepgram客户端
			this.deepgram = createClient(this.apiKey);
		}

		// Deepgram API基本URL(用于STT WebSocket)
		this.baseUrl = 'wss://api.deepgram.com/v1/listen';

		// 默认STT选项
		this.defaultOptions = {
			encoding: 'linear16',     // 16位PCM编码
			sample_rate: 16000,       // 16kHz采样率
			channels: 1,              // 单声道
			language: 'en-US',        // 默认为英语(美国)
			model: 'nova-3',          // 使用Nova-3模型
			smart_format: true,       // 启用智能格式化
			punctuate: true,          // 添加标点符号
			interim_results: true,    // 启用中间结果
			endpointing: 300          // 设置语音结束检测毫秒数
		};

		// 默认TTS选项，修正为支持的值
		this.defaultTtsOptions = {
			model: 'aura-2-draco-en', // Deepgram的文本转语音模型
			voice: 'nova',            // 声音风格
			encoding: 'linear16',     // 输出音频编码格式
			container: 'wav',         // 支持的容器格式：wav, ogg, none
			sample_rate: 24000,       // 采样率
			pitch: 1.0,               // 音调调整因子 (0.5 - 2.0)
			speed: 0.6                // 语速调整因子 (0.5 - 2.0)
		};
	}

	/**
	 * 生成前端可直接使用的Deepgram WebSocket URL，包括身份验证信息
	 * @param {Object} [options={}] 覆盖默认选项的参数
	 * @returns {Object} 包含URL和认证信息的对象
	 */
	generateClientWebSocketUrl(options = {}) {
		try {
			// 确保API密钥存在
			if (!this.apiKey) {
				throw new Error('未配置Deepgram API密钥');
			}

			// 合并默认选项和自定义选项
			const mergedOptions = { ...this.defaultOptions, ...options };

			// 构建URL参数字符串
			const queryParams = Object.entries(mergedOptions)
				.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
				.join('&');

			// 创建完整URL，使用Sec-WebSocket-Protocol认证方式
			return {
				url: `${this.baseUrl}?${queryParams}`,
				protocol: ['token', this.apiKey]
			};
		} catch (error) {
			console.error('生成Deepgram客户端URL错误:', error);
			throw error;
		}
	}

	/**
	 * 为前端生成使用直接连接模式所需的所有信息
	 * @param {Object} [options={}] 覆盖默认选项的参数
	 * @returns {Object} 包含URL和认证信息的对象
	 */
	generateConnectionInfo(options = {}) {
		try {
			const { url, protocol } = this.generateClientWebSocketUrl(options);

			return {
				url,                     // WebSocket连接URL
				protocol,                // 认证协议数组
				options: {               // 返回所用选项供参考
					...this.defaultOptions,
					...options
				}
			};
		} catch (error) {
			console.error('生成Deepgram连接信息错误:', error);
			throw error;
		}
	}

	/**
	 * 使用Deepgram SDK将文本转换为语音
	 * @param {string} text 要转换为语音的文本
	 * @param {Object} [options={}] TTS选项，覆盖默认值
	 * @returns {Promise<Buffer>} 包含音频数据的Buffer
	 */
	async textToSpeech(text, options = {}) {
		try {
			// 确保客户端已初始化
			if (!this.deepgram) {
				throw new Error('Deepgram客户端未初始化，请检查API密钥');
			}

			// 合并默认选项和自定义选项
			const mergedOptions = { ...this.defaultTtsOptions, ...options };

			// 确保container选项是有效值
			if (!['wav', 'ogg', 'none'].includes(mergedOptions.container)) {
				console.warn(`不支持的容器格式: ${mergedOptions.container}，已自动更改为 'wav'`);
				mergedOptions.container = 'wav';
			}

			console.log(`开始将文本转换为语音，长度: ${text.length} 字符`);
			console.log('使用TTS选项:', mergedOptions);

			// 使用Deepgram SDK发送请求
			const response = await this.deepgram.speak.request(
				{ text },
				mergedOptions
			);

			// 获取音频流
			const stream = await response.getStream();
			if (!stream) {
				throw new Error('未能获取音频流');
			}

			// 转换流为音频缓冲区
			const buffer = await this.getAudioBuffer(stream);
			console.log(`语音生成成功，获取到${buffer.length}字节的音频数据`);

			return buffer;
		} catch (error) {
			console.error('Deepgram TTS处理错误:', error);
			throw new Error(`生成语音失败: ${error.message || JSON.stringify(error)}`);
		}
	}

	/**
	 * 将流转换为音频缓冲区
	 * @param {ReadableStream} stream 可读流
	 * @returns {Promise<Buffer>} 包含音频数据的Buffer
	 */
	async getAudioBuffer(stream) {
		const reader = stream.getReader();
		const chunks = [];

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}

		// 合并所有块
		const dataArray = chunks.reduce(
			(acc, chunk) => Uint8Array.from([...acc, ...chunk]),
			new Uint8Array(0)
		);

		return Buffer.from(dataArray.buffer);
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
		// 基于外星人情绪状态调整音调和语速
		let pitch = 1.0;
		let speed = 0.6;

		// 高兴度影响音调 - 越高兴音调越高
		if (alienState.happiness > 70) {
			pitch += 0.03;  // 很高兴 → 音调升高
		} else if (alienState.happiness < 30) {
			pitch -= 0.02;  // 不高兴 → 音调降低
		}

		// 能量影响语速 - 越有能量语速越快
		if (alienState.energy > 70) {
			speed += 0.01;  // 精力充沛 → 语速加快
		} else if (alienState.energy < 30) {
			speed -= 0.02;  // 能量低 → 语速减慢
		}

		// 确保值在有效范围内
		pitch = Math.max(0.5, Math.min(0.77, pitch));
		speed = Math.max(0.5, Math.min(0.77, speed));

		// 返回定制选项，使用支持的格式
		return {
			model: 'aura-2-draco-en',  // 使用英语模型
			voice: 'nova',             // 使用Nova声音
			container: 'wav',          // 使用WAV格式
			pitch,                     // 定制音调
			speed                      // 定制语速
		};
	}
}

module.exports = DeepgramService;