import Nav from '@/components/Nav'
import HeroSpot from '@/components/HeroSpot'
import AbrirChat from '@/components/AbrirChat'
import CardImovel from '@/components/CardImovel'
import { todos, getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function estatisticas() {
  const { rows } = await getPool().query(`
    SELECT count(*)::int total,
           count(DISTINCT bairro)::int bairros,
           round(min(preco))::int menor
    FROM imoveis
  `)
  return rows[0] as { total: number; bairros: number; menor: number }
}

const PASSOS = [
  {
    n: '01',
    t: 'Você fala',
    d: 'Do jeito que você pensa: "dois quartos até 600 mil, perto da Redenção, e eu tenho cachorro". Sem formulário, sem checkbox.',
  },
  {
    n: '02',
    t: 'A IA busca',
    d: 'Ela traduz o que você disse em critérios e consulta o banco de verdade. Nada é inventado — todo imóvel citado existe e todo número vem do anúncio.',
  },
  {
    n: '03',
    t: 'Você entende o porquê',
    d: 'Cada imóvel vem com uma nota de match e a explicação do que bate e do que não bate. O defeito aparece antes de você perder a visita.',
  },
]

export default async function Home() {
  const [destaques, stats] = await Promise.all([todos(6), estatisticas()])

  return (
    <>
      <Nav />

      <section className="hero">
        <HeroSpot />
        <div className="wrap">
          <div className="pill hero-badge">
            <span className="dot" />
            {stats.total} imóveis em Porto Alegre
          </div>
          <h1>
            Descreva o apê. <span className="accent">A IA acha.</span>
          </h1>
          <p className="sub">
            Procurar imóvel virou preencher filtro. Aqui você conversa como
            conversaria com um corretor — e recebe a lista já explicada.
          </p>
          <div className="hero-cta">
            <AbrirChat>Começar a conversa</AbrirChat>
            <a href="/imoveis" className="btn btn-outline">
              Ver todos os imóveis
            </a>
          </div>
        </div>
      </section>

      <div className="metrics">
        <div className="wrap">
          <div className="metric">
            <b>{stats.total}</b>
            <span>imóveis no banco</span>
          </div>
          <div className="metric">
            <b>{stats.bairros}</b>
            <span>bairros de POA</span>
          </div>
          <div className="metric">
            <b>0</b>
            <span>números inventados</span>
          </div>
        </div>
      </div>

      <section className="section-pad section-alt" id="como">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Como funciona</span>
            <h2>Três passos, nenhum formulário.</h2>
            <p>
              O chat fica aberto ao lado enquanto você navega. Os imóveis aparecem
              em tempo real conforme a conversa avança.
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
              A partir de {(stats.menor / 1000).toFixed(0)} mil. Clique em qualquer um
              para ver a ficha completa.
            </p>
          </div>
          <div className="grid-imoveis">
            {destaques.map((im) => (
              <CardImovel key={im.id} im={im} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad section-alt">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 style={{ maxWidth: '16ch', margin: '0 auto 22px' }}>
            Pronto para achar o seu?
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 520, margin: '0 auto 38px' }}>
            Leva um minuto. Diga o que importa para você e deixe a IA fazer o trabalho
            chato de cruzar as opções.
          </p>
          <AbrirChat>Conversar agora</AbrirChat>
        </div>
      </section>

      <footer>
        <div className="wrap">
          mora.ai · POC com dados públicos da Auxiliadora Predial · Porto Alegre, RS
        </div>
      </footer>
    </>
  )
}
