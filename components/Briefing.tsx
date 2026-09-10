'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * O briefing real de um corretor, com tudo que o cliente falou e nada
 * estruturado. É o placeholder porque ele ensina o formato: prosa, contradição
 * ("teto de 750 mas estica até 800"), motivo ("já pagam escola"), e o que é
 * obrigatório versus desejável. Um placeholder como "digite sua busca" não
 * ensinaria nada e o corretor escreveria três palavras.
 */
const EXEMPLO = `Cliente é um casal, ela grávida, moram no Menino Deus e querem continuar na região ou perto. Precisam de 3 dormitórios sendo 1 suíte, 2 vagas cobertas obrigatório porque têm dois carros. Teto de R$ 750 mil mas ele falou que se for muito bom estica até 800. Condomínio não pode passar de R$ 900 porque já pagam escola. Querem prédio com playground. Não querem térreo.`

/** Abaixo disto não é briefing, é palpite — e o match sai ruim. */
const MINIMO_UTIL = 40

export default function Briefing() {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [tentouCurto, setTentouCurto] = useState(false)

  const limpo = texto.trim()
  const curto = limpo.length > 0 && limpo.length < MINIMO_UTIL

  const enviar = () => {
    if (!limpo) return
    if (curto) {
      setTentouCurto(true)
      return
    }
    router.push(`/chat?q=${encodeURIComponent(limpo)}`)
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', textAlign: 'left' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        <label
          htmlFor="briefing"
          style={{
            display: 'block',
            fontSize: 13,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          Briefing do cliente
        </label>

        <textarea
          id="briefing"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (tentouCurto) setTentouCurto(false)
          }}
          placeholder={EXEMPLO}
          rows={7}
          // Ctrl/Cmd+Enter envia: quem cola briefing longo precisa de Enter
          // para quebrar linha, então o atalho não pode ser o Enter puro.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              enviar()
            }
          }}
          style={{
            width: '100%',
            padding: '18px 20px',
            borderRadius: 16,
            border: `1px solid ${tentouCurto ? 'var(--alerta)' : 'var(--line)'}`,
            background: 'var(--campo)',
            color: 'var(--ink)',
            fontFamily: 'var(--sans)',
            fontSize: 16,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color .25s var(--ease)',
          }}
          onFocus={(e) => {
            if (!tentouCurto) e.currentTarget.style.borderColor = 'var(--foco)'
          }}
          onBlur={(e) => {
            if (!tentouCurto) e.currentTarget.style.borderColor = 'var(--line)'
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginTop: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13.5, color: tentouCurto ? 'var(--alerta)' : 'var(--muted)' }}>
            {tentouCurto
              ? 'Escreva o que o cliente falou, com as palavras dele — quanto mais contexto, melhor o match.'
              : 'Do jeito que o cliente falou. Sem formulário, sem campo obrigatório.'}
          </span>
          <button type="submit" className="btn btn-solid" disabled={!limpo}>
            Buscar no estoque
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => setTexto(EXEMPLO)}
        style={{
          marginTop: 18,
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--muted)',
          fontFamily: 'var(--sans)',
          fontSize: 13.5,
          cursor: 'pointer',
          borderBottom: '1px solid var(--line)',
        }}
      >
        usar um briefing de exemplo
      </button>
    </div>
  )
}
