/**
 * Script to create an admin user with email and password
 * Usage: node scripts/create-admin-user.js <email> <password> [name]
 * 
 * Example:
 *   node scripts/create-admin-user.js matthewkiata@gmail.com 12121212 "Matthew"
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser(email, password, name = 'Admin User') {
  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, is_admin')
      .eq('email', email)
      .single();

    if (existingUser) {
      console.log('User already exists, updating...');
      
      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Update user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          is_admin: true,
          name: name,
        })
        .eq('id', existingUser.id)
        .select('id, email, name, is_admin')
        .single();

      if (updateError) {
        throw updateError;
      }

      console.log('✅ Successfully updated user to admin:');
      console.log(JSON.stringify(updatedUser, null, 2));
      return;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate unique phone number (limit to 20 chars to match DB constraint)
    const timestamp = Date.now().toString().slice(-10); // Last 10 digits
    const random = Math.random().toString(36).substr(2, 6); // 6 chars
    const uniquePhone = `admin_${timestamp}${random}`.substring(0, 20); // Ensure max 20 chars

    // Create new admin user
    // Note: Some fields might have length restrictions, use shorter values if needed
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: passwordHash,
        name: name.length > 50 ? name.substring(0, 50) : name, // Limit name length
        phone: uniquePhone.length > 20 ? uniquePhone.substring(0, 20) : uniquePhone, // Limit phone length
        wechat_id: 'N/A',
        company: 'N/A',
        role: 'Other',
        main_products: 'N/A',
        is_admin: true,
      })
      .select('id, email, name, is_admin')
      .single();

    if (createError) {
      throw createError;
    }

    console.log('✅ Successfully created admin user:');
    console.log(JSON.stringify(newUser, null, 2));
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Admin: Yes');
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === '23505') {
      console.error('   Email already exists. Use update instead.');
    }
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: node scripts/create-admin-user.js <email> <password> [name]

Arguments:
  email      Admin user email address
  password   Admin user password
  name       (Optional) Admin user name (default: "Admin User")

Example:
  node scripts/create-admin-user.js matthewkiata@gmail.com 12121212 "Matthew"
`);
  process.exit(0);
}

const [email, password, name] = args;
createAdminUser(email, password, name || 'Admin User');
