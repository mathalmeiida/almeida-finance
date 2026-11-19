#!/usr/bin/env node
// Auditoria: Cores hardcoded que devem usar tokens do tema

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const PATTERNS_PROBLEMA = [
  /bg-\[#[0-9A-Fa-f]{6}\]/g,
  /text-\[#[0-9A-Fa-f]{6}\]/g,
  /border-\[#[0-9A-Fa-f]{6}\]/g,
  /bg-(blue|indigo|purple|pink|violet|fuchsia|cyan|sky)-\d{3}/g,
  /text-(blue|indigo|purple|pink|violet|fuchsia|cyan|sky)-\d{3}/g,
]

const EXCECOES = [
  'rose-', // Cores de erro/saída podem permanecer
  'red-',  // Cores de alerta
  'green-', // Cores de sucesso
  'emerald-', // Cores de entrada
  'amber-', // Avisos
  'yellow-', // Avisos
]

function ehExcecao(linha) {
  return EXCECOES.some(exc => linha.includes(exc))
}

function auditarArquivo(caminho) {
  const conteudo = readFileSync(caminho, 'utf-8')
  const linhas = conteudo.split('\n')
  const problemas = []
  
  linhas.forEach((linha, idx) => {
    if (ehExcecao(linha)) return
    
    PATTERNS_PROBLEMA.forEach(pattern => {
      const matches = linha.match(pattern)
      if (matches) {
        problemas.push({
          linha: idx + 1,
          codigo: linha.trim().substring(0, 80),
          tipo: pattern.toString()
        })
      }
    })
  })
  
  return problemas
}

function varrerDiretorio(dir, base = '') {
  const itens = readdirSync(dir, { withFileTypes: true })
  let resultados = {}
  
  for (const item of itens) {
    const caminho = join(dir, item.name)
    const relativo = join(base, item.name)
    
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist') {
        resultados = { ...resultados, ...varrerDiretorio(caminho, relativo) }
      }
    } else if (item.name.endsWith('.jsx') || item.name.endsWith('.js')) {
      const problemas = auditarArquivo(caminho)
      if (problemas.length > 0) {
        resultados[relativo] = problemas
      }
    }
  }
  
  return resultados
}

console.log('🔍 AUDITORIA: Cores hardcoded em componentes\n')

const resultados = varrerDiretorio('src')
const totalArquivos = Object.keys(resultados).length
const totalProblemas = Object.values(resultados).reduce((acc, arr) => acc + arr.length, 0)

if (totalProblemas === 0) {
  console.log('✅ Nenhuma cor hardcoded encontrada!\n')
  process.exit(0)
}

console.log(`❌ ${totalProblemas} ocorrências em ${totalArquivos} arquivos:\n`)

Object.entries(resultados).forEach(([arquivo, problemas]) => {
  console.log(`📄 ${arquivo} (${problemas.length} ocorrências)`)
  problemas.slice(0, 3).forEach(p => {
    console.log(`   L${p.linha}: ${p.codigo}`)
  })
  if (problemas.length > 3) {
    console.log(`   ... e mais ${problemas.length - 3} ocorrências`)
  }
  console.log('')
})

console.log('RECOMENDAÇÃO: Usar tokens do tema (bg-marca, text-pri, bg-surface, etc.)')
console.log('Permitido manter: cores funcionais (rose-/red-/green- para erro/sucesso)\n')

process.exit(1)
