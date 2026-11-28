import { supabase } from './supabase'
export async function familiaAcao(acao, args = {}) {
  const { data, error } = await supabase.rpc('af_familia_acao', { p_acao: acao, ...args })
  if (error) throw error
  return data
}
export async function empresaAcao(acao, args = {}) {
  const { data, error } = await supabase.rpc('af_empresa_acao', { p_acao: acao, ...args })
  if (error) throw error
  return data
}
export const rotuloPapel = papel => ({ titular:'Titular', admin:'Administrador', membro:'Membro', gestor:'Gestor', colaborador:'Colaborador' })[papel] || 'Membro'
export const mensagemAcesso = erro => {
  if (erro?.code === 'PGRST202' || erro?.code === '42P01' || erro?.code === '42883') return 'O ambiente ainda não possui a atualização de acessos. Confirme as migrations no Supabase DEV.'
  return erro?.message || (typeof erro === 'string' ? erro : 'Não foi possível concluir a operação.')
}
