import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import AbrirChat from '@/components/AbrirChat'
import { brl } from '@/lib/formato'
import { porId, getPool } from '@/lib/db'
import { contextoMercado } from '@/lib/mercado'
import FaixaMercado from '@/components/FaixaMercado'
import Atributos, { type Atributo } from '@/components/Atributos'
import CustoReal from '@/components/CustoReal'
import AtributosVisuais, { type AtributoVisual } from '@/components/AtributosVisuais'
import LeveParaVisita from '@/components/LeveParaVisita'
import { sinaisIncompletos } from '@/lib/completude'

// Uma ficha compartilhada no WhatsApp pode receber um pico de tráfego; ISR
// faz isso virar serving estático em vez de N consultas ao banco.
export const revalidate = 3600

const brlMeta = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * O canal de distribuição deste produto é o WhatsApp: alguém acha um
 * apartamento e manda pro cônjuge. Sem metadata, o preview do link é o título
 * genérico do site e ninguém clica.
 */
export async function generateMetadata(props: PageProps<'/imovel/[id]'>) {
  const { id } = await props.params
  const im = await porId(Number(id))
  if (!im) return { title: 'Imóvel não encontrado — mora.ai' }

  const titulo = `${brlMeta(im.preco)} · ${im.dormitorios ?? '?'} dorm · ${im.bairro}`
  const partes = [
    im.area ? `${im.area} m² privativos` : null,
    im.vagas ? `${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : 'sem vaga',
    im.condominio ? `condomínio ${brlMeta(im.condominio)}` : null,
  ].filter(Boolean)

  return {
    title: `${titulo} — mora.ai`,
    description: partes.join(' · '),
    openGraph: { title: titulo, description: partes.join(' · '), type: 'article' },
  }
}


// Next 16: params é sempre uma Promise.
export default async function Detalhe(props: PageProps<'/imovel/[id]'>) {
  const { id } = await props.params
  const im = await porId(Number(id))
  if (!im) notFound()

  const [ctx, atributos, visuais] = await Promise.all([
    contextoMercado(im.id!),
    getPool()
      .query(
        `SELECT atributo, valor, evidencia FROM atributos_extraidos
         WHERE imovel_id = $1 ORDER BY valor DESC, atributo`,
        [im.id]
      )
      .then((r) => r.rows as Atributo[]),
    getPool()
      .query(
        `SELECT atributo, valor, foto_index, foto_url FROM atributos_visuais
         WHERE imovel_id = $1 ORDER BY atributo`,
        [im.id]
      )
      .then((r) => r.rows as AtributoVisual[]),
  ])

  const sinais = sinaisIncompletos(im, ctx)

  const ficha: [string, string][] = [
    ['Preço', brl(im.preco)],
    ['Condomínio', im.condominio ? brl(im.condominio) + '/mês' : '—'],
    ['IPTU', im.iptu ? brl(im.iptu) + '/ano' : '—'],
    ['Custo mensal', im.custo_mensal ? brl(im.custo_mensal) : '—'],
    ['Preço por m²', im.preco_m2 ? brl(im.preco_m2) : '—'],
    ['Área privativa', im.area ? `${im.area} m²` : '—'],
    ['Área total', im.area_total ? `${im.area_total} m²` : '—'],
    ['Dormitórios', String(im.dormitorios ?? '—')],
    ['Suítes', String(im.suites ?? '—')],
    ['Banheiros', String(im.banheiros ?? '—')],
    ['Vagas', String(im.vagas ?? '—')],
    ['Bairro', im.bairro],
    ['Endereço', im.endereco ?? '—'],
  ]

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <Link href="/imoveis" className="tag" style={{ display: 'inline-block', marginBottom: 24 }}>
            ← voltar para o catálogo
          </Link>

          {im.fotos.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                marginBottom: 40,
              }}
            >
              {im.fotos.slice(0, 6).map((f, i) => (
                <img
                  key={f}
                  src={f}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: i === 0 ? 360 : 175,
                    objectFit: 'cover',
                    borderRadius: 16,
                    gridColumn: i === 0 ? 'span 2' : 'auto',
                  }}
                />
              ))}
            </div>
          ) : null}

          <span className="eyebrow">{im.bairro}</span>
          <h2 style={{ margin: '18px 0 10px' }}>{brl(im.preco)}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 18, marginBottom: 32 }}>
            {im.dormitorios ?? '?'} dormitórios · {im.area ?? '?'} m² privativos
            {im.vagas ? ` · ${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : ' · sem vaga'}
          </p>

          {im.dados_conflitantes ? (
            <div
              className="card"
              style={{ marginBottom: 32, borderColor: 'rgba(255,180,0,.3)' }}
            >
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                ⚠ O anúncio original traz informações inconsistentes entre os campos
                estruturados e o texto. Confirme os números com o corretor antes de
                decidir.
              </p>
            </div>
          ) : null}

          {ctx ? <FaixaMercado ctx={ctx} /> : null}

          <CustoReal preco={im.preco} condominio={im.condominio} iptu={im.iptu} />

          <Atributos lista={atributos} />

          <AtributosVisuais lista={visuais} />

          <LeveParaVisita sinais={sinais} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 1,
              background: 'var(--line)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 40,
            }}
          >
            {ficha.map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg)', padding: '18px 20px' }}>
                <span className="tag" style={{ textTransform: 'uppercase' }}>
                  {k}
                </span>
                <p style={{ fontSize: 16.5, fontWeight: 600, marginTop: 6 }}>{v}</p>
              </div>
            ))}
          </div>

          {im.descricao ? (
            <div style={{ marginBottom: 40, maxWidth: 760 }}>
              <span className="eyebrow">Descrição do anúncio</span>
              <p
                style={{
                  color: 'var(--muted)',
                  fontSize: 15.5,
                  lineHeight: 1.7,
                  marginTop: 16,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {im.descricao}
              </p>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <AbrirChat pergunta={`Me fala sobre o imóvel #${im.id}`}>
              Perguntar à IA sobre este
            </AbrirChat>
            <a
              href={im.url_origem}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              Ver anúncio original
            </a>
          </div>

          {im.corretor_nome ? (
            <p style={{ color: 'var(--muted-2)', fontSize: 13.5, marginTop: 28 }}>
              Anunciado por {im.corretor_nome}
              {im.corretor_telefone ? ` · ${im.corretor_telefone}` : ''}
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
