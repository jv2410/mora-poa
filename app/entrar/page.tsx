import Nav from '@/components/Nav'
import FormAuth from '@/components/FormAuth'
import { acaoEntrar } from '@/lib/acoesAuth'
import { usuarioAtual } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Entrar — MORA.AI' }

export default async function Entrar() {
  if (await usuarioAtual()) redirect('/painel')

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 20px' }}>
          <span className="eyebrow">Entrar</span>
          <h2 style={{ fontSize: 'clamp(30px,5vw,42px)', margin: '16px 0 10px' }}>
            Bem-vindo de volta.
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 32, fontSize: 15.5 }}>
            Suas buscas e seleções continuam onde você parou.
          </p>
          <FormAuth
            acao={acaoEntrar}
            botao="Entrar"
            campos={[
              { nome: 'email', label: 'E-mail', tipo: 'email' },
              { nome: 'senha', label: 'Senha', tipo: 'password' },
            ]}
            rodape={{ texto: 'Ainda não tem conta?', link: 'criar conta', href: '/criar-conta' }}
          />
        </div>
      </section>
    </>
  )
}
