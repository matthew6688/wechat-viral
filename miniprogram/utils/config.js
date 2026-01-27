// API base URLs
// Local simulator: 'http://localhost:3000/api'
// Production: 'https://your-app.vercel.app/api' (set in PRODUCTION_URL below)
// Real device (fallback): use Cloudflare tunnel URL (dynamically fetched from Supabase)

// ========================================
// Supabase 配置 (用于直接获取 tunnel URL)
// ========================================
// ⚠️ 这些是公开的配置，anon key 是设计为可公开的
var SUPABASE_URL = 'https://fseyfnuqxvrcwrpshxyv.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXlmbnVxeHZyY3dycHNoeHl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MzY2MjMsImV4cCI6MjA1MzExMjYyM30.gVvZkRa8poLj2hfrMw4i77bqjT8SZ1S_KLWnRjJcAZY';

// 本地开发 URL
var LOCAL_URL = 'http://localhost:3000/api';

// 生产环境 URL (部署到 Vercel 后，替换为你的 Vercel URL)
// 例如: 'https://your-app.vercel.app/api'
// 设置为 null 或空字符串以使用 tunnel URL 作为后备方案
var PRODUCTION_URL = 'https://wechat-viral-4lq4hct57-matthews-projects-09dd8000.vercel.app/api'; // Vercel production URL

// 缓存的 tunnel URL (启动时从 Supabase 获取)
var cachedTunnelUrl = null;
var lastFetchTime = 0;
var CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存

/**
 * 从 Supabase 直接获取 tunnel URL
 * 这样即使后端 URL 变化，小程序也能动态获取
 */
function fetchTunnelUrlFromSupabase() {
  return new Promise(function(resolve) {
    try {
      console.log('[Config] Fetching tunnel URL from Supabase...');
      
      wx.request({
        url: SUPABASE_URL + '/rest/v1/tunnel_config?select=url&order=updated_at.desc&limit=1',
        method: 'GET',
        header: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        success: function(res) {
          if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
            var url = res.data[0].url;
            // Remove trailing slash if present
            if (url && url.endsWith('/')) {
              url = url.slice(0, -1);
            }
            console.log('[Config] ✅ Got tunnel URL from Supabase:', url);
            
            // Validate URL format
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              resolve(url);
            } else {
              console.error('[Config] ❌ Invalid tunnel URL format:', url);
              resolve(null);
            }
          } else {
            console.log('[Config] ⚠️ No tunnel URL found in Supabase, response:', res);
            resolve(null);
          }
        },
        fail: function(err) {
          console.error('[Config] Failed to fetch tunnel URL from Supabase:', err);
          resolve(null);
        },
      });
    } catch (error) {
      console.error('[Config] Error fetching tunnel URL:', error);
      resolve(null);
    }
  });
}

/**
 * 获取 API Base URL
 * - 模拟器环境: 使用 localhost
 * - 真机环境: 从 Supabase 获取 tunnel URL
 */
