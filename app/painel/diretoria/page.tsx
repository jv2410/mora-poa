import { redirect } from 'next/navigation'
import { usuarioAtual, VE_DIRETORIA } from '@/lib/auth'
import {
  comercial, eficiencia, qualidade, escopoDeUsuarios, adocaoPorCorretor,
} from '@/lib/indicadores'
import BlocoCRM from '@/components/BlocoCRM'
import { brl } from '@/lib/formato'

export const metadata = { title: 'Diretoria — MORA.AI' }
export const dynamic = 'force-dynamic'

export default async function Diretoria() {
  const u = (await usuarioAtual())!
  if (!VE_DIRETORIA.includes(u.papel)) redirect('/painel')

  const ids = await escopoDeUsuarios(u)
  const [ef, qa, com, matriz] = await Promise.all([
    eficiencia(ids, u.min_por_30_imoveis),
    qualidade(ids),
    comercial(ids),
    adocaoPorCorretor(u.conta_id),
  ])

  const ativos = matriz.filter((c: any) => c.buscas > 0).length
  const pctAtivos = matriz.length === 0 ? null : Math.round((ativos / matriz.length) * 100)

  return (
    <section className="section-pad" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <span className="eyebrow">Diretoria · 30 dias</span>
          <h2>Isso me dá retorno?</h2>
          <p>
            Uma tela feita para ser printada e mandada no grupo dos sócios. O que a MORA mede
            está preenchido; o que depende do CRM está marcado, não estimado.
          </p>
        </div>

        {/* ---------------- Retorno ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Retorno</h3>
        <div className="grid-3" style={{ marginBottom: 40 }}>
          <div className="card">
            <span className="tag">Investimento no mês</span>
            <p style={{ fontSize: 36, fontWeight: 800, margin: '6px 0' }}>
              {u.mensalidade == null ? '—' : brl(u.mensalidade)}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {u.mensalidade == null
                ? 'Informe a mensalidade no cadastro para calcular o múltiplo.'
                : 'Mensalidade do plano.'}
            </p>
          </div>
          <div
            className="card"
            style={{ borderStyle: 'dashed', background: 'var(--elev)' }}
          >
            <span className="tag">Múltiplo de retorno</span>
            <p style={{ fontSize: 36, fontWeight: 800, margin: '6px 0', color: 'var(--muted-2)' }}>
              —
            </p>
            <p style={{ color: 'var(--muted-2)', fontSize: 14 }}>
              Comissão influenciada ÷ mensalidade. Depende da venda, que vem do CRM.
            </p>
          </div>
          <div className="card">
            <span className="tag">Horas devolvidas à equipe</span>
            <p style={{ fontSize: 36, fontWeight: 800, margin: '6px 0', color: 'var(--green)' }}>
              {ef.horas_economizadas.toLocaleString('pt-BR')}h
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {ef.imoveis_analisados.toLocaleString('pt-BR')} imóveis analisados em {ef.buscas}{' '}
              {ef.buscas === 1 ? 'briefing' : 'briefings'}.
            </p>
          </div>
        </div>

        {/* ---------------- Funil ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Funil MORA</h3>
        <div style={{ marginBottom: 40 }}>
          {[
            { etapa: 'Briefings', n: qa.buscas, medido: true },
            { etapa: 'Seleções enviadas', n: qa.selecoes_enviadas, medido: true },
            { etapa: 'Imóveis enviados', n: qa.imoveis_enviados, medido: true },
            { etapa: 'Aprovados pelo comprador', n: qa.aprovados_comprador, medido: true },
            { etapa: 'Visitas', n: null, medido: false },
            { etapa: 'Propostas', n: null, medido: false },
            { etapa: 'Vendas', n: null, medido: false },
          ].map((e) => (
            <div
              key={e.etapa}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '14px 18px',
                borderBottom: '1px solid var(--line)',
                opacity: e.medido ? 1 : 0.55,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: e.medido ? 600 : 400 }}>
                {e.etapa}
                {!e.medido ? (
                  <span style={{ color: 'var(--ressalva)', fontSize: 12.5, fontWeight: 400 }}>
                    {' '}
                    · vem do CRM
                  </span>
                ) : null}
              </span>
              <b style={{ fontSize: 20, color: e.medido ? 'var(--ink)' : 'var(--muted-2)' }}>
                {e.n == null ? '—' : e.n}
              </b>
            </div>
          ))}
        </div>

        {/* ---------------- Adoção ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Adoção</h3>
        <div className="card" style={{ marginBottom: 40 }}>
          <span className="tag">Corretores ativos na janela</span>
          <p style={{ fontSize: 36, fontWeight: 800, margin: '6px 0', color: 'var(--green)' }}>
            {pctAtivos == null ? '—' : `${pctAtivos}%`}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
            {ativos} de {matriz.length} usuários fizeram ao menos uma busca. É o indicador que
            prevê churn melhor que qualquer outro — antes mesmo do resultado comercial.
          </p>
        </div>

        <BlocoCRM aprovacoes={com.aprovacoes_comprador} compacto />
      </div>
    </section>
  )
}
