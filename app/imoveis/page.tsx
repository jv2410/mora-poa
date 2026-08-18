import Nav from '@/components/Nav'
import CardImovel from '@/components/CardImovel'
import AbrirChat from '@/components/AbrirChat'
import { buscar, getPool } from '@/lib/db'
import type { Criterios } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

async function bairrosDisponiveis(): Promise<string[]> {
  const { rows } = await getPool().query(
    'SELECT DISTINCT bairro FROM imoveis ORDER BY bairro'
  )
  return rows.map((r) => r.bairro as string)
}

// Next 16: searchParams é sempre uma Promise.
export default async function Imoveis(props: PageProps<'/imoveis'>) {
  const sp = await props.searchParams
  const bairro = typeof sp.bairro === 'string' ? sp.bairro : undefined
  const precoMax = typeof sp.preco_max === 'string' ? Number(sp.preco_max) : undefined
  const dorm = typeof sp.dorm === 'string' ? Number(sp.dorm) : undefined

  const criterios: Criterios = {
    ...(bairro ? { bairros: [bairro] } : {}),
    ...(precoMax ? { preco_max: precoMax } : {}),
    ...(dorm ? { dorm_min: dorm } : {}),
  }

  const [imoveis, bairros] = await Promise.all([buscar(criterios, 100), bairrosDisponiveis()])

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const atual = { bairro, preco_max: precoMax?.toString(), dorm: dorm?.toString(), ...patch }
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v)
    const q = p.toString()
    return q ? `/imoveis?${q}` : '/imoveis'
  }

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 60 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 36 }}>
            <span className="eyebrow">Catálogo</span>
            <h2>{imoveis.length} imóveis</h2>
            <p>
              Filtrar aqui funciona, mas é o jeito antigo. Se quiser dizer o que
              procura em português, o chat entende melhor.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
            <a href={link({ bairro: undefined })} className="btn btn-outline">
              Todos os bairros
            </a>
            {bairros.map((b) => (
              <a
                key={b}
                href={link({ bairro: b })}
                className={b === bairro ? 'btn btn-solid' : 'btn btn-outline'}
              >
                {b}
              </a>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
            {[400000, 600000, 900000].map((v) => (
              <a
                key={v}
                href={link({ preco_max: precoMax === v ? undefined : String(v) })}
                className={precoMax === v ? 'btn btn-solid' : 'btn btn-outline'}
              >
                até {v / 1000} mil
              </a>
            ))}
            {[1, 2, 3].map((d) => (
              <a
                key={d}
                href={link({ dorm: dorm === d ? undefined : String(d) })}
                className={dorm === d ? 'btn btn-solid' : 'btn btn-outline'}
              >
                {d}+ dorm
              </a>
            ))}
          </div>

          {imoveis.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 56 }}>
              <h3 style={{ marginBottom: 10 }}>Nada com esses filtros.</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
                Tenta afrouxar um critério — ou pergunta pra IA, que ela sugere o
                que mudar.
              </p>
              <AbrirChat>Perguntar à IA</AbrirChat>
            </div>
          ) : (
            <div className="grid-imoveis">
              {imoveis.map((im) => (
                <CardImovel key={im.id} im={im} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