function getApiBaseUrl() {
  var platform = 'unknown';
  try {
    // Try new API first
    if (wx.getDeviceInfo) {
      var deviceInfo = wx.getDeviceInfo();
      platform = deviceInfo.platform;
    } else {
      // Fallback to deprecated API
      var systemInfo = wx.getSystemInfoSync();
      platform = systemInfo.platform;
    }
  } catch (e) {
    console.warn('[Config] Failed to get platform, assuming devtools');
    platform = 'devtools';
  }
  
  // 模拟器直接用 localhost
  if (platform === 'devtools') {
    console.log('[Config] Running in simulator, using localhost');
    return LOCAL_URL;
  }
  
  // 真机环境
  console.log('[Config] Running on real device');
  
  // 优先从本地存储获取 URL（最可靠）
  try {
    var stored = wx.getStorageSync('tunnel_url');
    if (stored && stored.trim()) {
      // Remove trailing slash if present
      if (stored.endsWith('/')) {
        stored = stored.slice(0, -1);
      }
      cachedTunnelUrl = stored;
      lastFetchTime = Date.now();
      console.log('[Config] ✅ Using stored tunnel URL:', stored);
      console.log('[Config] Full API URL:', stored + '/api');
      // 在后台静默更新 tunnel URL（不阻塞）
      refreshTunnelUrl();
      return stored + '/api';
    }
  } catch (e) {
    console.error('[Config] Failed to read stored tunnel URL:', e);
  }
  
  // 如果有内存缓存且未过期，使用它
  if (cachedTunnelUrl && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Config] ✅ Using cached tunnel URL:', cachedTunnelUrl);
    // 在后台静默更新
    refreshTunnelUrl();
    return cachedTunnelUrl + '/api';
  }
  
  // 如果没有缓存，尝试立即同步获取（阻塞式）
  console.log('[Config] ⚠️ No cached tunnel URL, attempting to fetch from Supabase synchronously...');
  
  // 尝试同步获取（使用 Promise，但会等待）
  var urlFetched = false;
  var fetchedUrl = null;
  var fetchError = null;
  
  fetchTunnelUrlFromSupabase()
    .then(function(newUrl) {
      if (newUrl) {
        // Remove trailing slash
        if (newUrl.endsWith('/')) {
          newUrl = newUrl.slice(0, -1);
        }
        cachedTunnelUrl = newUrl;
        lastFetchTime = Date.now();
        try {
          wx.setStorageSync('tunnel_url', newUrl);
          console.log('[Config] ✅ Tunnel URL fetched and saved:', newUrl);
        } catch (e) {
          console.error('[Config] Failed to save tunnel URL:', e);
        }
        fetchedUrl = newUrl;
      } else {
        console.error('[Config] ⚠️ No tunnel URL returned from Supabase');
      }
      urlFetched = true;
    })
    .catch(function(error) {
      console.error('[Config] Error fetching tunnel URL:', error);
      fetchError = error;
      urlFetched = true;
    });
  
  // 等待获取完成（最多等待 5 秒）
  var startTime = Date.now();
  while (!urlFetched && (Date.now() - startTime) < 5000) {
    // 在小程序中，我们无法真正阻塞，所以使用简单的延迟
    // 但这种方法不理想，所以我们会立即返回并使用存储的值
  }
  
  if (fetchedUrl) {
    return fetchedUrl + '/api';
  }
  
  // 如果仍然没有，尝试从存储中获取（可能是之前保存的）
  try {
    var stored = wx.getStorageSync('tunnel_url');
    if (stored && stored.trim() && !stored.includes('invalid')) {
      // Remove trailing slash
      if (stored.endsWith('/')) {
        stored = stored.slice(0, -1);
      }
      console.log('[Config] ⚠️ Using stored tunnel URL (may be outdated):', stored);
      // 在后台刷新
      refreshTunnelUrl();
      return stored + '/api';
    }
  } catch (e) {
    console.error('[Config] Error reading stored URL:', e);
  }
  
  // 如果仍然没有，返回 null 让调用者处理
  console.error('[Config] ❌ No tunnel URL available!');
  console.error('[Config] Please check Supabase tunnel_config table has a valid URL');
  return null;
}

/**
 * 在后台刷新 tunnel URL
 */
function refreshTunnelUrl() {
  fetchTunnelUrlFromSupabase().then(function(newUrl) {
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
  }).catch(function(error) {
    console.error('[Config] Failed to refresh tunnel URL:', error);
  });
}

/**
 * 强制刷新 tunnel URL (用于调试或手动刷新)
 */
function forceRefreshTunnelUrl() {
  console.log('[Config] Force refreshing tunnel URL...');
  return fetchTunnelUrlFromSupabase().then(function(newUrl) {
    if (newUrl) {
      // Remove trailing slash if present
      if (newUrl.endsWith('/')) {
        newUrl = newUrl.slice(0, -1);
      }
      cachedTunnelUrl = newUrl;
      lastFetchTime = Date.now();
      try {
        wx.setStorageSync('tunnel_url', newUrl);
        console.log('[Config] ✅ Tunnel URL force refreshed and saved:', newUrl);
      } catch (e) {
        console.error('[Config] Failed to save tunnel URL:', e);
      }
    } else {
      console.warn('[Config] ⚠️ No tunnel URL returned from Supabase');
    }
    return newUrl;
  });
}

/**
 * 获取当前使用的 tunnel URL (不含 /api)
 */
function getCurrentTunnelUrl() {
  return cachedTunnelUrl;
}

/**
 * 检测当前环境
 */
