/**
 * webauthn.js — Autenticação biométrica usando WebAuthn/Passkeys
 * 
 * FUNCIONALIDADES:
 * - Registro de credencial biométrica (fingerprint, FaceID, Windows Hello)
 * - Login sem senha usando passkey
 * - Gerenciamento de credenciais ativas
 * - Compatibilidade com iOS, Android e desktop
 * 
 * SEGURANÇA:
 * - Nenhum dado biométrico é armazenado no servidor
 * - Apenas public key e credential ID são persistidos
 * - Challenge único por operação (previne replay attacks)
 * - Login tradicional sempre disponível como fallback
 * 
 * REQUISITOS:
 * - Navegador com suporte a WebAuthn (Chrome 67+, Safari 14+, Firefox 60+)
 * - HTTPS obrigatório (ou localhost para desenvolvimento)
 * - Dispositivo com sensor biométrico ou PIN do sistema
 */

// Verifica se WebAuthn está disponível no navegador
export function webAuthnDisponivel() {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  )
}

// Verifica se o navegador suporta passkeys de plataforma (FaceID, TouchID, Windows Hello)
export async function suportaPasskeysPlatforma() {
  if (!webAuthnDisponivel()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Converte ArrayBuffer para base64url (formato compatível com JSON)
 */
function bufferParaBase64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (const byte of bytes) {
    str += String.fromCharCode(byte)
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Converte base64url para ArrayBuffer
 */
function base64urlParaBuffer(base64url) {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * REGISTRO: Cria nova credencial biométrica
 * 
 * @param {Object} opcoes
 * @param {string} opcoes.usuario_id - ID único do usuário
 * @param {string} opcoes.email - Email do usuário
 * @param {string} opcoes.nome - Nome exibido ao usuário
 * @param {string} opcoes.challenge - Challenge único do servidor (base64url)
 * @param {string} opcoes.rpName - Nome do site (ex: "Almeida Finance")
 * @param {string} opcoes.rpId - Domínio do site (ex: "almeidafinance.com" ou "localhost")
 * 
 * @returns {Promise<{
 *   credential_id: string,
 *   public_key: string,
 *   tipo_autenticador: string
 * }>}
 */
export async function registrarCredencial({
  usuario_id,
  email,
  nome,
  challenge,
  rpName = 'Almeida Finance',
  rpId,
}) {
  if (!webAuthnDisponivel()) {
    throw new Error('WebAuthn não disponível neste navegador.')
  }

  // Se rpId não informado, usa o hostname atual (sem porta)
  if (!rpId) {
    rpId = window.location.hostname
  }

  const publicKeyOptions = {
    challenge: base64urlParaBuffer(challenge),
    rp: {
      name: rpName,
      id: rpId,
    },
    user: {
      id: Uint8Array.from(usuario_id, c => c.charCodeAt(0)),
      name: email,
      displayName: nome,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256 (recomendado)
      { alg: -257, type: 'public-key' }, // RS256 (fallback)
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Prefere biometria integrada
      requireResidentKey: true,             // Credencial armazenada no dispositivo
      residentKey: 'required',
      userVerification: 'required',         // Exige biometria ou PIN
    },
    timeout: 60000,
    attestation: 'none', // Não exige certificado do fabricante
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })

    if (!credential) {
      throw new Error('Nenhuma credencial foi criada.')
    }

    // Extrai dados para enviar ao servidor
    const response = credential.response
    const credentialId = bufferParaBase64url(credential.rawId)
    const publicKey = bufferParaBase64url(response.getPublicKey())
    const tipoAutenticador = credential.authenticatorAttachment || 'desconhecido'

    return {
      credential_id: credentialId,
      public_key: publicKey,
      tipo_autenticador: tipoAutenticador,
    }
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Operação cancelada pelo usuário.')
    }
    if (err.name === 'InvalidStateError') {
      throw new Error('Esta credencial já está registrada.')
    }
    throw new Error(`Erro ao registrar biometria: ${err.message}`)
  }
}

/**
 * AUTENTICAÇÃO: Faz login usando credencial biométrica existente
 * 
 * @param {Object} opcoes
 * @param {string} opcoes.challenge - Challenge único do servidor (base64url)
 * @param {string[]} opcoes.allowCredentials - IDs das credenciais aceitas (opcional)
 * @param {string} opcoes.rpId - Domínio do site
 * 
 * @returns {Promise<{
 *   credential_id: string,
 *   authenticator_data: string,
 *   client_data: string,
 *   signature: string
 * }>}
 */
export async function autenticarComCredencial({
  challenge,
  allowCredentials = [],
  rpId,
}) {
  if (!webAuthnDisponivel()) {
    throw new Error('WebAuthn não disponível neste navegador.')
  }

  if (!rpId) {
    rpId = window.location.hostname
  }

  const publicKeyOptions = {
    challenge: base64urlParaBuffer(challenge),
    rpId,
    allowCredentials: allowCredentials.map(id => ({
      type: 'public-key',
      id: base64urlParaBuffer(id),
    })),
    userVerification: 'required',
    timeout: 60000,
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })

    if (!assertion) {
      throw new Error('Nenhuma credencial foi retornada.')
    }

    const response = assertion.response

    return {
      credential_id: bufferParaBase64url(assertion.rawId),
      authenticator_data: bufferParaBase64url(response.authenticatorData),
      client_data: bufferParaBase64url(response.clientDataJSON),
      signature: bufferParaBase64url(response.signature),
    }
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Operação cancelada pelo usuário.')
    }
    throw new Error(`Erro ao autenticar: ${err.message}`)
  }
}

/**
 * Gera um challenge criptograficamente seguro (32 bytes)
 * IMPORTANTE: Em produção, o challenge deve vir do servidor
 */
export function gerarChallenge() {
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return bufferParaBase64url(buffer)
}
