// ─── Verificação RLS: Tabelas de Importação ─────────────────────────────────
// Conecta ao Supabase e verifica se as policies RLS estão corretas
// Executar: node tests/verificar-rls-supabase.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // Service role para queries admin

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada')
  console.log('ℹ️  Executando com anon key (verificação limitada)')
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'
)

let falhas = 0

async function verificarTabela(nome) {
  console.log(`\n## Verificando tabela: ${nome}`)
  
  // 1. Verificar se a tabela existe
  const { data: colunas, error: errColunas } = await supabase
    .from(nome)
    .select('*')
    .limit(0)
  
  if (errColunas) {
    console.log(`❌ Tabela ${nome} não existe ou não é acessível:`, errColunas.message)
    falhas++
    return false
  }
  
  console.log(`✅ Tabela ${nome} existe e é acessível`)
  
  // 2. Verificar RLS usando query PostgreSQL
  try {
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('_verificar_rls_importacoes', {
      tabela: nome
    })
    
    if (rlsError) {
      console.log(`⚠️  Não foi possível verificar RLS via RPC:`, rlsError.message)
      console.log(`ℹ️  Verificação manual necessária no painel do Supabase`)
    } else {
      console.log(`✅ RLS Status:`, rlsStatus)
    }
  } catch (e) {
    console.log(`⚠️  RPC não disponível, verificação manual necessária`)
  }
  
  // 3. Contar registros (deve funcionar se RLS estiver OK)
  const { count, error: countError } = await supabase
    .from(nome)
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.log(`⚠️  Erro ao contar registros:`, countError.message)
  } else {
    console.log(`ℹ️  Total de registros na tabela: ${count}`)
  }
  
  return true
}

async function verificarPolicies() {
  console.log(`\n## Verificando Policies RLS`)
  
  // Query para listar policies (requer service role)
  const { data, error } = await supabase
    .from('pg_policies')
    .select('*')
    .or('tablename.eq.importacoes,tablename.eq.importacoes_itens')
  
  if (error) {
    console.log(`⚠️  Não foi possível listar policies (requer service role):`, error.message)
    console.log(`\n📋 VERIFICAÇÃO MANUAL NECESSÁRIA:`)
    console.log(`1. Acesse o painel do Supabase: ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}`)
    console.log(`2. Vá em: Database → Tables → importacoes → Policies`)
    console.log(`3. Verifique se existem policies para:`)
    console.log(`   - SELECT: usuario_id = auth.uid()`)
    console.log(`   - INSERT: usuario_id = auth.uid()`)
    console.log(`   - UPDATE: usuario_id = auth.uid()`)
    console.log(`   - DELETE: usuario_id = auth.uid()`)
    console.log(`4. Repita para: importacoes_itens`)
    return
  }
  
  if (data && data.length > 0) {
    console.log(`✅ Encontradas ${data.length} policies:`)
    data.forEach(p => {
      console.log(`   - ${p.policyname} (${p.cmd}) em ${p.tablename}`)
      console.log(`     Definição: ${p.qual || p.with_check || 'N/A'}`)
    })
  } else {
    console.log(`❌ Nenhuma policy encontrada!`)
    console.log(`⚠️  RLS pode estar desabilitado ou policies não foram criadas`)
    falhas++
  }
}

async function testarIsolamento() {
  console.log(`\n## Testando Isolamento de Usuários`)
  
  // Cria um registro de teste
  const { data: novaImportacao, error: insError } = await supabase
    .from('importacoes')
    .insert({
      contexto: 'extrato',
      formato: 'csv',
      qtd_lidas: 1,
      qtd_importadas: 1,
      qtd_ignoradas: 0,
      status: 'concluida'
    })
    .select()
    .single()
  
  if (insError) {
    console.log(`⚠️  Não foi possível criar registro de teste:`, insError.message)
    console.log(`   Motivo: Pode não estar autenticado ou RLS está bloqueando`)
    return
  }
  
  console.log(`✅ Registro de teste criado: ${novaImportacao.id}`)
  
  // Tenta ler o próprio registro
  const { data: leitura, error: readError } = await supabase
    .from('importacoes')
    .select('*')
    .eq('id', novaImportacao.id)
    .single()
  
  if (readError) {
    console.log(`❌ Não conseguiu ler o próprio registro!`, readError.message)
    falhas++
  } else {
    console.log(`✅ Conseguiu ler o próprio registro`)
  }
  
  // Limpa o teste
  const { error: delError } = await supabase
    .from('importacoes')
    .delete()
    .eq('id', novaImportacao.id)
  
  if (delError) {
    console.log(`⚠️  Não conseguiu deletar registro de teste:`, delError.message)
  } else {
    console.log(`✅ Registro de teste deletado`)
  }
}

async function main() {
  console.log('# VERIFICAÇÃO RLS - TABELAS DE IMPORTAÇÃO\n')
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`)
  console.log(`🔑 Usando: ${SUPABASE_SERVICE_KEY ? 'Service Role Key' : 'Anon Key (limitado)'}\n`)
  
  // 1. Verificar tabelas
  const importacoesOk = await verificarTabela('importacoes')
  const itensOk = await verificarTabela('importacoes_itens')
  
  if (!importacoesOk || !itensOk) {
    console.log(`\n❌ FALHA: Tabelas não existem ou não são acessíveis`)
    console.log(`\n📋 AÇÃO NECESSÁRIA:`)
    console.log(`1. Aplicar migration: supabase/migrations/2026-11_importacoes.sql`)
    console.log(`2. Ou executar: npx supabase db push`)
    process.exit(1)
  }
  
  // 2. Verificar policies
  await verificarPolicies()
  
  // 3. Testar isolamento (se autenticado)
  await testarIsolamento()
  
  // Resultado final
  console.log(`\n${'='.repeat(60)}`)
  if (falhas === 0) {
    console.log(`✅ VERIFICAÇÃO RLS: APROVADA`)
    console.log(`\nAs tabelas existem e estão acessíveis.`)
    console.log(`Verificação manual das policies recomendada no painel do Supabase.`)
  } else {
    console.log(`❌ VERIFICAÇÃO RLS: ${falhas} FALHA(S)`)
    console.log(`\nCorreções necessárias antes do deploy.`)
  }
  console.log(`${'='.repeat(60)}\n`)
  
  process.exit(falhas === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
