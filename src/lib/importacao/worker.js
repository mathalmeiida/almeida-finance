// ─── Web Worker da Importação Inteligente ───────────────────────────────────
// Processa o arquivo FORA da thread da interface: o conteúdo não tem acesso ao
// DOM, à sessão nem ao Supabase. O arquivo só existe na memória deste worker,
// que é encerrado ao fim de cada processamento (ou por tempo limite).
// Nada do conteúdo é registrado em console/logs.

import { extrairDocumento } from './motor.js'

let pdfjsCarregado = null

function carregarPdfjs() {
  if (!pdfjsCarregado) {
    pdfjsCarregado = (async () => {
      // Registra o "worker" do pdf.js na própria thread deste Web Worker
      // (evita criar um worker aninhado, pouco suportado no iOS).
      const nucleo = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
      globalThis.pdfjsWorker = nucleo
      return import('pdfjs-dist/legacy/build/pdf.mjs')
    })()
  }
  return pdfjsCarregado
}

self.onmessage = async (evento) => {
  const { id, buffer, nome, tipoDocumento, nomeTitular, hoje } = evento.data || {}
  try {
    const resultado = await extrairDocumento(
      { bytes: new Uint8Array(buffer), nome, tipoDocumento, nomeTitular, hoje },
      { carregarPdfjs, progresso: etapa => self.postMessage({ id, tipo: 'progresso', etapa }) },
    )
    self.postMessage({ id, tipo: 'ok', resultado })
  } catch (erro) {
    // Só mensagens próprias (ErroImportacao) chegam à tela; erros internos
    // viram uma mensagem genérica, sem detalhes do conteúdo do arquivo.
    const conhecido = erro && erro.name === 'ErroImportacao'
    self.postMessage({
      id,
      tipo: 'erro',
      codigo: conhecido ? erro.codigo : 'interno',
      mensagem: conhecido ? erro.message : 'Não foi possível processar o arquivo. Verifique se ele não está corrompido.',
    })
  }
}
