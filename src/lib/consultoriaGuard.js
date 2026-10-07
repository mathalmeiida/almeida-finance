// Guarda de somente-leitura do Modo Consultoria.
// Chamada no início das funções de ESCRITA dos hooks de dados. Quando o app
// está no modo consultoria (admin visualizando o cliente), qualquer tentativa
// de criar/editar/apagar é bloqueada ANTES de tocar o banco — evitando que uma
// escrita acabe gravada na conta do próprio admin (a RLS não distingue esse
// caso, pois o id usado na escrita é o do admin logado).
export function bloquearSeConsultoria(modoConsultoria) {
  if (modoConsultoria) {
    throw new Error('Modo Consultoria: visualização somente leitura. Edição desativada.')
  }
}
