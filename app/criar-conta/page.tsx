import Nav from '@/components/Nav'
import FormAuth from '@/components/FormAuth'
import { acaoCriarConta } from '@/lib/acoesAuth'
import { usuarioAtual } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Criar conta — MORA.AI' }

export default async function CriarConta() {
  if (await usuarioAtual()) redirect('/painel')

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 56 }}>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 20px' }}>
          <span className="eyebrow">Criar conta</span>
          <h2 style={{ fontSize: 'clamp(30px,5vw,42px)', margin: '16px 0 10px' }}>
            Comece pela imobiliária.
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 32, fontSize: 15.5 }}>
            Você entra como diretor e depois adiciona os corretores. Quem cadastra é quem
            assina.
          </p>
          <FormAuth
            acao={acaoCriarConta}
            botao="Criar conta"
            campos={[
              { nome: 'imobiliaria', label: 'Nome da imobiliária' },
              { nome: 'nome', label: 'Seu nome' },
              { nome: 'email', label: 'E-mail', tipo: 'email' },
              {
                nome: 'senha',
                label: 'Senha',
                tipo: 'password',
                dica: 'No mínimo 8 caracteres.',
              },
              {
                nome: 'mensalidade',
                label: 'Mensalidade do plano',
                tipo: 'number',
                opcional: true,
                dica: 'Usada para calcular o múltiplo de retorno no painel da diretoria.',
              },
            ]}
            rodape={{ texto: 'Já tem conta?', link: 'entrar', href: '/entrar' }}
          />
        </div>
      </section>
    </>
  )
}
