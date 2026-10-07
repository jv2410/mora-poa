import Link from 'next/link'
import Nav from '@/components/Nav'
import { demandaNaoAtendida, saudeDoCadastro } from '@/lib/demanda'
import { estoqueMorto } from '@/lib/selecao'
import { brl } from '@/lib/formato'

export const metadata = {
  title: 'Estoque e captação — MORA.AI',
  description: 'O que o mercado pediu e o estoque não tinha.',
}

// Depende de buscas e seleções feitas hoje; cache curto, não ISR de uma hora.
export const revalidate = 60

export default async function Estoque() {
  const [demanda, saude, morto] = await Promise.all([
    demandaNaoAtendida(30, 12),
    saudeDoCadastro(),
    estoqueMorto(90, 12),
  ])

  const destravaveis = [
    { campo: 'condomínio', n: saude.sem_condominio },
    { campo: 'vagas', n: saude.sem_vagas },
    { campo: 'área', n: saude.sem_area },
    { campo: 'fotos (menos de 3)', n: saude.poucas_fotos },
  ]
    .filter((d) => d.n > 0)
    .sort((a, b) => b.n - a.n)

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 48 }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Estoque e captação</span>
            <h2>O que o mercado pediu e o estoque não tinha.</h2>
            <p>
              Agregado das buscas feitas no MORA, inclusive as que não acharam nada. É pauta de
              captação saída de demanda real, não de palpite.
            </p>
          </div>

          {/* ---------------- Demanda não atendida ---------------- */}
          <h3 style={{ marginBottom: 18 }}>Demanda não atendida · últimos 30 dias</h3>

          {demanda.length === 0 ? (
            <div className="card" style={{ marginBottom: 56 }}>
              <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7 }}>
                Ainda sem buscas registradas neste período. Este bloco é retrospectivo por
                natureza: ele mede o que foi pedido e não encontrado, então começa a ter
                conteúdo a partir das primeiras buscas feitas no{' '}
                <Link href="/chat" style={{ borderBottom: '1px solid var(--muted-2)' }}>
                  Briefing
                </Link>
                .
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: 56, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted-2)' }}>
                    <th style={th}>Perfil pedido</th>
                    <th style={{ ...th, textAlign: 'right' }}>Buscas</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sem alta compat.</th>
                    <th style={{ ...th, textAlign: 'right' }}>Opções achadas</th>
                  </tr>
                </thead>
                <tbody>
                  {demanda.map((d) => (
                    <tr key={d.perfil} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>{d.perfil}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{d.buscas}</td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          color: d.sem_alta > 0 ? 'var(--alerta)' : 'var(--muted)',
                          fontWeight: d.sem_alta > 0 ? 700 : 400,
                        }}
                      >
                        {d.sem_alta}
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--muted)' }}>
                        {d.imoveis_encontrados}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---------------- Saúde do cadastro ---------------- */}
          <h3 style={{ marginBottom: 18 }}>Saúde do cadastro</h3>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <div className="card">
              <span className="tag">Nota média</span>
              <p style={{ fontSize: 38, fontWeight: 800, color: 'var(--green)', margin: '8px 0' }}>
                {saude.media}
                <span style={{ fontSize: 18, color: 'var(--muted-2)' }}>/100</span>
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Calculada pela presença dos campos que decidem match.
              </p>
            </div>
            <div className="card">
              <span className="tag">Fila de correção</span>
              <p style={{ fontSize: 38, fontWeight: 800, color: 'var(--ressalva)', margin: '8px 0' }}>
                {saude.fila_correcao}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Imóveis abaixo de 60, de {saude.total} no estoque.
              </p>
            </div>
            <div className="card">
              <span className="tag">O que destrava mais</span>
              <p style={{ fontSize: 38, fontWeight: 800, margin: '8px 0' }}>
                {destravaveis[0]?.n ?? 0}
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                imóveis sem {destravaveis[0]?.campo ?? 'dado faltante'}.
              </p>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: 15, lineHeight: 1.8 }}>
              {destravaveis.map((d, i) => (
                <span key={d.campo}>
                  <b>{d.n}</b> imóveis sem {d.campo}
                  {i < destravaveis.length - 1 ? ' · ' : '. '}
                </span>
              ))}
              <span style={{ color: 'var(--muted)' }}>
                Cada um desses campos em branco tira o imóvel de todo briefing que exija aquele
                critério — não porque o imóvel não serve, mas porque não há como provar que
                serve.
              </span>
            </p>
          </div>

          {/* ---------------- Estoque parado ---------------- */}
          <h3 style={{ marginBottom: 8 }}>Estoque parado · sem entrar em seleção há 90 dias</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 20, maxWidth: 620 }}>
            Imóvel que nunca foi apresentado a ninguém. O motivo mais comum não é o imóvel, é o
            cadastro — e aí é renegociar preço com o proprietário ou devolver a captação.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted-2)' }}>
                  <th style={th}>Imóvel</th>
                  <th style={{ ...th, textAlign: 'right' }}>Preço</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cadastro</th>
                  <th style={th}>Motivo provável</th>
                </tr>
              </thead>
              <tbody>
                {morto.map((im: any) => {
                  const motivos = [
                    im.sem_condominio ? 'sem condomínio' : null,
                    im.sem_vagas ? 'sem vagas' : null,
                    im.poucas_fotos ? 'poucas fotos' : null,
                  ].filter(Boolean)
                  return (
                    <tr key={im.id} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={td}>
                        <Link
                          href={`/imovel/${im.id}`}
                          style={{ borderBottom: '1px solid var(--line)' }}
                        >
                          {im.bairro}
                        </Link>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>{brl(Number(im.preco))}</td>
                      <td
                        style={{
                          ...td,
                          textAlign: 'right',
                          color:
                            im.qualidade_cadastro < 60 ? 'var(--ressalva)' : 'var(--muted)',
                        }}
                      >
                        {im.qualidade_cadastro}
                      </td>
                      <td style={{ ...td, color: 'var(--muted)' }}>
                        {motivos.length ? motivos.join(' · ') : 'cadastro completo'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}

const th: React.CSSProperties = {
  padding: '10px 14px 10px 0',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  fontWeight: 400,
}

const td: React.CSSProperties = { padding: '13px 14px 13px 0' }
