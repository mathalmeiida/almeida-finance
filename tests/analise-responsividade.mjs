// Análise estática de responsividade - verifica padrões no código
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const PAGES_DIR = 'src/pages'

console.log('🔍 Análise estática de responsividade\n')

const problemas = []
const boas = []

// Busca arquivos .jsx em src/pages
const arquivos = readdirSync(PAGES_DIR)
  .filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'))
  .map(f => join(PAGES_DIR, f))

console.log(`📄 Analisando ${arquivos.length} páginas...\n`)

for (const arquivo of arquivos) {
  const nome = arquivo.split(/[/\\]/).pop().replace('.jsx', '')
  const conteudo = readFileSync(arquivo, 'utf-8')
  
  // Verifica padrões bons
  const usaAfContainer = conteudo.includes('af-container')
  const usaMaxW7xl = /max-w-(7xl|6xl|5xl)/.test(conteudo)
  const usaGrid = /grid grid-cols/.test(conteudo)
  const usaResponsive = /md:|lg:|xl:/.test(conteudo)
  
  // Verifica padrões ruins
  const maxWPequeno = /max-w-(xs|sm|md|lg)/.test(conteudo) && !usaAfContainer
  const widthFixo = /className=["'][^"']*\bw-\d{3,}/.test(conteudo)
  
  if (usaAfContainer) {
    boas.push(`✅ ${nome}: usa af-container`)
  } else if (usaMaxW7xl || usaGrid || usaResponsive) {
    boas.push(`✅ ${nome}: estrutura responsiva detectada`)
  } else if (!conteudo.includes('return')) {
    // Arquivo auxiliar, não é página
  } else {
    problemas.push(`⚠️  ${nome}: sem container responsivo evidente`)
  }
  
  if (maxWPequeno) {
    problemas.push(`⚠️  ${nome}: max-w muito pequeno (sm/md/lg)`)
  }
  
  if (widthFixo) {
    problemas.push(`⚠️  ${nome}: largura fixa detectada`)
  }
}

console.log('## Páginas com estrutura responsiva:\n')
boas.slice(0, 15).forEach(b => console.log(b))
if (boas.length > 15) console.log(`... e mais ${boas.length - 15}`)

console.log('\n## Possíveis melhorias:\n')
if (problemas.length === 0) {
  console.log('✅ Nenhum problema evidente detectado')
} else {
  problemas.forEach(p => console.log(p))
}

console.log(`\n📊 Resumo: ${boas.length} OK, ${problemas.length} atenção`)
console.log('\n⚠️  NOTA: Análise estática não substitui testes visuais')
