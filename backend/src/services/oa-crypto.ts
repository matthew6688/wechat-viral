import WXBizMsgCrypt from 'wechat-crypto';
import { oaConfig } from '../config/wechat';

let msgCrypt: WXBizMsgCrypt | null = null;

/**
 * Get or create WXBizMsgCrypt instance
 */
function getMsgCrypt(): WXBizMsgCrypt {
  if (!msgCrypt) {
    const { appId, token, encodingAESKey } = oaConfig;
    msgCrypt = new WXBizMsgCrypt(token, encodingAESKey, appId);
  }
  return msgCrypt;
}

/**
 * Decrypt message (for security mode)
 */
export function decryptMessage(encryptedMsg: string, msgSignature: string, timestamp: string, nonce: string): string {
  try {
    const crypt = getMsgCrypt();
    const decrypted = crypt.decrypt(encryptedMsg, msgSignature, timestamp, nonce);
    return decrypted.message;
  } catch (error: any) {
    console.error('Decrypt message error:', error);
    throw new Error(`Failed to decrypt message: ${error.message}`);
  }
}

/**
 * Encrypt message (for security mode replies)
 */
export function encryptMessage(message: string, timestamp: string, nonce: string): { encrypted: string; signature: string } {
  try {
    const crypt = getMsgCrypt();
    const encrypted = crypt.encrypt(message);
    const signature = crypt.getSignature(timestamp, nonce, encrypted);
    return { encrypted, signature };
  } catch (error: any) {
    console.error('Encrypt message error:', error);
    throw new Error(`Failed to encrypt message: ${error.message}`);
  }
}

/**
 * Decrypt echostr (for URL verification in security mode)
 */
export function decryptEchostr(encryptedEchostr: string, msgSignature: string, timestamp: string, nonce: string): string {
  try {
    const crypt = getMsgCrypt();
    const decrypted = crypt.decrypt(encryptedEchostr, msgSignature, timestamp, nonce);
    return decrypted.message;
  } catch (error: any) {
    console.error('Decrypt echostr error:', error);
    throw new Error(`Failed to decrypt echostr: ${error.message}`);
  }
}
