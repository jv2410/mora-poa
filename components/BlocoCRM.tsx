import { brl } from '@/lib/formato'
import type { Comercial } from '@/lib/indicadores'

/**
 * Resultado comercial: do imóvel aprovado pelo comprador até a venda fechada.
 *
 * Os rótulos usam "influenciado" e "potencial" porque é o que os números são.
 * A MORA participa do caminho até a venda; ela não fecha negócio. Chamar de
 * "gerado" transformaria qualquer negócio que caísse numa promessa quebrada.
 */
export default function BlocoCRM({
  dados,
  compacto = false,
}: {
  dados: Comercial
  compacto?: boolean
}) {
  const cartoes = [
    {
      rotulo: 'Aprovações do comprador',
      valor: String(dados.aprovacoes_comprador),
      nota: 'clicaram em "quero visitar" na seleção enviada',
      destaque: true,
    },
    {
      rotulo: 'Visitas',
      valor: String(dados.visitas),
      nota:
        dados.visitas_realizadas > 0
          ? `${dados.visitas_realizadas} já realizadas`
          : 'agendadas no período',
    },
    {
      rotulo: 'Propostas',
      valor: String(dados.propostas),
      nota: 'negociações abertas a partir de uma seleção',
    },
    {
      rotulo: 'Vendas',
      valor: String(dados.vendas),
      nota: 'negócios ganhos no período',
      destaque: true,
    },
  ]

  return (
    <section style={{ marginBottom: 48 }}>
      <h3 style={{ marginBottom: 16 }}>Resultado comercial</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${compacto ? 160 : 190}px, 1fr))`,
          gap: 12,
          marginBottom: 20,
        }}
      >
        {cartoes.map((c) => (
          <div key={c.rotulo} className="card">
            <span className="tag">{c.rotulo}</span>
            <p
              style={{
                fontSize: 38,
                fontWeight: 800,
                margin: '6px 0 4px',
                color: c.destaque ? 'var(--green)' : 'var(--ink)',
              }}
            >
              {c.valor}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{c.nota}</p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <div className="card" style={{ borderColor: 'var(--green-dim)' }}>
          <span className="tag">VGV influenciado</span>
          <p style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 4px', color: 'var(--green)' }}>
            {brl(dados.vgv_influenciado)}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            soma das vendas em que o imóvel passou por uma seleção
          </p>
        </div>

        <div className="card">
          <span className="tag">Comissão potencial</span>
          <p style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 4px' }}>
            {brl(dados.comissao_potencial)}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
            sobre o VGV influenciado, no percentual do seu cadastro
          </p>
        </div>

        {dados.multiplo_retorno != null ? (
          <div className="card" style={{ borderColor: 'var(--green)' }}>
            <span className="tag">Múltiplo de retorno</span>
            <p
              style={{ fontSize: 32, fontWeight: 800, margin: '6px 0 4px', color: 'var(--green)' }}
            >
              {dados.multiplo_retorno.toLocaleString('pt-BR')}×
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>
              comissão influenciada dividida pela mensalidade
              {dados.custo_por_visita != null
                ? ` · ${brl(dados.custo_por_visita)} por visita`
                : ''}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
