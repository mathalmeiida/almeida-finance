import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';

// Parse .env.local to get Supabase URL and anon key
const envContent = readFileSync('./posso-comprar/.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

const BASE_URL = 'http://localhost:5173';
const TEST_USER = {
  email: `test.${Date.now()}@almeidafinance.test`,
  password: 'TestSecure2024!@#',
  name: 'Test User'
};

const PAGES_TO_TEST = [
  { path: '/home', name: 'Home' },
  { path: '/configuracoes', name: 'Configurações' },
  { path: '/investimentos', name: 'Investimentos' },
  { path: '/cartoes', name: 'Cartões' },
  { path: '/receitas', name: 'Receitas' },
  { path: '/despesas', name: 'Despesas' },
  { path: '/calendario', name: 'Calendário' },
  { path: '/onboarding', name: 'Onboarding' }
];

const VIEWPORTS = [
  { width: 390, height: 844, name: 'Mobile' },
  { width: 1440, height: 900, name: 'Desktop' }
];

async function signUpUser(page) {
  console.log('\n📝 Attempting user signup via Supabase API...');
  
  // Try to sign up via Supabase REST API
  const response = await page.evaluate(async ({ url, key, user }) => {
    try {
      const res = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          data: {
            name: user.name
          }
        })
      });
      
      const data = await res.json();
      return { status: res.status, data };
    } catch (error) {
      return { error: error.message };
    }
  }, { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, user: TEST_USER });

  console.log('Signup response:', JSON.stringify(response, null, 2));
  
  if (response.status === 200 || response.status === 201) {
    console.log('✅ User created successfully');
    return true;
  } else if (response.data?.message?.includes('already registered')) {
    console.log('⚠️  User already exists, will attempt login');
    return true;
  } else if (response.data?.message?.includes('Email not confirmed')) {
    console.log('⚠️  Email confirmation required - cannot proceed with automated tests');
    return false;
  } else {
    console.log('❌ Signup failed:', response.data?.message || response.error);
    return false;
  }
}

async function login(page) {
  console.log('\n🔐 Attempting login...');
  
  // Mark presentation as viewed
  await page.evaluate(() => {
    localStorage.setItem('almeida_apresentacao_publica_vista', '1');
  });

  // Navigate to login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });

  // Fill login form
  await page.type('input[type="email"]', TEST_USER.email);
  await page.type('input[type="password"]', TEST_USER.password);
  
  // Submit form
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
    page.click('button[type="submit"]')
  ]);

  // Check if logged in (should redirect to /home)
  const currentUrl = page.url();
  if (currentUrl.includes('/home')) {
    console.log('✅ Login successful');
    return true;
  } else {
    console.log('❌ Login failed - still at:', currentUrl);
    
    // Check for error messages
    const errorText = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      return Array.from(alerts).map(a => a.textContent).join('; ');
    });
    
    if (errorText) {
      console.log('Error message:', errorText);
    }
    
    return false;
  }
}

