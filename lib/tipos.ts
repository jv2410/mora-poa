export type Imovel = {
  id?: number
  codigo_origem: string
  url_origem: string
  titulo: string
  descricao: string | null
  preco: number
  condominio: number | null
  iptu: number | null
  area: number | null
  dormitorios: number | null
  suites: number | null
  banheiros: number | null
  vagas: number | null
  bairro: string
  endereco: string | null
  cidade: string
  fotos: string[]
  corretor_nome: string | null
  corretor_telefone: string | null
  publicado_em: string | null
  dados_conflitantes: boolean
  preco_m2?: number | null
  custo_mensal?: number | null
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

export type ImovelComScore = Imovel & {
  score: number
  atende: string[]
  nao_atende: string[]
}
