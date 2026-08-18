import { parsearImovel, extrairIdsDaListagem } from '../lib/parser'
import { inserirImovel } from '../lib/db'

const BASE = 'https://www.auxiliadorapredial.com.br'
const UA = 'imoveis-ia-rs/1.0 (POC; contato: growth@o2inc.com.br)'

const BAIRROS = [
  'moinhos-de-vento',
  'cidade-baixa',
  'bom-fim',
  'santana',
  'petropolis',
  'menino-deus',
  'centro-historico',
]

const META = 100
const INTERVALO_MS = 1000

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pegar(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) {
      console.warn(`  HTTP ${r.status} em ${url}`)
      return null
    }
    return await r.text()
  } catch (e) {
    console.warn(`  falha de rede em ${url}: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  console.log('1. Descobrindo IDs por bairro\n')
  const ids = new Set<string>()

  for (const bairro of BAIRROS) {
    if (ids.size >= META) break
    const html = await pegar(`${BASE}/comprar/residencial/rs+porto-alegre+${bairro}`)
    if (html) {
      const antes = ids.size
      extrairIdsDaListagem(html).forEach((i) => ids.add(i))
      console.log(`  ${bairro.padEnd(18)} +${ids.size - antes}  (total ${ids.size})`)
    }
    await dormir(INTERVALO_MS)
  }

  const alvo = [...ids].slice(0, META)
  console.log(`\n2. Buscando ${alvo.length} anúncios (1 req/s)\n`)

  let ok = 0
  let falhas = 0
  let conflitos = 0

  for (const [i, id] of alvo.entries()) {
    const url = `${BASE}/imovel/venda/${id}/apartamento+porto-alegre+rio-grande-do-sul`
    const html = await pegar(url)

    if (html) {
      const im = parsearImovel(html, url)
      if (im && Number.isFinite(im.preco) && im.preco > 0) {
        await inserirImovel(im)
        ok++
        if (im.dados_conflitantes) conflitos++
      } else {
        falhas++
        console.warn(`  parse falhou ou preço inválido: ${id}`)
      }
    } else {
      falhas++
    }

    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${alvo.length}  (ok ${ok})`)
    await dormir(INTERVALO_MS)
  }

  console.log(`\nGravados: ${ok} | Falhas: ${falhas} | Com dados conflitantes: ${conflitos}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
