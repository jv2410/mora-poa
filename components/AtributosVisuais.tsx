'use client'

import { useState } from 'react'

export type AtributoVisual = {
  atributo: string
  valor: boolean
  foto_index: number
  foto_url: string
}

const ROTULOS: Record<string, string> = {
  eh_render_3d: 'imagem gerada em 3D, não foto real',
  planta_baixa: 'tem planta baixa',
  imovel_vazio: 'está vazio',
  mobiliado_nas_fotos: 'mobiliado nas fotos',
  reforma_recente_aparente: 'parece reformado',
  precisa_reforma_aparente: 'aparenta precisar de reforma',
  armarios_embutidos: 'armários embutidos',
  piso_madeira_ou_laminado: 'piso de madeira ou laminado',
  piso_ceramico_ou_porcelanato: 'piso cerâmico ou porcelanato',
  cozinha_integrada: 'cozinha integrada',
  vista_livre_visivel: 'vista livre',
  vista_bloqueada_por_predio: 'vista bloqueada por prédio',
  sem_foto_do_interior: 'nenhuma foto mostra o interior',
  fotos_escuras_ou_ruins: 'fotos escuras ou de baixa qualidade',
}

/** Os que mudam a decisão de compra e merecem destaque de alerta. */
const ALERTAS = new Set([
  'eh_render_3d',
  'sem_foto_do_interior',
  'vista_bloqueada_por_predio',
  'precisa_reforma_aparente',
  'fotos_escuras_ou_ruins',
])

/**
 * O que as fotos mostram, com a foto que prova cada item.
 *
 * Clicar num chip abre exatamente a imagem onde o modelo diz ter visto aquilo:
 * é o análogo visual da citação literal usada nos atributos de texto. Quem lê
 * confere em um clique, em vez de confiar.
 */
export default function AtributosVisuais({ lista }: { lista: AtributoVisual[] }) {
  const [aberta, setAberta] = useState<AtributoVisual | null>(null)
  if (!lista.length) return null

  return (
    <div style={{ margin: '28px 0' }}>
      <span className="eyebrow">O que as fotos mostram</span>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {lista.map((a) => {
          const alerta = ALERTAS.has(a.atributo) && a.valor
          return (
            <button
              key={a.atributo}
              onClick={() => setAberta(a)}
              className="chip-visual"
              style={{
                borderColor: alerta ? 'rgba(255,180,0,.35)' : 'var(--green-dim)',
                background: alerta ? 'var(--ressalva-fundo)' : 'var(--alta-fundo)',
                color: alerta ? '#ffc75a' : 'var(--ink)',
              }}
            >
              {alerta ? '⚠' : '◉'} {ROTULOS[a.atributo] ?? a.atributo.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      <p className="tag" style={{ marginTop: 12, display: 'block' }}>
        clique em qualquer item para ver a foto de onde ele saiu
      </p>

      {aberta ? (
        <div className="lightbox" onClick={() => setAberta(null)}>
          <div className="lightbox-conteudo" onClick={(e) => e.stopPropagation()}>
            <img src={aberta.foto_url} alt="" referrerPolicy="no-referrer" />
            <p style={{ marginTop: 14, fontSize: 15 }}>
              {ROTULOS[aberta.atributo] ?? aberta.atributo}
              <span className="tag" style={{ marginLeft: 10 }}>
                foto {aberta.foto_index + 1} do anúncio
              </span>
            </p>
            <button onClick={() => setAberta(null)} className="btn btn-outline" style={{ marginTop: 16 }}>
              fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
