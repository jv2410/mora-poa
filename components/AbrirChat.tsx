'use client'

/**
 * Botão que dispara a abertura do painel de chat. Comunica-se com o
 * ChatPanel por CustomEvent para não precisar de context provider.
 */
export function abrirChat(pergunta?: string) {
  window.dispatchEvent(new CustomEvent('abrir-chat', { detail: { pergunta } }))
}

type Props = {
  children: React.ReactNode
  pergunta?: string
  className?: string
}

export default function AbrirChat({ children, pergunta, className = 'btn btn-solid' }: Props) {
  return (
    <button className={className} onClick={() => abrirChat(pergunta)}>
      {children}
    </button>
  )
}
