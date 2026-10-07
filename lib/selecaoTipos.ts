/**
 * Tipos e constantes da seleção, sem nenhuma dependência de banco.
 *
 * Existe separado de `lib/selecao.ts` porque a página do comprador é um Client
 * Component e precisa dos motivos de recusa. Importar do módulo que abre pool
 * de Postgres arrastava `pg` — e portanto `fs`, `net`, `tls` e `dns` — para o
 * bundle do navegador, que é exatamente o que quebrou o build.
 */
export type StatusItem =
  | 'aprovado_corretor'
  | 'enviado'
  | 'visualizado'
  | 'aprovado_comprador'
  | 'recusado'

/** Fechados de propósito: é o agregado deles que mostra onde o match erra. */
export const MOTIVOS = ['preco', 'localizacao', 'andar', 'tamanho', 'outro'] as const
export type Motivo = (typeof MOTIVOS)[number]
