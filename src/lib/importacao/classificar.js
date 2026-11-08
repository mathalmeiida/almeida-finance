// ─── Classificação automática nas categorias EXISTENTES do app ──────────────
// Ordem de decisão:
//   1. Regras aprendidas do PRÓPRIO usuário (tabela importacao_regras_categoria,
//      isolada por RLS — nunca compartilhada entre usuários).
//   2. Regras padrão por palavra-chave (abaixo).
//   3. Sem correspondência: "Outros" / "Outras receitas" com confiança baixa.
// Cada regra lista nomes de categoria em ordem de preferência; usa-se o
// primeiro que existir na conta (ex.: "Assinaturas" se o usuário criou essa
// categoria; senão "Serviços").

import { normalizarDescricao, chaveAprendizado } from './normalizar.js'

const REGRAS_DESPESA = [
  { re: /\b(UBER EATS|UBEREATS|IFOOD|RAPPI|AIQFOME|ZE DELIVERY|JAMES DELIVERY)\b/, nomes: ['Alimentação'] },
  { re: /\b(SUPERMERCADO|SUPERMERCADOS|MERCADO(?! LIVRE| PAGO)|ATACADAO|ASSAI|CARREFOUR|PAO DE ACUCAR|HORTIFRUTI|SACOLAO|PADARIA|PANIFICADORA|ACOUGUE|RESTAURANTE|LANCHONETE|PIZZARIA|BURGER|MCDONALDS|MC DONALDS|SUBWAY|STARBUCKS|CAFETERIA|EMPORIO|CHURRASCARIA|SUSHI|HABIBS|OUTBACK|BISTRO|MERCEARIA|ATACADISTA|SAMS CLUB|DIA BRASIL|GPA|ST MARCHE|OXXO)\b/, nomes: ['Alimentação'] },
  { re: /\b(NETFLIX|SPOTIFY|DISNEY|HBO|HBOMAX|PRIME VIDEO|AMAZON PRIME|PRIMEVIDEO|GLOBOPLAY|DEEZER|YOUTUBE|YOUTUBEPREMIUM|APPLE COM BILL|ICLOUD|GOOGLE ONE|GOOGLE STORAGE|PARAMOUNT|CRUNCHYROLL|CHATGPT|OPENAI|MICROSOFT 365|ADOBE|DROPBOX|CANVA|STARPLUS|TELECINE|AUDIBLE|KINDLE UNLIMITED)\b/, nomes: ['Assinaturas', 'Serviços', 'Lazer'], fixa: true },
  { re: /\b(UBER|UBR|99APP|99 APP|99 POP|99 TAXI|99TAXI|CABIFY|TAXI|POSTO|AUTO POSTO|SHELL|IPIRANGA|PETROBRAS|BR MANIA|COMBUSTIVEL|COMBUSTIVEIS|GASOLINA|ESTACIONAMENTO|ESTAPAR|SEM PARAR|CONECTCAR|VELOE|PEDAGIO|METRO|METROPOLITANO|BILHETE UNICO|RECARGA BU|LOCALIZA|MOVIDA|UNIDAS|ONIBUS|BUSER|CLICKBUS)\b/, nomes: ['Transporte'] },
  { re: /\b(FARMACIA|DROGARIA|DROGA RAIA|DROGASIL|RAIA|PACHECO|PAGUE MENOS|PANVEL|ULTRAFARMA|HOSPITAL|CLINICA|LABORATORIO|ODONTO|DENTISTA|UNIMED|AMIL|HAPVIDA|SULAMERICA SAUDE|BRADESCO SAUDE|NOTREDAME|FLEURY|DASA|PSICOLOG|FISIOTERAPIA|MEDICO|OTICA)\b/, nomes: ['Saúde'] },
  { re: /\b(ALUGUEL|CONDOMINIO|IPTU|ENERGIA|ELETRICIDADE|ENEL|CEMIG|CPFL|LIGHT SA|COPEL|CELESC|EQUATORIAL|NEOENERGIA|COELBA|ELEKTRO|ENERGISA|SABESP|COPASA|SANEPAR|CEDAE|EMBASA|CAGECE|COMPESA|AGUA E ESGOTO|SANEAMENTO|COMGAS|NATURGY|ULTRAGAZ|LIQUIGAS|SUPERGASBRAS)\b/, nomes: ['Moradia'], fixa: true },
  { re: /\b(VIVO|CLARO|TIM|NET SERVICOS|INTERNET|FIBRA|BRISANET|DESKTOP|ALGAR|SKY|TELEFONICA|OPERADORA)\b/, nomes: ['Internet', 'Serviços'], fixa: true },
  { re: /\b(ESCOLA|COLEGIO|FACULDADE|UNIVERSIDADE|CURSO|CURSOS|UDEMY|ALURA|COURSERA|LIVRARIA|SARAIVA|ESTACIO|ANHANGUERA|UNOPAR|KUMON|IDIOMAS|DUOLINGO)\b/, nomes: ['Educação'] },
  { re: /\b(HOTEL|HOTEIS|POUSADA|AIRBNB|BOOKING|DECOLAR|LATAM|GOL LINHAS|GOL TRANSPORTES|AZUL LINHAS|AZUL VIAGENS|123MILHAS|MAXMILHAS|HURB|PASSAGEM|PASSAGENS|CVC)\b/, nomes: ['Viagem', 'Lazer'] },
  { re: /\b(CINEMA|CINEMARK|KINOPLEX|INGRESSO|INGRESSOS|SYMPLA|EVENTIM|TICKETMASTER|TEATRO|SHOW|STEAM|PLAYSTATION|XBOX|NINTENDO|BAR|PUB|BOATE|PARQUE)\b/, nomes: ['Lazer'] },
  { re: /\b(RENNER|RIACHUELO|C A MODAS|CEA|ZARA|HERING|CENTAURO|NETSHOES|DAFITI|SHEIN|NIKE|ADIDAS|ARAMIS|CALCADOS|SAPATARIA|MARISA|YOUCOM|DECATHLON)\b/, nomes: ['Vestuário'] },
  { re: /\b(PET|PETZ|COBASI|PETLOVE|VETERINARI[AO]|AGROPECUARIA|PET SHOP|PETSHOP)\b/, nomes: ['Pets'] },
  { re: /\b(KABUM|FAST SHOP|FASTSHOP|MAGAZINE LUIZA|MAGALU|CASAS BAHIA|PONTO FRIO|APPLE STORE|SAMSUNG|DELL|LENOVO)\b/, nomes: ['Eletrônicos', 'Outros'] },
  { re: /\b(EMPRESTIMO|FINANCIAMENTO|CONSIGNADO|CREDITO PESSOAL|JUROS|ENCARGOS|MULTA|MORA|ROTATIVO|IOF)\b/, nomes: ['Empréstimos', 'Serviços'] },
  { re: /\b(TARIFA|TAR|CESTA|PACOTE SERVICOS|PACOTE DE SERVICOS|ANUIDADE|SEGURO|SEGUROS|ACADEMIA|SMARTFIT|SMART FIT|BLUEFIT|LAVANDERIA|BARBEARIA|CABELEIREIRO|SALAO|CARTORIO|CORREIOS|DETRAN|DARF|GPS INSS)\b/, nomes: ['Serviços'] },
]

