// Gera um par de chaves VAPID (P-256) usando apenas Node.js nativo.
// Saída: chaves em Base64url — formato exigido pela Web Push API.
import { webcrypto } from 'node:crypto'
const { subtle } = webcrypto

const kp = await subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey'],
)

// Chave pública: formato "raw" (65 bytes, não comprimido) = padrão VAPID
const pubRaw   = await subtle.exportKey('raw',   kp.publicKey)
// Chave privada: extraímos o escalar d do formato PKCS8
// PKCS8 de P-256 tem 138 bytes; os últimos 32 bytes a partir do offset 36
// são o escalar d (chave privada bruta).
const privPkcs = await subtle.exportKey('pkcs8', kp.privateKey)

const toB64url = buf => Buffer.from(buf).toString('base64url')

const pubB64  = toB64url(pubRaw)
// Extrair escalar d: PKCS8 P-256 = header (36 bytes) + octet-string (04 + 1 byte len + 32 bytes d)
const privBuf = new Uint8Array(privPkcs)
const privB64 = toB64url(privBuf.slice(36, 68))  // 32 bytes = escalar d

console.log('\n=== CHAVES VAPID GERADAS ===\n')
console.log('VITE_VAPID_PUBLIC_KEY=' + pubB64)
console.log('')
console.log('# Cole a linha abaixo SOMENTE nas variáveis de ambiente da Edge Function (Supabase):')
console.log('VAPID_PRIVATE_KEY=' + privB64)
console.log('')
console.log('# Para o envio push, o subject (mailto:) deve ser um e-mail seu:')
console.log('VAPID_SUBJECT=mailto:seu@email.com')
console.log('\n=== NÃO compartilhe a chave privada ===\n')
