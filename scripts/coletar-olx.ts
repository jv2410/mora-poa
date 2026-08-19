import { chromium, type Page } from 'playwright'
import {
  ZAP,
  VIVAREAL,
  IMOVELWEB,
  paraImovel,
  type PortalOlx,
  type CardBruto,
} from '../lib/fontes/zap'
import { inserirImovel } from '../lib/db'

const PORTAIS: Record<string, PortalOlx> = { zap: ZAP, vivareal: VIVAREAL, imovelweb: IMOVELWEB }

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Script que roda DENTRO do browser, passado como string.
 * O tsx transpila funções com um helper `__name` que não existe na página —
 * passar como string evita a transpilação e o ReferenceError.
 */
const EXTRATOR = `(() => {
  const num = (s) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[^\\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const itens = Array.from(document.querySelectorAll(
    'li:has(a[href*="/imovel/"]), li:has(a[href*="/propriedades/"]), div[data-qa="posting PROPERTY"]'
  ));

  return itens.map((li) => {
    const a = li.querySelector('a[href*="/imovel/"], a[href*="/propriedades/"], a[href]');
    const href = a ? a.getAttribute('href') || '' : '';
    const texto = li.innerText || '';

    const mPreco   = texto.match(/R\\$\\s?([\\d.]{6,})/);
    const mBairro  = texto.match(/\\sem\\s*\\n?\\s*([^,\\n]+),\\s*Porto Alegre/i)
                  || texto.match(/,\\s*([^,\\n]+),\\s*Porto Alegre/i);
    const mCond    = texto.match(/Cond\\.?\\s*R\\$\\s?([\\d.]+)/i);
    const mIptu    = texto.match(/IPTU\\s*R\\$\\s?([\\d.]+)/i);
    const mArea    = texto.match(/([\\d.]+)\\s*m²/);
    const mQuartos = texto.match(/(\\d+)\\s*(?:quartos?|dorm)/i);
    const mBanh    = texto.match(/(\\d+)\\s*banheiros?/i);
    const mVagas   = texto.match(/(\\d+)\\s*vagas?/i);

    const id = (href.match(/-id-(\\d+)/) || [])[1]
            || (href.match(/\\/(\\d{6,})\\.html/) || [])[1]
            || (href.match(/id-(\\d+)/) || [])[1]
            || null;

    const rua = li.querySelector('[data-cy="rp-cardProperty-street-txt"]');
    const img = li.querySelector('img');

    return {
      id: id,
      url: href.indexOf('http') === 0 ? href.split('?')[0] : location.origin + href.split('?')[0],
      bairro: mBairro ? mBairro[1].trim() : null,
      endereco: rua ? rua.textContent.trim() : null,
      area: mArea ? num(mArea[1]) : null,
      dormitorios: mQuartos ? Number(mQuartos[1]) : null,
      banheiros: mBanh ? Number(mBanh[1]) : null,
      vagas: mVagas ? Number(mVagas[1]) : null,
      preco: mPreco ? num(mPreco[1]) : null,
      condominio: mCond ? num(mCond[1]) : null,
      iptu: mIptu ? num(mIptu[1]) : null,
      foto: img ? (img.getAttribute('src') || '').split('?')[0] : null,
      titulo: texto.split('\\n').filter((l) => /^Apartamento/i.test(l.trim()))[0] || null,
    };
  });
})()`

/**
 * O ImovelWeb veio de outra base de código (Navent) e tem DOM próprio:
 * `div[data-qa="posting PROPERTY"]`, sem virtualização, 25 por página.
 */
