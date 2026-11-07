// ─── Reabertura manual do onboarding ("Refazer configuração") ────────────────
// Gatilho usado por Configurações ("Refazer configuração") e pelo card
// "Complete sua configuração" da Home para reabrir o onboarding numa etapa.
//
// O estado fica SÓ EM MEMÓRIA (não persiste). Antes ele era gravado no
// localStorage e, se o usuário fechasse o app no meio do fluxo reaberto, a flag
// ficava gravada para sempre e o onboarding voltava a cada abertura do app —
// mesmo com perfis.onboarding_concluido = true. Agora, ao fechar/atualizar o
// app, a reabertura manual simplesmente deixa de valer.
//
// A decisão de "primeiro acesso" NÃO passa por aqui: ela vem exclusivamente de
// perfis.onboarding_concluido (banco de dados), ver useOnboarding.

const EVENTO = 'almeida-refazer-onboarding'

// Chaves antigas (localStorage) que causavam a reexibição. São removidas no
// boot para não deixar lixo de versões anteriores.
const CHAVES_LEGADAS = ['almeida_refazer_onboarding', 'almeida_onboarding_etapa']

let estado = { ativo: false, etapa: '' }

export function lerRefazerOnboarding() {
  return estado
}

export function abrirRefazerOnboarding(etapa = '') {
  estado = { ativo: true, etapa: etapa || '' }
  try { window.dispatchEvent(new Event(EVENTO)) } catch { /* sem DOM */ }
}

export function encerrarRefazerOnboarding() {
  estado = { ativo: false, etapa: '' }
  try { window.dispatchEvent(new Event(EVENTO)) } catch { /* sem DOM */ }
}

export function ouvirRefazerOnboarding(callback) {
  window.addEventListener(EVENTO, callback)
  return () => window.removeEventListener(EVENTO, callback)
}

export function limparFlagsLegadasOnboarding() {
  try { CHAVES_LEGADAS.forEach(k => localStorage.removeItem(k)) } catch { /* ignora */ }
}
