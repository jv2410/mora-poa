import Link from 'next/link'

export default function Nav() {
  return (
    <div className="wrap">
      <nav className="nav">
        <Link href="/" className="marca">
          mora<span>.ai</span>
        </Link>
        <div className="nav-links">
          <Link href="/chat">Conversar</Link>
          <Link href="/imoveis">Imóveis</Link>
          <Link href="/mercado">Mercado</Link>
          <Link href="/dados">De onde vêm os dados</Link>
        </div>
      </nav>
    </div>
  )
}
