import Link from 'next/link'
import type { LinhaBairro } from '@/lib/raioX'

const mil = (n: number) => `${(n / 1000).toFixed(1)}k`
const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * Uma linha do ranking: a barra clara é o miolo do mercado do bairro (do
 * percentil 25 ao 75) e o ponto é a mediana.
 *
 * A escala é compartilhada por todas as linhas — é o que permite comparar
 * bairros de relance. Barra por linha, cada uma com sua própria escala, seria
 * bonita e mentirosa.
 */
export default function BarraBairro({
  b,
  max,
  destaque,
}: {
  b: LinhaBairro
  max: number
  destaque?: boolean
}) {
  const pos = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const esq = pos(b.p25)
  const dir = pos(b.p75)
  const med = pos(b.mediana)

  return (
    <Link
      href={`/imoveis?bairro=${encodeURIComponent(b.bairro)}`}
      className="linha-bairro"
      title={`${b.bairro}: mediana ${brl(b.mediana)}/m², miolo entre ${brl(b.p25)} e ${brl(b.p75)}, ${b.n} anúncios`}
    >
      <span className="linha-nome">{b.bairro}</span>

      <span className="linha-trilho">
        {/* miolo do mercado: p25 a p75 */}
        <span
          className="linha-faixa"
          style={{ left: `${esq}%`, width: `${Math.max(dir - esq, 0.6)}%` }}
        />
        {/* mediana */}
        <span
          className="linha-mediana"
          style={{ left: `${med}%`, background: destaque ? 'var(--green)' : 'var(--ink)' }}
        />
      </span>

      <span className="linha-valor">{brl(b.mediana)}</span>
      <span className="linha-amostra">{b.n}</span>
    </Link>
  )
}
