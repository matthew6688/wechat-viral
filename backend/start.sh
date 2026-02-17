#!/bin/bash
# WeChat Viral 启动脚本

# 设置环境变量
export PORT=3002
export SUPABASE_URL="https://qkfyktfgbrslbmtaxghb.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZnlrdGZnYnJzbGJtdGF4Z2hiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAyNzg1MCwiZXhwIjoyMDg0NjAzODUwfQ.HiZ1kNRfGQLsRkwlbtxCe-smPzHYOYEsV2raxp3CPJ8"
export JWT_SECRET="your-jwt-secret-key-here"

# 进入目录
cd /data/.openclaw/workspace/wechat-viral/backend

# 启动服务
exec node dist/index.js
