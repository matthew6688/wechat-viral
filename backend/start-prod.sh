Loading .env from: /data/.openclaw/workspace/wechat-viral/backend/.env
ENV Check - SUPABASE_URL: SET
ENV Check - SUPABASE_SERVICE_KEY: NOT SET
Admin static path: /data/.openclaw/workspace/wechat-viral/admin
Admin path exists: true
Server running on port 3002
Get campaigns error: Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY environment variables
    at getSupabase (/data/.openclaw/workspace/wechat-viral/backend/dist/config/supabase.js:17:19)
    at Object.get (/data/.openclaw/workspace/wechat-viral/backend/dist/config/supabase.js:131:24)
    at /data/.openclaw/workspace/wechat-viral/backend/dist/routes/campaigns.js:31:14
    at Layer.handle [as handle_request] (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/layer.js:95:5)
    at next (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/route.js:119:3)
    at Layer.handle [as handle_request] (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/layer.js:95:5)
    at /data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:284:15
    at Function.process_params (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:346:12)
    at next (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:280:10)
Email login error: Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY environment variables
    at getSupabase (/data/.openclaw/workspace/wechat-viral/backend/dist/config/supabase.js:17:19)
    at Object.get (/data/.openclaw/workspace/wechat-viral/backend/dist/config/supabase.js:131:24)
    at /data/.openclaw/workspace/wechat-viral/backend/dist/routes/auth.js:249:14
    at Layer.handle [as handle_request] (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/layer.js:95:5)
    at next (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/route.js:149:13)
    at Route.dispatch (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/route.js:119:3)
    at Layer.handle [as handle_request] (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/layer.js:95:5)
    at /data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:284:15
    at Function.process_params (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:346:12)
    at next (/data/.openclaw/workspace/wechat-viral/backend/node_modules/express/lib/router/index.js:280:10)
