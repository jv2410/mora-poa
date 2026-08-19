import { conversar } from '@/lib/claude'
import { verificarLimite, validarMensagens, ipDaRequisicao } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const encoder = new TextEncoder()

  const erroSSE = (mensagem: string, status = 200) =>
    new Response(
      encoder.encode(`data: ${JSON.stringify({ tipo: 'erro', mensagem })}\n\ndata: ${JSON.stringify({ tipo: 'fim' })}\n\n`),
      { status, headers: { 'Content-Type': 'text/event-stream' } }
    )

  const limite = verificarLimite(ipDaRequisicao(req))
  if (!limite.ok) return erroSSE(limite.motivo)

  let body: any
  try {
    body = await req.json()
  } catch {
    return erroSSE('Não entendi o pedido.')
  }

  const v = validarMensagens(body?.mensagens)
  if (!v.ok) return erroSSE(v.motivo)

  const stream = new ReadableStream({
    async start(controller) {
      // Quando o cliente aborta (botão parar), o controller já fechou e o
      // enqueue lança. Não é erro de verdade: é a pessoa desistindo.
      let fechado = false
      const enviar = (evento: unknown) => {
        if (fechado) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`))
        } catch {
          fechado = true
        }
      }

      try {
        for await (const evento of conversar(v.mensagens)) enviar(evento)
      } catch (erro) {
        console.error('Erro no chat:', erro)
        enviar({
          tipo: 'erro',
          mensagem: 'Não consegui consultar os imóveis agora. Tenta de novo em alguns segundos.',
        })
      } finally {
        if (!fechado) {
          try {
            controller.close()
          } catch {
            // já fechado pelo abort do cliente
          }
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
