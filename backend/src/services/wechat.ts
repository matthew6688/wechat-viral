import axios from 'axios';
import { wechatConfig, WECHAT_API } from '../config/wechat';

/**
 * Exchange WeChat code for session (openid, session_key)
 */
export async function code2Session(code: string): Promise<{ openid: string; session_key: string; unionid?: string }> {
  const { appId, secret } = wechatConfig;
  
  const response = await axios.get(WECHAT_API.code2Session, {
    params: {
      appid: appId,
      secret: secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  if (response.data.errcode) {
    console.error('WeChat API Error:', {
      errcode: response.data.errcode,
      errmsg: response.data.errmsg,
      fullResponse: response.data,
    });
    throw new Error(`WeChat API Error (${response.data.errcode}): ${response.data.errmsg}`);
  }

  if (!response.data.openid) {
    console.error('WeChat API Response missing openid:', response.data);
    throw new Error('WeChat API response missing openid');
  }

  return {
    openid: response.data.openid,
    session_key: response.data.session_key,
    unionid: response.data.unionid,
  };
}
