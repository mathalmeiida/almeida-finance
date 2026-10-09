import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Contexto que disponibiliza o usuário atual para todo o app
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined) // undefined = ainda verificando
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  // Guarda o ID do usuário atual para comparar entre eventos de auth sem
  // depender da referência do objeto (que muda em cada TOKEN_REFRESHED).
  const usuarioIdRef = useRef(null)

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
  async function buscarPerfil(userId) {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()
    setPerfil(data)
  }

  // ── Cor da marca (Aparência: Azul padrão / Rosa) ────────────────────────────
  // FONTE DA PREFERÊNCIA de cor do tema (robusta, sem depender da migration):
  //   1) localStorage 'almeida_cor_tema' → aplica JÁ no boot (antes do perfil
  //      carregar), inclusive em login/onboarding, sem flash.
  //   2) perfis.cor_tema → quando a coluna existir, sincroniza entre
  //      dispositivos. Se a coluna NÃO existir, o app funciona só com o
  //      localStorage (não quebra).
  // Cores válidas: azul (padrão), rosa, verde, roxo.
  const CHAVE_COR_TEMA = 'almeida_cor_tema'
  const CORES_TEMA = ['azul', 'rosa', 'verde', 'roxo']
  const normalizarCor = (c) => (CORES_TEMA.includes(c) ? c : 'azul')
  const [corTemaLocal, setCorTemaLocal] = useState(() => {
    try { return normalizarCor(localStorage.getItem(CHAVE_COR_TEMA)) }
    catch { return 'azul' }
  })

  // Preferência efetiva: perfil do banco tem prioridade quando válido; senão
  // cai no localStorage.
  const corTema = CORES_TEMA.includes(perfil?.cor_tema) ? perfil.cor_tema : corTemaLocal

  // Aplica a classe de tema no <html> (tema-rosa/-verde/-roxo). Azul = sem
  // classe (variáveis padrão do :root). Só visual: alterna --marca/--marca-hover.
  useEffect(() => {
    try {
      const el = document.documentElement
      el.classList.remove('tema-rosa', 'tema-verde', 'tema-roxo')
      if (corTema !== 'azul') el.classList.add(`tema-${corTema}`)
    } catch { /* ambiente sem DOM: ignora */ }
  }, [corTema])

  // Quando o perfil chega do banco com uma cor válida, espelha no localStorage
  // para o próximo boot já aplicar antes do login resolver.
  useEffect(() => {
    if (CORES_TEMA.includes(perfil?.cor_tema)) {
      try { localStorage.setItem(CHAVE_COR_TEMA, perfil.cor_tema) } catch { /* ignora */ }
      setCorTemaLocal(perfil.cor_tema)
    }
  }, [perfil?.cor_tema])

  useEffect(() => {
    // 1. Verifica se já existe uma sessão ativa ao carregar o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      usuarioIdRef.current = user ? user.id : null
      setUsuario(user)
      if (user) buscarPerfil(user.id)
      setCarregando(false)
    })

    // 2. Escuta mudanças de autenticação (login, logout, expiração de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null
        // Estabiliza a identidade do usuário: só troca o objeto no estado quando
        // o ID realmente muda (login/logout). Eventos como TOKEN_REFRESHED trazem
        // um NOVO objeto `user` com o MESMO id — se o setássemos, a nova referência
        // re-dispararia os efeitos [usuario,...] de todos os hooks (receitas,
        // despesas etc.), fazendo as listas recarregarem e "piscarem" vazias.
        const idAnterior = usuarioIdRef.current
        const idNovo = user ? user.id : null
        const mudouUsuario = idAnterior !== idNovo
        usuarioIdRef.current = idNovo

        if (mudouUsuario) {
          setUsuario(user)
          if (user) buscarPerfil(user.id)
          else setPerfil(null)
        }
        // Se o id não mudou (ex.: refresh de token), mantém o objeto `usuario`
        // atual intacto — nenhum efeito dependente é re-disparado.
        setCarregando(false)
      }
    )

    return () => subscription.unsubscribe()
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
    // Registra o último acesso (usado no painel admin). Não bloqueia o login
    // se falhar, e não interfere em nenhum dado financeiro.
    if (data?.user?.id) {
      supabase
        .from('perfis')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {}, () => {})
    }
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
  // Aceita um objeto com qualquer um dos campos: { limite_diario, modo_limite }
  async function atualizarPreferenciasLimite(campos) {
    if (!usuario) return
    // No modo consultoria o app está em somente leitura: não grava preferências
    // (evitaria escrever no perfil do próprio admin e corromper a exibição).
    if (consultoriaAlvo) {
      throw new Error('Modo Consultoria: visualização somente leitura. Edição desativada.')
    }
    const { data, error } = await supabase
      .from('perfis')
      .update(campos)
      .eq('id', usuario.id)
      .select()
      .single()
    if (error) throw error
    setPerfil(data) // reflete imediatamente no app
    return data
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
    marcarOnboardingConcluido,
    encerrarMinhaConta,
    // Aparência (cor do tema) — preferência efetiva (perfil do banco quando
    // disponível, senão localStorage). Robusto à migration pendente.
    corTema,
    atualizarCorTema,
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
