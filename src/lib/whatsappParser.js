const normalizar = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const RECEITAS = /\b(recebi|ganhei|entrada|receita|salario|freelance)\b/;
const DESPESAS = /\b(gastei|paguei|comprei|despesa|saiu)\b/;
const CATEGORIAS = {
  receita: { salario: ['salario', 'ordenado', 'holerite'], renda_extra: ['freelance', 'renda extra', 'bico', 'comissao'], investimentos: ['dividendo', 'rendimento', 'juros'] },
  despesa: { alimentacao: ['mercado','supermercado','feira','padaria','acougue','restaurante','lanche','comida','almoco','jantar','alimentacao'], transporte: ['uber','99','taxi','onibus','metro','gasolina','combustivel','estacionamento'], saude: ['farmacia','remedio','medico','consulta','exame','hospital','clinica'], lazer: ['cinema','teatro','show','jogo','parque','viagem','passeio','festa'], educacao: ['escola','curso','livro','material escolar','faculdade','universidade'], moradia: ['aluguel','condominio','luz','agua','gas'], telecomunicacoes: ['internet','telefone','celular'], vestuario: ['roupa','calca','camisa','sapato','tenis'], assinaturas: ['netflix','spotify','assinatura'] }
};
const ROTULOS = {salario:'Salário', renda_extra:'Renda extra', investimentos:'Investimentos', alimentacao:'Alimentação', transporte:'Transporte', saude:'Saúde', lazer:'Lazer', educacao:'Educação', moradia:'Moradia', telecomunicacoes:'Telecomunicações', vestuario:'Vestuário', assinaturas:'Assinaturas', outros:'Outros'};
export const formatarValor = valor => Number(valor).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
export const rotuloCategoria = categoria => ROTULOS[categoria] || categoria || 'Outros';
const falha = erro => ({sucesso:false, erro});
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function numero(s) {
  if (s.includes(',')) return Number(s.replace(/\./g,'').replace(',','.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g,''));
  return Number(s);
}
export function validarMensagem(mensagem) {
  if (typeof mensagem !== 'string' || !mensagem.trim()) return {valida:false,erro:'Mensagem inválida'};
  if (mensagem.trim().length < 5 || mensagem.length > 500) return {valida:false,erro:'Digite entre 5 e 500 caracteres.'};
  return {valida:true};
}
export function parseWhatsAppMessage(mensagem) {
  const v = validarMensagem(mensagem); if (!v.valida) return falha(v.erro);
  let texto = mensagem.trim(); const norm = normalizar(texto);
  if (/\?|\b(quanto|qual|saldo|simule|simular)\b/.test(norm) || /\b(nao|talvez|pretendo|vou|quero)\b/.test(norm)) return falha('Envie um lançamento já realizado. Consultas e intenções de compra ainda não são processadas.');
  const rec = RECEITAS.test(norm), desp = DESPESAS.test(norm);
  // Salário pode aparecer em uma despesa; verbos explícitos prevalecem.
  const verboRec = /\b(recebi|ganhei|entrada|receita)\b/.test(norm);
  if (verboRec && desp) return falha('Envie uma receita ou despesa por mensagem.');
  const tipo = desp ? 'despesa' : rec ? 'receita' : 'despesa';
  let data = hojeBrasil();
  const dataMatch = texto.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (dataMatch) {
    const [,d,m,a] = dataMatch; const ano = a || data.slice(0,4);
    const iso = `${ano}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const dt = new Date(iso+'T12:00:00Z');
    if (!Number.isFinite(dt.getTime()) || dt.toISOString().slice(0,10)!==iso) return falha('Data inválida.');
    data=iso; texto=texto.replace(dataMatch[0],' ');
  } else if (/\bontem\b/.test(norm)) { const dt=new Date(data+'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate()-1); data=dt.toISOString().slice(0,10); }
  const pm = texto.match(/\b(\d+)\s*(?:x\b|parcelas?\b)/i);
  const parcelas = pm ? Number(pm[1]) : null;
  if (parcelas !== null && (parcelas<1 || parcelas>48 || tipo==='receita')) return falha('Parcelamento inválido. Informe de 1 a 48 parcelas para uma despesa.');
  if (pm) texto=texto.replace(pm[0],' ').replace(/\bem\s+(?=no|na|via|$)/gi,' ');
  const pagamento = /\bcredito\b/.test(norm) ? 'cartao_credito' : /\bdebito\b/.test(norm) ? 'cartao_debito' : /\bpix\b/.test(norm) ? 'pix' : /\bdinheiro\b/.test(norm) ? 'dinheiro' : /\bboleto\b/.test(norm) ? 'boleto' : null;
  const familiar = /\b(familia|familiar|conjunta|conjunto|grupo)\b/.test(norm);
  const categoriaExplicita = texto.match(/\bcategoria\s*[:=]?\s*(.+)$/i);
  let categoria = 'outros';
  const base = normalizar(categoriaExplicita?.[1] || texto);
  for (const [key, palavras] of Object.entries(CATEGORIAS[tipo])) {
    if (palavras.some(p=> new RegExp('\\b'+p+'\\b').test(base))) {categoria=key;break;}
  }
  if(categoriaExplicita) texto=texto.replace(categoriaExplicita[0],' ');
  const padrao = /(?:R\$\s*)?\d+(?:[.,]\d+)*(?:\s*reais\b)?/gi;
  const candidatos = [...texto.matchAll(padrao)].filter(m=> !(/[\p{L}\d]/u.test(texto[m.index-1]||'') || /[\p{L}\d]/u.test(texto[m.index+m[0].length]||'')));
  const explicitos = candidatos.filter(m=> /R\$|reais/i.test(m[0]));
  let escolha;
  if(explicitos.length===1) escolha=explicitos[0];
  else if(explicitos.length>1) return falha('Mais de um valor identificado. Envie um lançamento por mensagem.');
  else if(candidatos.length===1) escolha=candidatos[0];
  else return falha(candidatos.length?'Informe o valor com R$ para evitar ambiguidade.':'Não encontrei um valor monetário.');
  if (/-\s*$/.test(texto.slice(0,escolha.index))) return falha('Informe um valor positivo.');
  const valor = numero(escolha[0].replace(/R\$|reais|\s/gi,''));
  if (!Number.isFinite(valor)||valor<=0||valor>999999999||Math.abs(valor*100-Math.round(valor*100))>0.00001) return falha('Valor inválido. Informe um valor positivo com até duas casas decimais.');
  if (/\b(?:cada|por parcela)\b/.test(norm)) return falha('Informe o valor total da compra, não o valor de cada parcela.');
  let descricao=(texto.slice(0,escolha.index)+' '+texto.slice(escolha.index+escolha[0].length))
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrada|receita|despesa|saiu|ontem|hoje)\b/gi,' ')
    .replace(/\b(no pix|via pix|em dinheiro|no cr[eé]dito|no d[eé]bito|no boleto|em|no|na|de|do|da)\s*$/gi,' ')
    .replace(/^\s*(?:(?:de|do|da|no|na|em|com)\s+)+/i,'').trim().replace(/\s+/g,' ');
  descricao = descricao ? descricao[0].toUpperCase()+descricao.slice(1) : rotuloCategoria(categoria);
  return {sucesso:true,transacao:{valor,tipo,categoria,familiar,parcelas:parcelas>1?parcelas:null,descricao,data,forma_pagamento:pagamento,confianca:Math.min(1,0.4+(desp||verboRec?0.3:0)+(categoria!=='outros'?0.2:0)+(explicitos.length?0.1:0))}};
}
export function formatConfirmacao(dados) {
  return `${dados.tipo==='receita'?'💰 Receita':'💸 Despesa'} identificada\n${dados.descricao}\n${formatarValor(dados.valor)}\nCategoria: ${rotuloCategoria(dados.categoria)}${dados.parcelas?`\n${dados.parcelas} parcelas (valor total informado)`:''}\nConfirme os dados antes de registrar.`;
}
