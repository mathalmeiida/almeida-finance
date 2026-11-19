import { readFileSync } from 'fs';

// Parse .env.local
const envContent = readFileSync('./posso-comprar/.env.local', 'utf-8');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

console.log('Debug env vars:', Object.keys(envVars));

const testUser = {
  email: `testvisual${Date.now()}@gmail.com`,
  password: 'TestVisual2024!@#SecurePass'
};

console.log('🔐 Creating test user for visual validation...\n');
console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Test email: ${testUser.email}`);
console.log(`Test password: ${testUser.password}\n`);

async function createUser() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
        email_confirm: false // Try to bypass email confirmation
      })
    });

    const data = await response.json();
    
    console.log('📋 Response Status:', response.status);
    console.log('📋 Response:', JSON.stringify(data, null, 2), '\n');

    if (response.status === 200 || response.status === 201) {
      console.log('✅ SUCCESS! User created.');
      console.log('\n📝 CREDENTIALS TO USE:');
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Password: ${testUser.password}`);
      console.log('\n🌐 Now you can login at: http://localhost:5173/login');
      return true;
    } else if (data.message?.includes('confirmation')) {
      console.log('⚠️  Email confirmation is required by Supabase.');
      console.log('\n🔧 TO FIX:');
      console.log('   1. Go to https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/auth/users');
      console.log('   2. Click "Add user" → "Create new user"');
      console.log(`   3. Email: ${testUser.email}`);
      console.log(`   4. Password: ${testUser.password}`);
      console.log('   5. ✅ Check "Auto Confirm User"');
      console.log('   6. Click "Create user"');
      console.log('\n   OR disable email confirmation in Auth settings:');
      console.log('   https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/auth/providers');
      return false;
    } else if (data.message?.includes('already registered')) {
      console.log('⚠️  User already exists. Try logging in with:');
      console.log(`   Email: ${testUser.email}`);
      console.log(`   Password: ${testUser.password}`);
      return true;
    } else {
      console.log('❌ Failed to create user');
      console.log('Error:', data.message || data.error_description || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

createUser();
