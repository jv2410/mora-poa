import Link from 'next/link'
import Nav from '@/components/Nav'
import BarraBairro from '@/components/BarraBairro'
import { raioX, dormsDisponiveis } from '@/lib/raioX'
import { brl } from '@/lib/formato'

export const revalidate = 3600

export const metadata = {
  title: 'Quanto custa o m² em cada bairro de Porto Alegre — MORA.AI',
  description:
    'Mediana e faixa de preço por metro quadrado em cada bairro de POA, calculadas sobre anúncios reais de seis portais. Grátis e sem cadastro.',
}

export default async function Mercado(props: PageProps<'/mercado'>) {
  const sp = await props.searchParams
  const dorm = typeof sp.dorm === 'string' ? Number(sp.dorm) : null

  const [x, dorms] = await Promise.all([raioX(dorm), dormsDisponiveis()])

  // Escala compartilhada: o teto é o maior p75 do conjunto, para todas as
  // barras poderem ser comparadas entre si.
  const max = Math.max(...x.bairros.map((b) => b.p75)) * 1.02

  const link = (d: number | null) => (d ? `/mercado?dorm=${d}` : '/mercado')

  return (
    <>
      <Nav />

      <section style={{ padding: '56px 0 0' }}>
        <div className="wrap">
          <span className="eyebrow">Raio-x do mercado</span>
          <h2 style={{ margin: '20px 0 18px', maxWidth: '18ch' }}>
            Quanto custa o m² em cada bairro.
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 18, maxWidth: 620, lineHeight: 1.6 }}>
            Mediana e faixa de preço por metro quadrado, calculadas sobre {x.geral.n} anúncios
            reais de seis portais. Nenhuma estimativa: são os preços que estão pedindo hoje.
          </p>
        </div>
      </section>

      {/* O número-manchete: uma frase que o leitor leva embora */}
      <section style={{ padding: '48px 0' }}>
        <div className="wrap">
          <div
            className="card"
            style={{ borderColor: 'var(--green-dim)', padding: '36px 32px' }}
          >
            <p style={{ fontSize: 'clamp(20px, 3.2vw, 30px)', lineHeight: 1.42, maxWidth: 780 }}>
              O metro quadrado no{' '}
              <strong style={{ color: 'var(--green)' }}>{x.maisCaro?.bairro}</strong> custa{' '}
              <strong style={{ color: 'var(--green)' }}>
                {x.razao.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}×
              </strong> o do{' '}
              <strong>{x.maisBarato?.bairro}</strong> — {brl(x.maisCaro?.mediana ?? 0)} contra{' '}
              {brl(x.maisBarato?.mediana ?? 0)}.
            </p>
            <p style={{ color: 'var(--muted)', marginTop: 18, fontSize: 15.5 }}>
              A mediana de Porto Alegre é {brl(x.geral.mediana)} o m²
              {x.dormFiltro ? ` para imóveis de ${x.dormFiltro} dormitórios` : ''}. Num
              apartamento de 70 m², essa diferença entre os dois bairros é de{' '}
              {brl(((x.maisCaro?.mediana ?? 0) - (x.maisBarato?.mediana ?? 0)) * 70)}.
            </p>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <span className="tag" style={{ marginRight: 6 }}>
              FILTRAR POR
            </span>
            <Link href={link(null)} className={!dorm ? 'btn btn-solid' : 'btn btn-outline'}>
              todos
            </Link>
            {dorms.map((d) => (
              <Link
                key={d}
                href={link(d)}
                className={dorm === d ? 'btn btn-solid' : 'btn btn-outline'}
              >
                {d} {d === 1 ? 'dormitório' : 'dormitórios'}
              </Link>
            ))}
          </div>

          <div className="legenda-grafico">
            <span>
              <i className="amostra-faixa" /> miolo do bairro (25% a 75% dos anúncios)
            </span>
            <span>
              <i className="amostra-mediana" /> mediana
            </span>
          </div>

          <div className="ranking">
            {x.bairros.map((b, i) => (
              <BarraBairro key={b.bairro} b={b} max={max} destaque={i === 0} />
            ))}
          </div>

          <p className="tag" style={{ display: 'block', marginTop: 22, lineHeight: 1.8 }}>
            Só bairros com 5 anúncios ou mais entram no ranking · clique num bairro para ver os
            imóveis · {x.geral.descartados} anúncios ficaram de fora por preço por m² fora da
            faixa plausível
          </p>
        </div>
      </section>

      {/* A tabela: quem quer o número exato, e quem lê por leitor de tela */}
      <section className="section-pad section-alt">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 32 }}>
            <span className="eyebrow">Os números</span>
            <h2>Tabela completa.</h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Bairro</th>
                  <th>Anúncios</th>
                  <th>R$/m² mediana</th>
                  <th>Faixa (25%–75%)</th>
                  <th>Preço mediano</th>
                  <th>Área mediana</th>
                </tr>
              </thead>
              <tbody>
                {x.bairros.map((b) => (
                  <tr key={b.bairro}>
                    <td>
                      <Link href={`/imoveis?bairro=${encodeURIComponent(b.bairro)}`}>
                        {b.bairro}
                      </Link>
                    </td>
                    <td>{b.n}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{brl(b.mediana)}</td>
                    <td style={{ color: 'var(--muted)' }}>
                      {brl(b.p25)} – {brl(b.p75)}
                    </td>
                    <td>{brl(b.preco_mediano)}</td>
                    <td>{b.area_mediana} m²</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ maxWidth: '20ch', margin: '0 auto 20px' }}>
            Quer saber se um imóvel específico está caro?
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 540, margin: '0 auto 34px' }}>
            Pergunte no chat. Ele compara o imóvel com os semelhantes do mesmo bairro e diz em
            que percentil ele cai — com o tamanho da amostra.
          </p>
          <Link href="/chat" className="btn btn-solid">
            Conversar
          </Link>
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span>MORA.AI · Porto Alegre, RS</span>
          <Link href="/dados" style={{ color: 'var(--muted)' }}>
            de onde vêm os dados →
          </Link>
        </div>
      </footer>
    </>
  )
}
