import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { eficiencia, qualidade, comercial, escopoDeUsuarios, alertas } from '@/lib/indicadores'
import { doCorretor } from '@/lib/selecao'
import HorasEconomizadas from '@/components/HorasEconomizadas'
import BlocoCRM from '@/components/BlocoCRM'

export const metadata = { title: 'Meu mês — MORA.AI' }
export const dynamic = 'force-dynamic'

const ROTULO_MOTIVO: Record<string, string> = {
  preco: 'preço',
  localizacao: 'localização',
  andar: 'andar',
  tamanho: 'tamanho',
  outro: 'outro',
}

export default async function Painel() {
  const u = (await usuarioAtual())!
  const ids = await escopoDeUsuarios(u)

  const [ef, qa, com, selecoes, avisos] = await Promise.all([
    eficiencia(ids, u.min_por_30_imoveis),
    qualidade(ids),
    comercial(ids),
    doCorretor(String(u.id), 20, u.id).catch(() => []),
    alertas(ids),
  ])

  return (
    <section className="section-pad" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <div className="section-head" style={{ marginBottom: 36 }}>
          <span className="eyebrow">Últimos 30 dias</span>
          <h2>Seu mês.</h2>
        </div>

        {/*
          Máximo quatro números no topo. A regra é do documento e o motivo é
          bom: cada número a mais reduz a chance de o corretor entender
          qualquer um deles.
        */}
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <HorasEconomizadas horas={ef.horas_economizadas} formula={ef.formula} />

          <div className="card">
            <span className="tag">Imóveis analisados</span>
            <p style={{ fontSize: 40, fontWeight: 800, margin: '6px 0' }}>
              {ef.imoveis_analisados.toLocaleString('pt-BR')}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              em {ef.buscas} {ef.buscas === 1 ? 'briefing' : 'briefings'}. Escala que nenhum
              humano alcança à mão.
            </p>
          </div>

          <div className="card">
            <span className="tag">Seleções enviadas</span>
            <p style={{ fontSize: 40, fontWeight: 800, margin: '6px 0' }}>
              {qa.selecoes_enviadas}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {qa.imoveis_enviados} imóveis no total
              {qa.media_enviados_por_selecao != null
                ? `, ${qa.media_enviados_por_selecao} por seleção`
                : ''}
              .
            </p>
          </div>
        </div>

        {/* ---------------- Qualidade do match ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Qualidade do match</h3>
        <div className="grid-3" style={{ marginBottom: 20 }}>
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
              {qa.taxa_aproveitamento == null
                ? 'Aparece a partir da primeira busca.'
                : 'das suas buscas viraram seleção enviada ao cliente. Se cai, ou o match está ruim ou você não confia nele.'}
            </p>
          </div>

          <div className="card">
            <span className="tag">Buscas sem alta compatibilidade</span>
            <p
              style={{
                fontSize: 40,
                fontWeight: 800,
                margin: '6px 0',
                color: qa.buscas_sem_alta > 0 ? 'var(--ressalva)' : 'var(--ink)',
              }}
            >
              {qa.buscas_sem_alta}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Onde o estoque não tinha o que o cliente pediu.{' '}
              <Link href="/estoque" style={{ borderBottom: '1px solid var(--muted-2)' }}>
                ver a demanda
              </Link>
            </p>
          </div>

          <div className="card">
            <span className="tag">Por que recusaram</span>
            {qa.motivos.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 10 }}>
                Nenhuma recusa com motivo ainda. Quando o comprador diz o que não serviu, o
                agregado aparece aqui e mostra onde o match erra.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', marginTop: 10, display: 'grid', gap: 7 }}>
                {qa.motivos.map((m) => (
                  <li
                    key={m.motivo}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}
                  >
                    <span>{ROTULO_MOTIVO[m.motivo] ?? m.motivo}</span>
                    <b>{m.n}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ---------------- O que vem do CRM ---------------- */}
        <BlocoCRM aprovacoes={com.aprovacoes_comprador} />

        {/* ---------------- Alertas acionáveis ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Precisa de um telefonema</h3>
        {avisos.length === 0 ? (
          <div className="card" style={{ marginBottom: 44 }}>
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>
              Nenhuma seleção parada há mais de 7 dias sem resposta. Quando houver, ela aparece
              aqui com quantas vezes o cliente abriu — que é o que diz se ele está interessado
              e travado, ou se simplesmente não viu.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, marginBottom: 44 }}>
            {avisos.map((a) => (
              <div
                key={a.token}
                className="card"
                style={{ borderColor: 'var(--ressalva)', background: 'var(--ressalva-fundo)' }}
              >
                <p style={{ fontSize: 15 }}>
                  <b>{a.cliente}</b> — seleção enviada há {a.dias} dias sem resposta.
                  {a.visualizacoes > 0
                    ? ` Abriu os imóveis ${a.visualizacoes}× e não respondeu.`
                    : ' Ainda não abriu.'}{' '}
                  <Link
                    href={`/s/${a.token}`}
                    style={{ borderBottom: '1px solid var(--ressalva)' }}
                  >
                    ver a seleção
                  </Link>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ---------------- Seleções ---------------- */}
        <h3 style={{ marginBottom: 16 }}>Suas seleções</h3>
        {selecoes.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>
              Nenhuma seleção ainda.{' '}
              <Link href="/chat" style={{ borderBottom: '1px solid var(--muted-2)' }}>
                Cole um briefing
              </Link>{' '}
              e monte a primeira.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {selecoes.map((s: any) => (
              <Link
                key={s.token}
                href={`/s/${s.token}`}
                className="card"
                style={{ display: 'block' }}
              >
                <p style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 5 }}>
                  {s.cliente ?? 'cliente sem nome'}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                  {s.total} {s.total === 1 ? 'imóvel' : 'imóveis'} · {s.aprovados} quer visitar
                  · {s.recusados} descartou · aberta {s.aberturas}×
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
