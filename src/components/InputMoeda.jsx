import React, { useState, useEffect } from 'react'
import { formatarMoedaDigitada, moedaParaNumero, numeroParaMoeda } from '../lib/utils'

/**
 * Campo de entrada monetária com máscara brasileira automática.
 *
 * - O usuário digita só números; os dois últimos dígitos são sempre centavos.
 *   Ex.: 3 → R$ 0,03 | 387 → R$ 3,87 | 387470 → R$ 3.874,70
 * - Separador de milhar e duas casas decimais automáticos.
 * - Teclado numérico no celular (inputMode="numeric").
 * - Comunica o valor NUMÉRICO ao pai via onChangeValor (ex.: 3874.70).
 *
 * Props:
 *   valor         número atual (controla o campo; usado para pré-preencher)
 *   onChangeValor (numero) => void  — chamado a cada digitação com o número
 *   className, placeholder, autoFocus, required, id, name, ...rest
 */
export default function InputMoeda({
  valor,
  onChangeValor,
  className = 'input',
  placeholder = 'R$ 0,00',
  prefixo = 'R$',
  ...rest
}) {
  // Estado interno = texto já formatado (ex.: "3.874,70").
  const [texto, setTexto] = useState(numeroParaMoeda(valor))

  // Sincroniza quando o valor vindo do pai muda (ex.: abrir modal de edição),
  // sem sobrescrever enquanto o usuário digita o mesmo valor.
  useEffect(() => {
    const atualNum = moedaParaNumero(texto)
    const propNum = Number(valor) || 0
    if (atualNum !== propNum) setTexto(numeroParaMoeda(valor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function handleChange(e) {
    const formatado = formatarMoedaDigitada(e.target.value)
    setTexto(formatado)
    onChangeValor?.(moedaParaNumero(formatado))
  }

  const comPrefixo = prefixo != null && prefixo !== ''
  return (
    <div className="relative">
      {comPrefixo && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {prefixo}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={texto}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className}${comPrefixo ? ' pl-9' : ''}`}
        {...rest}
      />
    </div>
  )
}
