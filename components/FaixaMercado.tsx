import type { ContextoMercado } from '@/lib/mercado'

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Mostra onde o preço/m² deste imóvel cai entre os comparáveis: a faixa
 * escura é o miolo do mercado (p25 a p75) e o marcador é o imóvel.
 *
 * Todos os números vêm do SQL. O componente só desenha.
 */
export default function FaixaMercado({ ctx }: { ctx: ContextoMercado }) {
  if (ctx.p25 == null || ctx.p75 == null || ctx.preco_m2_imovel == null) return null

  // Escala com 15% de folga para o marcador nunca encostar na borda.
  const min = Math.min(ctx.p25, ctx.preco_m2_imovel) * 0.85
  const max = Math.max(ctx.p75, ctx.preco_m2_imovel) * 1.15
  const pos = (v: number) => ((v - min) / (max - min)) * 100

  const barato = (ctx.delta_mediana_pct ?? 0) < -8
  const caro = (ctx.delta_mediana_pct ?? 0) > 8
  const cor = barato ? 'var(--green)' : caro ? '#ffb020' : 'var(--ink)'

  return (
    <div style={{ margin: '28px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span className="eyebrow">Preço vs. mercado</span>
        <span className="tag">
          {ctx.base_comparacao} · {ctx.amostra} anúncios
        </span>
      </div>

      <div style={{ position: 'relative', height: 46, marginBottom: 10 }}>
        {/* trilho */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: 'var(--line)',
          }}
        />
        {/* miolo do mercado: p25 a p75 */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: `${pos(ctx.p25)}%`,
            width: `${pos(ctx.p75) - pos(ctx.p25)}%`,
            height: 4,
            borderRadius: 2,
            background: 'var(--line)',
          }}
        />
        {/* mediana */}
        {ctx.mediana != null && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: `${pos(ctx.mediana)}%`,
              width: 2,
              height: 16,
              background: 'var(--muted)',
            }}
          />
        )}
        {/* este imóvel */}
        <div
          style={{
            position: 'absolute',
            top: 15,
            left: `calc(${pos(ctx.preco_m2_imovel)}% - 7px)`,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: cor,
            boxShadow: `0 0 12px ${cor}`,
            border: '2px solid var(--bg)',
          }}
        />
        {/* legendas */}
        <span
          className="tag"
          style={{ position: 'absolute', top: 30, left: `${pos(ctx.p25)}%`, transform: 'translateX(-50%)' }}
        >
          {brl(ctx.p25)}
        </span>
        {ctx.mediana != null && (
          <span
            className="tag"
            style={{
              position: 'absolute',
              top: 0,
              left: `${pos(ctx.mediana)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            mediana {brl(ctx.mediana)}
          </span>
        )}
        <span
          className="tag"
          style={{ position: 'absolute', top: 30, left: `${pos(ctx.p75)}%`, transform: 'translateX(-50%)' }}
        >
          {brl(ctx.p75)}
        </span>
      </div>

      <p style={{ fontSize: 14.5, color: 'var(--muted)', marginTop: 18 }}>
        <strong style={{ color: cor }}>{brl(ctx.preco_m2_imovel)}/m²</strong>{' '}
        {ctx.delta_mediana_pct != null && (
          <>
            — {Math.abs(ctx.delta_mediana_pct)}%{' '}
            {ctx.delta_mediana_pct < 0 ? 'abaixo' : 'acima'} da mediana, percentil{' '}
            {ctx.percentil}.{' '}
          </>
        )}
        {ctx.leitura.charAt(0).toUpperCase() + ctx.leitura.slice(1)}.
      </p>
    </div>
  )
}
