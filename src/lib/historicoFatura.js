// Caminho controlado para alterar o histórico de faturas já quitadas.
// Funções puras (sem importar o cliente Supabase): o cliente é recebido por parâmetro,
// o que permite testar em node sem rede e sem pacotes.
//
// O banco recusa DML direto em compras/parcelamentos/faturas de uma competência
// quitada com SQLSTATE FP001. O único caminho permitido é a RPC
// alterar_historico_fatura, que exige motivo e grava a auditoria.

export const CODIGO_FATURA_QUITADA = 'FP001'
export const MOTIVO_MIN = 5
export const MOTIVO_MAX = 300

const TABELAS = ['compras_cartao', 'parcelamentos', 'faturas_cartao']
const ACOES = ['editar', 'excluir']

export const MENSAGEM_FATURA_QUITADA =
  'Esta fatura já foi quitada. Para alterar ou excluir um lançamento dela, informe o motivo: a mudança fica registrada no histórico e os pagamentos são preservados.'

/** True quando o erro do Supabase indica fatura quitada (SQLSTATE FP001). */
export function ehErroFaturaQuitada(error) {
  if (!error) return false
  if (error.code === CODIGO_FATURA_QUITADA) return true
  // Alguns drivers só expõem o texto: o HINT da guarda cita a RPC.
  const texto = `${error.message || ''} ${error.hint || ''}`
  return texto.includes('alterar_historico_fatura')
}

/** Valida o motivo e devolve o texto sem espaços nas pontas. Lança Error em português. */
export function validarMotivo(motivo) {
  const m = String(motivo ?? '').trim()
  if (m.length < MOTIVO_MIN) throw new Error(`Informe o motivo da alteração (mínimo de ${MOTIVO_MIN} caracteres).`)
  if (m.length > MOTIVO_MAX) throw new Error(`O motivo deve ter no máximo ${MOTIVO_MAX} caracteres.`)
  return m
}

// Mesma whitelist da RPC (chave desconhecida lá é erro 22023).
export const CAMPOS_EDITAVEIS = {
  compras_cartao: ['descricao', 'valor_total', 'data_compra', 'numero_parcelas', 'categoria_id', 'subcategoria_id', 'cartao_id'],
  parcelamentos: ['descricao', 'valor_total', 'numero_parcelas', 'primeira_parcela', 'categoria_id', 'quitado_em', 'cartao_id'],
  faturas_cartao: ['valor_total'],
}

/** Mantém só os campos que a RPC aceita para a tabela. */
export function filtrarCamposEditaveis(tabela, dados) {
  const permitidos = CAMPOS_EDITAVEIS[tabela] || []
  return Object.fromEntries(Object.entries(dados || {}).filter(([k]) => permitidos.includes(k)))
}

/** Monta os parâmetros da RPC alterar_historico_fatura. Lança Error se algo for inválido. */
export function montarParametrosHistorico({ tabela, id, acao, dados = null, motivo }) {
  if (!TABELAS.includes(tabela)) throw new Error('Tabela não permitida para alteração de histórico.')
  if (!ACOES.includes(acao)) throw new Error('Ação inválida: use editar ou excluir.')
  if (!id) throw new Error('Registro não informado.')
  if (acao === 'editar' && (!dados || typeof dados !== 'object' || Object.keys(dados).length === 0)) {
    throw new Error('Informe os dados a alterar.')
  }
  return {
    p_tabela: tabela,
    p_id: id,
    p_acao: acao,
    p_dados: acao === 'editar' ? dados : {},
    p_motivo: validarMotivo(motivo),
  }
}

/** Chama a RPC. Devolve o jsonb ({ ok, ajustes }) ou lança Error com mensagem amigável. */
export async function alterarHistoricoFatura(supabase, { tabela, id, acao, dados = null, motivo }) {
  const params = montarParametrosHistorico({ tabela, id, acao, dados, motivo })
  const { data, error } = await supabase.rpc('alterar_historico_fatura', params)
  if (error) {
    const err = new Error(error.message || 'Não foi possível alterar o histórico da fatura.')
    err.code = error.code
    throw err
  }
  return data
}

/** Crédito vigente = soma assinada dos lançamentos tipo 'credito' (estorno reduz via novo lançamento credito). */
export function creditoVigente(ajustes) {
  const centavos = (ajustes || [])
    .filter(a => a && a.tipo === 'credito')
    .reduce((acc, a) => acc + Math.round(Number(a.valor || 0) * 100), 0)
  return Math.max(centavos, 0) / 100
}
