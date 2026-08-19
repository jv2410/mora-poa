'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ImovelComScore } from '@/lib/tipos'
import { brl } from '@/lib/formato'


type Props = { im: Partial<ImovelComScore> & { id?: number } }

export default function CardImovel({ im }: Props) {
  // As fotos vêm de CDNs de terceiros e vão quebrar com o tempo. Um ícone de
  // imagem quebrada num catálogo é o oposto de confiança.
  const [semFoto, setSemFoto] = useState(false)
  const temFoto = Boolean(im.fotos?.[0]) && !semFoto

  return (
    <Link href={`/imovel/${im.id}`} className="card" style={{ display: 'block' }}>
      {temFoto ? (
        <img
          src={im.fotos![0]}
          alt=""
          loading="lazy"
          // Os CDNs do Grupo OLX bloqueiam hotlink por Referer. Sem isto o
          // browser manda o nosso domínio no header e leva 403, enquanto um
          // curl sem referer passa — foi exatamente o sintoma observado.
          referrerPolicy="no-referrer"
          onError={() => setSemFoto(true)}
          style={{
            width: '100%',
            height: 190,
            objectFit: 'cover',
            borderRadius: 12,
            marginBottom: 16,
          }}
        />
      ) : (
        <div className="foto-vazia">{im.bairro ?? 'sem foto'}</div>
      )}

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
    </Link>
  )
}
