#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

async function updateTunnelUrl(url) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Tunnel] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env');
    return;
  }

  const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('tunnel_config')
    .insert({ url, updated_at: new Date().toISOString() });

  if (error) {
    console.error('[Tunnel] Failed to save tunnel URL:', error.message);
    return;
  }

  const filePath = path.join(__dirname, '..', '.tunnel_url');
  fs.writeFileSync(filePath, url, 'utf8');
  console.log('[Tunnel] ✅ URL saved to Supabase and .tunnel_url');
  console.log('[Tunnel] WeChat webhook URL should be: ' + url + '/api/oa/wh');
}

function startCloudflared() {
  console.log('[Tunnel] Starting cloudflared...');
  const proc = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
  let lastUrl = null;

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    const match = text.match(urlRegex);
    if (match && match[0] && match[0] !== lastUrl) {
      lastUrl = match[0];
      console.log('[Tunnel] Detected URL:', lastUrl);
      updateTunnelUrl(lastUrl).catch((err) => {
        console.error('[Tunnel] Update error:', err.message);
      });
    }
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  proc.on('close', (code) => {
    console.error(`[Tunnel] cloudflared exited with code ${code}`);
  });

  return proc;
}

function main() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  loadEnvFile(envPath);
  startCloudflared();
}

main();
