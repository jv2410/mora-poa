import Link from 'next/link'
import Nav from '@/components/Nav'
import { oQueCompra } from '@/lib/orcamento'
import { brl } from '@/lib/formato'

export const revalidate = 3600

export const metadata = {
  title: 'O que o seu dinheiro compra em cada bairro de Porto Alegre — mora.ai',
  description:
    'Escolha um orçamento e veja o apartamento mediano que ele compra em cada bairro de POA. Imóveis reais, de seis portais.',
}

const FAIXAS = [200_000, 300_000, 400_000, 500_000, 700_000, 1_000_000]

export default async function Orcamento(props: PageProps<'/orcamento'>) {
  const sp = await props.searchParams
  const valor = typeof sp.valor === 'string' ? Number(sp.valor) : 400_000
  const dorm = typeof sp.dorm === 'string' ? Number(sp.dorm) : null

  const r = await oQueCompra(valor, dorm)

  const link = (patch: { valor?: number; dorm?: number | null }) => {
    const p = new URLSearchParams()
    p.set('valor', String(patch.valor ?? valor))
    const d = patch.dorm === undefined ? dorm : patch.dorm
    if (d) p.set('dorm', String(d))
    return `/orcamento?${p}`
  }

  const maxArea = Math.max(...r.bairros.map((b) => b.area ?? 0), 1)

  return (
    <>
      <Nav />

      <section style={{ padding: '56px 0 40px' }}>
        <div className="wrap">
          <span className="eyebrow">Poder de compra</span>
          <h2 style={{ margin: '20px 0 18px', maxWidth: '20ch' }}>
            O que {brl(valor)} compram em cada bairro.
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 18, maxWidth: 640, lineHeight: 1.6 }}>
            Não é simulação: cada linha abaixo é o apartamento mediano que esse dinheiro
            compra naquele bairro hoje — o que você realmente encontra procurando ali.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 32 }}>
        <div className="wrap">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {FAIXAS.map((f) => (
              <Link
                key={f}
                href={link({ valor: f })}
                className={valor === f ? 'btn btn-solid' : 'btn btn-outline'}
              >
                {f >= 1_000_000 ? `${f / 1_000_000} mi` : `${f / 1000} mil`}
              </Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={link({ dorm: null })} className={!dorm ? 'btn btn-solid' : 'btn btn-outline'}>
              qualquer tamanho
            </Link>
            {[1, 2, 3].map((d) => (
              <Link
                key={d}
                href={link({ dorm: dorm === d ? null : d })}
                className={dorm === d ? 'btn btn-solid' : 'btn btn-outline'}
              >
                {d}+ dorm
              </Link>
            ))}
          </div>
        </div>
      </section>

      {r.melhor_area && r.pior_area && r.bairros.length > 2 ? (
        <section style={{ paddingBottom: 40 }}>
          <div className="wrap">
            <div className="card" style={{ borderColor: 'var(--green-dim)', padding: '30px 28px' }}>
              <p style={{ fontSize: 'clamp(18px, 2.6vw, 25px)', lineHeight: 1.45, maxWidth: 800 }}>
                Com {brl(valor)} você compra{' '}
                <strong style={{ color: 'var(--green)' }}>{r.melhor_area.area} m²</strong> no{' '}
                {r.melhor_area.bairro} — ou{' '}
                <strong>{r.pior_area.area} m²</strong> no {r.pior_area.bairro}. O mesmo dinheiro,{' '}
                {Math.round(((r.melhor_area.area ?? 1) / (r.pior_area.area ?? 1) - 1) * 100)}% a
                mais de espaço.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ paddingBottom: 80 }}>
        <div className="wrap">
          {r.bairros.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 56 }}>
              <h3 style={{ marginBottom: 10 }}>Nada nessa faixa.</h3>
              <p style={{ color: 'var(--muted)' }}>
                Tente um orçamento maior ou tire o filtro de dormitórios.
              </p>
            </div>
          ) : (
            <div className="ranking">
              {r.bairros.map((b) => (
                <Link key={b.bairro} href={`/imovel/${b.id}`} className="linha-orcamento">
                  <span className="linha-nome">{b.bairro}</span>

                  <span className="linha-trilho">
                    <span
                      className="linha-faixa"
                      style={{ left: 0, width: `${((b.area ?? 0) / maxArea) * 100}%` }}
                    />
                  </span>

                  <span className="linha-valor">{b.area ?? '?'} m²</span>
                  <span className="orc-detalhe">
                    {b.dormitorios ?? '?'} dorm
                    {b.vagas ? ` · ${b.vagas} vaga${b.vagas > 1 ? 's' : ''}` : ' · sem vaga'}
                    {b.condominio ? ` · cond ${brl(b.condominio)}` : ''}
                  </span>
                  <span className="linha-amostra">{b.n}</span>
                </Link>
              ))}
            </div>
          )}

          <p className="tag" style={{ display: 'block', marginTop: 22, lineHeight: 1.8 }}>
            A barra é a área do apartamento mediano de cada bairro dentro do orçamento · o
            número à direita é quantos imóveis existem ali nessa faixa · clique para abrir a
            ficha
          </p>
        </div>
      </section>

      <section className="section-pad section-alt">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ maxWidth: '18ch', margin: '0 auto 20px' }}>
            Quer ajuda para escolher entre eles?
          </h2>
          <Link href="/chat" className="btn btn-solid">
            Conversar com a IA
          </Link>
        </div>
      </section>
    </>
  )
}
