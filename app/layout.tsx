import type { Metadata } from 'next'
import '@/styles/system.css'
import ChatPanel from '@/components/ChatPanel'

export const metadata: Metadata = {
  title: 'MORA.AI — o estoque da cidade cruzado com o briefing do seu cliente',
  description:
    'Descreva o que você procura em português. A IA busca no banco, ranqueia e explica por que cada imóvel serve para você.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ChatPanel />
      </body>
    </html>
  )
}
