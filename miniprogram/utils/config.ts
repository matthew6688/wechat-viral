// API base URLs
// Local simulator: 'http://localhost:3000/api'
// Real device: use Cloudflare tunnel URL (dynamically fetched from Supabase)

// ========================================
// Supabase 配置 (用于直接获取 tunnel URL)
// ========================================
// ⚠️ 这些是公开的配置，anon key 是设计为可公开的
const SUPABASE_URL = 'https://fseyfnuqxvrcwrpshxyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXlmbnVxeHZyY3dycHNoeHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MzY2MjMsImV4cCI6MjA1MzExMjYyM30.gVvZkRa8poLj2hfrMw4i77bqjT8SZ1S_KLWnRjJcAZY';

// 本地开发 URL
const LOCAL_URL = 'http://localhost:3000/api';

// 缓存的 tunnel URL (启动时从 Supabase 获取)
let cachedTunnelUrl: string | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 从 Supabase 直接获取 tunnel URL
 * 这样即使后端 URL 变化，小程序也能动态获取
 */
async function fetchTunnelUrlFromSupabase(): Promise<string | null> {
  try {
    console.log('[Config] Fetching tunnel URL from Supabase...');
    
    return new Promise((resolve) => {
      wx.request({
        url: `${SUPABASE_URL}/rest/v1/tunnel_config?select=url&order=updated_at.desc&limit=1`,
        method: 'GET',
        header: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        success: (res: any) => {
          if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
            const url = res.data[0].url;
            console.log('[Config] Got tunnel URL from Supabase:', url);
            resolve(url);
          } else {
            console.log('[Config] No tunnel URL found in Supabase, response:', res);
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('[Config] Failed to fetch tunnel URL from Supabase:', err);
          resolve(null);
        },
      });
    });
  } catch (error) {
    console.error('[Config] Error fetching tunnel URL:', error);
    return null;
  }
}

/**
 * 获取 API Base URL
 * - 模拟器环境: 使用 localhost
 * - 真机环境: 从 Supabase 获取 tunnel URL
 */
function getApiBaseUrl(): string {
  const systemInfo = wx.getSystemInfoSync();
  const platform = systemInfo.platform;
  
  // 模拟器直接用 localhost
  if (platform === 'devtools') {
    console.log('[Config] Running in simulator, using localhost');
    return LOCAL_URL;
  }
  
  // 真机环境，先返回缓存的 URL，同时在后台更新
  console.log('[Config] Running on real device');
  
  // 如果有缓存且未过期，直接返回
  if (cachedTunnelUrl && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Config] Using cached tunnel URL:', cachedTunnelUrl);
    return cachedTunnelUrl + '/api';
  }
  
  // 从本地存储获取上次保存的 URL
  try {
    const stored = wx.getStorageSync('tunnel_url');
    if (stored) {
      cachedTunnelUrl = stored;
      console.log('[Config] Using stored tunnel URL:', stored);
    }
  } catch (e) {
    console.error('[Config] Failed to read stored tunnel URL:', e);
  }
  
  // 在后台静默更新 tunnel URL
  refreshTunnelUrl();
  
  // 返回缓存的 URL 或 fallback
  if (cachedTunnelUrl) {
    return cachedTunnelUrl + '/api';
  }
  
  // 如果没有缓存，返回一个 fallback（可能会失败，但会触发更新）
  console.log('[Config] No cached tunnel URL, using localhost as fallback');
  return LOCAL_URL;
}

/**
 * 在后台刷新 tunnel URL
 */
async function refreshTunnelUrl(): Promise<void> {
  try {
    const newUrl = await fetchTunnelUrlFromSupabase();
    if (newUrl) {
      cachedTunnelUrl = newUrl;
      lastFetchTime = Date.now();
      
      // 保存到本地存储
      try {
        wx.setStorageSync('tunnel_url', newUrl);
        console.log('[Config] Tunnel URL saved to storage:', newUrl);
      } catch (e) {
        console.error('[Config] Failed to save tunnel URL:', e);
      }
    }
  } catch (error) {
    console.error('[Config] Failed to refresh tunnel URL:', error);
  }
}

/**
 * 强制刷新 tunnel URL (用于调试或手动刷新)
 */
export async function forceRefreshTunnelUrl(): Promise<string | null> {
  console.log('[Config] Force refreshing tunnel URL...');
  const newUrl = await fetchTunnelUrlFromSupabase();
  if (newUrl) {
    cachedTunnelUrl = newUrl;
    lastFetchTime = Date.now();
    try {
      wx.setStorageSync('tunnel_url', newUrl);
    } catch (e) {
      console.error('[Config] Failed to save tunnel URL:', e);
    }
  }
  return newUrl;
}

/**
 * 获取当前使用的 tunnel URL (不含 /api)
 */
export function getCurrentTunnelUrl(): string | null {
  return cachedTunnelUrl;
}

/**
 * 检测当前环境
 */
export function isRealDevice(): boolean {
  const systemInfo = wx.getSystemInfoSync();
  return systemInfo.platform !== 'devtools';
}

// 导出配置
export const API_BASE_URL = getApiBaseUrl();

// WeChat Mini Program AppID
export const WECHAT_APPID = 'wxb00a7034897b60fe';

// Supabase 配置 (公开)
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};
