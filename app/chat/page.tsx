'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useConversa } from '@/lib/useConversa'
import { ColunaConversa, ColunaResultados } from '@/components/Conversa'

/**
 * O chat como rota de primeira classe, e não como overlay.
 *
 * A conversa é o produto: ela precisa de endereço próprio, para poder ser
 * aberta direto, favoritada e — com ?q= — iniciada a partir de um link.
 */
function ChatInterno() {
  const params = useSearchParams()
  const conv = useConversa(params.get('q'))

  return (
    <div className="chat-cheio">
      <header className="chat-cheio-topo">
        <Link href="/" className="marca">
          MORA<span>.AI</span>
        </Link>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link href="/imoveis" className="tag">
            ver catálogo
          </Link>
          <Link href="/dados" className="tag">
            de onde vêm os dados
          </Link>
          {conv.mensagens.length > 0 && (
            <button onClick={conv.recomecar} className="tag botao-texto">
              nova conversa
            </button>
          )}
        </div>
      </header>

      <div className="chat-cheio-corpo">
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          <ColunaConversa conv={conv} />
        </div>
        <aside className="chat-cheio-resultados">
          <ColunaResultados conv={conv} />
        </aside>
      </div>
    </div>
  )
}

/**
 * useSearchParams precisa de um limite de Suspense para o Next conseguir
 * pré-renderizar a casca da página. Sem isso o build quebra no prerender.
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="chat-cheio" />}>
      <ChatInterno />
    </Suspense>
  )
}
