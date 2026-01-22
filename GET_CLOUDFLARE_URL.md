# 获取 Cloudflare Tunnel URL

## 方法1：查看 Cloudflare Tunnel 输出

Cloudflare Tunnel 启动时会在终端输出 URL，格式类似：
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxx-xxx-xxx.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

**请查看运行 `cloudflared tunnel --url http://localhost:3000` 的终端窗口**，应该能看到这个 URL。

## 方法2：测试连接

一旦您有了 URL（例如 `https://xxx-xxx-xxx.trycloudflare.com`），可以测试：

```bash
curl https://xxx-xxx-xxx.trycloudflare.com/api/oa/wh?signature=test&timestamp=123&nonce=456&echostr=hello
```

应该返回：`Missing required parameters`（这是正常的，因为参数不完整）

## 方法3：重新启动以查看 URL

如果看不到 URL，可以：
1. 停止当前的 cloudflared 进程
2. 在前台重新运行以查看输出：

```bash
# 停止当前进程
pkill cloudflared

# 在前台运行（可以看到输出）
cloudflared tunnel --url http://localhost:3000
```

## 配置到微信公众平台

获得 URL 后，在微信公众平台配置：

**URL**: `https://您的-cloudflare-url.trycloudflare.com/api/oa/wh`

其他配置保持不变。
