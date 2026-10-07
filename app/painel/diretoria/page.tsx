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
    comercial(ids, u.mensalidade, u.comissao_pct),
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
            Do briefing à venda fechada, com a conversão entre cada etapa. Feita para ser
            printada e mandada no grupo dos sócios.
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
          <div className="card" style={{ borderColor: 'var(--green)' }}>
            <span className="tag">Múltiplo de retorno</span>
            <p style={{ fontSize: 36, fontWeight: 800, margin: '6px 0', color: 'var(--green)' }}>
              {com.multiplo_retorno == null ? '—' : `${com.multiplo_retorno}×`}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {com.multiplo_retorno == null
                ? 'Informe a mensalidade no cadastro para calcular.'
                : `${brl(com.comissao_potencial)} de comissão influenciada sobre a mensalidade.`}
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
            // "Imóveis enviados" fica fora da sequência de propósito: ele não
            // é um estágio, é a contagem de itens dentro das seleções. Entre
            // 26 seleções e 112 imóveis a divisão daria 431%, que não é
            // conversão nenhuma — é a média de imóveis por seleção disfarçada
            // de taxa.
            { etapa: 'Briefings', n: qa.buscas },
            { etapa: 'Seleções enviadas', n: qa.selecoes_enviadas },
            { etapa: 'Aprovados pelo comprador', n: qa.aprovados_comprador },
            { etapa: 'Visitas', n: com.visitas },
            { etapa: 'Propostas', n: com.propostas },
            { etapa: 'Vendas', n: com.vendas },
          ].map((e, i, todas) => {
            // Conversão contra a etapa anterior: é onde se ganha e onde se
            // perde, e sem isso o funil vira uma lista de números soltos.
            const anterior = i === 0 ? null : todas[i - 1].n
            const conversao =
              anterior && anterior > 0 ? Math.round((e.n / anterior) * 100) : null

            return (
              <div
                key={e.etapa}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{e.etapa}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  {conversao != null ? (
                    <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>{conversao}%</span>
                  ) : null}
                  <b style={{ fontSize: 20 }}>{e.n}</b>
                </span>
              </div>
            )
          })}
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

        <BlocoCRM dados={com} compacto />
      </div>
    </section>
  )
}
