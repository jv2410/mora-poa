import { notFound } from 'next/navigation'
import { porToken, registrarAbertura } from '@/lib/selecao'
import { porIds } from '@/lib/db'
import RespostaComprador from '@/components/RespostaComprador'
import { brl } from '@/lib/formato'

// A página é por natureza dinâmica: o comprador precisa ver o estado atual da
// própria resposta, e cada abertura é um sinal que contamos.
export const dynamic = 'force-dynamic'

export async function generateMetadata(props: PageProps<'/s/[token]'>) {
  const { token } = await props.params
  const sel = await porToken(token)
  if (!sel) return { title: 'Seleção não encontrada' }
  return {
    title: sel.cliente ? `Imóveis para ${sel.cliente}` : 'Imóveis selecionados para você',
    description: `${sel.itens.length} imóveis escolhidos a dedo.`,
    // A seleção é privada por link: não deve ser indexada nem aparecer em busca.
    robots: { index: false, follow: false },
  }
}

export default async function PaginaSelecao(props: PageProps<'/s/[token]'>) {
  const { token } = await props.params
  const sel = await porToken(token)
  if (!sel) notFound()

  // Cada abertura conta. É o que alimenta o alerta "abriu 6× e não respondeu".
  await registrarAbertura(token)

  const imoveis = await porIds(sel.itens.map((i) => i.imovel_id))
  const porId = new Map(imoveis.map((im) => [im.id!, im]))

  const alta = sel.itens.filter((i) => i.faixa === 'alta')
  const comRessalva = sel.itens.filter((i) => i.faixa !== 'alta')

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 80px' }}>
      <header style={{ marginBottom: 44 }}>
        <span className="eyebrow">Seleção do seu corretor</span>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', margin: '18px 0 14px' }}>
          {sel.cliente ? `${sel.cliente}, separei estes.` : 'Separei estes para você.'}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 17, maxWidth: 560 }}>
          {sel.itens.length} {sel.itens.length === 1 ? 'imóvel' : 'imóveis'} escolhidos a
          partir do que você me contou. Marque os que quer visitar — e diga o que não serviu,
          que eu ajusto a próxima leva.
        </p>
      </header>

      {alta.length > 0 ? (
        <Secao
          titulo="Batem tudo que você pediu"
          cor="var(--alta)"
          itens={alta}
          porId={porId}
          token={token}
        />
      ) : null}

      {comRessalva.length > 0 ? (
        <Secao
          titulo="Vale olhar, com uma ressalva"
          cor="var(--ressalva)"
          itens={comRessalva}
          porId={porId}
          token={token}
        />
      ) : null}

      <footer style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <p style={{ color: 'var(--muted-2)', fontSize: 12.5, lineHeight: 1.6 }}>
          Esta página registra quais imóveis você abriu e o que respondeu, para o seu corretor
          saber como te ajudar melhor. Nada é compartilhado com terceiros.
        </p>
      </footer>
    </main>
  )
}

function Secao({
  titulo,
  cor,
  itens,
  porId,
  token,
}: {
  titulo: string
  cor: string
  itens: Awaited<ReturnType<typeof porToken>> extends infer T
    ? T extends { itens: infer I }
      ? I
      : never
    : never
  porId: Map<number, any>
  token: string
}) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 15, color: cor, marginBottom: 20, letterSpacing: '.02em' }}>
        {titulo}
      </h2>
      <div style={{ display: 'grid', gap: 20 }}>
        {(itens as any[]).map((item) => {
          const im = porId.get(item.imovel_id)
          if (!im) return null
          return (
            <article
              key={item.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 18,
                overflow: 'hidden',
                background: 'var(--bg-3)',
              }}
            >
              {im.fotos?.[0] ? (
                <img
                  src={im.fotos[0]}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: 260, objectFit: 'cover' }}
                />
              ) : null}

              <div style={{ padding: '22px 24px 24px' }}>
                <h3 style={{ marginBottom: 8 }}>{brl(im.preco)}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 14 }}>
                  {im.bairro} · {im.dormitorios ?? '?'} dorm · {im.area ?? '?'} m²
                  {im.vagas ? ` · ${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : ''}
                  {im.condominio ? ` · condomínio ${brl(im.condominio)}` : ''}
                </p>

                {item.ressalva ? (
                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'var(--ressalva)',
                      background: 'var(--ressalva-fundo)',
                      padding: '10px 14px',
                      borderRadius: 10,
                      marginBottom: 16,
                    }}
                  >
                    {item.ressalva}
                  </p>
                ) : null}

                {/*
                  O link do anúncio original NÃO aparece aqui, por decisão de
                  produto: se o comprador chega ao anúncio, ele chega ao
                  corretor que captou — ou seja, ao concorrente de quem montou
                  esta seleção.
                */}
                <RespostaComprador
                  token={token}
                  imovelId={item.imovel_id}
                  statusInicial={item.status}
                  motivoInicial={item.motivo_recusa}
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
