import { NextResponse, type NextRequest } from 'next/server'

/**
 * Evita a viagem inútil: sem cookie de sessão não vale renderizar a página
 * para ela mesma redirecionar.
 *
 * Isto é conveniência, não autorização. O middleware roda no edge e não
 * consulta o banco, então só consegue ver que existe *algum* cookie — não se a
 * sessão é válida. Quem decide de verdade é o layout de cada grupo, que
 * consulta a tabela de sessões: um cookie forjado passa por aqui e morre lá.
 */
const PROTEGIDAS = [
  '/chat', '/imoveis', '/imovel', '/mercado', '/orcamento', '/estoque', '/painel',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const protegida = PROTEGIDAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!protegida) return NextResponse.next()
  if (req.cookies.get('mora_sessao')) return NextResponse.next()

  // Guarda onde a pessoa queria chegar, para o login devolver ela para lá.
  const destino = new URL('/entrar', req.url)
  destino.searchParams.set('destino', pathname + req.nextUrl.search)
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: [
    '/chat', '/chat/:path*',
    '/imoveis', '/imoveis/:path*',
    '/imovel/:path*',
    '/mercado', '/mercado/:path*',
    '/orcamento', '/orcamento/:path*',
    '/estoque', '/estoque/:path*',
    '/painel', '/painel/:path*',
  ],
}
