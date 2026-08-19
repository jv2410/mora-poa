export type Atributo = { atributo: string; valor: boolean; evidencia: string }

const ROTULOS: Record<string, string> = {
  aceita_pet: 'aceita pet',
  mobiliado: 'mobiliado',
  reformado: 'reformado',
  vista_livre: 'vista livre',
  sol_da_manha: 'sol da manhã',
  andar_alto: 'andar alto',
  tem_elevador: 'elevador',
  sem_elevador: 'sem elevador',
  sacada: 'sacada',
  churrasqueira: 'churrasqueira',
  portaria_24h: 'portaria 24h',
  piscina: 'piscina',
  academia: 'academia',
  quarto_de_servico: 'quarto de serviço',
  aceita_financiamento: 'aceita financiamento',
  aceita_permuta: 'aceita permuta',
  proximo_metro: 'perto do metrô',
  proximo_parque: 'perto de parque',
  silencioso: 'silencioso',
  precisa_reforma: 'precisa de reforma',
}

/**
 * Cada chip mostra, no hover, a frase exata do anúncio que comprova o
 * atributo. A citação foi validada por substring contra o texto original
 * antes de entrar no banco — se não conferisse, não estaria aqui.
 */
export default function Atributos({ lista }: { lista: Atributo[] }) {
  if (!lista.length) return null

  return (
    <div style={{ margin: '28px 0' }}>
      <span className="eyebrow">O que o anúncio diz</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {lista.map((a) => (
          <span
            key={a.atributo}
            title={`"${a.evidencia}"`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 14px',
              borderRadius: 999,
              border: `1px solid ${a.valor ? 'var(--green-dim)' : 'var(--line)'}`,
              background: a.valor ? 'rgba(0,232,122,.05)' : 'rgba(255,255,255,.02)',
              fontSize: 13.5,
              color: a.valor ? 'var(--ink)' : 'var(--muted-2)',
              cursor: 'help',
              textDecoration: a.valor ? 'none' : 'line-through',
            }}
          >
            {a.valor ? '✓' : '×'} {ROTULOS[a.atributo] ?? a.atributo.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <p className="tag" style={{ marginTop: 12, display: 'block' }}>
        passe o mouse para ver o trecho do anúncio que comprova cada item
      </p>
    </div>
  )
}
