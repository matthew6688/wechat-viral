// Note: dotenv is loaded in index.ts before any imports

let _wechatConfig: { appId: string; secret: string } | null = null;
let _oaConfig: { appId: string; secret: string; token: string; encodingAESKey: string } | null = null;

function getWechatConfig() {
  if (!_wechatConfig) {
    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;
    
    if (!appId || !secret) {
      throw new Error('Missing WECHAT_APPID or WECHAT_SECRET environment variables');
    }
    
    _wechatConfig = { appId, secret };
  }
  return _wechatConfig;
}

function getOAConfig() {
  if (!_oaConfig) {
    const appId = process.env.OA_APPID;
    const secret = process.env.OA_SECRET;
    const token = process.env.OA_TOKEN || '';
    const encodingAESKey = process.env.OA_ENCODING_AES_KEY || '';
    
    if (!appId || !secret) {
      throw new Error('Missing OA_APPID or OA_SECRET environment variables');
    }
    
    _oaConfig = { appId, secret, token, encodingAESKey };
  }
  return _oaConfig;
}

export const wechatConfig = new Proxy({} as { appId: string; secret: string }, {
  get(target, prop) {
    const config = getWechatConfig();
    return config[prop as keyof typeof config];
  }
});

export const oaConfig = new Proxy({} as { appId: string; secret: string; token: string; encodingAESKey: string }, {
  get(target, prop) {
    const config = getOAConfig();
    return config[prop as keyof typeof config];
  }
});

// WeChat Mini Program API endpoints
export const WECHAT_API = {
  code2Session: 'https://api.weixin.qq.com/sns/jscode2session',
  getAccessToken: 'https://api.weixin.qq.com/cgi-bin/token',
  getUnlimitedQRCode: 'https://api.weixin.qq.com/wxa/getwxacodeunlimit',
};

// Official Account API endpoints
export const OA_API = {
  getAccessToken: 'https://api.weixin.qq.com/cgi-bin/token',
  createQRCode: 'https://api.weixin.qq.com/cgi-bin/qrcode/create',
  getQRCodeImage: 'https://mp.weixin.qq.com/cgi-bin/showqrcode',
  getUserInfo: 'https://api.weixin.qq.com/cgi-bin/user/info',
  sendMessage: 'https://api.weixin.qq.com/cgi-bin/message/custom/send',
};
