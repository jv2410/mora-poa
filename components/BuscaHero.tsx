'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const EXEMPLOS = [
  'dois quartos até 600 mil, de preferência perto da Redenção',
  'algo pequeno e barato pra morar sozinho',
  'preciso de vaga e condomínio baixo',
  'tenho 150 mil de entrada, o que dá pra fazer?',
]

/**
 * O input é a porta de entrada, não um botão que abre um painel.
 *
 * Quem chega precisa entender em três segundos o que isto é e começar a usar
 * sem ler nada. Um campo de texto com exemplo rodando faz isso; um CTA
 * genérico obriga a pessoa a decidir antes de entender.
 */
export default function BuscaHero({ chips }: { chips: string[] }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % EXEMPLOS.length), 3800)
    return () => clearInterval(t)
  }, [])

  const ir = (q: string) => {
    const limpo = q.trim()
    if (limpo) router.push(`/chat?q=${encodeURIComponent(limpo)}`)
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ir(texto)
        }}
        style={{ display: 'flex', gap: 10, marginBottom: 18 }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EXEMPLOS[i]}
          aria-label="Descreva o imóvel que você procura"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '17px 24px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'rgba(255,255,255,.03)',
            color: 'var(--ink)',
            fontFamily: 'var(--sans)',
            fontSize: 16,
            outline: 'none',
            transition: 'border-color .3s var(--ease)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--green-dim)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
        />
        <button type="submit" className="btn btn-solid">
          Buscar
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => ir(c)}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'rgba(255,255,255,.02)',
              color: 'var(--muted)',
              fontFamily: 'var(--sans)',
              fontSize: 13.5,
              cursor: 'pointer',
              transition: '.25s var(--ease)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--green-dim)'
              e.currentTarget.style.color = 'var(--ink)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--line)'
              e.currentTarget.style.color = 'var(--muted)'
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}
