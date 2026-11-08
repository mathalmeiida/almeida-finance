// ─── Limites da Importação Inteligente ───────────────────────────────────────
// Valores conservadores para proteger o aparelho do usuário (memória/CPU) e o
// banco (tamanho da gravação). Os mesmos limites de itens são revalidados no
// servidor pela função importacao_confirmar (migration 2026-11).

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024 // 10 MB por arquivo
export const MAXIMO_ARQUIVOS = 5                       // por importação
export const MAXIMO_LINHAS = 5000                      // linhas lidas por arquivo
export const MAXIMO_ITENS_GRAVACAO = 2000              // itens por confirmação
export const MAXIMO_PAGINAS_PDF = 60
export const TEMPO_MAXIMO_MS = 45000                   // processamento por arquivo
// Proteção contra "zip bomb" em XLSX: soma descompactada máxima.
export const MAXIMO_DESCOMPACTADO_BYTES = 60 * 1024 * 1024

export const FORMATOS_ACEITOS = ['pdf', 'csv', 'ofx', 'xls', 'xlsx']
export const EXTENSOES_ACEITAS = '.pdf,.csv,.ofx,.xls,.xlsx,.txt'

export const TIPOS_DOCUMENTO = {
  extrato_bancario: 'Extrato bancário',
  fatura_cartao: 'Fatura de cartão',
  extrato_investimentos: 'Extrato de investimentos',
}

// Retenção do histórico de importações (metadados + vínculos para desfazer).
// Os lançamentos financeiros importados NÃO expiram; só o histórico.
export const RETENCAO_HISTORICO_DIAS = 365