const REGRAS_RECEITA = [
  { re: /\b(13 SALARIO|DECIMO TERCEIRO|13O SALARIO)\b/, nomes: ['13º salário', 'Salário'] },
  { re: /\b(PLR|PARTICIPACAO NOS LUCROS|PARTICIPACAO LUCROS)\b/, nomes: ['PLR', 'Bônus'] },
  { re: /\b(FERIAS)\b/, nomes: ['Férias', 'Salário'] },
  { re: /\b(RESCISAO|RESCISORIO)\b/, nomes: ['Rescisão'] },
  { re: /\b(SALARIO|SALARIOS|FOLHA|FOLHA PAGAMENTO|CRED SALARIO|PROVENTOS|REMUNERACAO|VENCIMENTOS|PAGTO SALARIO)\b/, nomes: ['Salário'] },
  { re: /\b(DIVIDENDO|DIVIDENDOS|JCP|JUROS S CAPITAL|JUROS SOBRE CAPITAL|JRS CAP PROPRIO)\b/, nomes: ['Dividendos / JCP', 'Rendimentos', 'Investimento'] },
  { re: /\b(RENDIMENTO|RENDIMENTOS|REND PAGO|REND APLIC|REMUNERACAO APLICACAO|JUROS POUPANCA|RENDIMENTO POUPANCA)\b/, nomes: ['Rendimentos', 'Investimento'] },
  { re: /\b(REEMBOLSO|ESTORNO|DEVOLUCAO|CASHBACK|RESTITUICAO)\b/, nomes: ['Reembolso', 'Outras receitas'] },
  { re: /\b(ALUGUEL|LOCACAO)\b/, nomes: ['Aluguel recebido'] },
  { re: /\b(SEGURO DESEMPREGO)\b/, nomes: ['Seguro-desemprego'] },
]

