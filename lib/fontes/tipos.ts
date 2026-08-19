import type { Imovel } from '../tipos'

/**
 * Cada portal tem uma estrutura própria — a Auxiliadora publica JSON-LD
 * `RealEstateListing`, a Foxter usa `Product` + `Apartment`, a Guarida guarda
 * tudo em `__NEXT_DATA__`. Esta interface é o contrato que isola essas
 * diferenças do resto do sistema: o coletor não sabe de qual portal veio o
 * imóvel, e trocar scraping por feed oficial amanhã mexe só aqui.
 */
export type Fonte = {
  /** Identificador curto, gravado na coluna `fonte`. */
  nome: string

  /** Nome de exibição do portal. */
  rotulo: string

  /** Listagens a varrer para descobrir anúncios. */
  listagens: string[]

  /** Extrai os IDs de anúncio do HTML de uma listagem. */
  extrairIds(html: string): string[]

  /** Monta a URL da ficha a partir do ID. */
  urlDetalhe(id: string): string

  /** HTML da ficha → Imovel. Devolve null se não der para parsear. */
  parsear(html: string, url: string): Imovel | null
}
