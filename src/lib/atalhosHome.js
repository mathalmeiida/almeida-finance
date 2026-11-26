// Catálogo e regras de personalização dos atalhos da Home.
export const VERSAO_CONFIG_ATALHOS = 4
export const ATALHOS_DESKTOP = ['gastar-hoje', 'registrar-gasto', 'calendario', 'simular-compra', 'consultoria']
export const CATALOGO_ATALHOS = [
  { id: 'gastar-hoje', label: 'Quanto posso gastar hoje?', modal: 'planejamento' },
  { id: 'registrar-gasto', label: 'Registrar gasto', modal: 'gasto', exigeEscrita: true },
  { id: 'calendario', label: 'Calendário', modal: 'calendario' },
  { id: 'simular-compra', label: 'Posso comprar?', rota: '/posso-comprar' },
  { id: 'consultoria', label: 'Consultoria', rota: '/consultoria' },
  { id: 'receitas', label: 'Receitas', rota: '/receitas' },
  { id: 'investimentos', label: 'Investimentos', rota: '/investimentos' },
  { id: 'despesas', label: 'Despesas', rota: '/despesas' },
  { id: 'cartoes', label: 'Cartões', rota: '/cartoes' },
  { id: 'metas', label: 'Metas', rota: '/metas' },
  { id: 'e-se', label: 'E se...?', rota: '/e-se' },
  { id: 'importacao', label: 'Central de Importação', rota: '/central-importacao', exigeEscrita: true },
  { id: 'parcelamentos', label: 'Parcelamentos', rota: '/despesas?aba=parceladas' },
  { id: 'projecao', label: 'Projeção financeira', rota: '/projecao' },
]
const IDS_VALIDOS = new Set(CATALOGO_ATALHOS.map(a => a.id))
export function configPadraoAtalhos() {
  return { versao: VERSAO_CONFIG_ATALHOS, ordem: CATALOGO_ATALHOS.map(a => a.id), ocultos: [], favoritos: [] }
}
function listaIdsValidos(lista) {
  return Array.isArray(lista) ? [...new Set(lista.filter(id => typeof id === 'string' && IDS_VALIDOS.has(id)))] : []
}
export function normalizarConfigAtalhos(bruto) {
  const base = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {}
  let ordem = listaIdsValidos(base.ordem)
  let ocultos = listaIdsValidos(base.ocultos)
  const favoritos = listaIdsValidos(base.favoritos)
  const versao = Number(base.versao) || 1
  // Migração v4: coloca os cinco atalhos principais primeiro nas configurações antigas.
  // Mantém a ordem relativa dos demais, ocultos e favoritos existentes.
  if (versao < 4) {
    ordem = [...ATALHOS_DESKTOP, ...ordem.filter(id => !ATALHOS_DESKTOP.includes(id))]
  }
  for (const a of CATALOGO_ATALHOS) if (!ordem.includes(a.id)) ordem.push(a.id)
  if (ocultos.length >= CATALOGO_ATALHOS.length) ocultos = ocultos.filter(id => id !== ordem[0])
  return { versao: VERSAO_CONFIG_ATALHOS, ordem, ocultos, favoritos: favoritos.filter(id => !ocultos.includes(id)) }
}
export function atalhosVisiveis(config, { somenteLeitura = false } = {}) {
  const c = normalizarConfigAtalhos(config)
  const porId = Object.fromEntries(CATALOGO_ATALHOS.map(a => [a.id, a]))
  const ocultos = new Set(c.ocultos), favoritos = new Set(c.favoritos)
  const visiveis = c.ordem.filter(id => !ocultos.has(id) && !(somenteLeitura && porId[id].exigeEscrita))
  return [...visiveis.filter(id => favoritos.has(id)), ...visiveis.filter(id => !favoritos.has(id))].map(id => ({ ...porId[id], favorito: favoritos.has(id) }))
}
export function atalhosDesktop(config, opcoes) {
  return atalhosVisiveis(config, opcoes).filter(a => ATALHOS_DESKTOP.includes(a.id))
}
export function moverAtalho(config, id, delta) {
  const c = normalizarConfigAtalhos(config), i = c.ordem.indexOf(id), j = i + delta
  if (!Number.isInteger(j) || i < 0 || j < 0 || j >= c.ordem.length) return c
  const ordem = [...c.ordem]; [ordem[i], ordem[j]] = [ordem[j], ordem[i]]
  return { ...c, ordem }
}
export function reposicionarAtalho(config, id, alvoId) {
  const c = normalizarConfigAtalhos(config), de = c.ordem.indexOf(id), para = c.ordem.indexOf(alvoId)
  if (de < 0 || para < 0 || de === para) return c
  const ordem = [...c.ordem]; ordem.splice(de, 1); ordem.splice(para, 0, id)
  return { ...c, ordem }
}
function alternarNaLista(lista, id) { return lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id] }
export function alternarOcultoAtalho(config, id) {
  const c = normalizarConfigAtalhos(config)
  if (!IDS_VALIDOS.has(id)) return c
  const ocultos = alternarNaLista(c.ocultos, id)
  if (ocultos.length >= CATALOGO_ATALHOS.length) return c
  return { ...c, ocultos, favoritos: ocultos.includes(id) ? c.favoritos.filter(x => x !== id) : c.favoritos }
}
export function alternarFavoritoAtalho(config, id) {
  const c = normalizarConfigAtalhos(config)
  if (!IDS_VALIDOS.has(id)) return c
  const favoritos = alternarNaLista(c.favoritos, id)
  return { ...c, favoritos, ocultos: favoritos.includes(id) ? c.ocultos.filter(x => x !== id) : c.ocultos }
}
export function configsAtalhosIguais(a,b) { return JSON.stringify(normalizarConfigAtalhos(a)) === JSON.stringify(normalizarConfigAtalhos(b)) }
