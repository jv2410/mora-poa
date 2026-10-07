'use client'

import { useState } from 'react'

/**
 * O número grande com a fórmula atrás.
 *
 * O documento trata isso como regra não negociável, e com razão: "18h
 * economizadas" sem conta visível é indistinguível de marketing. Com a conta
 * aberta, o corretor pode discordar do parâmetro — e discordar é melhor que
 * desconfiar, porque o parâmetro é ajustável.
 */
export default function HorasEconomizadas({
  horas,
  formula,
}: {
  horas: number
  formula: { buscas: number; media_por_busca: number; minutos_por_30: number }
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="card">
      <span className="tag">Horas economizadas · 30 dias</span>
      <p style={{ fontSize: 40, fontWeight: 800, color: 'var(--green)', margin: '6px 0' }}>
        {horas.toLocaleString('pt-BR')}h
      </p>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--muted)',
          fontFamily: 'var(--sans)',
          fontSize: 13.5,
          cursor: 'pointer',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {aberto ? 'fechar a conta' : 'como calculamos'}
      </button>

      {aberto ? (
        <div style={{ marginTop: 14, fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
          <p>
            Você fez <b>{formula.buscas}</b>{' '}
            {formula.buscas === 1 ? 'busca' : 'buscas'} nos últimos 30 dias. Cada uma analisou
            em média <b>{formula.media_por_busca}</b> imóveis. Estimamos{' '}
            <b>{formula.minutos_por_30} min</b> de busca manual a cada 30 imóveis, com base no
            tempo informado no cadastro.
          </p>
          <p style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12.5 }}>
            {formula.buscas} × {formula.media_por_busca} ÷ 30 × {formula.minutos_por_30} min ÷
            60 = {horas.toLocaleString('pt-BR')}h
          </p>
          <p style={{ marginTop: 10, fontSize: 13 }}>
            Se esse tempo não corresponde ao seu, o parâmetro é ajustável — e o número inteiro
            muda com ele.
          </p>
        </div>
      ) : null}
    </div>
  )
}
