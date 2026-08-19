import { ImageResponse } from 'next/og'
import { porId } from '@/lib/db'
import { contextoMercado } from '@/lib/mercado'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Imóvel no mora.ai'

const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * O preview do link no WhatsApp.
 *
 * O detalhe que faz a diferença é o selo de mercado: nenhum portal manda no
 * preview a informação "está 12% abaixo da mediana do bairro". É isso que faz
 * a pessoa do outro lado abrir o link.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const im = await porId(Number(id))

  if (!im) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#080808',
            color: '#f4f6f4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
          }}
        >
          mora.ai
        </div>
      ),
      size
    )
  }

  const ctx = await contextoMercado(im.id!)
  const delta = ctx?.delta_mediana_pct ?? null
  const selo =
    delta != null && Math.abs(delta) >= 8
      ? `${Math.abs(delta)}% ${delta < 0 ? 'abaixo' : 'acima'} da mediana do bairro`
      : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#080808' }}>
        {im.fotos[0] ? (
          <img
            src={im.fotos[0]}
            width={520}
            height={630}
            style={{ objectFit: 'cover' }}
            alt=""
          />
        ) : null}

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '56px 56px',
            color: '#f4f6f4',
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: '#00e87a',
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 24,
              display: 'flex',
            }}
          >
            {im.bairro}
          </div>

          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, display: 'flex' }}>
            {brl(im.preco)}
          </div>

          <div style={{ fontSize: 30, color: '#9aa39c', marginTop: 18, display: 'flex' }}>
            {im.dormitorios ?? '?'} dorm · {im.area ?? '?'} m²
            {im.vagas ? ` · ${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : ' · sem vaga'}
          </div>

          {selo ? (
            <div
              style={{
                marginTop: 36,
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '14px 26px',
                borderRadius: 999,
                border: '2px solid rgba(0,232,122,.35)',
                background: 'rgba(0,232,122,.1)',
                color: '#00e87a',
                fontSize: 24,
              }}
            >
              {selo}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 'auto',
              fontSize: 24,
              color: '#6b736c',
              display: 'flex',
            }}
          >
            mora.ai
          </div>
        </div>
      </div>
    ),
    size
  )
}
