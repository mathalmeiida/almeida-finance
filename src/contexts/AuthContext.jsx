import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

import { supabase } from '../lib/supabase'



// Contexto que disponibiliza o usuário atual para todo o app
const AuthContext = createContext(null)



export function AuthProvider({ children }) {

  const [usuario, setUsuario] = useState(undefined) // undefined = ainda verificando
  const [perfil, setPerfil] = useState(null)

  const [carregando, setCarregando] = useState(true)

  const [erroCarregamento, setErroCarregamento] = useState(null) // {tipo, mensagem}
  // Guarda o ID do usuário atual para comparar entre eventos de auth sem
  // depender da referência do objeto (que muda em cada TOKEN_REFRESHED).
  const usuarioIdRef = useRef(null)

  const montadoRef = useRef(true)



  useEffect(() => {

    console.log('[AuthContext] Estado:', {

      carregando,

      temUsuario: !!usuario,

      temPerfil: !!perfil,

      erroCarregamento: erroCarregamento?.tipo

    })

  }, [carregando, usuario, perfil, erroCarregamento])



  // ── Modo Consultoria (somente leitura) ──────────────────────────────────────
  // Quando o admin (consultor) ativa "Visualizar como cliente", guardamos aqui
  // o alvo { id, nome }. Enquanto houver alvo, o app opera em modo consultoria:
  //  - idEfetivo passa a ser o id do CLIENTE (as LEITURAS financeiras usam ele);
  //  - perfilEfetivo passa a ser o perfil do CLIENTE (nome, reserva, saldo_base);
  //  - a UI entra em somente-leitura (botões de criar/editar ficam ocultos).
  // A segurança real está no banco: a RLS só devolve os dados do cliente se
  // existir uma autorização ('autorizado') — ver migration consultoria_acessos.
  const [consultoriaAlvo, setConsultoriaAlvo] = useState(null) // { id, nome } | null
  const [perfilCliente, setPerfilCliente] = useState(null)



  // Busca o perfil complementar do usuário na tabela "perfis"
  // Retorna: { sucesso: boolean, erro?: {tipo, mensagem} }
  async function buscarPerfil(userId) {

    const inicio = Date.now()

    console.log('[buscarPerfil] Iniciando para userId:', userId?.substring(0, 8))



    try {

      const { data, error } = await supabase

        .from('perfis')

        .select('*')

        .eq('id', userId)

        .single()



      const duracao = Date.now() - inicio

      console.log(`[buscarPerfil] Query concluída em ${duracao}ms`, { 

        temData: !!data, 

        dataIsNull: data === null,

        dataIsUndefined: data === undefined,

        dataKeys: data ? Object.keys(data) : 'N/A',

        temError: !!error, 

        errorCode: error?.code 

      })



      // Verifica se o componente ainda está montado antes de atualizar estado
      if (!montadoRef.current) {

        console.log('[buscarPerfil] Componente desmontado, ignorando resultado')

        return { sucesso: false }

      }



      if (error) {

        // Perfil não existe no banco (usuário novo sem perfil criado pelo trigger)
        if (error.code === 'PGRST116') {

          console.warn('Perfil não encontrado para usuário:', userId)

          return {

            sucesso: false,

            erro: {

              tipo: 'perfil_nao_encontrado',

              mensagem: 'Perfil não encontrado. Entre em contato com o suporte.'

            }

          }

        }



        // Erro de permissão RLS
        if (error.code === '42501' || error.message?.includes('permission')) {

          console.error('Erro de permissão RLS:', error)

          return {

            sucesso: false,

            erro: {

              tipo: 'permissao',

              mensagem: 'Sem permissão para acessar o perfil.'

            }

          }

        }



        // Outros erros do banco
        console.error('Erro ao buscar perfil:', error)

        return {

          sucesso: false,

          erro: {

            tipo: 'banco',

            mensagem: 'Erro ao carregar perfil. Tente novamente.'

          }

        }

      }



      // Sucesso: perfil carregado
      if (montadoRef.current) {

        setPerfil(data)

      } else {

        console.warn('[buscarPerfil] Componente desmontado antes de setPerfil, ignorando')

      }

      return { sucesso: true }



    } catch (err) {

      // Erro de rede, timeout, Supabase indisponível
      console.error('Erro de conexão ao carregar perfil:', err)



      if (!montadoRef.current) return { sucesso: false }



      return {

        sucesso: false,

        erro: {

          tipo: 'rede',

          mensagem: 'Não foi possível conectar ao servidor. Verifique sua conexão.'

        }

      }

    }

  }



  // Recarrega o perfil do usuário atual (útil após atualizar foto/avatar)
  async function recarregarPerfil() {

    if (!usuario?.id) return

    await buscarPerfil(usuario.id)

  }



  // ── Cor da marca (Aparência: Azul padrão / Rosa) ────────────────────────────
  // FONTE DA PREFERÊNCIA de cor do tema (robusta, sem depender da migration):
  //   1) localStorage 'almeida_cor_tema' → aplica JÁ no boot (antes do perfil
  //      carregar), inclusive em login/onboarding, sem flash.
  //   2) perfis.cor_tema → quando a coluna existir, sincroniza entre
  //      dispositivos. Se a coluna NÃO existir, o app funciona só com o
  //      localStorage (não quebra).
  // Aparência: 3 modos fixos — claro (padrão), escuro, automático.
  // A cor de marca é sempre vinho. Temas antigos salvos são aceitos como aliases
  // para 'claro' (preservam experiência sem quebrar).
  const CHAVE_COR_TEMA = 'almeida_cor_tema'

  const MODOS_APARENCIA = ['claro', 'escuro', 'automatico']

  // Normaliza modo: modos válidos passam; legados (vinho, roxo, etc.) → 'claro'
  const normalizarCor = (c) => {

    if (MODOS_APARENCIA.includes(c)) return c

    return 'claro'

  }

  const [corTemaLocal, setCorTemaLocal] = useState(() => {

    try { return normalizarCor(localStorage.getItem(CHAVE_COR_TEMA)) }

    catch { return 'claro' }

  })



  // Preferência efetiva:
  // 1) Se o banco tem um modo válido (claro/escuro/automatico) → usa ele.
  // 2) Senão → usa localStorage (preserva escolha feita na sessão atual).
  // 3) Valores legados no banco (vinho, roxo…) → ignora banco, usa localStorage.
  // Isso evita que um cor_tema legado no banco sobrescreva a preferência atual.
  const corTema = (() => {

    const dosBanco = perfil?.cor_tema

    if (MODOS_APARENCIA.includes(dosBanco)) return dosBanco

    return corTemaLocal

  })()



  // Aplica a classe de tema no <html>.
  // 'claro' = sem classe (padrão). 'escuro' = .tema-escuro. 'automatico' = .tema-automatico.
  useEffect(() => {

    try {

      const el = document.documentElement

      el.classList.remove('tema-escuro', 'tema-automatico',

        // limpeza de classes legadas
        'tema-vinho','tema-roxo','tema-azul','tema-rosa','tema-vermelho',

        'tema-verde','tema-laranja','tema-preto')

      if (corTema === 'escuro')     el.classList.add('tema-escuro')

      else if (corTema === 'automatico') el.classList.add('tema-automatico')

      // 'claro' = sem classe adicional
    } catch { /* sem DOM */ }

  }, [corTema])



  // Quando o perfil chega do banco com um modo válido, espelha no localStorage
  // para o próximo boot já aplicar antes do perfil carregar.
  useEffect(() => {

    const dosBanco = perfil?.cor_tema

    if (MODOS_APARENCIA.includes(dosBanco)) {

      try { localStorage.setItem(CHAVE_COR_TEMA, dosBanco) } catch { /* ignora */ }

      setCorTemaLocal(dosBanco)

    }

    // Se o banco tem valor legado, NÃO sobrescreve o localStorage —
    // mantém a escolha mais recente do usuário.
  }, [perfil?.cor_tema])



  useEffect(() => {

    montadoRef.current = true



    console.log('[AuthContext] Iniciando verificação de sessão...')



    // 1. Verifica se já existe uma sessão ativa ao carregar o app
    supabase.auth.getSession().then(async ({ data: { session } }) => {

      console.log('[AuthContext] getSession concluído:', { temSessao: !!session })



      const user = session?.user ?? null

      usuarioIdRef.current = user ? user.id : null



      if (!montadoRef.current) return



      setUsuario(user)



      if (user) {

        console.log('[AuthContext] Buscando perfil para userId:', user.id.substring(0, 8))

        const resultado = await buscarPerfil(user.id)



        console.log('[AuthContext] buscarPerfil resultado:', resultado.sucesso ? 'sucesso' : `erro: ${resultado.erro?.tipo}`)



        if (!montadoRef.current) return



        if (!resultado.sucesso && resultado.erro) {

          setErroCarregamento(resultado.erro)

        }

      }



      console.log('[AuthContext] Definindo carregando = false')

      setCarregando(false)

    }).catch(err => {

      console.error('[AuthContext] Erro em getSession:', err)

      setCarregando(false)

    })



    // 2. Escuta mudanças de autenticação (login, logout, expiração de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(

      (_event, session) => {

        console.log('[AuthContext] onAuthStateChange:', _event, { temSessao: !!session })



        const user = session?.user ?? null

        const idAnterior = usuarioIdRef.current

        const idNovo = user ? user.id : null

        const mudouUsuario = idAnterior !== idNovo

        usuarioIdRef.current = idNovo



        if (!montadoRef.current) return



        if (mudouUsuario) {

          console.log('[AuthContext] Usuário mudou de', idAnterior?.substring(0,8), 'para', idNovo?.substring(0,8))

          setUsuario(user)

          setErroCarregamento(null)



          if (user) {

            console.log('[AuthContext] Buscando perfil (callback)')

            // Executa buscarPerfil fora do callback para evitar deadlock
            buscarPerfil(user.id).then(resultado => {

              console.log('[AuthContext] buscarPerfil (callback) resultado:', resultado.sucesso ? 'sucesso' : `erro: ${resultado.erro?.tipo}`)



              if (!montadoRef.current) return



              if (!resultado.sucesso && resultado.erro) {

                setErroCarregamento(resultado.erro)

              }



              // Só agora finaliza o loading após perfil carregar
              setCarregando(false)

            })

          } else {

            setPerfil(null)

            setCarregando(false)

          }

        } else {

          // Se o id não mudou (ex.: refresh de token), mantém o objeto `usuario`
          // atual intacto — nenhum efeito dependente é re-disparado.
          // NÃO altera carregando neste caso (getSession já controlou)
          console.log('[AuthContext] Token refresh, mantendo estado')

        }

      }

    )



    // 3. Safari/iOS restaura páginas do cache de navegação (bfcache) ao tocar em
    // "Voltar", inclusive a área autenticada exibida antes do logout. Ao voltar
    // de um cache sem sessão válida, recarrega para o guard de rotas decidir.
    function aoReexibirPagina(ev) {

      if (!ev.persisted) return

      supabase.auth.getSession().then(({ data: { session } }) => {

        if (!session && usuarioIdRef.current) window.location.reload()

      })

    }

    window.addEventListener('pageshow', aoReexibirPagina)



    return () => {

      montadoRef.current = false

      subscription.unsubscribe()

      window.removeEventListener('pageshow', aoReexibirPagina)

    }

  }, [])



  // Cadastro com e-mail e senha
  async function cadastrar({ nome, email, senha }) {

    const { data, error } = await supabase.auth.signUp({

      email,

      password: senha,

      options: {

        data: { nome }, // enviado ao trigger que cria o perfil
        // Para onde o link "Confirmar cadastro" do e-mail deve voltar. Usa a
        // origem atual (produção na Vercel ou localhost) + a rota de callback,
        // que processa o retorno na MESMA aba. Esta URL precisa estar liberada
        // em Authentication → URL Configuration → Redirect URLs no Supabase.
        emailRedirectTo: `${window.location.origin}/auth/callback`,

      },

    })

    if (error) throw error

    return data

  }



  // Login com e-mail e senha
  async function entrar({ email, senha }) {

    const { data, error } = await supabase.auth.signInWithPassword({

      email,

      password: senha,

    })

    if (error) throw error

    return data

  }



  // Logout
  async function sair() {

    const { error } = await supabase.auth.signOut()

    if (error) throw error

  }



  // Envia e-mail de redefinição de senha. O link leva de volta ao app em /redefinir-senha.
  async function solicitarRecuperacaoSenha(email) {

    const { error } = await supabase.auth.resetPasswordForEmail(email, {

      redirectTo: `${window.location.origin}/redefinir-senha`,

    })

    if (error) throw error

  }



  // Define a nova senha (usado na sessão de recuperação aberta pelo link do e-mail)
  async function redefinirSenha(novaSenha) {

    const { error } = await supabase.auth.updateUser({ password: novaSenha })

    if (error) throw error

  }



  // Atualiza preferências de limite no perfil (modo e/ou valor manual).
  // Aceita um objeto com qualquer um dos campos: { limite_diario, modo_limite, saldo_base, etc }
  // 
  // PRINCÍPIO: Esta função atualiza APENAS preferências financeiras.
  // NÃO gerencia nem modifica o status de onboarding_concluido.
  // 
  // Atualiza somente os campos solicitados e sincroniza o horário do saldo retornado pelo banco.
  async function atualizarPreferenciasLimite(campos) {

    if (!usuario) throw new Error('Usuário não autenticado.')

    // No modo consultoria o app está em somente leitura: não grava preferências
    // (evitaria escrever no perfil do próprio admin e corromper a exibição).
    if (consultoriaAlvo) {

      throw new Error('Modo Consultoria: visualização somente leitura. Edição desativada.')

    }



    // IMPORTANTE: Removemos explicitamente onboarding_concluido dos campos
    // para garantir que esta função NUNCA altere o status de onboarding.
    // Isso mantém separação clara de responsabilidades.
    const { onboarding_concluido, ...camposFinanceiros } = campos



    // Se alguém tentar passar onboarding_concluido, ignoramos e alertamos
    if (campos.hasOwnProperty('onboarding_concluido')) {

      console.warn(

        '[AuthContext] atualizarPreferenciasLimite: onboarding_concluido foi removido dos campos.',

        'Use marcarOnboardingConcluido() para alterar o status de onboarding.'

      )

    }



    // A resposta do banco inclui o horário gravado pelo trigger.
    const { data, error } = await supabase
      .from('perfis')
      .update(camposFinanceiros)
      .eq('id', usuario.id)
      .select('*')
      .single()

    if (error) throw error
    const atualizados = Object.fromEntries(Object.keys(camposFinanceiros).map(k => [k, data[k]]))
    if (Object.prototype.hasOwnProperty.call(data, 'saldo_base_atualizado_em')) {
      atualizados.saldo_base_atualizado_em = data.saldo_base_atualizado_em
    }
    setPerfil(p => p && p.id === usuario.id ? { ...p, ...atualizados } : p)
    return atualizados

  }



  // Mantida por compatibilidade: salva apenas o valor manual
  async function atualizarLimiteDiario(valor) {

    return atualizarPreferenciasLimite({ limite_diario: valor })

  }



  // Salva a cor de marca (Aparência) do PRÓPRIO usuário logado. Atualização
  // otimista: aplica no perfil local na hora (a classe de tema reage pelo
  // efeito acima) e persiste no banco. Não depende do modo consultoria — é
  // sempre o perfil real do logado. É só identidade visual.
  async function atualizarCorTema(cor) {

    const novaCor = normalizarCor(cor)

    // 1) Aplica JÁ (otimista): localStorage + estado → a classe de tema reage
    //    pelo efeito acima. Funciona mesmo sem a coluna no banco.
    try { localStorage.setItem(CHAVE_COR_TEMA, novaCor) } catch { /* ignora */ }

    setCorTemaLocal(novaCor)

    setPerfil(p => (p ? { ...p, cor_tema: novaCor } : p))



    // 2) Tenta persistir no perfil (multi-dispositivo). Se a coluna cor_tema
    //    ainda NÃO existir (migration pendente), NÃO quebra a UI: a preferência
    //    continua valendo pelo localStorage. Qualquer outro erro também é
    //    tolerado — é só identidade visual.
    if (!usuario) return

    try {

      const { data, error } = await supabase

        .from('perfis')

        .update({ cor_tema: novaCor })

        .eq('id', usuario.id)

        .select()

        .single()

      if (error) throw error

      if (data) setPerfil(data)

    } catch {

      /* coluna ausente ou falha de rede: mantém só o localStorage */

    }

  }



  // Grava campos OPCIONAIS do perfil do onboarding (objetivos_financeiros,
  // onboarding_etapa) que dependem de migration ainda não aplicada. Se a
  // coluna não existir, não quebra o fluxo: devolve false e o chamador mantém
  // a cópia no localStorage. Nunca usado para campos financeiros.
  const CAMPOS_PERFIL_OPCIONAIS = ['objetivos_financeiros', 'onboarding_etapa']

  async function atualizarPerfilOpcional(campos) {

    if (!usuario || consultoriaAlvo) return false

    const permitidos = Object.fromEntries(Object.entries(campos).filter(([k]) => CAMPOS_PERFIL_OPCIONAIS.includes(k)))

    if (Object.keys(permitidos).length === 0) return false

    try {

      const { data, error } = await supabase

        .from('perfis')

        .update(permitidos)

        .eq('id', usuario.id)

        .select()

        .single()

      if (error) throw error

      if (data) setPerfil(data)

      return true

    } catch {

      return false

    }

  }



  // Salva a personalização dos atalhos da Home (perfis.atalhos_home, JSONB)
  // do PRÓPRIO usuário logado. Mesmo padrão do tema: aplica no estado local e
  // tenta persistir no banco. Se a coluna ainda não existir (migration
  // pendente), não quebra: o hook useAtalhosHome mantém a cópia no
  // localStorage. Retorna true quando gravou no Supabase.
  async function atualizarAtalhosHome(config) {

    if (!usuario) return false

    setPerfil(p => (p ? { ...p, atalhos_home: config } : p))

    try {

      const { data, error } = await supabase

        .from('perfis')

        .update({ atalhos_home: config })

        .eq('id', usuario.id)

        .select()

        .single()

      if (error) throw error

      if (data) setPerfil(data)

      return true

    } catch {

      return false

    }

  }



  // Encerra a PRÓPRIA conta: desativa o perfil (ativo = false) e faz logout.
  // Não apaga dados nem remove o usuário do Auth. A segurança está no banco:
  //  - policy "Usuário atualiza apenas o próprio perfil" permite só o próprio id;
  //  - trigger impedir_autodesativacao bloqueia um ADMIN de se autodesativar
  //    (nesse caso o update lança erro e a conta não é encerrada).
  async function encerrarMinhaConta() {

    if (!usuario) throw new Error('Usuário não autenticado.')

    const { error } = await supabase

      .from('perfis')

      .update({ ativo: false })

      .eq('id', usuario.id)

    if (error) throw error

    // Desativado com sucesso → encerra a sessão.
    await supabase.auth.signOut()

  }



  // Marca o onboarding (primeiro acesso) como concluído no perfil do usuário.
  // Persistido no banco (perfis.onboarding_concluido) → funciona em qualquer
  // dispositivo. Atualiza o perfil no contexto para refletir na hora.
  // 
  // ÚNICA FUNÇÃO QUE PODE MARCAR ONBOARDING COMO CONCLUÍDO.
  async function marcarOnboardingConcluido() {

    if (!usuario) return

    const { data, error } = await supabase

      .from('perfis')

      .update({ onboarding_concluido: true })

      .eq('id', usuario.id)

      .select()

      .single()

    if (error) throw error

    setPerfil(data)

    return data

  }



  // Reinicia o onboarding (usado por Admin ou quando usuário zera dados).
  // Marca onboarding_concluido = false para reabrir o fluxo.
  // 
  // ÚNICA FUNÇÃO QUE PODE MARCAR ONBOARDING COMO NÃO CONCLUÍDO.
  async function reiniciarOnboarding() {

    if (!usuario) return

    const { data, error } = await supabase

      .from('perfis')

      .update({ onboarding_concluido: false })

      .eq('id', usuario.id)

      .select()

      .single()

    if (error) throw error

    setPerfil(data)

    return data

  }



  // ── Modo Consultoria ────────────────────────────────────────────────────────
  // Entra no modo "Visualizar como cliente". Carrega o perfil do cliente (o
  // banco só devolve se o acesso estiver 'autorizado'). Em caso de bloqueio da
  // RLS, não entra no modo (data vem null) e lança para a UI avisar.
  async function entrarModoConsultoria(cliente) {

    if (!cliente?.id) throw new Error('Cliente inválido.')

    const { data, error } = await supabase

      .from('perfis')

      .select('*')

      .eq('id', cliente.id)

      .single()

    if (error || !data) {

      throw new Error('Sem autorização para visualizar os dados deste cliente.')

    }

    setPerfilCliente(data)

    setConsultoriaAlvo({ id: cliente.id, nome: data.nome || cliente.nome || cliente.email || 'cliente' })

    return data

  }



  // Sai do modo consultoria e volta a ver os próprios dados.
  function sairModoConsultoria() {

    setConsultoriaAlvo(null)

    setPerfilCliente(null)

  }



  // Se o usuário trocar (logout/login), encerra qualquer modo consultoria ativo.
  useEffect(() => {

    sairModoConsultoria()

  }, [usuario?.id])



  const modoConsultoria = consultoriaAlvo != null

  // id que as LEITURAS financeiras devem usar: o do cliente no modo consultoria,
  // senão o do próprio usuário autenticado.
  const idEfetivo = modoConsultoria ? consultoriaAlvo.id : (usuario?.id ?? null)

  // Perfil que a UI deve exibir (nome, reserva, saldo_base): o do cliente no
  // modo consultoria, senão o próprio.
  const perfilEfetivo = modoConsultoria ? perfilCliente : perfil



  // Função para limpar erro e tentar recarregar
  async function tentarNovamente() {

    if (!usuario?.id) return



    setErroCarregamento(null)

    setCarregando(true)



    const resultado = await buscarPerfil(usuario.id)



    if (!resultado.sucesso && resultado.erro) {

      setErroCarregamento(resultado.erro)

    }



    setCarregando(false)

  }



  const valor = {

    usuario,

    perfil: perfilEfetivo,     // no modo consultoria, reflete o perfil do cliente
    perfilProprio: perfil,     // perfil real do usuário logado (nunca muda)
    carregando,

    cadastrar,

    entrar,

    sair,

    solicitarRecuperacaoSenha,

    redefinirSenha,

    atualizarLimiteDiario,

    atualizarPreferenciasLimite,

    recarregarPerfil,          // recarga o perfil após atualizar foto/avatar
    marcarOnboardingConcluido,

    reiniciarOnboarding,       // reinicia o onboarding (usado por Admin ou zerar dados)
    encerrarMinhaConta,

    // Aparência (cor do tema) — preferência efetiva (perfil do banco quando
    // disponível, senão localStorage). Robusto à migration pendente.
    corTema,

    atualizarCorTema,

    atualizarAtalhosHome,

    atualizarPerfilOpcional,

    // ehAdmin usa SEMPRE o papel real do usuário logado (não o do cliente).
    ehAdmin: perfil?.papel === 'admin',

    // Conta desativada por um administrador (soft-disable). Baseado no perfil
    // real do logado — nunca no do cliente visualizado.
    contaDesativada: perfil != null && perfil.ativo === false,

    autenticado: !!usuario,

    // ── Modo Consultoria ──
    modoConsultoria,                                  // bool: estamos visualizando um cliente?
    consultoriaAlvo,                                  // { id, nome } | null
    idEfetivo,                                        // id usado nas LEITURAS financeiras
    idUsuarioLogado: usuario?.id ?? null,             // id real do logado (p/ escritas)
    somenteLeitura: modoConsultoria,                  // UI deve bloquear edição
    entrarModoConsultoria,

    sairModoConsultoria,

    // Erro de carregamento
    erroCarregamento,

    tentarNovamente,

  }



  return (

    <AuthContext.Provider value={valor}>

      {children}

    </AuthContext.Provider>

  )

}



// Hook para usar o contexto de auth em qualquer componente
export function useAuth() {

  const context = useContext(AuthContext)

  if (!context) {

    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')

  }

  return context

}
