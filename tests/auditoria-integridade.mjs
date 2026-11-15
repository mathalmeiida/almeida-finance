#!/usr/bin/env node
/**
 * Auditoria de Integridade - Almeida Finance
 * 
 * Valida:
 * - Estrutura de hooks
 * - Consistência de contexts
 * - Rotas da aplicação
 * - Imports de componentes
 * - Padrões de código críticos
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

let errosEncontrados = 0
let avisos = 0

function erro(msg) {
  console.error(`❌ ERRO: ${msg}`)
  errosEncontrados++
}

function aviso(msg) {
  console.warn(`⚠️  AVISO: ${msg}`)
  avisos++
}

function sucesso(msg) {
  console.log(`✅ ${msg}`)
}

// Validar estrutura de hooks
function validarHooks() {
  console.log('\n📋 Validando hooks...')
  const hooksDir = join(ROOT, 'src', 'hooks')
  
  if (!existsSync(hooksDir)) {
    erro('Diretório src/hooks não existe')
    return
  }

  const arquivosHooks = readdirSync(hooksDir).filter(f => f.endsWith('.js'))
  
  if (arquivosHooks.length === 0) {
    erro('Nenhum hook encontrado em src/hooks')
    return
  }

  sucesso(`${arquivosHooks.length} hooks encontrados`)

  // Validar que cada hook exporta uma função
  arquivosHooks.forEach(arquivo => {
    const conteudo = readFileSync(join(hooksDir, arquivo), 'utf-8')
    
    if (!conteudo.includes('export default function') && !conteudo.includes('export function')) {
      aviso(`Hook ${arquivo} pode não ter export padrão`)
    }

    // Verificar se usa useEffect sem dependências
    const linhas = conteudo.split('\n')
    linhas.forEach((linha, idx) => {
      if (linha.includes('useEffect(') && !linha.includes('//')) {
        // Verificar se as próximas linhas têm array de dependências
        const proximasLinhas = linhas.slice(idx, idx + 10).join('\n')
        if (!proximasLinhas.match(/\],?\s*\)/)) {
          aviso(`${arquivo}:${idx + 1} - useEffect sem array de dependências explícito`)
        }
      }
    })
  })
}

// Validar contexts
function validarContexts() {
  console.log('\n📋 Validando contexts...')
  const contextsDir = join(ROOT, 'src', 'contexts')
  
  if (!existsSync(contextsDir)) {
    erro('Diretório src/contexts não existe')
    return
  }

  const arquivosContexts = readdirSync(contextsDir).filter(f => f.endsWith('.jsx'))
  
  if (arquivosContexts.length === 0) {
    erro('Nenhum context encontrado em src/contexts')
    return
  }

  sucesso(`${arquivosContexts.length} contexts encontrados`)

  arquivosContexts.forEach(arquivo => {
    const conteudo = readFileSync(join(contextsDir, arquivo), 'utf-8')
    
    if (!conteudo.includes('createContext')) {
      erro(`Context ${arquivo} não usa createContext`)
    }

    if (!conteudo.includes('Provider')) {
      erro(`Context ${arquivo} não exporta Provider`)
    }
  })
}

// Validar rotas no App.jsx
function validarRotas() {
  console.log('\n📋 Validando rotas...')
  const appPath = join(ROOT, 'src', 'App.jsx')
  
  if (!existsSync(appPath)) {
    erro('App.jsx não encontrado')
    return
  }

  const conteudo = readFileSync(appPath, 'utf-8')
  const rotasEncontradas = (conteudo.match(/<Route/g) || []).length

  if (rotasEncontradas === 0) {
    erro('Nenhuma rota encontrada em App.jsx')
    return
  }

  sucesso(`${rotasEncontradas} rotas encontradas em App.jsx`)

  // Verificar rotas essenciais
  const rotasEssenciais = ['/login', '/dashboard', '/cadastro']
  rotasEssenciais.forEach(rota => {
    if (!conteudo.includes(`path="${rota}"`)) {
      aviso(`Rota essencial ${rota} não encontrada`)
    }
  })
}

// Validar imports de componentes principais
function validarImports() {
  console.log('\n📋 Validando imports principais...')
  const appPath = join(ROOT, 'src', 'App.jsx')
  
  if (!existsSync(appPath)) {
    return
  }

  const conteudo = readFileSync(appPath, 'utf-8')
  
  // Verificar imports essenciais
  const importsEssenciais = [
    'react-router-dom',
    './contexts/AuthContext'
  ]

  importsEssenciais.forEach(imp => {
    if (!conteudo.includes(imp)) {
      aviso(`Import essencial '${imp}' não encontrado em App.jsx`)
    }
  })

  sucesso('Imports principais validados')
}

// Validar estrutura de páginas
function validarPaginas() {
  console.log('\n📋 Validando páginas...')
  const pagesDir = join(ROOT, 'src', 'pages')
  
  if (!existsSync(pagesDir)) {
    erro('Diretório src/pages não existe')
    return
  }

  const arquivosPaginas = readdirSync(pagesDir).filter(f => f.endsWith('.jsx'))
  
  if (arquivosPaginas.length === 0) {
    erro('Nenhuma página encontrada em src/pages')
    return
  }

  sucesso(`${arquivosPaginas.length} páginas encontradas`)

  // Verificar páginas essenciais
  const paginasEssenciais = ['Login.jsx', 'Dashboard.jsx', 'Cadastro.jsx']
  paginasEssenciais.forEach(pagina => {
    if (!arquivosPaginas.includes(pagina)) {
      aviso(`Página essencial ${pagina} não encontrada`)
    }
  })
}

// Validar configuração do Supabase
function validarSupabase() {
  console.log('\n📋 Validando configuração Supabase...')
  const supabasePath = join(ROOT, 'src', 'lib', 'supabase.js')
  
  if (!existsSync(supabasePath)) {
    erro('Arquivo src/lib/supabase.js não encontrado')
    return
  }

  const conteudo = readFileSync(supabasePath, 'utf-8')
  
  if (!conteudo.includes('createClient')) {
    erro('supabase.js não cria cliente Supabase')
    return
  }

  if (conteudo.includes('YOUR_SUPABASE_URL') || conteudo.includes('YOUR_SUPABASE_KEY')) {
    erro('supabase.js contém placeholders de configuração')
    return
  }

  sucesso('Configuração Supabase OK')
}

// Executar todas as validações
console.log('🔍 AUDITORIA DE INTEGRIDADE - Almeida Finance\n')

validarHooks()
validarContexts()
validarRotas()
validarImports()
validarPaginas()
validarSupabase()

// Resultado final
console.log('\n' + '='.repeat(60))
if (errosEncontrados === 0 && avisos === 0) {
  console.log('✅ AUDITORIA CONCLUÍDA: Sistema íntegro, sem problemas detectados')
  process.exit(0)
} else {
  console.log(`⚠️  AUDITORIA CONCLUÍDA: ${errosEncontrados} erro(s), ${avisos} aviso(s)`)
  if (errosEncontrados > 0) {
    console.log('❌ Erros críticos encontrados que precisam de correção')
    process.exit(1)
  } else {
    console.log('✅ Avisos não críticos - sistema operacional')
    process.exit(0)
  }
}
