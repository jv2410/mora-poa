import { auxiliadora } from '../lib/fontes/auxiliadora'
import { foxter } from '../lib/fontes/foxter'
import { guarida } from '../lib/fontes/guarida'
import type { Fonte } from '../lib/fontes/tipos'
import { inserirImovel } from '../lib/db'

const UA = 'imoveis-ia-rs/1.0 (POC; contato: growth@o2inc.com.br)'
const INTERVALO_MS = 1000
const POR_FONTE = 100

const FONTES: Fonte[] = [auxiliadora, foxter, guarida]

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pegar(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    if (!r.ok) {
      console.warn(`    HTTP ${r.status} em ${url}`)
      return null
    }
    return await r.text()
  } catch (e) {
    console.warn(`    falha de rede: ${(e as Error).message}`)
    return null
  }
}

async function coletarFonte(f: Fonte) {
  console.log(`\n━━━ ${f.rotulo} ━━━`)

  const ids = new Set<string>()
  for (const listagem of f.listagens) {
    if (ids.size >= POR_FONTE) break
    const html = await pegar(listagem)
    if (html) {
      const antes = ids.size
      f.extrairIds(html).forEach((i) => ids.add(i))
      const nome = listagem.split('/').pop()!.slice(0, 34)
      console.log(`  ${nome.padEnd(36)} +${ids.size - antes} (${ids.size})`)
    }
    await dormir(INTERVALO_MS)
  }

  const alvo = [...ids].slice(0, POR_FONTE)
  console.log(`  buscando ${alvo.length} anúncios…`)

  let ok = 0
  let falhas = 0

  for (const [i, id] of alvo.entries()) {
    const url = f.urlDetalhe(id)
    const html = await pegar(url)

    if (html) {
      const im = f.parsear(html, url)
      if (im && Number.isFinite(im.preco) && im.preco > 0) {
        await inserirImovel(im)
        ok++
      } else {
        falhas++
      }
    } else {
      falhas++
    }

    if ((i + 1) % 25 === 0) console.log(`    ${i + 1}/${alvo.length} (ok ${ok})`)
    await dormir(INTERVALO_MS)
  }

  console.log(`  ✓ ${f.rotulo}: ${ok} gravados, ${falhas} falhas`)
  return { ok, falhas }
}

async function main() {
  const pedidas = process.argv.slice(2)
  const fontes = pedidas.length
    ? FONTES.filter((f) => pedidas.includes(f.nome))
    : FONTES

  let total = 0
  for (const f of fontes) {
    const r = await coletarFonte(f)
    total += r.ok
  }

  console.log(`\n═══ total gravado: ${total} ═══`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