const PADRAO_DESPESA = ['Outros']
const PADRAO_RECEITA = ['Outras receitas', 'Renda extra']

function buscarPorNome(categorias, nomes) {
  for (const nome of nomes) {
    const alvo = normalizarDescricao(nome)
    const c = categorias.find(x => normalizarDescricao(x.nome) === alvo)
    if (c) return c
  }
  return null
}

// Índice das regras aprendidas: chave "destino|padrao".
export function indexarRegrasUsuario(regras = []) {
  const mapa = new Map()
  for (const r of regras) mapa.set(`${r.destino}|${r.padrao}`, r)
  return mapa
}

function destinoDaRegra(destino) {
  return destino === 'receitas' ? 'receitas' : destino === 'compras_cartao' ? 'compras_cartao' : 'despesas'
}

/**
 * @param {{ descricao: string, destino: 'despesas'|'receitas'|'compras_cartao' }} item
 * @param {{ categoriasDespesa: object[], categoriasReceita: object[], regrasUsuario?: Map }} ctx
 * @returns {{ categoriaId: string|null, categoriaNome: string|null, confianca: 'alta'|'media'|'baixa', origem: string, fixa: boolean }}
 */
export function classificarItem(item, ctx) {
  const ehReceita = item.destino === 'receitas'
  const categorias = ehReceita ? (ctx.categoriasReceita || []) : (ctx.categoriasDespesa || [])
  const chave = chaveAprendizado(item.descricao)
  const regras = ctx.regrasUsuario

  if (regras && chave) {
    const destino = destinoDaRegra(item.destino)
    let regra = regras.get(`${destino}|${chave}`)
    // Regras de despesa valem também para o cartão (e vice-versa) quando não há específica.
    if (!regra && destino !== 'receitas') regra = regras.get(`${destino === 'despesas' ? 'compras_cartao' : 'despesas'}|${chave}`)
    if (!regra) {
      const primeiro = chave.split(' ')[0]
      if (primeiro.length >= 4) regra = regras.get(`${destino}|${primeiro}`)
    }
    if (regra) {
      const cat = ehReceita
        ? categorias.find(c => c.nome === regra.categoria_nome) || (regra.categoria_nome ? { id: null, nome: regra.categoria_nome } : null)
        : categorias.find(c => c.id === regra.categoria_id)
      if (cat) return { categoriaId: cat.id, categoriaNome: cat.nome, confianca: 'alta', origem: 'aprendida', fixa: false }
    }
  }

  const texto = normalizarDescricao(item.descricao)
  const lista = ehReceita ? REGRAS_RECEITA : REGRAS_DESPESA
  for (const regra of lista) {
    if (regra.re.test(texto)) {
      const cat = buscarPorNome(categorias, regra.nomes)
      if (cat) return { categoriaId: cat.id, categoriaNome: cat.nome, confianca: 'media', origem: 'padrao', fixa: Boolean(regra.fixa) }
    }
  }
  const padrao = buscarPorNome(categorias, ehReceita ? PADRAO_RECEITA : PADRAO_DESPESA)
  return {
    categoriaId: padrao?.id ?? null,
    categoriaNome: padrao?.nome ?? null,
    confianca: 'baixa',
    origem: 'nenhuma',
    fixa: false,
  }
}

// Regras que serão gravadas/reforçadas após a confirmação. Uma por chave.
export function regrasParaAprender(itensConfirmados) {
  const mapa = new Map()
  for (const it of itensConfirmados) {
    if (!['despesas', 'receitas', 'compras_cartao'].includes(it.destino)) continue
    const padrao = chaveAprendizado(it.descricao)
    if (!padrao || padrao.length < 2) continue
    if (it.destino === 'receitas' ? !it.categoriaNome : !it.categoriaId) continue
    mapa.set(`${it.destino}|${padrao}`, {
      destino: it.destino,
      padrao,
      categoria_id: it.destino === 'receitas' ? null : it.categoriaId,
      categoria_nome: it.categoriaNome || null,
    })
  }
  return [...mapa.values()].slice(0, 300)
}
