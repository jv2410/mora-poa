import Link from 'next/link'
import { redirect } from 'next/navigation'
import { usuarioAtual, VE_EQUIPE, VE_DIRETORIA } from '@/lib/auth'
import { acaoSair } from '@/lib/acoesAuth'

/**
 * Tudo sob /painel exige sessão. A checagem fica no layout para nenhuma página
 * nova nascer desprotegida por esquecimento — o mesmo raciocínio do corte de
 * dados pessoais em lib/db.ts.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const u = await usuarioAtual()
  if (!u) redirect('/entrar')

  const abas = [
    { href: '/painel', rotulo: 'Meu mês', visivel: true },
    { href: '/painel/equipe', rotulo: 'Equipe', visivel: VE_EQUIPE.includes(u.papel) },
    { href: '/painel/diretoria', rotulo: 'Diretoria', visivel: VE_DIRETORIA.includes(u.papel) },
    { href: '/painel/conta', rotulo: 'Conta', visivel: VE_DIRETORIA.includes(u.papel) },
  ].filter((a) => a.visivel)

  return (
    <>
      <div className="wrap">
        <nav className="nav">
          <Link href="/" className="marca">
            MORA<span>.AI</span>
          </Link>
          <div className="nav-links">
            <Link href="/chat">Briefing</Link>
            {abas.map((a) => (
              <Link key={a.href} href={a.href}>
                {a.rotulo}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div
        className="wrap"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          paddingTop: 8,
          paddingBottom: 8,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
          {u.nome} · {u.conta_nome} ·{' '}
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{u.papel}</span>
        </span>
        <form action={acaoSair}>
          <button
            type="submit"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--muted-2)',
              fontFamily: 'var(--sans)',
              fontSize: 13.5,
              cursor: 'pointer',
              borderBottom: '1px solid var(--line)',
            }}
          >
            sair
          </button>
        </form>
      </div>

      {children}
    </>
  )
}
