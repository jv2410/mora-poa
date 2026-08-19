import { simularCompra } from '@/lib/financiamento'

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * O número que nenhum portal brasileiro mostra: quanto dinheiro a pessoa
 * precisa ter no bolso no dia da assinatura, entrada mais ITBI mais cartório.
 * É a surpresa que derruba compra de primeira viagem na véspera.
 */
export default function CustoReal({
  preco,
  condominio,
  iptu,
}: {
  preco: number
  condominio: number | null
  iptu: number | null
}) {
  const entrada = Math.round(preco * 0.2)
  const s = simularCompra({ preco, entrada, condominio, iptu })

  const linhas: [string, string][] = [
    ['Entrada (20%)', brl(s.entrada)],
    ['ITBI (3%)', brl(s.itbi)],
    ['Escritura', brl(s.escritura)],
    ['Registro', brl(s.registro)],
  ]

  return (
    <div
      className="card"
      style={{ margin: '28px 0', borderColor: 'var(--line)', background: 'var(--bg-3)' }}
    >
      <span className="eyebrow">Custo real para fechar</span>

      <div style={{ display: 'grid', gap: 10, margin: '20px 0 18px' }}>
        {linhas.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontWeight: 600 }}>Você precisa ter no dia</span>
        <strong style={{ fontSize: 22, color: 'var(--green)', letterSpacing: '-0.03em' }}>
          {brl(s.dinheiro_necessario)}
        </strong>
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
        São {brl(s.custos_fechamento)} além da entrada, em impostos e cartório — a conta que
        costuma aparecer só na véspera da escritura.
      </p>

      {s.sac && (
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
          Financiando {brl(s.financiado)} em 30 anos a 11,49% ao ano: primeira parcela de{' '}
          <strong style={{ color: 'var(--ink)' }}>{brl(s.sac.primeira)}</strong> na tabela SAC,
          caindo até {brl(s.sac.ultima)}. Com condomínio e IPTU, o custo mensal de moradia começa
          em <strong style={{ color: 'var(--ink)' }}>{brl(s.custo_mensal_moradia!)}</strong>.
        </p>
      )}

      <p className="tag" style={{ marginTop: 16, display: 'block' }}>
        {s.referencia} · simulação, confirme com o banco
      </p>
    </div>
  )
}
