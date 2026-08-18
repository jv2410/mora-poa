import type { ImovelComScore } from '@/lib/tipos'

export const brl = (n: number | null | undefined) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      })

type Props = { im: Partial<ImovelComScore> & { id?: number } }

export default function CardImovel({ im }: Props) {
  return (
    <a href={`/imovel/${im.id}`} className="card" style={{ display: 'block' }}>
      {im.fotos?.[0] ? (
        <img
          src={im.fotos[0]}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            height: 190,
            objectFit: 'cover',
            borderRadius: 12,
            marginBottom: 16,
          }}
        />
      ) : null}

      {im.score != null ? (
        <div className="pill" style={{ marginBottom: 12 }}>
          <span className="dot" />
          {im.score}% de match
        </div>
      ) : null}

      <h3 style={{ marginBottom: 8 }}>{brl(im.preco)}</h3>

      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>
        {im.bairro} · {im.dormitorios ?? '?'} dorm · {im.area ?? '?'} m²
        {im.vagas ? ` · ${im.vagas} vaga${im.vagas > 1 ? 's' : ''}` : ''}
      </p>

      {im.atende?.slice(0, 2).map((t) => (
        <p key={t} style={{ fontSize: 13, color: 'var(--green)', marginBottom: 4 }}>
          ✓ {t}
        </p>
      ))}
      {im.nao_atende?.slice(0, 1).map((t) => (
        <p key={t} style={{ fontSize: 13, color: 'var(--muted-2)' }}>
          · {t}
        </p>
      ))}

      {im.dados_conflitantes ? (
        <p style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 10 }}>
          ⚠ dados inconsistentes no anúncio original
        </p>
      ) : null}
    </a>
  )
}
