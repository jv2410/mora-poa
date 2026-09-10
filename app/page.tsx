import Link from 'next/link'
import Nav from '@/components/Nav'
import HeroSpot from '@/components/HeroSpot'
import Briefing from '@/components/Briefing'
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

const PASSOS = [
  {
    n: '01',
    t: 'Você cola o briefing',
    d: 'Do jeito que o cliente falou, com contradição e tudo: "teto de 750 mas se for muito bom estica até 800". Sem formulário, sem 18 campos.',
  },
  {
    n: '02',
    t: 'A MORA cruza com o estoque',
    d: 'O anúncio de seis portais num banco só, sem o mesmo apartamento repetido três vezes, e cada imóvel comparado com os semelhantes do próprio bairro.',
  },
  {
    n: '03',
    t: 'Você recebe o que apresentar',
    d: 'Separado entre o que atende tudo e o que vale apresentar com ressalva — e a ressalva vem escrita, para você falar antes que o cliente descubra.',
  },
]

/**
 * As três faixas são a assinatura do produto, então aparecem na home com a
 * cara que têm no resultado — não descritas em prosa. Quem é corretor
 * reconhece o problema na hora: ele já mandou lista para cliente sem saber
 * qual imóvel tinha o defeito.
 */
const FAIXAS = [
  {
    cor: 'var(--alta)',
    fundo: 'var(--alta-fundo)',
    titulo: 'Alta compatibilidade',
    d: 'Atende todos os critérios do briefing. Manda para o cliente sem pensar duas vezes.',
  },
  {
    cor: 'var(--ressalva)',
    fundo: 'var(--ressalva-fundo)',
    titulo: 'Vale apresentar',
    d: '"Atende tudo, exceto o teto de preço — R$ 40 mil acima, mas custo mensal R$ 600 abaixo da mediana dos que batem tudo."',
  },
  {
    cor: 'var(--alerta)',
    fundo: 'rgba(165, 52, 42, .07)',
    titulo: 'Não encontrei — e a saída',
    d: 'Nunca termina em "não encontrei". Se o teto subir para R$ 560 mil aparecem 12; sem a segunda vaga, aparecem 8. Contagem real do banco.',
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
            {stats.total} imóveis · {stats.portais} portais · um banco só
          </div>
          <h1>
            Cole o briefing. <span className="accent">Receba o que apresentar.</span>
          </h1>
          <p className="sub">
            O corretor perde a venda procurando imóvel em seis portais enquanto o lead
            esfria. A MORA.AI cruza o que o seu cliente pediu com o estoque anunciado da
            cidade e devolve só o que vale mostrar.
          </p>
          <Briefing />
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

      <section className="section-pad" id="faixas">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">O resultado</span>
            <h2>Nenhum imóvel volta como &ldquo;87% de match&rdquo;.</h2>
            <p>
              Porcentagem obriga você a interpretar antes de decidir. A MORA devolve a
              decisão pronta em três faixas — e quando algo não bate, diz exatamente o quê.
            </p>
          </div>
          <div className="grid-3">
            {FAIXAS.map((f) => (
              <div
                key={f.titulo}
                className="card"
                style={{ borderColor: f.cor, background: f.fundo }}
              >
                <h3 style={{ color: f.cor, margin: '0 0 12px' }}>{f.titulo}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      <section className="section-pad" id="estoque">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">No banco agora</span>
            <h2>O estoque, sem repetição.</h2>
            <p>
              A partir de {(stats.menor / 1000).toFixed(0)} mil. O mesmo apartamento
              anunciado em três portais entra uma vez só — lista com imóvel repetido queima
              você na frente do cliente.
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
          <h2 style={{ maxWidth: '20ch', margin: '0 auto 22px' }}>
            Traga o briefing do seu próximo atendimento.
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 560, margin: '0 auto 38px' }}>
            A MORA não vende imóvel, não capta cliente e não fica com comissão. Ela só acha,
            no que já está anunciado, o que serve para o cliente que é seu.
          </p>
          <Link href="/chat" className="btn btn-solid">
            Abrir o chat
          </Link>
        </div>
      </section>

      <footer>
        <div
          className="wrap"
          style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}
        >
          <span>MORA.AI · Porto Alegre, RS</span>
          <Link href="/dados" style={{ color: 'var(--muted)' }}>
            de onde vêm os dados →
          </Link>
        </div>
      </footer>
    </>
  )
}
