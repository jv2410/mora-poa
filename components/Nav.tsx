import Link from 'next/link'

export default function Nav() {
  return (
    <div className="wrap">
      <nav className="nav">
        <Link href="/" className="marca">
          MORA<span>.AI</span>
        </Link>
        <div className="nav-links">
          <Link href="/chat">Briefing</Link>
          <Link href="/imoveis">Imóveis</Link>
          <Link href="/mercado">Mercado</Link>
          <Link href="/estoque">Estoque</Link>
          <Link href="/orcamento">Orçamento</Link>
          <Link href="/dados">Dados</Link>
          <Link href="/painel">Painel</Link>
        </div>
      </nav>
    </div>
  )
}
