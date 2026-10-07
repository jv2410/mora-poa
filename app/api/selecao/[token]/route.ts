import { responder, registrarVisualizacaoItem, MOTIVOS, type Motivo } from '@/lib/selecao'

export const runtime = 'nodejs'

/**
 * A resposta do comprador na página da seleção. Não há login: o token do link
 * é a credencial, e é por isso que ele é aleatório e longo.
 *
 * Aceita dois tipos de evento — a resposta explícita ("quero visitar" / "não é
 * pra mim") e o sinal passivo de visualização. O sinal passivo não é
 * aprovação, mas é o que produz "abriu 6 vezes e não respondeu".
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ erro: 'Pedido inválido.' }, { status: 400 })
  }

  const imovelId = Number(body?.imovel_id)
  if (!Number.isInteger(imovelId) || imovelId <= 0) {
    return Response.json({ erro: 'Imóvel inválido.' }, { status: 400 })
  }

  try {
    if (body?.evento === 'visualizou') {
      await registrarVisualizacaoItem(token, imovelId)
      return Response.json({ ok: true })
    }

    const resposta = body?.resposta
    if (resposta !== 'quero_visitar' && resposta !== 'nao_e_pra_mim') {
      return Response.json({ erro: 'Resposta inválida.' }, { status: 400 })
    }

    const motivo: Motivo | null = MOTIVOS.includes(body?.motivo) ? body.motivo : null
    await responder(token, imovelId, resposta, motivo)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ erro: 'Não foi possível registrar.' }, { status: 500 })
  }
}
