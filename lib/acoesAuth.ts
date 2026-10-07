'use server'

import { redirect } from 'next/navigation'
import { criarConta, entrar, abrirSessao, fecharSessao, reivindicarHistorico } from './auth'

/**
 * Server Actions do login. Ficam separadas de `lib/auth.ts` para aquele módulo
 * continuar importável por rotas e páginas sem arrastar a diretiva 'use server'.
 */
export async function acaoEntrar(_: unknown, form: FormData) {
  const email = String(form.get('email') ?? '')
  const senha = String(form.get('senha') ?? '')
  const corretorId = String(form.get('corretorId') ?? '')

  const r = await entrar(email, senha)
  if (!r.ok) return { erro: r.motivo }

  await abrirSessao(r.usuarioId)
  // Costura o histórico anônimo deste navegador com a conta.
  if (corretorId) await reivindicarHistorico(r.usuarioId, corretorId)
  redirect('/painel')
}

export async function acaoCriarConta(_: unknown, form: FormData) {
  const r = await criarConta({
    imobiliaria: String(form.get('imobiliaria') ?? ''),
    nome: String(form.get('nome') ?? ''),
    email: String(form.get('email') ?? ''),
    senha: String(form.get('senha') ?? ''),
    mensalidade: form.get('mensalidade') ? Number(form.get('mensalidade')) : null,
  })
  if (!r.ok) return { erro: r.motivo }

  await abrirSessao(r.usuarioId)
  const corretorId = String(form.get('corretorId') ?? '')
  if (corretorId) await reivindicarHistorico(r.usuarioId, corretorId)
  redirect('/painel')
}

export async function acaoSair() {
  await fecharSessao()
  redirect('/')
}
