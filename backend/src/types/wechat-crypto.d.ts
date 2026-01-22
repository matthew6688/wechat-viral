declare module 'wechat-crypto' {
  class WXBizMsgCrypt {
    constructor(token: string, encodingAESKey: string, appId: string);
    decrypt(encryptedMsg: string, msgSignature: string, timestamp: string, nonce: string): { message: string };
    encrypt(message: string): string;
    getSignature(timestamp: string, nonce: string, encrypted: string): string;
  }
  export = WXBizMsgCrypt;
}
