// Teste da correção: página Investimentos deve carregar sem erros
console.log('=== TESTE: Página Investimentos ===\n')

let falhas = 0
function assert(nome, condicao, detalhe = '') {
  if (!condicao) falhas++
  console.log(`${condicao ? '✓' : '✗'} ${nome} ${detalhe}`)
}

// 1. Verificar imports do componente
console.log('## 1. Verificação de Imports')

try {
  const fs = await import('fs/promises')
  const conteudo = await fs.readFile('src/pages/Investimentos.jsx', 'utf-8')
  
  // Verificar se Upload está nos imports do lucide-react
  const importLucide = conteudo.match(/import\s+{[^}]+}\s+from\s+['"]lucide-react['"]/)?.[0]
  const temUpload = importLucide?.includes('Upload')
  
  assert('Upload importado do lucide-react', temUpload)
  
  // Verificar se useInvestimentos está importado
  const temUseInvestimentos = conteudo.includes('useInvestimentos')
  assert('useInvestimentos importado', temUseInvestimentos)
  
  // Verificar se proventosNoMes está sendo usado
  const temProventosNoMes = conteudo.includes('proventosNoMes')
  assert('proventosNoMes sendo usado', temProventosNoMes)
  
  console.log('\n## 2. Verificação do Hook useInvestimentos')
  
  const hookContent = await fs.readFile('src/hooks/useInvestimentos.js', 'utf-8')
  
  // Verificar se proventosNoMes está definido no hook
  const hookTemProventosNoMes = hookContent.includes('const proventosNoMes')
  assert('proventosNoMes definido no hook', hookTemProventosNoMes)
  
  // Verificar se proventosNoMes está no return
  const hookExportaProventosNoMes = hookContent.match(/return\s+{[^}]+proventosNoMes[^}]*}/s)
  assert('proventosNoMes exportado no hook', !!hookExportaProventosNoMes)
  
  console.log('\n## 3. Verificação de Sintaxe')
  
  // Verificar se não há JSX malformado
  const jsxProblems = conteudo.match(/<[A-Z][a-zA-Z]*[^>]*>[^<]*(?!<\/)/g)?.filter(m => 
    !m.includes('/>') && !m.includes('children')
  )
  assert('JSX bem formado', !jsxProblems || jsxProblems.length === 0, 
    jsxProblems ? `(${jsxProblems.length} possíveis problemas)` : '')
  
  // Verificar se não há erros comuns
  const temNullUndefined = conteudo.match(/\.\w+\(\)\.map|\.filter\(\)\.map/)
  assert('Sem chamadas encadeadas sem verificação', !temNullUndefined)
  
  console.log('\n## 4. Estrutura do Componente')
  
  // Verificar se o componente principal existe
  const temExportDefault = conteudo.includes('export default function Investimentos')
  assert('Componente principal exportado', temExportDefault)
  
  // Verificar se o hook é chamado no início
  const hookCalledEarly = conteudo.indexOf('useInvestimentos()') < conteudo.indexOf('return (')
  assert('Hook chamado antes do return', hookCalledEarly)
  
} catch (err) {
  console.error('\n✗ Erro ao ler arquivos:', err.message)
  falhas++
}

// Resumo
console.log('\n' + '='.repeat(50))
if (falhas === 0) {
  console.log('✓ TODOS OS TESTES PASSARAM')
  console.log('\n✅ Correção validada: página Investimentos deve funcionar')
  process.exit(0)
} else {
  console.log(`✗ ${falhas} TESTE(S) FALHARAM`)
  process.exit(1)
}
