# Cloudflare Tunnel 设置指南

## 安装 Cloudflare Tunnel

### macOS
```bash
brew install cloudflare/cloudflare/cloudflared
```

### 或下载二进制文件
访问：https://github.com/cloudflare/cloudflared/releases

## 设置步骤

### 1. 登录 Cloudflare
```bash
cloudflared tunnel login
```
这会打开浏览器，选择您的域名并授权。

### 2. 创建 Tunnel
```bash
cloudflared tunnel create wechat-viral
```

### 3. 创建配置文件
创建文件：`~/.cloudflared/config.yml`

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/matthew/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: wechat-viral.yourdomain.com  # 替换为您的域名
    service: http://localhost:3000
  - service: http_status:404
```

### 4. 运行 Tunnel
```bash
cloudflared tunnel run wechat-viral
```

### 5. 或者直接运行（临时，不需要配置文件）
```bash
cloudflared tunnel --url http://localhost:3000
```

这会给出一个类似 `https://xxx.trycloudflare.com` 的 URL。

## 快速启动（最简单的方法）

如果您只是想快速测试，可以直接运行：

```bash
cloudflared tunnel --url http://localhost:3000
```

这会输出一个 URL，例如：
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxx-xxx-xxx.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

然后使用这个 URL 配置到微信公众平台：
```
https://xxx-xxx-xxx.trycloudflare.com/api/oa/wh
```

## 优势

- ✅ 免费且稳定
- ✅ 没有浏览器验证页面
- ✅ 不会阻止微信服务器的请求
- ✅ 支持自定义域名（如果有 Cloudflare 账户）
