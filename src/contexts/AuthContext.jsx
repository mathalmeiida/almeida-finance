import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AVATAR_BUCKET, caminhoDoAvatar } from '../lib/avatar'

// Contexto que disponibiliza o usuário atual para todo o app
const AuthContext = createContext(null)

// Mesma chave usada em Login.jsx: a apresentação pública (antes do login) não
// volta a aparecer neste dispositivo depois que alguém já entrou nele.
const CHAVE_APRES_PUBLICA = 'almeida_apresentacao_publica_vista'

// "Caixa de saída" do onboarding: se o usuário concluir o onboarding sem
// conexão (ou a gravação falhar), guardamos aqui o id para REENVIAR a gravação
// ao banco na próxima oportunidade. NÃO é a fonte da verdade — a fonte é
// perfis.onboarding_concluido. O marcador é apagado assim que o banco confirma.
const chaveOnboardingPendente = (id) => `almeida_onboarding_pendente_${id}`

const esperar = (ms) => new Promise(r => setTimeout(r, ms))

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined) // undefined = ainda verificando
  const [perfil, setPerfil] = useState(null)
  // Erro ao carregar o perfil (rede/servidor). Com erro, a UI mostra uma tela
  // de "tentar novamente" em vez de ficar carregando para sempre.
  const [perfilErro, setPerfilErro] = useState(null)
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

  // Grava onboarding_concluido = true no banco, com novas tentativas em caso de
  // falha de rede. Lança erro se todas as tentativas falharem.
  async function gravarOnboardingNoBanco(userId, tentativas = 3) {
    let ultimoErro = null
    for (let i = 0; i < tentativas; i++) {
      const { data, error } = await supabase
        .from('perfis')
        .update({ onboarding_concluido: true })
        .eq('id', userId)
        .select()
        .maybeSingle()
      if (!error && data) return data
      ultimoErro = error || new Error('Perfil não encontrado para atualizar.')
      if (i < tentativas - 1) await esperar(600 * (i + 1))
    }
    throw ultimoErro
  }

  // Se existir uma conclusão de onboarding pendente (feita offline), reenvia ao
  // banco. Devolve o perfil atualizado quando a sincronização funciona.
  async function sincronizarOnboardingPendente(userId) {
    let pendente = false
    try { pendente = localStorage.getItem(chaveOnboardingPendente(userId)) === '1' } catch { /* ignora */ }
    if (!pendente) return null
    try {
      const data = await gravarOnboardingNoBanco(userId, 2)
      try { localStorage.removeItem(chaveOnboardingPendente(userId)) } catch { /* ignora */ }
      return data
    } catch {
      return null // continua pendente; nova tentativa no próximo boot/online
    }
  }

  // Busca o perfil complementar do usuário na tabela "perfis".
  // Tenta algumas vezes (redes móveis instáveis) e, se falhar, expõe o erro em
  // perfilErro para a UI oferecer "Tentar novamente" — nunca decide o
  // onboarding sem ter o perfil real em mãos.
  async function buscarPerfil(userId) {
    setPerfilErro(null)
    let ultimoErro = null
    // Até 3 tentativas (espera de 1s e 2s). A repetição automática do
    // supabase-js fica desligada aqui para a tela de erro não demorar demais.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      // Tempo limite: em rede móvel "pendurada" a UI não fica carregando para sempre.
      const controle = new AbortController()
      const limite = setTimeout(() => controle.abort(), 15000)
      let resposta
      try {
        resposta = await supabase
          .from('perfis')
          .select('*')
          .eq('id', userId)
          .abortSignal(controle.signal)
          .retry(false)
          .maybeSingle()
      } catch (e) {
        resposta = { data: null, error: e }
      } finally {
        clearTimeout(limite)
      }
      const { data, error } = resposta

      // Usuário trocou durante a requisição: descarta a resposta.
      if (usuarioIdRef.current !== userId) return

      if (!error && data) {
        let perfilFinal = data
        if (data.onboarding_concluido !== true) {
          // Conclusão feita offline neste dispositivo e ainda não confirmada
          // pelo banco → reenvia. Se o reenvio falhar, o onboarding NÃO é
          // reexibido neste dispositivo (o usuário já o concluiu aqui).
          const sincronizado = await sincronizarOnboardingPendente(userId)
          if (sincronizado) perfilFinal = sincronizado
          else {
            let pendente = false
            try { pendente = localStorage.getItem(chaveOnboardingPendente(userId)) === '1' } catch { /* ignora */ }
            if (pendente) perfilFinal = { ...data, onboarding_concluido: true }
          }
        }
        if (usuarioIdRef.current !== userId) return
        setPerfil(perfilFinal)
        return
      }

      if (!error && !data) {
        // Conta sem linha em "perfis" (o trigger de cadastro falhou no passado).
        // Cria o próprio perfil (permitido pela policy de INSERT do dono) para
        // não deixar o usuário preso no carregamento.
        const { data: sessao } = await supabase.auth.getSession()
        const u = sessao?.session?.user
        const { data: criado, error: erroCriar } = await supabase
          .from('perfis')
          .insert({
            id: userId,
            nome: u?.user_metadata?.nome || u?.email?.split('@')[0] || null,
            email: u?.email || null,
          })
          .select()
          .maybeSingle()
        if (!erroCriar && criado) {
          if (usuarioIdRef.current === userId) setPerfil(criado)
          return
        }
        ultimoErro = erroCriar || new Error('Perfil não encontrado.')
      } else {
        ultimoErro = error
      }
      if (tentativa < 2) await esperar(1000 * (tentativa + 1))
    }
    if (usuarioIdRef.current !== userId) return
    setPerfil(null)
    setPerfilErro(ultimoErro?.message || 'Não foi possível carregar seu perfil.')
  }

  // Permite à UI tentar de novo após erro de conexão.
  async function recarregarPerfil() {
    const id = usuarioIdRef.current
    if (id) await buscarPerfil(id)
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
    // 1. Verifica se já existe uma sessão ativa ao carregar o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      // Se o onAuthStateChange já tratou este mesmo usuário, não busca de novo.
      const jaTratado = usuarioIdRef.current === (user ? user.id : null) && usuarioIdRef.current !== null
      usuarioIdRef.current = user ? user.id : null
      if (!jaTratado) {
        setUsuario(user)
        if (user) buscarPerfil(user.id)
      }
      setCarregando(false)
    }).catch(() => {
      // Falha ao ler a sessão (armazenamento indisponível): trata como deslogado.
      setUsuario(null)
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
          // Troca de conta: limpa o perfil anterior ANTES de buscar o novo, para
          // nenhuma decisão (onboarding, avatar) usar dados de outro usuário.
          setPerfil(null)
          setPerfilErro(null)
          setUsuario(user)
          if (user) buscarPerfil(user.id)
        }
        // Se o id não mudou (ex.: refresh de token), mantém o objeto `usuario`
        // atual intacto — nenhum efeito dependente é re-disparado.
        setCarregando(false)
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

    // 4. Voltou a conexão: reenvia uma conclusão de onboarding pendente.
    function aoFicarOnline() {
      const id = usuarioIdRef.current
      if (!id) return
      sincronizarOnboardingPendente(id).then(data => {
        if (data && usuarioIdRef.current === id) setPerfil(data)
      })
    }
    window.addEventListener('online', aoFicarOnline)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('pageshow', aoReexibirPagina)
      window.removeEventListener('online', aoFicarOnline)
    }
  }, [])

  // Alguém já entrou neste dispositivo → a apresentação pública da tela de
  // login não precisa voltar (ex.: depois de "Sair").
  useEffect(() => {
    if (usuario?.id) {
      try { localStorage.setItem(CHAVE_APRES_PUBLICA, '1') } catch { /* ignora */ }
    }
  }, [usuario?.id])

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
  //
  // Fluxo à prova de falhas de conexão:
  //  1) guarda um marcador "pendente" local (caixa de saída);
  //  2) grava no banco (com novas tentativas);
  //  3) sucesso → remove o marcador. Falha → o marcador fica e a gravação é
  //     reenviada no próximo boot ou quando a conexão voltar. Nesse meio tempo
  //     o onboarding NÃO reaparece neste dispositivo.
  // Retorna { sincronizado: boolean }.
  async function marcarOnboardingConcluido() {
    if (!usuario) return { sincronizado: false }
    const id = usuario.id
    try { localStorage.setItem(chaveOnboardingPendente(id), '1') } catch { /* ignora */ }
    // Libera o app imediatamente (otimista).
    setPerfil(p => (p && p.id === id ? { ...p, onboarding_concluido: true } : p))
    try {
      const data = await gravarOnboardingNoBanco(id)
      try { localStorage.removeItem(chaveOnboardingPendente(id)) } catch { /* ignora */ }
      if (usuarioIdRef.current === id) setPerfil(data)
      return { sincronizado: true }
    } catch (e) {
      console.warn('Onboarding concluído offline; será sincronizado depois.', e?.message)
      return { sincronizado: false }
    }
  }

  // ── Foto de perfil ──────────────────────────────────────────────────────────
  // Arquivo no Supabase Storage (bucket "avatars", pasta = id do usuário) e URL
  // pública em perfis.avatar_url. As policies do Storage só permitem que cada
  // usuário escreva/apague dentro da PRÓPRIA pasta, e um trigger no banco só
  // aceita em avatar_url uma URL dessa pasta (ver migration
  // 2026-11_onboarding_e_avatar.sql).
  function garantirEdicaoPropria() {
    if (!usuario) throw new Error('Sua sessão expirou. Entre novamente para alterar a foto.')
    if (consultoriaAlvo) throw new Error('Modo Consultoria: visualização somente leitura.')
  }

  async function apagarArquivoAvatar(url) {
    const caminho = caminhoDoAvatar(url)
    // Só apaga arquivos da própria pasta (o Storage também bloquearia).
    if (!caminho || !caminho.startsWith(`${usuario.id}/`)) return
    try { await supabase.storage.from(AVATAR_BUCKET).remove([caminho]) } catch { /* limpeza best-effort */ }
  }

  // Envia a foto já comprimida ({ blob, tipo, extensao } de processarImagemAvatar)
  // e grava a URL no perfil. Atualiza o contexto → todas as telas mudam na hora.
  async function salvarFotoPerfil({ blob, tipo, extensao }) {
    garantirEdicaoPropria()
    const id = usuario.id
    const urlAnterior = perfil?.avatar_url || null
    // Nome único a cada envio: evita cache antigo (CDN/navegador) e permite
    // apagar a foto anterior só depois que a nova estiver salva.
    const caminho = `${id}/avatar-${Date.now()}.${extensao}`

    const { error: erroUpload } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(caminho, blob, { contentType: tipo, cacheControl: '31536000', upsert: false })
    if (erroUpload) throw new Error(traduzirErroStorage(erroUpload))

    const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(caminho)
    const url = pub?.publicUrl
    const { data, error } = await supabase
      .from('perfis')
      .update({ avatar_url: url })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error || !data) {
      // Perfil não foi atualizado → remove o arquivo recém-enviado (sem órfãos).
      try { await supabase.storage.from(AVATAR_BUCKET).remove([caminho]) } catch { /* ignora */ }
      throw new Error(traduzirErroPerfil(error))
    }
    if (usuarioIdRef.current === id) setPerfil(data)
    if (urlAnterior && urlAnterior !== url) await apagarArquivoAvatar(urlAnterior)
    return data
  }

  // Remove a foto: limpa avatar_url (volta às iniciais) e apaga o arquivo.
  async function removerFotoPerfil() {
    garantirEdicaoPropria()
    const id = usuario.id
    const urlAnterior = perfil?.avatar_url || null
    const { data, error } = await supabase
      .from('perfis')
      .update({ avatar_url: null })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error || !data) throw new Error(traduzirErroPerfil(error))
    if (usuarioIdRef.current === id) setPerfil(data)
    if (urlAnterior) await apagarArquivoAvatar(urlAnterior)
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
    // Carregamento do perfil (erro de rede → tela com "Tentar novamente")
    perfilErro,
    recarregarPerfil,
    // Foto de perfil (Storage "avatars" + perfis.avatar_url)
    salvarFotoPerfil,
    removerFotoPerfil,
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

