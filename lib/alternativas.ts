import { contarCom } from './db'
import type { Criterios } from './tipos'

/**
 * "Não encontrei nada" é a pior resposta que a MORA pode dar, porque devolve o
 * problema ao corretor sem nenhuma saída. O que ele precisa é da próxima
 * pergunta pronta para fazer ao cliente: "se você esticar o teto para R$ 560
 * mil, aparecem 12".
 *
 * Cada número aqui é um COUNT no banco com um critério afrouxado por vez.
 * Nada é estimado — se o modelo inventasse "provavelmente apareceriam
 * alguns", o corretor levaria a conversa errada para o cliente.
 */
export type Alternativa = {
  /** Qual critério foi afrouxado. */
  criterio: keyof Criterios
  /** Frase pronta: "se o teto subisse para R$ 560 mil". */
  mudanca: string
  /** Quantos imóveis passariam a atender. */
  quantos: number
}

/**
 * Quanto se estica um teto antes de desistir. 5% é negociação, 10% é conversa
 * difícil, 20% é outro orçamento — passar disso não é alternativa, é trocar o
 * cliente de faixa.
 */
const ESTICOES = [0.05, 0.1, 0.2]

const brl = (n: number) =>
  n >= 1000
    ? `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil`
    : `R$ ${Math.round(n)}`

/**
 * Critérios que ou valem ou não valem — a alternativa é abrir mão deles.
 * A ordem importa: é a ordem em que as sugestões aparecem para o corretor, e
 * abrir mão de bairro dói menos que abrir mão de dormitório para uma família.
 */
const ABANDONAVEIS: Array<{ chave: keyof Criterios; rotulo: (c: Criterios) => string }> = [
  { chave: 'bairros', rotulo: (c) => `sem restringir a ${c.bairros!.join(', ')}` },
  {
    chave: 'vagas_min',
    rotulo: (c) =>
      `aceitando menos de ${c.vagas_min} vaga${c.vagas_min === 1 ? '' : 's'}`,
  },
  { chave: 'area_min', rotulo: (c) => `sem o mínimo de ${c.area_min} m²` },
  { chave: 'dorm_min', rotulo: (c) => `com menos de ${c.dorm_min} dormitórios` },
]

/** Tetos que dá para esticar, com a frase correspondente. */
const ESTICAVEIS: Array<{
  chave: 'preco_max' | 'custo_mensal_max'
  rotulo: (novo: number) => string
}> = [
  { chave: 'preco_max', rotulo: (n) => `se o teto subisse para ${brl(n)}` },
  { chave: 'custo_mensal_max', rotulo: (n) => `se o custo mensal pudesse ir a ${brl(n)}` },
]

/** Arredonda para cima na dezena de milhar — teto quebrado não se negocia. */
function arredondar(valor: number): number {
  const passo = valor >= 100_000 ? 10_000 : 100
  return Math.ceil(valor / passo) * passo
}

/**
 * Devolve as saídas ordenadas por quantos imóveis destravam. Só entram
 * alternativas que realmente destravam algo: sugerir uma mudança que continua
 * dando zero é pior que não sugerir nada.
 */
export async function alternativas(c: Criterios): Promise<Alternativa[]> {
  const achadas: Alternativa[] = []

  for (const { chave, rotulo } of ABANDONAVEIS) {
    if (c[chave] == null) continue
    const quantos = await contarCom({ ...c, [chave]: undefined })
    if (quantos > 0) achadas.push({ criterio: chave, mudanca: rotulo(c), quantos })
  }

  for (const { chave, rotulo } of ESTICAVEIS) {
    const teto = c[chave]
    if (teto == null) continue

    // Para no primeiro esticão que resolve: a menor concessão que funciona é
    // a que o cliente aceita.
    for (const fator of ESTICOES) {
      const novo = arredondar(teto * (1 + fator))
      const quantos = await contarCom({ ...c, [chave]: novo })
      if (quantos > 0) {
        achadas.push({ criterio: chave, mudanca: rotulo(novo), quantos })
        break
      }
    }
  }

  if (achadas.length > 0) return achadas.sort((a, b) => b.quantos - a.quantos)

  // Briefing muito apertado não destrava com uma concessão só: "até R$ 200 mil,
  // 4 dormitórios, 3 vagas, Moinhos de Vento" continua dando zero se você
  // afrouxar qualquer critério isolado. Aqui vamos cedendo em cadeia, do que
  // dói menos para o que dói mais, e paramos na primeira combinação que
  // devolve imóvel — é a menor concessão possível, não uma qualquer.
  return await cederEmCadeia(c)
}

async function cederEmCadeia(c: Criterios): Promise<Alternativa[]> {
  let atual: Criterios = { ...c }
  const cedidos: string[] = []

  for (const { chave, rotulo } of ABANDONAVEIS) {
    if (atual[chave] == null) continue

    cedidos.push(rotulo(atual))
    atual = { ...atual, [chave]: undefined }

    const quantos = await contarCom(atual)
    if (quantos > 0) {
      return [{ criterio: chave, mudanca: cedidos.join(' e '), quantos }]
    }
  }

  // Última carta: o teto de preço, esticado até onde ainda é o mesmo cliente.
  if (atual.preco_max != null) {
    for (const fator of ESTICOES) {
      const novo = arredondar(atual.preco_max * (1 + fator))
      const quantos = await contarCom({ ...atual, preco_max: novo })
      if (quantos > 0) {
        return [
          {
            criterio: 'preco_max',
            mudanca: [...cedidos, `com o teto em ${brl(novo)}`].join(' e '),
            quantos,
          },
        ]
      }
    }
  }

  // Nada destrava. Devolver lista vazia é honesto: o modelo é instruído a
  // dizer que o briefing não tem saída neste estoque em vez de improvisar uma.
  return []
}
