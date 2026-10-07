import { criarSelecao, marcarEnviada } from '@/lib/selecao'
import { verificarLimite, ipDaRequisicao } from '@/lib/ratelimit'
import { usuarioAtual } from '@/lib/auth'

export const runtime = 'nodejs'

const ID_VALIDO = /^[a-z0-9-]{8,64}$/i

/**
 * Cria a seleção que o corretor vai mandar ao comprador e devolve o link.
 *
 * O link já nasce "enviado": o corretor clica em copiar e manda no WhatsApp no
 * mesmo gesto. Separar criar de enviar em dois passos só criaria seleções
 * órfãs no meio do funil.
 */
export async function POST(req: Request) {
  const limite = verificarLimite(ipDaRequisicao(req))
  if (!limite.ok) return Response.json({ erro: limite.motivo }, { status: 429 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ erro: 'Pedido inválido.' }, { status: 400 })
  }

  // Criar seleção é ação de corretor autenticado. A resposta do comprador vive
  // em [token]/route.ts e continua sem login, porque é o link do WhatsApp.
  const u = await usuarioAtual()
  if (!u) return Response.json({ erro: 'Entre na sua conta.' }, { status: 401 })

  const corretorId = body?.corretorId
  if (typeof corretorId !== 'string' || !ID_VALIDO.test(corretorId)) {
    return Response.json({ erro: 'Sessão não identificada.' }, { status: 400 })
  }

  const itens = Array.isArray(body?.itens) ? body.itens : []
  if (itens.length === 0) {
    return Response.json({ erro: 'Selecione ao menos um imóvel.' }, { status: 400 })
  }
  // Seleção longa não é apresentação, é catálogo — e catálogo o comprador não lê.
  if (itens.length > 12) {
    return Response.json({ erro: 'No máximo 12 imóveis por seleção.' }, { status: 400 })
  }

  const limpos = itens
    .map((i: any) => ({
      imovel_id: Number(i?.imovel_id),
      faixa: i?.faixa === 'alta' ? 'alta' : 'ressalva',
      ressalva: typeof i?.ressalva === 'string' ? i.ressalva.slice(0, 500) : null,
    }))
    .filter((i: any) => Number.isInteger(i.imovel_id) && i.imovel_id > 0)

  if (limpos.length === 0) {
    return Response.json({ erro: 'Nenhum imóvel válido.' }, { status: 400 })
  }

  try {
    const token = await criarSelecao({
      corretorId,
      usuarioId: u?.id ?? null,
      buscaId: Number.isInteger(body?.buscaId) ? body.buscaId : null,
      cliente: typeof body?.cliente === 'string' ? body.cliente.slice(0, 120) : null,
      itens: limpos as any,
    })
    await marcarEnviada(token)
    return Response.json({ token, url: `/s/${token}` })
  } catch {
    return Response.json({ erro: 'Não foi possível criar a seleção.' }, { status: 500 })
  }
}
