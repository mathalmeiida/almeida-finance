// Teste de robustez: página Investimentos deve lidar com casos extremos
console.log('=== TESTE: Robustez Página Investimentos ===\n')

let falhas = 0
function assert(nome, condicao, detalhe = '') {
  if (!condicao) falhas++
  console.log(`${condicao ? '✓' : '✗'} ${nome} ${detalhe}`)
}

console.log('## 1. Verificação de Proteções contra undefined/null\n')

try {
  const fs = await import('fs/promises')
  const conteudo = await fs.readFile('src/pages/Investimentos.jsx', 'utf-8')
  
  // Verificar se há verificação de Array.isArray antes de maps críticos
  const mapInvestimentos = conteudo.match(/investimentos\.map\(/g) || []
  const protecaoInvestimentos = conteudo.match(/Array\.isArray\(investimentos\).*investimentos\.map\(/g) || []
  
  assert('investimentos.map() tem proteção Array.isArray', 
    protecaoInvestimentos.length > 0,
    `(${mapInvestimentos.length} maps, ${protecaoInvestimentos.length} com proteção)`)
  
  // Verificar proteção no gráfico conic-gradient
  const conicGradient = conteudo.match(/conic-gradient.*dist\.map/s)
  const protecaoGrafico = conicGradient && conicGradient[0].includes('dist && dist.length')
  
  assert('Gráfico conic-gradient tem proteção para dist vazio', !!protecaoGrafico)
  
  // Verificar se ultimasMovimentacoes tem fallback
  const ultimasMovs = conteudo.match(/const ultimasMovimentacoes = .*\[\]/s)
  assert('ultimasMovimentacoes tem fallback para array vazio', !!ultimasMovs)
  
  console.log('\n## 2. Verificação de Imports\n')
  
  // Verificar se Upload está importado
  const importLucide = conteudo.match(/import\s+{[^}]+}\s+from\s+['"]lucide-react['"]/)?.[0]
  const temUpload = importLucide?.includes('Upload')
  assert('Upload importado corretamente', temUpload)
  
  // Verificar se todos hooks necessários estão desestruturados
  const hookDestructure = conteudo.match(/const\s+{[^}]+}\s+=\s+useInvestimentos\(\)/s)?.[0]
  const hooksNecessarios = ['investimentos', 'distribuicaoPorCategoria', 'proventosNoMes', 'movsDeInvestimento']
  
  hooksNecessarios.forEach(hook => {
    const temHook = hookDestructure?.includes(hook)
    assert(`Hook "${hook}" desestruturado`, temHook)
  })
  
  console.log('\n## 3. Verificação de Renderização Condicional\n')
  
  // Verificar se há tratamento para carregando
  const temCarregando = conteudo.includes('carregando ?') || conteudo.includes('carregando &&')
  assert('Estado de carregamento tratado', temCarregando)
  
  // Verificar se há tratamento para erro
  const temErro = conteudo.includes('erro &&') || conteudo.includes('erro ?')
  assert('Estado de erro tratado', temErro)
  
  // Verificar se há tratamento para lista vazia
  const temListaVazia = conteudo.includes('investimentos.length === 0')
  assert('Lista vazia de investimentos tratada', temListaVazia)
  
  console.log('\n## 4. Verificação de Operações Seguras\n')
  
  // Verificar se há uso de optional chaining
  const temOptionalChaining = conteudo.match(/\?\./g)?.length || 0
  assert('Uso de optional chaining (?.) presente', temOptionalChaining > 5, 
    `(${temOptionalChaining} ocorrências)`)
  
  // Verificar se há uso de nullish coalescing
  const temNullish = conteudo.match(/\?\?/g)?.length || 0
  assert('Uso de nullish coalescing (??) presente', temNullish > 0,
    `(${temNullish} ocorrências)`)
  
  // Verificar se Number() é usado com fallback
  const numberComFallback = conteudo.match(/Number\([^)]+\)\s*\|\|\s*0/g)?.length || 0
  assert('Number() com fallback para 0', numberComFallback > 10,
    `(${numberComFallback} ocorrências)`)
  
  console.log('\n## 5. Verificação do Hook useInvestimentos\n')
  
  const hookContent = await fs.readFile('src/hooks/useInvestimentos.js', 'utf-8')
  
  // Verificar inicialização de arrays
  const inicializacaoArrays = hookContent.includes('useState([])') && 
                              hookContent.includes('setInvestimentos([])') &&
                              hookContent.includes('setMovimentacoes([])')
  assert('Arrays inicializados corretamente no hook', inicializacaoArrays)
  
  // Verificar se distribuicaoPorCategoria retorna array
  const distRetornaArray = hookContent.match(/distribuicaoPorCategoria.*return\s+\[/s)
  assert('distribuicaoPorCategoria retorna array', !!distRetornaArray)
  
  // Verificar se proventosNoMes está definido e exportado
  const proventosDefinido = hookContent.includes('const proventosNoMes') || 
                            hookContent.includes('proventosNoMes =')
  const proventosExportado = hookContent.match(/return\s+{[^}]*proventosNoMes[^}]*}/s)
  assert('proventosNoMes definido no hook', proventosDefinido)
  assert('proventosNoMes exportado no hook', !!proventosExportado)
  
} catch (err) {
  console.error('\n✗ Erro ao ler arquivos:', err.message)
  falhas++
}

// Resumo
console.log('\n' + '='.repeat(50))
if (falhas === 0) {
  console.log('✓ TODOS OS TESTES PASSARAM')
  console.log('\n✅ Página Investimentos robusta contra erros comuns:')
  console.log('   - Arrays protegidos com Array.isArray()')
  console.log('   - Gráfico com fallback para dist vazio')
  console.log('   - Imports corretos (Upload incluído)')
  console.log('   - Estados de loading/erro tratados')
  console.log('   - Optional chaining e nullish coalescing')
  console.log('   - Hook inicializa arrays corretamente')
  process.exit(0)
} else {
  console.log(`✗ ${falhas} TESTE(S) FALHARAM`)
  console.log('\n⚠️ Correções adicionais podem ser necessárias')
  process.exit(1)
}
