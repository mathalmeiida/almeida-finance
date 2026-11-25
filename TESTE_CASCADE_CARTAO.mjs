/**
 * TESTE FOCADO - Bug #8: CASCADE de cartão
 * 
 * Valida se ao deletar um cartão, as compras vinculadas são removidas.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

// IMPORTANTE: Usar credenciais de um usuário real existente no DEV
// Ou criar manualmente via UI: https://gxfcfpdwyjqcrfssxgbi.supabase.co
const EMAIL = process.argv[2] || 'teste@example.com'
const SENHA = process.argv[3] || 'senha123'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testar() {
  console.log('\n🧪 TESTE: Bug #8 - CASCADE delete de cartão\n')
  
  try {
    // 1. Login
    console.log(`📧 Login: ${EMAIL}`)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: SENHA
    })
    
    if (authError) {
      console.log(`❌ Login falhou: ${authError.message}`)
      console.log('\n💡 USAGE: node TESTE_CASCADE_CARTAO.mjs email@example.com senha123')
      console.log('💡 Ou criar usuário manualmente no Supabase Dashboard')
      return
    }
    
    const userId = authData.user.id
    console.log(`✅ Autenticado: ${userId.substring(0, 8)}...\n`)
    
    // 2. Cria cartão de teste
    console.log('📝 Criando cartão de teste...')
    const { data: cartao, error: cartaoError } = await supabase
      .from('cartoes')
      .insert([{
        nome: 'Teste CASCADE',
        dia_fechamento: 20,
        dia_vencimento: 28,
        usuario_id: userId
      }])
      .select()
      .single()
    
    if (cartaoError) {
      console.log(`❌ Erro ao criar cartão: ${cartaoError.message}`)
      return
    }
    
    console.log(`✅ Cartão criado: ${cartao.id}\n`)
    
    // 3. Cria 3 compras vinculadas ao cartão
    console.log('🛒 Criando 3 compras vinculadas...')
    const compras = [
      { descricao: 'Compra 1', valor_total: 100 },
      { descricao: 'Compra 2', valor_total: 200 },
      { descricao: 'Compra 3', valor_total: 300 },
    ]
    
    for (const c of compras) {
      await supabase.from('compras_cartao').insert([{
        cartao_id: cartao.id,
        descricao: c.descricao,
        valor_total: c.valor_total,
        numero_parcelas: 1,
        data_compra: '2025-01-24',
        usuario_id: userId
      }])
    }
    
    console.log('✅ 3 compras criadas\n')
    
    // 4. Verifica quantas compras existem ANTES de deletar
    const { data: comprasAntes, error: comprasAntesError } = await supabase
      .from('compras_cartao')
      .select('*')
      .eq('cartao_id', cartao.id)
    
    if (comprasAntesError) {
      console.log(`❌ Erro ao buscar compras: ${comprasAntesError.message}`)
      return
    }
    
    console.log(`📊 Compras ANTES de deletar cartão: ${comprasAntes.length}`)
    
    // 5. Deleta o cartão
    console.log('\n🗑️  Deletando cartão...')
    const { error: deleteError } = await supabase
      .from('cartoes')
      .delete()
      .eq('id', cartao.id)
      .eq('usuario_id', userId)
    
    if (deleteError) {
      console.log(`❌ Erro ao deletar cartão: ${deleteError.message}`)
      return
    }
    
    console.log('✅ Cartão deletado\n')
    
    // 6. Verifica quantas compras existem DEPOIS de deletar
    const { data: comprasDepois, error: comprasDepoisError } = await supabase
      .from('compras_cartao')
      .select('*')
      .eq('cartao_id', cartao.id)
    
    if (comprasDepoisError) {
      console.log(`❌ Erro ao buscar compras: ${comprasDepoisError.message}`)
      return
    }
    
    console.log(`📊 Compras DEPOIS de deletar cartão: ${comprasDepois.length}\n`)
    
    // 7. Resultado
    console.log('═'.repeat(60))
    if (comprasDepois.length === 0) {
      console.log('✅ APROVADO: CASCADE funcionando corretamente')
      console.log('   Compras foram deletadas automaticamente')
    } else {
      console.log(`❌ BUG CONFIRMADO: ${comprasDepois.length} compra(s) órfã(s)`)
      console.log('   CASCADE não está configurado no banco')
      console.log('\n📋 Compras órfãs:')
      comprasDepois.forEach(c => {
        console.log(`   - ${c.descricao}: R$ ${c.valor_total}`)
      })
      
      // Limpa compras órfãs manualmente
      console.log('\n🧹 Limpando compras órfãs...')
      await supabase.from('compras_cartao').delete().eq('cartao_id', cartao.id)
      console.log('✅ Compras órfãs removidas manualmente')
    }
    console.log('═'.repeat(60))
    
    // Logout
    await supabase.auth.signOut()
    
  } catch (err) {
    console.log(`\n💥 ERRO: ${err.message}`)
  }
}

testar()