function ehErroDeRede(msg) {
  const m = String(msg || '').toLowerCase()
  return m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('timeout')
}

function traduzirErroStorage(error) {
  const msg = String(error?.message || '')
  const m = msg.toLowerCase()
  if (ehErroDeRede(m)) return 'Sem conexão. Verifique sua internet e tente novamente.'
  if (m.includes('bucket not found')) return 'Armazenamento de fotos não configurado. Avise o administrador.'
  if (m.includes('row-level security') || m.includes('unauthorized') || m.includes('403'))
    return 'Você não tem permissão para enviar esta foto. Entre novamente na sua conta.'
  if (m.includes('exceeded') || m.includes('too large') || m.includes('413')) return 'A imagem ultrapassa o tamanho máximo permitido.'
  if (m.includes('mime') || (m.includes('invalid') && m.includes('type'))) return 'Formato de imagem não permitido.'
  if (m.includes('jwt')) return 'Sua sessão expirou. Entre novamente para alterar a foto.'
  return 'Não foi possível enviar a foto. Tente novamente.'
}

function traduzirErroPerfil(error) {
  const msg = String(error?.message || '')
  const m = msg.toLowerCase()
  if (ehErroDeRede(m)) return 'Sem conexão. Verifique sua internet e tente novamente.'
  if (m.includes('avatar_url') && (m.includes('column') || m.includes('schema cache')))
    return 'O banco ainda não foi atualizado para fotos de perfil. Avise o administrador.'
  if (m.includes('jwt')) return 'Sua sessão expirou. Entre novamente para alterar a foto.'
  return 'Não foi possível salvar a foto no seu perfil. Tente novamente.'
}

// Hook para usar o contexto de auth em qualquer componente
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return context
}
