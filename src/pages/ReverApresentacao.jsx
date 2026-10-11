import React from 'react'
import { useNavigate } from 'react-router-dom'
import Apresentacao from '../components/Apresentacao'

// Página para REVER a apresentação inicial (3 telas) a qualquer momento, pelo
// menu/Configurações. Reutiliza o MESMO componente da apresentação do primeiro
// acesso — sem duplicar conteúdo. Ao concluir/pular, volta para Configurações.
// NÃO reinicia o onboarding nem toca em dados: é só a revisão das telas.
export default function ReverApresentacao() {
  const navigate = useNavigate()
  return <Apresentacao aoConcluir={() => navigate('/configuracoes')} />
}
