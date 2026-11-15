import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  console.log('\n🔍 DIAGNÓSTICO INTERATIVO - ALMEIDA FINANCE\n');
  
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const error = msg.text();
      console.log('❌ Console Error:', error);
      errors.push(error);
    }
  });
  
  page.on('pageerror', err => {
    console.log('❌ Page Error:', err.message);
    errors.push(err.message);
  });
  
  console.log('Carregando https://almeida-finance.vercel.app/...\n');
  await page.goto('https://almeida-finance.vercel.app/', { 
    waitUntil: 'networkidle',
    timeout: 15000
  });
  
  // Aguardar React
  console.log('Aguardando React renderizar (5s)...\n');
  await page.waitForTimeout(5000);
  
  // Verificar elementos
  console.log('📋 ELEMENTOS NO DOM:\n');
  
  const checks = [
    { selector: '#root', label: 'Root element' },
    { selector: '.af-apres-telas', label: 'Container apresentação (9 telas)' },
    { selector: '.af-apres-capa', label: 'Capa apresentação' },
    { selector: 'button:has-text("Começar")', label: 'Botão Começar' },
    { selector: 'a[href="/login"]', label: 'Link Login' },
    { selector: 'a[href="/cadastro"]', label: 'Link Cadastro' },
    { selector: 'input[type="email"]', label: 'Campo email' },
  ];
  
  for (const { selector, label } of checks) {
    const count = await page.locator(selector).count();
    const visible = count > 0 ? await page.locator(selector).first().isVisible().catch(() => false) : false;
    const status = visible ? '✅ Visível' : count > 0 ? '⚠️  Existe mas oculto' : '❌ Ausente';
    console.log(`  ${status} ${label}`);
  }
  
  // Estrutura DOM
  console.log('\n🌳 ESTRUTURA DOM (#root):\n');
  const structure = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return { error: 'Root não encontrado' };
    if (root.children.length === 0) return { error: 'Root vazio' };
    
    const first = root.children[0];
    const second = first.children[0];
    
    return {
      root: {
        tag: root.tagName,
        children: root.children.length
      },
      firstChild: {
        tag: first.tagName,
        classes: first.className.split(' ').slice(0, 5).join(' '),
        children: first.children.length
      },
      secondChild: second ? {
        tag: second.tagName,
        classes: second.className.split(' ').slice(0, 5).join(' '),
        text: second.textContent?.substring(0, 80) + '...'
      } : null
    };
  });
  console.log(JSON.stringify(structure, null, 2));
  
  // Verificar roteamento
  console.log('\n🔀 ROTEAMENTO:\n');
  const currentUrl = page.url();
  console.log(`  URL atual: ${currentUrl}`);
  
  // Tentar navegar para login
  console.log('\n📍 Tentando acessar /login...\n');
  await page.goto('https://almeida-finance.vercel.app/login', {
    waitUntil: 'networkidle',
    timeout: 10000
  });
  await page.waitForTimeout(2000);
  
  const loginUrl = page.url();
  console.log(`  URL após navegação: ${loginUrl}`);
  
  const emailInput = await page.locator('input[type="email"]').count();
  console.log(`  Campos email encontrados: ${emailInput}`);
  
  // Resumo erros
  console.log('\n📊 RESUMO DE ERROS:\n');
  if (errors.length === 0) {
    console.log('  ✅ Nenhum erro JavaScript detectado');
  } else {
    console.log(`  ❌ ${errors.length} erros detectados:`);
    errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }
  
  console.log('\n⏰ Aguardando 20 segundos para inspeção manual no DevTools...');
  console.log('   Pressione F12 para abrir o console e verificar erros.\n');
  
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('\n✅ Diagnóstico concluído.\n');
})();
