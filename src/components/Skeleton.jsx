import React from 'react'

/**
 * Componentes de skeleton para feedback de carregamento
 * 
 * Uso:
 * <Skeleton className="h-20 w-full" />
 * <SkeletonCard />
 * <SkeletonLista linhas={5} />
 */

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-lg ${className}`}
      {...props}
    />
  )
}

export function SkeletonTexto({ linhas = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === linhas - 1 ? '75%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <SkeletonTexto linhas={2} />
    </div>
  )
}

export function SkeletonLista({ linhas = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: linhas }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonTabela({ linhas = 5, colunas = 4 }) {
  return (
    <div className="card overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex gap-4 pb-3 border-b border-gray-200">
        {Array.from({ length: colunas }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Linhas */}
      <div className="space-y-3 pt-3">
        {Array.from({ length: linhas }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: colunas }).map((_, j) => (
              <Skeleton key={j} className="h-12 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonGrafico({ altura = 'h-64', className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className={altura} />
    </div>
  )
}

export function SkeletonIndicador({ className = '' }) {
  return (
    <div className={`card text-center ${className}`}>
      <Skeleton className="h-4 w-24 mx-auto mb-2" />
      <Skeleton className="h-8 w-32 mx-auto" />
    </div>
  )
}

export default Skeleton
