import type { Metadata } from 'next'
import '@/styles/system.css'
import ChatPanel from '@/components/ChatPanel'

export const metadata: Metadata = {
  title: 'MORA.AI — o estoque da cidade cruzado com o briefing do seu cliente',
  description:
    'Cole o briefing do seu cliente. A MORA cruza com o estoque, separa o que tem alta compatibilidade do que vale apresentar com ressalva, e diz o que furou.',
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
