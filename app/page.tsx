import Link from 'next/link'
import Nav from '@/components/Nav'
import HeroSpot from '@/components/HeroSpot'
import BuscaHero from '@/components/BuscaHero'
import CardImovel from '@/components/CardImovel'
import { todos, getPool } from '@/lib/db'

export const revalidate = 3600

async function estatisticas() {
  const { rows } = await getPool().query(`
    SELECT count(*)::int total,
           count(DISTINCT bairro)::int bairros,
           count(DISTINCT fonte)::int portais,
           round(min(preco))::int menor,
           (SELECT count(*)::int FROM atributos_extraidos) atributos
    FROM imoveis
  `)
  return rows[0] as {
    total: number
    bairros: number
    portais: number
    menor: number
    atributos: number
  }
}

/**
 * Chips com número de verdade, não frase genérica. Um chip que já carrega um
 * dado do banco comunica em três segundos que isto não é um chatbot qualquer.
 */
async function chipsComDado(): Promise<string[]> {
  const { rows } = await getPool().query(`
    SELECT bairro, count(*)::int n, round(percentile_cont(0.5)
             WITHIN GROUP (ORDER BY preco))::int mediana
    FROM imoveis
    WHERE dormitorios >= 2 AND preco IS NOT NULL
    GROUP BY bairro HAVING count(*) >= 12
    ORDER BY mediana ASC LIMIT 3
  `)
  return rows.map(
    (r) => `2 quartos no ${r.bairro} · ${r.n} opções, mediana ${Math.round(r.mediana / 1000)} mil`
  )
}

const PASSOS = [
  {
    n: '01',
    t: 'Você fala',
    d: 'Do jeito que você pensa: "dois quartos até 600 mil, perto da Redenção, e eu tenho cachorro". Sem formulário, sem checkbox.',
  },
  {
    n: '02',
    t: 'A IA busca e compara',
    d: 'Ela traduz o que você disse em critérios, consulta o banco e compara cada imóvel com os semelhantes do mesmo bairro. Você vê a busca acontecendo.',
  },
  {
    n: '03',
    t: 'Você entende o porquê',
    d: 'Nota de match, o que bate e o que não bate, onde o preço cai na distribuição do bairro, e quanto custa de verdade fechar — com ITBI e cartório.',
  },
]

export default async function Home() {
  const [destaques, stats, chips] = await Promise.all([todos(6), estatisticas(), chipsComDado()])

  return (
    <>
      <Nav />

      <section className="hero">
        <HeroSpot />
        <div className="wrap">
          <div className="pill hero-badge">
            <span className="dot" />
            {stats.total} imóveis · {stats.portais} portais · grátis
          </div>
          <h1>
            Descreva o apê. <span className="accent">A IA acha.</span>
          </h1>
          <p className="sub">
            Procurar imóvel virou preencher filtro. Aqui você conversa — e recebe a lista
            já explicada, comparada com o mercado do bairro.
          </p>
          <BuscaHero chips={chips} />
        </div>
      </section>

      <div className="metrics">
        <div className="wrap">
          <div className="metric">
            <b>{stats.total}</b>
            <span>imóveis de {stats.portais} portais</span>
          </div>
          <div className="metric">
            <b>{stats.bairros}</b>
            <span>bairros de POA</span>
          </div>
          <div className="metric">
            <b>{stats.atributos}</b>
            <span>fatos com citação do anúncio</span>
          </div>
          <div className="metric">
            <b>0</b>
            <span>
              <Link href="/dados" style={{ borderBottom: '1px solid var(--muted-2)' }}>
                números inventados
              </Link>
            </span>
          </div>
        </div>
      </div>

      <section className="section-pad section-alt" id="como">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Como funciona</span>
            <h2>Três passos, nenhum formulário.</h2>
            <p>
              O chat fica aberto ao lado enquanto você navega. Os imóveis aparecem em tempo
              real conforme a conversa avança.
            </p>
          </div>
          <div className="grid-3">
            {PASSOS.map((p) => (
              <div key={p.n} className="card">
                <span className="tag">{p.n}</span>
                <h3 style={{ margin: '14px 0 10px' }}>{p.t}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad" id="bairros">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">No banco agora</span>
            <h2>Os mais acessíveis.</h2>
            <p>
              A partir de {(stats.menor / 1000).toFixed(0)} mil. Clique em qualquer um para ver
              a ficha com faixa de mercado e custo real de compra.
            </p>
          </div>
          <div className="grid-imoveis">
            {destaques.map((im) => (
              <CardImovel key={im.id} im={im} />
            ))}
          </div>
          <div style={{ marginTop: 40 }}>
            <Link href="/imoveis" className="btn btn-outline">
              Ver todos os {stats.total}
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad section-alt">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ maxWidth: '16ch', margin: '0 auto 22px' }}>Pronto para achar o seu?</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 520, margin: '0 auto 38px' }}>
            Grátis, sem cadastro, sem corretor te ligando depois. A gente não vende imóvel
            nem ganha comissão de ninguém.
          </p>
          <Link href="/chat" className="btn btn-solid">
            Conversar agora
          </Link>
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span>mora.ai · Porto Alegre, RS</span>
          <Link href="/dados" style={{ color: 'var(--muted)' }}>
            de onde vêm os dados →
          </Link>
        </div>
      </footer>
    </>
  )
}
