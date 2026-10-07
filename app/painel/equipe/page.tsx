import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioAtual, VE_EQUIPE } from '@/lib/auth'
import { adocaoPorCorretor, alertas, escopoDeUsuarios, qualidade } from '@/lib/indicadores'

export const metadata = { title: 'Equipe — MORA.AI' }
export const dynamic = 'force-dynamic'

export default async function Equipe() {
  const u = (await usuarioAtual())!
  if (!VE_EQUIPE.includes(u.papel)) redirect('/painel')

  const ids = await escopoDeUsuarios(u)
  const [matriz, qa, avisos] = await Promise.all([
    adocaoPorCorretor(u.conta_id),
    qualidade(ids),
    alertas(ids),
  ])

  const ativos = matriz.filter((c: any) => c.buscas > 0).length

  return (
    <section className="section-pad" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <span className="eyebrow">Gerência comercial · 30 dias</span>
          <h2>Quem está usando, e quem está deixando dinheiro na mesa.</h2>
        </div>

        <div className="grid-3" style={{ marginBottom: 40 }}>
          <div className="card">
            <span className="tag">Corretores ativos</span>
            <p style={{ fontSize: 40, fontWeight: 800, margin: '6px 0', color: 'var(--green)' }}>
              {ativos}
              <span style={{ fontSize: 18, color: 'var(--muted-2)' }}>/{matriz.length}</span>
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Prevê churn melhor que qualquer outro indicador.
            </p>
          </div>
          <div className="card">
            <span className="tag">Taxa de aproveitamento</span>
            <p
              style={{
                fontSize: 40,
                fontWeight: 800,
                margin: '6px 0',
                color: qa.taxa_aproveitamento == null ? 'var(--muted-2)' : 'var(--green)',
              }}
            >
              {qa.taxa_aproveitamento == null ? '—' : `${qa.taxa_aproveitamento}%`}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Das buscas que viraram seleção enviada. Principal KPI interno de qualidade.
            </p>
          </div>
          <div className="card">
            <span className="tag">Leads parados</span>
            <p
              style={{
                fontSize: 40,
                fontWeight: 800,
                margin: '6px 0',
                color: avisos.length > 0 ? 'var(--ressalva)' : 'var(--ink)',
              }}
            >
              {avisos.length}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Com seleção enviada há mais de 7 dias sem retorno.
            </p>
          </div>
        </div>

        <h3 style={{ marginBottom: 8 }}>Adoção por corretor</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 20, maxWidth: 620 }}>
          Ordenado por taxa de envio, não por volume: ranking por volume gera gaming e
          desmotiva o meio da tabela.
        </p>

        <div style={{ overflowX: 'auto', marginBottom: 40 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted-2)' }}>
                <th style={th}>Corretor</th>
                <th style={{ ...th, textAlign: 'right' }}>Buscas</th>
                <th style={{ ...th, textAlign: 'right' }}>Seleções</th>
                <th style={{ ...th, textAlign: 'right' }}>Taxa de envio</th>
                <th style={{ ...th, textAlign: 'right' }}>Quer visitar</th>
              </tr>
            </thead>
            <tbody>
              {matriz.map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {c.nome}
                    <span style={{ color: 'var(--muted-2)', fontWeight: 400, fontSize: 13 }}>
                      {' '}
                      · {c.papel}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.buscas}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.selecoes}</td>
                  <td
                    style={{
                      ...td,
                      textAlign: 'right',
                      color: c.taxa_envio == null ? 'var(--muted-2)' : 'var(--ink)',
                      fontWeight: 600,
                    }}
                  >
                    {c.taxa_envio == null ? '—' : `${c.taxa_envio}%`}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{c.aprovados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginBottom: 16 }}>Alertas acionáveis</h3>
        {avisos.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>
              Nada parado. Quando um lead ficar com seleção enviada e sem resposta, ele aparece
              aqui — com quantas vezes abriu, que é o que separa desinteresse de esquecimento.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {avisos.map((a) => (
              <div
                key={a.token}
                className="card"
                style={{ borderColor: 'var(--ressalva)', background: 'var(--ressalva-fundo)' }}
              >
                <p style={{ fontSize: 15 }}>
                  <b>{a.cliente}</b> — {a.dias} dias sem retorno
                  {a.visualizacoes > 0 ? `, abriu ${a.visualizacoes}× e ninguém ligou` : ''}.{' '}
                  <Link href={`/s/${a.token}`} style={{ borderBottom: '1px solid var(--ressalva)' }}>
                    ver
                  </Link>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
