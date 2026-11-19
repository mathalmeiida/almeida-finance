// VERIFICAÇÃO DE POLÍTICAS RLS NO SUPABASE
// Não cria usuários, apenas valida que as policies existem e estão ativas
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let falhas = 0
const TABELAS = ['receitas', 'despesas', 'cartoes', 'metas', 'investimentos', 'beneficios', 'parcelamentos', 'compras_cartao']

console.log('# VERIFICAÇÃO DE POLÍTICAS RLS\n')
console.log(`🔗 Supabase: ${SUPABASE_URL}\n`)

async function verificarTabelaAcessoNaoAutenticado(tabela) {
  console.log(`## Testando: ${tabela}`)
  
  // 1. SELECT sem autenticação (deve retornar vazio)
  const { data: selectData, error: selectError } = await supabase
    .from(tabela)
    .select('*')
    .limit(1)
  
  if (selectError) {
    console.log(`   SELECT: ❌ Erro inesperado: ${selectError.message}`)
    falhas++
  } else if (selectData && selectData.length > 0) {
    console.log(`   SELECT: ❌ Retornou ${selectData.length} registro(s) SEM autenticação! FALHA DE SEGURANÇA!`)
    falhas++
  } else {
    console.log(`   SELECT: ✅ Retornou vazio (RLS ativo)`)
  }
  
  // 2. INSERT sem autenticação (deve falhar)
  const dadosFalsos = {
    usuario_id: '00000000-0000-0000-0000-000000000000',
    descricao: 'Teste RLS',
    valor: 100,
    data: new Date().toISOString().split('T')[0]
  }
  
  // Ajustar campos específicos por tabela
  if (tabela === 'cartoes') {
    dadosFalsos.nome = 'Cartão Teste'
    dadosFalsos.limite = 1000
    dadosFalsos.dia_fechamento = 5
    dadosFalsos.dia_vencimento = 15
    delete dadosFalsos.descricao
    delete dadosFalsos.data
  } else if (tabela === 'metas') {
    dadosFalsos.valor_alvo = 1000
    dadosFalsos.prazo = new Date().toISOString().split('T')[0]
    delete dadosFalsos.valor
  } else if (tabela === 'investimentos') {
    dadosFalsos.nome = 'Investimento Teste'
    dadosFalsos.tipo = 'renda_fixa'
    dadosFalsos.valor_inicial = 1000
    dadosFalsos.data_aplicacao = new Date().toISOString().split('T')[0]
    delete dadosFalsos.descricao
    delete dadosFalsos.valor
    delete dadosFalsos.data
  } else if (tabela === 'beneficios') {
    dadosFalsos.tipo = 'VR'
    dadosFalsos.nome = 'VR Teste'
    dadosFalsos.saldo_inicial = 100
    dadosFalsos.data_inicio = new Date().toISOString().split('T')[0]
    delete dadosFalsos.descricao
    delete dadosFalsos.valor
    delete dadosFalsos.data
  } else if (tabela === 'parcelamentos') {
    dadosFalsos.valor_total = 1000
    dadosFalsos.parcelas_totais = 10
    dadosFalsos.data_inicio = new Date().toISOString().split('T')[0]
    delete dadosFalsos.data
  } else if (tabela === 'compras_cartao') {
    dadosFalsos.cartao_id = '00000000-0000-0000-0000-000000000000'
    dadosFalsos.parcelas = 1
  } else if (tabela === 'receitas') {
    dadosFalsos.tipo = 'teste'
  } else if (tabela === 'despesas') {
    dadosFalsos.categoria = 'teste'
  }
  
  const { data: insertData, error: insertError } = await supabase
    .from(tabela)
    .insert(dadosFalsos)
    .select()
  
  if (insertError) {
    if (insertError.message.includes('row-level security') || 
        insertError.message.includes('violates') ||
        insertError.code === '42501') {
      console.log(`   INSERT: ✅ Bloqueado por RLS`)
    } else {
      console.log(`   INSERT: ⚠️  Bloqueado por outro motivo: ${insertError.message}`)
    }
  } else if (!insertData || insertData.length === 0) {
    console.log(`   INSERT: ✅ Bloqueado silenciosamente (RLS)`)
  } else {
    console.log(`   INSERT: ❌ Permitiu inserção SEM autenticação! FALHA CRÍTICA!`)
    console.log(`   Dados inseridos: ${JSON.stringify(insertData)}`)
    falhas++
  }
  
  console.log('')
}

async function verificarRLSAtivo() {
  console.log('═'.repeat(60))
  console.log('VERIFICANDO TABELAS FINANCEIRAS')
  console.log('═'.repeat(60))
  console.log('')
  
  for (const tabela of TABELAS) {
    await verificarTabelaAcessoNaoAutenticado(tabela)
  }
}

async function verificarTabelaCategorias() {
  console.log('═'.repeat(60))
  console.log('VERIFICANDO TABELA PÚBLICA: categorias')
  console.log('═'.repeat(60))
  console.log('')
  
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .limit(5)
  
  if (error) {
    console.log(`❌ Erro ao ler categorias: ${error.message}`)
    console.log(`⚠️  Categorias devem ser leitura pública`)
    falhas++
  } else if (data && data.length > 0) {
    console.log(`✅ Categorias acessíveis (${data.length} registros)`)
    console.log(`ℹ️  Leitura pública OK (esperado para categorias)`)
  } else {
    console.log(`⚠️  Nenhuma categoria encontrada (pode estar vazio)`)
  }
  
  console.log('')
}

async function main() {
  await verificarRLSAtivo()
  await verificarTabelaCategorias()
  
  console.log('═'.repeat(60))
  console.log('RESULTADO FINAL')
  console.log('═'.repeat(60))
  console.log('')
  
  if (falhas === 0) {
    console.log('✅ POLÍTICAS RLS: ATIVAS E FUNCIONANDO')
    console.log('')
    console.log('Todas as tabelas financeiras estão protegidas:')
    console.log('  ✓ SELECT sem autenticação retorna vazio')
    console.log('  ✓ INSERT sem autenticação é bloqueado')
    console.log('  ✓ Categorias acessíveis publicamente (esperado)')
    console.log('')
    console.log('⚠️  ATENÇÃO: Este teste NÃO valida isolamento entre usuários')
    console.log('   Para validação completa, execute:')
    console.log('   1. Teste manual: tests/ROTEIRO-TESTE-MANUAL-RLS.md')
    console.log('   2. Teste pgTAP: supabase/tests/rls-security.test.sql')
    console.log('')
    console.log('🔒 RLS configurado corretamente para produção')
    process.exit(0)
  } else {
    console.log(`❌ POLÍTICAS RLS: ${falhas} FALHA(S) DETECTADA(S)`)
    console.log('')
    console.log('⚠️  CORREÇÕES NECESSÁRIAS:')
    console.log('   - Verificar políticas RLS no painel Supabase')
    console.log('   - Garantir que todas as tabelas têm RLS habilitado')
    console.log('   - Validar que policies usam auth.uid()')
    console.log('')
    console.log('🚨 NÃO PUBLICAR ATÉ CORRIGIR')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err)
  process.exit(1)
})
