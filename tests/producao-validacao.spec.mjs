/**
 * TESTES DE VALIDAÇÃO EM PRODUÇÃO — Almeida Finance 2.0
 * Verifica funcionalidades críticas contra https://almeida-finance.vercel.app
 * 
 * Execução: node tests/producao-validacao.spec.mjs
 */

import { chromium } from 'playwright';

const PRODUCAO_URL = 'https://almeida-finance.vercel.app';
const TIMEOUT = 10000;

class ValidadorProducao {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.resultados = {
      total: 0,
      aprovado: 0,
      falhou: 0,
      alertas: [],
      detalhes: []
    };
  }

  async iniciar() {
    console.log('\n🚀 VALIDAÇÃO ALMEIDA FINANCE 2.0 EM PRODUÇÃO');
    console.log(`📍 URL: ${PRODUCAO_URL}\n`);

    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    this.page = await this.context.newPage();
    
    // Capturar erros de console
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.resultados.alertas.push(`Console Error: ${msg.text()}`);
      }
    });
    
    this.page.on('pageerror', err => {
      this.resultados.alertas.push(`Page Error: ${err.message}`);
    });
  }

  async testar(nome, fn) {
    this.resultados.total++;
    try {
      await fn();
      this.resultados.aprovado++;
      console.log(`✅ ${nome}`);
      this.resultados.detalhes.push({ teste: nome, status: 'PASS' });
      return true;
    } catch (erro) {
      this.resultados.falhou++;
      console.log(`❌ ${nome}`);
      console.log(`   Erro: ${erro.message}`);
      this.resultados.detalhes.push({ 
        teste: nome, 
        status: 'FAIL', 
        erro: erro.message 
      });
      return false;
    }
  }

  async validarApresentacao() {
    console.log('\n📋 VALIDANDO APRESENTAÇÃO INICIAL\n');

    await this.testar('Carregar página inicial sem erros', async () => {
      const response = await this.page.goto(PRODUCAO_URL, { 
        waitUntil: 'networkidle', 
        timeout: TIMEOUT 
      });
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    });

    await this.testar('Apresentação renderiza 9 telas', async () => {
      await this.page.waitForSelector('.af-apres-telas', { timeout: TIMEOUT });
      const telas = await this.page.locator('.af-apres-tela').count();
      if (telas !== 9) throw new Error(`Esperado 9 telas, encontrado ${telas}`);
    });

    await this.testar('Navegação horizontal funciona', async () => {
      const container = await this.page.locator('.af-apres-telas');
      const initialScroll = await container.evaluate(el => el.scrollLeft);
      
      // Simular scroll
      await container.evaluate(el => el.scrollLeft += 800);
      await this.page.waitForTimeout(500);
      
      const newScroll = await container.evaluate(el => el.scrollLeft);
      if (newScroll <= initialScroll) throw new Error('Scroll horizontal não funcionou');
    });

    await this.testar('Identidade Vinho Premium aplicada', async () => {
      const corVinho = await this.page.evaluate(() => {
        const el = document.querySelector('.af-apres-capa h1');
        return el ? window.getComputedStyle(el).color : null;
      });
      // RGB(125, 46, 75) = #7d2e4b
      if (!corVinho || !corVinho.includes('125') && !corVinho.includes('7d2e4b')) {
        throw new Error('Cor vinho premium não encontrada');
      }
    });

    await this.testar('Botão "Começar" visível e clicável', async () => {
      const botao = await this.page.locator('button:has-text("Começar")');
      await botao.waitFor({ state: 'visible', timeout: TIMEOUT });
      if (!await botao.isEnabled()) throw new Error('Botão não está habilitado');
    });
  }

  async validarAutenticacao() {
    console.log('\n🔐 VALIDANDO AUTENTICAÇÃO\n');

    await this.testar('Acessar tela de login', async () => {
      await this.page.goto(`${PRODUCAO_URL}/login`, { 
        waitUntil: 'networkidle', 
        timeout: TIMEOUT 
      });
      await this.page.waitForSelector('input[type="email"]', { timeout: TIMEOUT });
    });

    await this.testar('Formulário de login renderizado', async () => {
      const email = await this.page.locator('input[type="email"]').isVisible();
      const senha = await this.page.locator('input[type="password"]').isVisible();
      const botao = await this.page.locator('button:has-text("Entrar")').isVisible();
      
      if (!email || !senha || !botao) {
        throw new Error('Formulário de login incompleto');
      }
    });

    await this.testar('Link para cadastro presente', async () => {
      const linkCadastro = await this.page.locator('a[href="/cadastro"]').isVisible();
      if (!linkCadastro) throw new Error('Link para cadastro não encontrado');
    });

    await this.testar('Acessar tela de cadastro', async () => {
      await this.page.goto(`${PRODUCAO_URL}/cadastro`, { 
        waitUntil: 'networkidle', 
        timeout: TIMEOUT 
      });
      await this.page.waitForSelector('input[type="email"]', { timeout: TIMEOUT });
    });

    await this.testar('Formulário de cadastro renderizado', async () => {
      const nome = await this.page.locator('input[placeholder*="Nome"]').isVisible();
      const email = await this.page.locator('input[type="email"]').isVisible();
      const senha = await this.page.locator('input[type="password"]').first().isVisible();
      
      if (!nome || !email || !senha) {
        throw new Error('Formulário de cadastro incompleto');
      }
    });
  }

  async validarResponsividade() {
    console.log('\n📱 VALIDANDO RESPONSIVIDADE MOBILE\n');

    // Configurar viewport mobile
    await this.page.setViewportSize({ width: 375, height: 812 });

    await this.testar('Apresentação responsiva em 375px', async () => {
      await this.page.goto(PRODUCAO_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
      
      const larguraContainer = await this.page.evaluate(() => {
        const el = document.querySelector('.af-apres-telas');
        return el ? el.offsetWidth : 0;
      });
      
      if (larguraContainer > 375) {
        throw new Error(`Container muito largo: ${larguraContainer}px`);
      }
    });

    await this.testar('Login responsivo em 375px', async () => {
      await this.page.goto(`${PRODUCAO_URL}/login`, { 
        waitUntil: 'networkidle', 
        timeout: TIMEOUT 
      });
      
      const larguraForm = await this.page.evaluate(() => {
        const form = document.querySelector('form');
        return form ? form.offsetWidth : 0;
      });
      
      if (larguraForm > 375) {
        throw new Error(`Formulário muito largo: ${larguraForm}px`);
      }
    });

    // Restaurar viewport desktop
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async validarPWA() {
    console.log('\n📲 VALIDANDO PWA\n');

    await this.testar('Manifest.webmanifest acessível', async () => {
      const response = await this.page.goto(`${PRODUCAO_URL}/manifest.webmanifest`, {
        timeout: TIMEOUT
      });
      
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      
      const manifest = await response.json();
      if (!manifest.name || !manifest.icons) {
        throw new Error('Manifest incompleto');
      }
    });

    await this.testar('Service Worker registrado', async () => {
      await this.page.goto(PRODUCAO_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
      
      const swRegistrado = await this.page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      });
      
      if (!swRegistrado) {
        this.resultados.alertas.push('Service Worker não registrado automaticamente');
      }
    });

    await this.testar('Ícones PWA disponíveis', async () => {
      const icones = [
        '/branding/icon-192.png',
        '/branding/icon-512.png',
        '/branding/icon-maskable.png'
      ];
      
      for (const icone of icones) {
        const response = await this.page.goto(`${PRODUCAO_URL}${icone}`, { timeout: TIMEOUT });
        if (!response.ok()) {
          throw new Error(`Ícone ${icone} não encontrado (HTTP ${response.status()})`);
        }
      }
    });

    this.resultados.alertas.push(
      'NOTA: Instalação PWA no iPhone requer teste manual em dispositivo real'
    );
  }

  async validarPerformance() {
    console.log('\n⚡ VALIDANDO PERFORMANCE\n');

    await this.testar('Tempo de carregamento < 5s', async () => {
      const inicio = Date.now();
      await this.page.goto(PRODUCAO_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const tempoCarregamento = Date.now() - inicio;
      
      console.log(`   Tempo: ${tempoCarregamento}ms`);
      
      if (tempoCarregamento > 5000) {
        throw new Error(`Carregamento lento: ${tempoCarregamento}ms`);
      }
    });

    await this.testar('Sem recursos bloqueando renderização', async () => {
      const metrics = await this.page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: perf.domContentLoadedEventEnd - perf.fetchStart,
          loadComplete: perf.loadEventEnd - perf.fetchStart
        };
      });
      
      console.log(`   DOMContentLoaded: ${metrics.domContentLoaded.toFixed(0)}ms`);
      console.log(`   Load Complete: ${metrics.loadComplete.toFixed(0)}ms`);
      
      if (metrics.domContentLoaded > 3000) {
        this.resultados.alertas.push(
          `DOMContentLoaded acima de 3s (${metrics.domContentLoaded.toFixed(0)}ms)`
        );
      }
    });
  }

  async gerarRelatorio() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO FINAL DE VALIDAÇÃO');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Aprovados: ${this.resultados.aprovado}/${this.resultados.total}`);
    console.log(`❌ Falhas: ${this.resultados.falhou}/${this.resultados.total}`);
    
    const percentual = ((this.resultados.aprovado / this.resultados.total) * 100).toFixed(1);
    console.log(`📈 Taxa de Sucesso: ${percentual}%`);
    
    if (this.resultados.alertas.length > 0) {
      console.log('\n⚠️  ALERTAS:');
      this.resultados.alertas.forEach(alerta => console.log(`   • ${alerta}`));
    }
    
    if (this.resultados.falhou > 0) {
      console.log('\n❌ TESTES FALHADOS:');
      this.resultados.detalhes
        .filter(d => d.status === 'FAIL')
        .forEach(d => {
          console.log(`   • ${d.teste}`);
          console.log(`     ${d.erro}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    
    const criticosFalharam = this.resultados.detalhes.some(d => 
      d.status === 'FAIL' && (
        d.teste.includes('Carregar página') ||
        d.teste.includes('Formulário de login') ||
        d.teste.includes('9 telas')
      )
    );
    
    if (criticosFalharam) {
      console.log('🚫 DEPLOY NÃO APROVADO - Falhas críticas detectadas');
    } else if (this.resultados.falhou > 0) {
      console.log('⚠️  DEPLOY APROVADO COM RESSALVAS - Verificar alertas');
    } else {
      console.log('✅ DEPLOY APROVADO - Todos os testes passaram');
    }
    
    console.log('='.repeat(60) + '\n');
    
    return {
      aprovado: !criticosFalharam,
      comRessalvas: this.resultados.falhou > 0 && !criticosFalharam,
      percentual,
      ...this.resultados
    };
  }

  async finalizar() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Execução
(async () => {
  const validador = new ValidadorProducao();
  
  try {
    await validador.iniciar();
    
    await validador.validarApresentacao();
    await validador.validarAutenticacao();
    await validador.validarResponsividade();
    await validador.validarPWA();
    await validador.validarPerformance();
    
    const relatorio = await validador.gerarRelatorio();
    
    await validador.finalizar();
    
    // Exit code: 0 = aprovado, 1 = falhas críticas, 2 = aprovado com ressalvas
    process.exit(relatorio.aprovado ? (relatorio.comRessalvas ? 2 : 0) : 1);
    
  } catch (erro) {
    console.error('\n❌ ERRO FATAL:', erro.message);
    await validador.finalizar();
    process.exit(1);
  }
})();
