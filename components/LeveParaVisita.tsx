import type { Sinal } from '@/lib/completude'

/**
 * O que o anúncio não conta, virado pauta.
 *
 * A ausência de informação é o material de negociação mais subestimado numa
 * compra de imóvel: o comprador de primeira viagem não sabe o que perguntar, e
 * o corretor não tem incentivo para lembrar. Cada sinal aqui nasce de um campo
 * vazio no banco, então é verificável — não é conselho genérico.
 */
export default function LeveParaVisita({ sinais }: { sinais: Sinal[] }) {
  if (!sinais.length) return null

  return (
    <div
      className="card"
      style={{ margin: '28px 0', borderColor: 'rgba(255,180,0,.22)', background: 'var(--bg-3)' }}
    >
      <span className="eyebrow" style={{ color: '#ffc75a' }}>
        Leve para a visita
      </span>

      <p style={{ color: 'var(--muted)', fontSize: 15, margin: '18px 0 22px', lineHeight: 1.6 }}>
        {sinais.length === 1
          ? 'Um ponto que o anúncio deixou em aberto:'
          : `${sinais.length} pontos que o anúncio deixou em aberto:`}
      </p>

      <ol style={{ listStyle: 'none', display: 'grid', gap: 18 }}>
        {sinais.map((s, i) => (
          <li key={s.tipo} style={{ display: 'flex', gap: 14 }}>
            <span
              className="tag"
              style={{ minWidth: 20, paddingTop: 2, color: '#ffc75a' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p style={{ fontSize: 15, lineHeight: 1.55 }}>{s.pergunta}</p>
              <p className="tag" style={{ marginTop: 5, display: 'block' }}>
                {s.detalhe}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
