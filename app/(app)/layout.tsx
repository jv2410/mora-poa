import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/auth'

/**
 * Guarda de tudo que é ferramenta: Briefing, catálogo, ficha, mercado,
 * orçamento e estoque.
 *
 * A checagem mora no layout do grupo, e não repetida em cada página, pelo
 * mesmo motivo do corte de contato em lib/db.ts: uma tela criada amanhã nasce
 * protegida sem ninguém precisar lembrar. Antes disto só /painel exigia
 * sessão, e o Briefing — o coração do produto — respondia a qualquer visitante
 * com o link.
 *
 * Três coisas ficam fora do grupo e seguem públicas: a landing, que precisa
 * ser aberta para apresentar o produto; o login; e a seleção que o comprador
 * abre pelo WhatsApp, que não tem login por definição.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  if (!(await usuarioAtual())) redirect('/entrar')
  return <>{children}</>
}
