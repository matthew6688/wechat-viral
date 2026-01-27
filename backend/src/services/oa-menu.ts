import axios from 'axios';
import { supabase } from '../config/supabase';
import { OA_API } from '../config/wechat';
import { getOAAccessToken, clearAccessTokenCache } from './oa-qrcode';

export interface OAMenuButton {
  name: string;
  type?: 'click' | 'view' | 'miniprogram';
  key?: string;
  url?: string;
  appid?: string;
  pagepath?: string;
  sub_button?: OAMenuButton[];
}

export interface OAMenuConfig {
  button: OAMenuButton[];
}

const OA_MENU_CONFIG_ID = '00000000-0000-0000-0000-000000000002';

export async function getStoredOAMenu(): Promise<OAMenuConfig | null> {
  const { data, error } = await supabase
    .from('oa_menu_config')
    .select('menu_json')
    .eq('id', OA_MENU_CONFIG_ID)
    .single();

  if (error) {
    return null;
  }

  return (data?.menu_json as OAMenuConfig) || null;
}

export async function saveOAMenuConfig(menu: OAMenuConfig): Promise<void> {
  const { error } = await supabase
    .from('oa_menu_config')
    .upsert({
      id: OA_MENU_CONFIG_ID,
      menu_json: menu,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export function validateMenuConfig(menu: OAMenuConfig): { valid: boolean; error?: string } {
  if (!menu || !Array.isArray(menu.button)) {
    return { valid: false, error: '菜单格式无效，缺少 button 列表' };
  }

  if (menu.button.length > 3) {
    return { valid: false, error: '一级菜单最多 3 个' };
  }

  for (const button of menu.button) {
    if (!button.name) {
      return { valid: false, error: '菜单名称不能为空' };
    }
    if (button.sub_button && button.sub_button.length > 0) {
      if (button.sub_button.length > 5) {
        return { valid: false, error: '二级菜单最多 5 个' };
      }
      for (const sub of button.sub_button) {
        if (!sub.name) {
          return { valid: false, error: '子菜单名称不能为空' };
        }
      }
    }
  }

  return { valid: true };
}

export async function syncMenuToWeChat(menu: OAMenuConfig, retryCount: number = 0): Promise<void> {
  const accessToken = await getOAAccessToken();

  const response = await axios.post(
    `${OA_API.createMenu}?access_token=${accessToken}`,
    menu
  );

  if ((response.data.errcode === 40001 || response.data.errcode === 42001) && retryCount < 2) {
    clearAccessTokenCache();
    await getOAAccessToken(true);
    return syncMenuToWeChat(menu, retryCount + 1);
  }

  if (response.data.errcode) {
    throw new Error(`Failed to create menu: ${response.data.errmsg}`);
  }
}

export async function fetchWeChatMenu(retryCount: number = 0): Promise<OAMenuConfig | null> {
  const accessToken = await getOAAccessToken();
  const response = await axios.get(`${OA_API.getMenu}?access_token=${accessToken}`);

  if ((response.data.errcode === 40001 || response.data.errcode === 42001) && retryCount < 2) {
    clearAccessTokenCache();
    await getOAAccessToken(true);
    return fetchWeChatMenu(retryCount + 1);
  }

  if (response.data.errcode) {
    throw new Error(`Failed to fetch menu: ${response.data.errmsg}`);
  }

  return response.data?.menu || null;
}
