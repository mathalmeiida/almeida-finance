export function resumirFicha(d){
  const n=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null
  const receita=n(d.receitas), despesa=n(d.despesas), reserva=n(d.reserva_atual)
  const suficiente=Number(d.qtd_receitas)>0 && Number(d.qtd_despesas)>0 && receita!==null && despesa!==null
  const diferenca=suficiente?Math.round((receita-despesa)*100)/100:null
  return {diferenca,margem:suficiente&&receita>0?100*diferenca/receita:null,cobertura:Number(d.qtd_despesas)>0&&despesa>0&&reserva!==null?reserva/despesa:null,diagnostico:!suficiente?'Dados insuficientes: confira receitas e despesas antes de concluir.':diferenca<0?'As despesas registradas superam as receitas registradas. Investigue compromissos e recorrências.':'Os lançamentos registrados não mostram déficit. Confirme a completude dos dados antes de orientar o cliente.'}
}
