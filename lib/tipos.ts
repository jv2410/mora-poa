export type Imovel = {
  id?: number
  fonte: string
  codigo_origem: string
  url_origem: string
  titulo: string
  descricao: string | null
  preco: number
  condominio: number | null
  iptu: number | null
  area: number | null
  area_total: number | null
  dormitorios: number | null
  suites: number | null
  banheiros: number | null
  vagas: number | null
  bairro: string
  endereco: string | null
  cidade: string
  latitude: number | null
  longitude: number | null
  caracteristicas: string[]
  fotos: string[]
  // Nome e telefone de corretor/proprietário NÃO existem neste tipo de
  // propósito. As colunas seguem no banco (dado histórico não se apaga), mas
  // a aplicação não os lê nem os escreve — quem quiser o contato vai ao
  // anúncio original. Ver `descartarContato()` em lib/db.ts.
  publicado_em: string | null
  dados_conflitantes: boolean
  preco_m2?: number | null
  custo_mensal?: number | null
  /**
   * Dias desde a última coleta que confirmou este anúncio. Null quando não há
   * histórico. Anúncio antigo pode já estar vendido — e o corretor precisa
   * saber disso antes de ligar para o cliente.
   */
  dias_sem_confirmacao?: number | null
}

export type Criterios = {
  preco_max?: number
  preco_min?: number
  bairros?: string[]
  dorm_min?: number
  vagas_min?: number
  area_min?: number
  custo_mensal_max?: number
}

/**
 * O corretor não decide com porcentagem, decide com verbo: manda, manda
 * avisando, ou não manda. Cada faixa corresponde a uma dessas três ações.
 */
export type Faixa = 'alta' | 'ressalva' | 'fora'

export type ImovelComScore = Imovel & {
  score: number
  atende: string[]
  nao_atende: string[]
  faixa: Faixa
  /** O furo escrito por extenso. Null quando o imóvel atende tudo. */
  ressalva: string | null
}