function isRealDevice() {
  try {
    // Try new API first
    if (wx.getDeviceInfo) {
      var deviceInfo = wx.getDeviceInfo();
      return deviceInfo.platform !== 'devtools';
    }
    // Fallback to deprecated API
    var systemInfo = wx.getSystemInfoSync();
    return systemInfo.platform !== 'devtools';
  } catch (e) {
    // Default to true (real device) if we can't determine
    return true;
  }
}

// 导出配置
// 注意：API_BASE_URL 现在是一个函数，每次调用时动态获取
// 这样可以确保在真机上总是获取最新的 tunnel URL
function getApiBaseUrlDynamic() {
  var platform = 'unknown';
  try {
    // Try new API first
    if (wx.getDeviceInfo) {
      var deviceInfo = wx.getDeviceInfo();
      platform = deviceInfo.platform;
    } else {
      // Fallback to deprecated API
      var systemInfo = wx.getSystemInfoSync();
      platform = systemInfo.platform;
    }
    
    // 模拟器直接用 localhost
    if (platform === 'devtools') {
      return LOCAL_URL;
    }
  } catch (e) {
    // 如果获取系统信息失败，默认使用 localhost（可能是开发环境）
    console.warn('[Config] Failed to get system info, using localhost:', e);
    return LOCAL_URL;
  }
  
  // 真机环境：优先使用生产环境 URL（如果已配置）
  if (PRODUCTION_URL && PRODUCTION_URL.trim()) {
    console.log('[Config] ✅ Using production URL:', PRODUCTION_URL);
    return PRODUCTION_URL;
  }
  
  // 否则，使用 tunnel URL 作为后备方案
  try {
    var stored = wx.getStorageSync('tunnel_url');
    if (stored && stored.trim() && !stored.includes('invalid')) {
      // Remove trailing slash
      if (stored.endsWith('/')) {
        stored = stored.slice(0, -1);
      }
      // 在后台刷新（不阻塞）
      if (!cachedTunnelUrl || cachedTunnelUrl !== stored) {
        cachedTunnelUrl = stored;
        lastFetchTime = Date.now();
      }
      refreshTunnelUrl();
      console.log('[Config] ✅ Using tunnel URL:', stored + '/api');
      return stored + '/api';
    }
  } catch (e) {
    console.error('[Config] Error reading stored URL:', e);
  }
  
  // 如果有内存缓存且未过期，使用它
  if (cachedTunnelUrl && (Date.now() - lastFetchTime) < CACHE_DURATION) {
    console.log('[Config] ✅ Using cached tunnel URL:', cachedTunnelUrl + '/api');
    return cachedTunnelUrl + '/api';
  }
  
  // 如果都没有，返回 null（API 层会处理）
  console.warn('[Config] ⚠️ No tunnel URL available, API calls may fail');
  return null;
}

// 为了向后兼容，导出一个变量（但会在第一次使用时初始化）
var API_BASE_URL = getApiBaseUrlDynamic();

// 如果初始化时没有获取到，尝试从存储获取
if (!API_BASE_URL) {
  try {
    var stored = wx.getStorageSync('tunnel_url');
    if (stored && stored.trim() && !stored.includes('invalid')) {
      if (stored.endsWith('/')) {
        stored = stored.slice(0, -1);
      }
      API_BASE_URL = stored + '/api';
      cachedTunnelUrl = stored;
      lastFetchTime = Date.now();
      console.log('[Config] ✅ Initialized with stored URL:', API_BASE_URL);
      refreshTunnelUrl();
    }
  } catch (e) {
    console.error('[Config] Error initializing:', e);
  }
}

// WeChat Mini Program AppID
var WECHAT_APPID = 'wxb00a7034897b60fe';

// Supabase 配置 (公开)
var SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

// 创建一个对象，使用 getter 来动态获取 API_BASE_URL
// 这样每次访问 API_BASE_URL 时都会获取最新的 URL
var configExports = {
  get API_BASE_URL() {
    return getApiBaseUrlDynamic();
  },
  WECHAT_APPID: WECHAT_APPID,
  SUPABASE_CONFIG: SUPABASE_CONFIG,
  forceRefreshTunnelUrl: forceRefreshTunnelUrl,
  getCurrentTunnelUrl: getCurrentTunnelUrl,
  isRealDevice: isRealDevice,
  getApiBaseUrlDynamic: getApiBaseUrlDynamic,
  refreshTunnelUrl: refreshTunnelUrl,
};

module.exports = configExports;
