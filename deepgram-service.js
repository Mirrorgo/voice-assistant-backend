// deepgram-service.js
require('dotenv').config();
const crypto = require('crypto');

/**
 * Deepgram服务类 - 处理与Deepgram API的通信，专注于生成前端可直接使用的签名URL
 */
class DeepgramService {
	constructor() {
		// 从环境变量中获取Deepgram API密钥
		this.apiKey = process.env.DEEPGRAM_API_KEY;

		// 如果未配置API密钥，记录警告
		if (!this.apiKey) {
			console.warn('警告: 未设置Deepgram API密钥 (DEEPGRAM_API_KEY)');
		}

		// Deepgram API基本URL
		this.baseUrl = 'wss://api.deepgram.com/v1/listen';

		// 默认选项
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
	}

	/**
	 * 生成前端可直接使用的Deepgram WebSocket URL，包括身份验证信息
	 * @param {Object} [options={}] 覆盖默认选项的参数
	 * @returns {string} 完整的WebSocket URL，附带身份验证信息
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
			// 前端将需要在WebSocket实例化时提供该协议
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
}

module.exports = DeepgramService;
