import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function DiagnosticoAuth() {
  const auth = useAuth()
  const [historico, setHistorico] = useState([])
  
  useEffect(() => {
    const log = {
      timestamp: new Date().toISOString().split('T')[1],
      carregando: auth.carregando,
      autenticado: auth.autenticado,
      usuario: auth.usuario?.id?.substring(0, 8),
      perfil: auth.perfil ? Object.keys(auth.perfil).join(',') : 'null',
      erroCarregamento: auth.erroCarregamento?.tipo
    }
    
    setHistorico(prev => [...prev, log].slice(-20))
  }, [auth.carregando, auth.autenticado, auth.usuario, auth.perfil, auth.erroCarregamento])
  
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Diagnóstico de Autenticação</h1>
        
        <div className="mb-6 p-4 bg-blue-50 rounded">
          <h2 className="font-bold mb-2">Estado Atual</h2>
          <div className="space-y-1 text-sm font-mono">
            <div>carregando: <span className={auth.carregando ? 'text-red-600' : 'text-green-600'}>{String(auth.carregando)}</span></div>
            <div>autenticado: {String(auth.autenticado)}</div>
            <div>usuario: {auth.usuario?.id?.substring(0, 16) || 'null'}</div>
            <div>perfil: {auth.perfil ? JSON.stringify(Object.keys(auth.perfil)) : 'null'}</div>
            <div>perfil.id: {auth.perfil?.id?.substring(0, 16) || 'null'}</div>
            <div>perfil.nome: {auth.perfil?.nome || 'null'}</div>
            <div>erroCarregamento: {auth.erroCarregamento?.tipo || 'null'}</div>
          </div>
        </div>
        
        <div className="mb-6">
          <h2 className="font-bold mb-2">Condições de Renderização</h2>
          <div className="space-y-1 text-sm">
            <div className={auth.carregando ? 'text-red-600 font-bold' : ''}>
              RotaPrivada: if (carregando) → {auth.carregando ? 'MOSTRA LOADING' : 'passa'}
            </div>
            <div className={auth.usuario && auth.perfil == null ? 'text-red-600 font-bold' : ''}>
              AreaAutenticada: if (usuario && perfil == null) → {auth.usuario && auth.perfil == null ? 'MOSTRA LOADING' : 'passa'}
            </div>
            <div>
              perfil === null: {String(auth.perfil === null)}
            </div>
            <div>
              perfil == null: {String(auth.perfil == null)}
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="font-bold mb-2">Histórico (últimas 20 mudanças)</h2>
          <div className="space-y-1 text-xs font-mono bg-gray-50 p-2 rounded max-h-96 overflow-y-auto">
            {historico.map((log, i) => (
              <div key={i} className={log.carregando ? 'text-red-600' : ''}>
                {log.timestamp} | carregando:{log.carregando ? 'T' : 'F'} | auth:{log.autenticado ? 'T' : 'F'} | user:{log.usuario || 'null'} | perfil:{log.perfil} | erro:{log.erroCarregamento || 'null'}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-50 rounded">
          <h2 className="font-bold mb-2">Console Logs</h2>
          <p className="text-sm">Abra o DevTools Console para ver logs detalhados de:</p>
          <ul className="list-disc list-inside text-sm">
            <li>[AuthContext] - Estados e eventos</li>
            <li>[buscarPerfil] - Queries e resultados</li>
            <li>[RotaPrivada] - Verificações de rota</li>
            <li>[AreaAutenticada] - Verificações de área</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
