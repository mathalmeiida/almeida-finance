import React, { useEffect, useState } from 'react'
import { MessageCircle, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Tela de autorização de consultoria (visão do CLIENTE) ────────────────────
// Exibida como gate pós-login quando existe uma solicitação de acesso PENDENTE
// direcionada ao cliente. Ele decide: Recusar | Autorizar acesso.
// Enquanto houver solicitação pendente, esta tela aparece antes do app — igual
// ao padrão de "conta desativada". Não altera nenhum dado financeiro.
export default function SolicitacaoConsultoria({ solicitacao, aoResponder, processando }) {
  // Busca o nome do consultor (admin) que solicitou, para a mensagem.
  const [nomeConsultor, setNomeConsultor] = useState('')

  useEffect(() => {
    let vivo = true
    async function buscarNome() {
      const { data } = await supabase
        .from('perfis')
        .select('nome, email')
        .eq('id', solicitacao.consultor_id)
        .single()
      if (vivo) setNomeConsultor(data?.nome || data?.email || 'O consultor')
    }
    buscarNome()
    return () => { vivo = false }
  }, [solicitacao.consultor_id])

  const nome = nomeConsultor || 'O consultor'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle size={28} className="text-blue-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Solicitação de consultoria</h1>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{nome}</strong> solicita autorização para visualizar seus dados
          financeiros durante sua consultoria.
        </p>

        <div className="flex items-start gap-2 text-left bg-gray-100 border border-gray-200 rounded-xl p-3 mb-6">
          <ShieldCheck size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            O acesso é <strong className="text-gray-700">somente leitura</strong>: o consultor
            não pode alterar nada. Você pode <strong className="text-gray-700">revogar</strong> a
            qualquer momento em Configurações.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => aoResponder('recusado')}
            disabled={processando}
            className="btn-secondary flex-1"
          >
            Recusar
          </button>
          <button
            onClick={() => aoResponder('autorizado')}
            disabled={processando}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {processando ? <><Loader2 size={15} className="animate-spin" /> ...</> : 'Autorizar acesso'}
          </button>
        </div>
      </div>
    </div>
  )
}
