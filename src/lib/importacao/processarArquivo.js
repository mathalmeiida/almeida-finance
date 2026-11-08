// ─── Cliente do Web Worker ───────────────────────────────────────────────────
// Um worker novo por arquivo: ao terminar (ou estourar o tempo), o worker é
// encerrado e a memória com o conteúdo do arquivo é liberada.

import { TEMPO_MAXIMO_MS, TAMANHO_MAXIMO_BYTES } from './limites.js'
import { extensaoDe } from './detectar.js'

const EXTENSOES = ['pdf', 'csv', 'ofx', 'xls', 'xlsx', 'txt']

export function validarArquivoAntes(arquivo) {
  if (!arquivo) return 'Arquivo inválido.'
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) return 'O arquivo ultrapassa o limite de 10 MB.'
  if (!EXTENSOES.includes(extensaoDe(arquivo.name))) return 'Formato não suportado. Envie PDF, CSV, OFX, XLS ou XLSX.'
  return null
}

/**
 * @param {File} arquivo
 * @param {{ tipoDocumento: string, nomeTitular?: string, hoje: string, aoProgresso?: (etapa:string)=>void }} opcoes
 */
export async function processarArquivo(arquivo, opcoes) {
  const erroPrevio = validarArquivoAntes(arquivo)
  if (erroPrevio) { const e = new Error(erroPrevio); e.codigo = 'validacao'; throw e }
  const buffer = await arquivo.arrayBuffer()
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
  const id = Math.random().toString(36).slice(2)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate()
      const e = new Error('O processamento demorou demais e foi interrompido. Tente um arquivo menor ou outro formato (CSV/OFX).')
      e.codigo = 'tempo'
      reject(e)
    }, TEMPO_MAXIMO_MS)

    worker.onmessage = (ev) => {
      const msg = ev.data || {}
      if (msg.id !== id) return
      if (msg.tipo === 'progresso') { opcoes.aoProgresso?.(msg.etapa); return }
      clearTimeout(timer)
      worker.terminate()
      if (msg.tipo === 'ok') resolve(msg.resultado)
      else { const e = new Error(msg.mensagem); e.codigo = msg.codigo; reject(e) }
    }
    worker.onerror = () => {
      clearTimeout(timer)
      worker.terminate()
      const e = new Error('Não foi possível processar o arquivo neste navegador.')
      e.codigo = 'worker'
      reject(e)
    }
    // Transfere o buffer (não copia): a interface deixa de ter o conteúdo.
    worker.postMessage({
      id, buffer, nome: arquivo.name, tipoDocumento: opcoes.tipoDocumento,
      nomeTitular: opcoes.nomeTitular || '', hoje: opcoes.hoje,
    }, [buffer])
  })
}
