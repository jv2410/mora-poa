import { conversar } from '@/lib/claude'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const { mensagens } = await req.json()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`))

      try {
        for await (const evento of conversar(mensagens)) enviar(evento)
      } catch (erro) {
        console.error('Erro no chat:', erro)
        enviar({
          tipo: 'erro',
          mensagem:
            'Não consegui consultar os imóveis agora. Tenta de novo em alguns segundos.',
        })
      } finally {
        controller.close()
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
