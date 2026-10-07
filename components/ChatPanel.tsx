'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useConversa } from '@/lib/useConversa'
import { ColunaConversa, ColunaResultados } from './Conversa'

/**
 * O painel lateral. Vive no layout, então sobrevive à navegação entre páginas
 * — desde que os links do site sejam <Link>, e não <a>. Com <a> cada clique
 * recarrega a página e a conversa evapora.
 */
export default function ChatPanel() {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()
  const conv = useConversa()

  useEffect(() => {
    const abrir = (e: Event) => {
      setAberto(true)
      const pergunta = (e as CustomEvent).detail?.pergunta
      if (pergunta) setTimeout(() => conv.enviar(pergunta), 120)
    }
    window.addEventListener('abrir-chat', abrir)
    return () => window.removeEventListener('abrir-chat', abrir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.enviar])

  // Em /chat a conversa já é a página inteira.
  // Em /chat a conversa já é a página inteira.
  //
  // Em /s/[token] quem está olhando é o COMPRADOR, não o corretor: aquela
  // página é a seleção que ele recebeu no WhatsApp. Abrir ali o chat da MORA
  // entregaria a ele o estoque inteiro, o raio-X de preço por bairro e o
  // caminho para procurar sozinho — exatamente o que o corretor não quer, e o
  // motivo pelo qual nem o link do anúncio original aparece nessa página.
  if (pathname === '/chat' || pathname.startsWith('/s/')) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="btn btn-solid fab-chat"
        aria-label="Abrir conversa"
      >
        <span className="dot-escuro" />
        {conv.mensagens.length > 0 ? 'Continuar conversa' : 'Falar com a IA'}
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="chat-header">
          <div className="pill">
            <span className="dot" />
            corretor ia
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/chat" className="tag" style={{ alignSelf: 'center' }}>
              abrir em tela cheia
            </a>
            <button onClick={() => setAberto(false)} aria-label="Fechar" className="botao-fechar">
              ×
            </button>
          </div>
        </header>
        <ColunaConversa conv={conv} compacto />
      </div>

      <div className="chat-resultados">
        <ColunaResultados conv={conv} />
      </div>
    </div>
  )
}
