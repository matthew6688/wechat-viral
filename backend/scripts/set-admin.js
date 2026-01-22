/**
 * Script to set a user as admin
 * Usage: node scripts/set-admin.js <user_identifier>
 * 
 * Examples:
 *   node scripts/set-admin.js <user_id>
 *   node scripts/set-admin.js --phone <phone_number>
 *   node scripts/set-admin.js --openid <openid>
 *   node scripts/set-admin.js --first (sets first user as admin)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdmin(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('id', userId)
      .select('id, name, phone, is_admin')
      .single();

    if (error) {
      throw error;
    }

    console.log('✅ Successfully set user as admin:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error setting admin:', error.message);
    process.exit(1);
  }
}

async function setAdminByPhone(phone) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('phone', phone)
      .select('id, name, phone, is_admin')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error(`❌ No user found with phone: ${phone}`);
      } else {
        throw error;
      }
      process.exit(1);
    }

    console.log('✅ Successfully set user as admin:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error setting admin:', error.message);
    process.exit(1);
  }
}

async function setAdminByOpenid(openid) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('openid', openid)
      .select('id, name, phone, openid, is_admin')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error(`❌ No user found with openid: ${openid}`);
      } else {
        throw error;
      }
      process.exit(1);
    }

    console.log('✅ Successfully set user as admin:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error setting admin:', error.message);
    process.exit(1);
  }
}

async function setAdminByUnionid(unionid) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('unionid', unionid)
      .select('id, name, phone, openid, unionid, is_admin')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error(`❌ No user found with unionid: ${unionid}`);
        console.error('💡 Note: UnionID is only available if the user has bound their account to WeChat Open Platform.');
      } else {
        throw error;
      }
      process.exit(1);
    }

    console.log('✅ Successfully set user as admin:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error setting admin:', error.message);
    process.exit(1);
  }
}

async function setFirstUserAsAdmin() {
  try {
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, name, phone, is_admin')
      .order('created_at', { ascending: true })
      .limit(1);

    if (fetchError || !users || users.length === 0) {
      console.error('❌ No users found in database');
      process.exit(1);
    }

    const userId = users[0].id;
    await setAdmin(userId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function listUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, openid, unionid, is_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    console.log('\n📋 Users in database:');
    console.log('─'.repeat(100));
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'N/A'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Phone: ${user.phone || 'N/A'}`);
      console.log(`   OpenID: ${user.openid ? user.openid.substring(0, 20) + '...' : 'N/A'}`);
      console.log(`   UnionID: ${user.unionid ? user.unionid.substring(0, 20) + '...' : 'N/A (not bound to Open Platform)'}`);
      console.log(`   Admin: ${user.is_admin ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log('─'.repeat(100));
    });
  } catch (error) {
    console.error('❌ Error listing users:', error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: node scripts/set-admin.js [options]

Options:
  <user_id>              Set user as admin by UUID
  --phone <phone>        Set user as admin by phone number
  --openid <openid>       Set user as admin by WeChat Mini Program openid
  --unionid <unionid>     Set user as admin by WeChat UnionID (RECOMMENDED - unique across all WeChat products)
  --first                 Set first user (by created_at) as admin
  --list                  List all users (to find your user ID)
  --help, -h              Show this help message

Examples:
  node scripts/set-admin.js --list
  node scripts/set-admin.js <your-user-id>
  node scripts/set-admin.js --unionid YOUR_UNIONID
  node scripts/set-admin.js --phone 13800138000
  node scripts/set-admin.js --first

Note: UnionID is the best option as it's unique across all WeChat products
      (Mini Program, Official Account, etc.) and doesn't change.
`);
  process.exit(0);
}

if (args[0] === '--list') {
  listUsers();
} else if (args[0] === '--phone' && args[1]) {
  setAdminByPhone(args[1]);
} else if (args[0] === '--openid' && args[1]) {
  setAdminByOpenid(args[1]);
} else if (args[0] === '--unionid' && args[1]) {
  setAdminByUnionid(args[1]);
} else if (args[0] === '--first') {
  setFirstUserAsAdmin();
} else if (args[0]) {
  // Assume it's a user ID
  setAdmin(args[0]);
} else {
  console.error('❌ Invalid arguments. Use --help for usage information.');
  process.exit(1);
}