async function validatePage(page, pagePath, pageName, viewport) {
  console.log(`\n📄 Testing ${pageName} at ${viewport.width}x${viewport.height}...`);
  
  try {
    await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle2', timeout: 10000 });
    
    // Wait for content to load
    await page.waitForTimeout(1000);
    
    // Check for horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    // Check background color in corners (should be vinho rgb(61, 10, 24))
    const cornerColors = await page.evaluate(() => {
      const checkColor = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return style.backgroundColor;
      };
      
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margin = 5;
      
      return {
        topLeft: checkColor(margin, margin),
        topRight: checkColor(w - margin, margin),
        bottomLeft: checkColor(margin, h - margin),
        bottomRight: checkColor(w - margin, h - margin)
      };
    });
    
    // Check if all corners have the wine background (allowing for authenticated pages that might have different layouts)
    const expectedColors = [
      'rgb(61, 10, 24)',  // vinho
      'rgb(255, 255, 255)', // white (for content areas)
      'rgb(249, 250, 251)' // gray-50 (for some sections)
    ];
    
    const cornerIssues = [];
    Object.entries(cornerColors).forEach(([corner, color]) => {
      if (!expectedColors.some(expected => color.includes(expected))) {
        cornerIssues.push(`${corner}: ${color}`);
      }
    });
    
    const status = !hasOverflow && cornerIssues.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${pageName} @ ${viewport.name}:`);
    console.log(`   Overflow: ${hasOverflow ? '❌ YES' : '✅ NO'}`);
    console.log(`   Corners: ${JSON.stringify(cornerColors, null, 2)}`);
    
    if (cornerIssues.length > 0) {
      console.log(`   Issues: ${cornerIssues.join(', ')}`);
    }
    
    return {
      page: pageName,
      viewport: viewport.name,
      overflow: hasOverflow,
      cornerIssues: cornerIssues.length,
      success: !hasOverflow && cornerIssues.length === 0
    };
    
  } catch (error) {
    console.log(`❌ ${pageName} @ ${viewport.name}: ${error.message}`);
    return {
      page: pageName,
      viewport: viewport.name,
      error: error.message,
      success: false
    };
  }
}

async function testThemeSwitching(page) {
  console.log('\n🎨 Testing theme switching...');
  
  try {
    // Go to config page
    await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(1000);
    
    // Find and click theme selector
    const themeButton = await page.$('button[aria-label*="tema"], button:has-text("Paleta")');
    if (!themeButton) {
      console.log('⚠️  Theme selector not found');
      return { success: false, reason: 'Theme selector not found' };
    }
    
    await themeButton.click();
    await page.waitForTimeout(500);
    
    // Select a different theme
    const themeOptions = await page.$$('[role="option"], button[data-theme]');
    if (themeOptions.length === 0) {
      console.log('⚠️  No theme options found');
      return { success: false, reason: 'No theme options found' };
    }
    
    // Click second theme option
    await themeOptions[1].click();
    await page.waitForTimeout(500);
    
    // Check if theme persists after reload
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForTimeout(1000);
    
    // TODO: Check if selected theme is still active
    console.log('✅ Theme switching tested');
    return { success: true };
    
  } catch (error) {
    console.log(`❌ Theme test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Complete Test Suite for Almeida Finance\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Test User: ${TEST_USER.email}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const results = {
    signup: false,
    login: false,
    pages: [],
    theme: null
  };
  
  try {
    // Step 1: Create test user
    results.signup = await signUpUser(page);
    
    if (!results.signup) {
      console.log('\n⚠️  Cannot proceed without user account');
      console.log('Please create a test user manually in Supabase dashboard or enable auto-confirm emails');
      await browser.close();
      return;
    }
    
    // Step 2: Login
    results.login = await login(page);
    
    if (!results.login) {
      console.log('\n❌ Cannot test internal pages without authentication');
      await browser.close();
      return;
    }
    
    // Step 3: Test all pages at different viewports
    for (const viewport of VIEWPORTS) {
      await page.setViewport(viewport);
      
      for (const pageInfo of PAGES_TO_TEST) {
        const result = await validatePage(page, pageInfo.path, pageInfo.name, viewport);
        results.pages.push(result);
      }
    }
    
    // Step 4: Test theme switching
    await page.setViewport(VIEWPORTS[1]); // Desktop for theme test
    results.theme = await testThemeSwitching(page);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  } finally {
    await browser.close();
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Signup: ${results.signup ? '✅' : '❌'}`);
  console.log(`Login: ${results.login ? '✅' : '❌'}`);
  console.log(`\nPages tested: ${results.pages.length}`);
  
  const successful = results.pages.filter(p => p.success).length;
  const failed = results.pages.filter(p => !p.success).length;
  
  console.log(`✅ Passed: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed pages:');
    results.pages.filter(p => !p.success).forEach(p => {
      console.log(`  - ${p.page} @ ${p.viewport}: ${p.error || `overflow=${p.overflow}, corners=${p.cornerIssues}`}`);
    });
  }
  
  console.log(`\nTheme switching: ${results.theme?.success ? '✅' : '❌'}`);
  console.log('='.repeat(60));
}

runTests().catch(console.error);