const EXTRATOR_IMOVELWEB = `(() => {
  const num = (s) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[^\\d]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  return Array.from(document.querySelectorAll('div[data-qa="posting PROPERTY"]')).map((card) => {
    const texto = card.innerText || '';
    const href = card.getAttribute('data-to-posting')
              || (card.querySelector('a[href]') ? card.querySelector('a[href]').getAttribute('href') : '');

    const mPreco = texto.match(/R\\$\\s?([\\d.]{6,})/);
    const mCond  = texto.match(/R\\$\\s?([\\d.]+)\\s*Condominio/i);
    const mArea  = texto.match(/([\\d.]+)\\s*m²/);
    const mQuartos = texto.match(/(\\d+)\\s*quartos?/i);
    const mBanh  = texto.match(/(\\d+)\\s*ban\\.?/i);
    const mVagas = texto.match(/(\\d+)\\s*vagas?/i);
    // penúltima linha antes da descrição: "Bairro, Cidade"
    const mLoc = texto.match(/\\n([^,\\n]+),\\s*Porto Alegre/i);

    const id = (href.match(/-(\\d{6,})\\.html/) || [])[1]
            || (card.getAttribute('data-id') || null);

    const img = card.querySelector('img');

    return {
      id: id,
      url: href ? (href.indexOf('http') === 0 ? href : 'https://www.imovelweb.com.br' + href) : '',
      bairro: mLoc ? mLoc[1].trim() : null,
      endereco: null,
      area: mArea ? num(mArea[1]) : null,
      dormitorios: mQuartos ? Number(mQuartos[1]) : null,
      banheiros: mBanh ? Number(mBanh[1]) : null,
      vagas: mVagas ? Number(mVagas[1]) : null,
      preco: mPreco ? num(mPreco[1]) : null,
      condominio: mCond ? num(mCond[1]) : null,
      iptu: null,
      foto: img ? (img.getAttribute('src') || '').split('?')[0] : null,
      titulo: null,
    };
  });
})()`

/**
 * A lista é virtualizada: o portal mantém no DOM só os cards visíveis e
 * descarta o resto ao rolar. Capturamos a cada passo do scroll, acumulando
 * por id — ler só no final devolveria meia dúzia de cards.
 */
async function capturarComScroll(page: Page, extrator: string): Promise<CardBruto[]> {
  const acumulado = new Map<string, CardBruto>()

  // Passos curtos e pausados: a virtualização monta e descarta os cards
  // conforme o scroll, então passar rápido demais pula itens.
  for (let passo = 0; passo < 70; passo++) {
    try {
      const lote = (await page.evaluate(extrator)) as CardBruto[]
      for (const c of lote) if (c?.id) acumulado.set(c.id, c)
    } catch {
      // um passo que falha não invalida os anteriores
    }
    await page.evaluate('window.scrollBy(0, 380)')
    await dormir(420)
  }

  return [...acumulado.values()]
}

async function coletarPortal(portal: PortalOlx, page: Page) {
  console.log(`\n━━━ ${portal.rotulo} ━━━`)
  let ok = 0
  let vistos = 0

  for (const url of portal.listagens) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await dormir(4000)

      const titulo = await page.title()
      if (/just a moment|attention required|acesso negado/i.test(titulo)) {
        console.log(`  challenge do Cloudflare em ${url.slice(-40)} — pulando`)
        await dormir(5000)
        continue
      }

      const cards = await capturarComScroll(page, portal.nome === 'imovelweb' ? EXTRATOR_IMOVELWEB : EXTRATOR)
      vistos += cards.length

      for (const c of cards) {
        const im = paraImovel(c, portal.nome)
        if (im) {
          await inserirImovel(im)
          ok++
        }
      }
      console.log(`  ${url.slice(-42)} → ${cards.length} cards, ${ok} no total`)
    } catch (e) {
      console.warn(`  falhou: ${(e as Error).message.slice(0, 90)}`)
    }
    // Pausa entre páginas: coleta educada, não rajada.
    await dormir(3000)
  }

  console.log(`  ✓ ${portal.rotulo}: ${ok} gravados de ${vistos} vistos`)
  return ok
}

async function main() {
  const pedidos = process.argv.slice(2)
  const alvos = pedidos.length
    ? pedidos.map((p) => PORTAIS[p]).filter(Boolean)
    : Object.values(PORTAIS)

  // Usa o Chrome instalado na máquina, não o Chromium empacotado: é o mesmo
  // navegador que uma pessoa usaria para visitar o site.
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  let total = 0
  for (const p of alvos) total += await coletarPortal(p, page)

  await browser.close()
  console.log(`\n═══ total gravado: ${total} ═══`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
