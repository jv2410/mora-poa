'use client'

import { useEffect, useRef, useState } from 'react'
import CardImovel from './CardImovel'
import type { ImovelComScore } from '@/lib/tipos'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGESTOES = [
  '2 quartos até 600 mil no Bom Fim',
  'algo pequeno e barato pra morar sozinho',
  'com vaga e condomínio baixo',
]

export default function ChatPanel() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [imoveis, setImoveis] = useState<ImovelComScore[]>([])
  const [parcial, setParcial] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [texto, setTexto] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const abrir = (e: Event) => {
      setAberto(true)
      const pergunta = (e as CustomEvent).detail?.pergunta
      if (pergunta) setTimeout(() => enviar(pergunta), 100)
    }
    window.addEventListener('abrir-chat', abrir)
    return () => window.removeEventListener('abrir-chat', abrir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagens])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [parcial, mensagens])

  async function enviar(conteudo: string) {
    const limpo = conteudo.trim()
    if (!limpo || carregando) return

    const novas: Msg[] = [...mensagens, { role: 'user', content: limpo }]
    setMensagens(novas)
    setTexto('')
    setCarregando(true)
    setParcial('')

    let acumulado = ''
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: novas }),
      })
      if (!r.body) throw new Error('sem corpo na resposta')

      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const linhas = buffer.split('\n\n')
        buffer = linhas.pop() ?? ''

        for (const linha of linhas) {
          if (!linha.startsWith('data: ')) continue
          const ev = JSON.parse(linha.slice(6))
          if (ev.tipo === 'texto') {
            acumulado += ev.texto
            setParcial(acumulado)
          } else if (ev.tipo === 'imoveis') {
            setImoveis(ev.imoveis)
          } else if (ev.tipo === 'erro') {
            acumulado += `\n\n${ev.mensagem}`
            setParcial(acumulado)
          }
        }
      }
    } catch {
      acumulado += '\n\nPerdi a conexão. Tenta de novo?'
    }

    setMensagens((m) => [...m, { role: 'assistant', content: acumulado }])
    setParcial('')
    setCarregando(false)
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="btn btn-solid"
        style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 60 }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#04140c',
            display: 'inline-block',
          }}
        />
        Falar com a IA
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        left: 'auto',
        width: 'min(760px, 100vw)',
        zIndex: 60,
        background: 'var(--bg-2)',
        borderLeft: '1px solid var(--line)',
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 380px) 1fr',
        boxShadow: '-30px 0 70px -20px rgba(0,0,0,.7)',
      }}
      className="chat-panel"
    >
      {/* Coluna da conversa */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div className="pill">
            <span className="dot" />
            corretor ia
          </div>
          <button
            onClick={() => setAberto(false)}
            aria-label="Fechar"
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {mensagens.length === 0 && !parcial ? (
            <div>
              <p style={{ color: 'var(--ink)', marginBottom: 8, fontWeight: 600 }}>
                Me conta o que você procura.
              </p>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
                Fala do jeito que você pensa — orçamento, bairro, quantos quartos, se
                precisa de vaga. Eu acho o que faz sentido.
              </p>
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 8,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    background: 'rgba(255,255,255,.02)',
                    color: 'var(--muted)',
                    fontFamily: 'var(--sans)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {mensagens.map((m, i) => (
            <Bolha key={i} role={m.role} texto={m.content} />
          ))}
          {parcial ? <Bolha role="assistant" texto={parcial} /> : null}
          {carregando && !parcial ? (
            <p style={{ color: 'var(--muted-2)', fontSize: 13, fontFamily: 'var(--mono)' }}>
              consultando o banco…
            </p>
          ) : null}
          <div ref={fimRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            enviar(texto)
          }}
          style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite aqui…"
            disabled={carregando}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '13px 16px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'rgba(255,255,255,.02)',
              color: 'var(--ink)',
              fontFamily: 'var(--sans)',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <button type="submit" className="btn btn-solid" disabled={carregando}>
            →
          </button>
        </form>
      </div>

      {/* Coluna dos resultados */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          overflowY: 'auto',
          padding: 20,
          background: 'var(--bg)',
        }}
        className="chat-resultados"
      >
        {imoveis.length === 0 ? (
          <p style={{ color: 'var(--muted-2)', fontSize: 13.5, marginTop: 8 }}>
            Os imóveis aparecem aqui conforme a gente conversa.
          </p>
        ) : (
          <>
            <p
              className="tag"
              style={{ marginBottom: 14, textTransform: 'uppercase' }}
            >
              {imoveis.length} imóveis · ordenados por match
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              {imoveis.map((im) => (
                <CardImovel key={im.id} im={im} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Bolha({ role, texto }: { role: 'user' | 'assistant'; texto: string }) {
  const eu = role === 'user'
  return (
    <div
      style={{
        marginBottom: 16,
        padding: eu ? '11px 15px' : 0,
        borderRadius: 14,
        background: eu ? 'rgba(0,232,122,.08)' : 'transparent',
        border: eu ? '1px solid var(--green-dim)' : 'none',
        marginLeft: eu ? 32 : 0,
      }}
    >
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.62,
          color: eu ? 'var(--ink)' : 'var(--ink)',
          whiteSpace: 'pre-wrap',
        }}
        dangerouslySetInnerHTML={{ __html: formatar(texto) }}
      />
    </div>
  )
}

/** Negrito do markdown que o modelo usa, escapando o resto. */
function formatar(t: string) {
  const escapado = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escapado.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
