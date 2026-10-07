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

/**
 * Ajusta os parâmetros da conta.
 *
 * Os três valores entram em contas de painel: a comissão define a comissão
 * potencial, a mensalidade é o divisor do múltiplo de retorno, e os minutos por
 * 30 imóveis são o parâmetro das horas economizadas — que o documento exige que
 * seja ajustável, justamente para o corretor poder discordar do número em vez
 * de desconfiar dele.
 */
export async function acaoSalvarConta(_: unknown, form: FormData) {
  const { usuarioAtual, VE_DIRETORIA } = await import('./auth')
  const { getPool } = await import('./db')
  const { revalidatePath } = await import('next/cache')

  const u = await usuarioAtual()
  if (!u) return { erro: 'Sessão expirada.' }
  // Parâmetro que muda indicador de retorno é decisão de quem assina.
  if (!VE_DIRETORIA.includes(u.papel)) return { erro: 'Só a diretoria altera estes valores.' }

  const num = (campo: string) => {
    const bruto = form.get(campo)
    if (bruto == null || String(bruto).trim() === '') return null
    const n = Number(String(bruto).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  const comissao = num('comissao_pct')
  const mensalidade = num('mensalidade')
  const minutos = num('min_por_30_imoveis')

  if (comissao == null || comissao > 100) return { erro: 'Comissão deve ficar entre 0 e 100%.' }
  if (minutos == null || minutos < 1 || minutos > 240) {
    return { erro: 'Minutos por 30 imóveis deve ficar entre 1 e 240.' }
  }

  await getPool().query(
    `UPDATE contas SET comissao_pct = $2, mensalidade = $3, min_por_30_imoveis = $4
     WHERE id = $1`,
    [u.conta_id, comissao, mensalidade, minutos]
  )

  revalidatePath('/painel')
  revalidatePath('/painel/diretoria')
  return { ok: 'Salvo.' }
}
