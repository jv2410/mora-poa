'use client'

import { useEffect, useRef, useState } from 'react'
import CardImovel from './CardImovel'
import type { useConversa } from '@/lib/useConversa'

type Conv = ReturnType<typeof useConversa>

export const SUGESTOES = [
  '2 quartos até 500 mil com vaga',
  'o mais barato pra morar sozinho',
  'quero algo no Bom Fim ou Cidade Baixa',
]

/** Coluna da conversa: mensagens, status de tool, input. */
export function ColunaConversa({
  conv,
  compacto = false,
}: {
  conv: Conv
  compacto?: boolean
}) {
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conv.parcial, conv.mensagens, conv.status])

  const vazio = conv.mensagens.length === 0 && !conv.parcial

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: compacto ? 20 : '28px 32px' }}>
        {conv.retomada ? (
          <div
            style={{
              border: '1px solid var(--green-dim)',
              background: 'rgba(0,232,122,.05)',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: 'var(--muted)' }}>Continuando de antes — você procurava</span>{' '}
            <span style={{ color: 'var(--ink)' }}>“{conv.retomada}”</span>{' '}
            <button
              onClick={conv.recomecar}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--green)',
                cursor: 'pointer',
                fontSize: 13.5,
                fontFamily: 'var(--sans)',
                padding: 0,
              }}
            >
              recomeçar
            </button>
          </div>
        ) : null}

        {vazio ? (
          <div>
            <p style={{ color: 'var(--ink)', marginBottom: 8, fontWeight: 600, fontSize: 17 }}>
              Me conta o que você procura.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 22, lineHeight: 1.6 }}>
              Fala do jeito que você pensa — orçamento, bairro, quantos quartos, se precisa de
              vaga. Eu comparo com o mercado do bairro e te digo o que serve e o que não serve.
            </p>
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => conv.enviar(s)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  padding: '13px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'rgba(255,255,255,.02)',
                  color: 'var(--muted)',
                  fontFamily: 'var(--sans)',
                  fontSize: 14.5,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {conv.mensagens.map((m, i) => (
          <Bolha key={i} role={m.role} texto={m.content} />
        ))}
        {conv.parcial ? <Bolha role="assistant" texto={conv.parcial} /> : null}

        {conv.status ? (
          <p
            style={{
              color: 'var(--green)',
              fontSize: 13,
              fontFamily: 'var(--mono)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            <span className="pulsa" />
            {conv.status}
          </p>
        ) : null}

        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (conv.carregando) return
          conv.enviar(texto)
          setTexto('')
        }}
        style={{
          padding: compacto ? 16 : '18px 32px 24px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite aqui…"
          disabled={conv.carregando}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '13px 18px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'rgba(255,255,255,.02)',
            color: 'var(--ink)',
            fontFamily: 'var(--sans)',
            // 16px evita o zoom automático do iOS ao focar o campo
            fontSize: 16,
            outline: 'none',
          }}
        />
        {conv.carregando ? (
          <button type="button" onClick={conv.parar} className="btn btn-outline">
            parar
          </button>
        ) : (
          <button type="submit" className="btn btn-solid" aria-label="Enviar">
            →
          </button>
        )}
      </form>
    </>
  )
}

/** Coluna dos resultados: cards, skeleton enquanto busca, estado vazio. */
export function ColunaResultados({ conv }: { conv: Conv }) {
  const buscando = conv.status.startsWith('buscando')

  if (buscando && conv.imoveis.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 250, borderRadius: 20, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    )
  }

  if (conv.imoveis.length === 0) {
    return (
      <p style={{ color: 'var(--muted-2)', fontSize: 13.5, marginTop: 8 }}>
        Os imóveis aparecem aqui conforme a gente conversa.
      </p>
    )
  }

  return (
    <>
      <p className="tag" style={{ marginBottom: 14, textTransform: 'uppercase', display: 'block' }}>
        {conv.imoveis.length} imóveis · ordenados por match
      </p>
      <div style={{ display: 'grid', gap: 16 }}>
        {conv.imoveis.map((im) => (
          <CardImovel key={im.id} im={im} />
        ))}
      </div>
    </>
  )
}

function Bolha({ role, texto }: { role: 'user' | 'assistant'; texto: string }) {
  const eu = role === 'user'
  return (
    <div
      style={{
        marginBottom: 18,
        padding: eu ? '11px 15px' : 0,
        borderRadius: 14,
        background: eu ? 'rgba(0,232,122,.08)' : 'transparent',
        border: eu ? '1px solid var(--green-dim)' : 'none',
        marginLeft: eu ? 32 : 0,
      }}
    >
      <p
        style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}
        dangerouslySetInnerHTML={{ __html: formatar(texto) }}
      />
    </div>
  )
}

/** Negrito do markdown que o modelo usa, escapando o resto. */
function formatar(t: string) {
  const escapado = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escapado.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
