// xfyun-service.js - 讯飞语音听写服务
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

/**
 * 讯飞API集成服务
 */
class XfyunService {
  constructor() {
    // 讯飞API相关配置
    this.apiKey = process.env.XFYUN_API_KEY;
    this.apiSecret = process.env.XFYUN_API_SECRET;
    this.appId = process.env.XFYUN_APP_ID;
    this.hostUrl = 'wss://iat-api.xfyun.cn/v2/iat'; // 讯飞语音听写WebSocket API地址
  }

  /**
   * 生成讯飞API使用的鉴权URL
   * @returns {string} 带鉴权参数的WebSocket URL
   */
  generateSignedUrl() {
    if (!this.apiKey || !this.apiSecret || !this.appId) {
      throw new Error('讯飞API配置不完整，请检查环境变量设置');
    }

    // RFC1123格式的时间戳
    const date = new Date().toUTCString();

    // 解析主机名
    const urlObj = new URL(this.hostUrl);
    const host = urlObj.host;
    const path = urlObj.pathname;

    // 构建签名原始字段
    const signatureOrigin = [
      `host: ${host}`,
      `date: ${date}`,
      `GET ${path} HTTP/1.1`
    ].join('\n');

    // 使用HMAC-SHA256计算签名
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(signatureOrigin);
    const signatureSha = hmac.digest();
    const signature = signatureSha.toString('base64');

    // 构建鉴权参数
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    // 构建最终URL
    const queryParams = new URLSearchParams({
      host,
      date,
      authorization
    });

    return `${this.hostUrl}?${queryParams.toString()}`;
  }
}

module.exports = XfyunService;