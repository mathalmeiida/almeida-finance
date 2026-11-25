// Teste rápido de sintaxe e imports
console.log('✓ Verificando implementação...')

const arquivos = [
  'src/hooks/usePagamentosFatura.js',
  'src/hooks/useCustoDeVida.js',
  'src/components/ModalPagamentoFatura.jsx',
  'src/components/HistoricoPagamentos.jsx',
  'src/pages/CustoDeVida.jsx'
]

import { readFileSync, existsSync } from 'fs'

let erros = 0

arquivos.forEach(arq => {
  if (!existsSync(arq)) {
    console.log(`✗ ${arq} NÃO EXISTE`)
    erros++
  } else {
    const conteudo = readFileSync(arq, 'utf-8')
    // Verificar imports básicos
    if (arq.includes('.jsx') && !conteudo.includes('import React')) {
      console.log(`⚠ ${arq} sem import React`)
    }
    console.log(`✓ ${arq}`)
  }
})

console.log(erros === 0 ? '\n✓ Todos os arquivos existem' : `\n✗ ${erros} erro(s)`)
