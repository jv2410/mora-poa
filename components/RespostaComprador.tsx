'use client'

import { useEffect, useRef, useState } from 'react'
import { MOTIVOS, type Motivo, type StatusItem } from '@/lib/selecaoTipos'

const ROTULO: Record<Motivo, string> = {
  preco: 'o preço',
  localizacao: 'a localização',
  andar: 'o andar',
  tamanho: 'o tamanho',
  outro: 'outro motivo',
}

/**
 * A reação do comprador a um imóvel da seleção.
 *
 * "Quero visitar" é a aprovação que o documento trata como o primeiro
 * resultado concreto do funil. O "não é pra mim" vale quase tanto: com o
 * motivo, ele volta para refinar a próxima leva e, agregado, mostra onde o
 * match erra.
 *
 * A resposta é otimista na tela: o comprador está no celular, provavelmente em
 * rede ruim, e esperar o servidor para ver o próprio clique registrado é o
 * jeito mais fácil de ele achar que não funcionou e desistir.
 */
export default function RespostaComprador({
  token,
  imovelId,
  statusInicial,
  motivoInicial,
}: {
  token: string
  imovelId: number
  statusInicial: StatusItem
  motivoInicial: string | null
}) {
  const [status, setStatus] = useState<StatusItem>(statusInicial)
  const [motivo, setMotivo] = useState<string | null>(motivoInicial)
  const [perguntandoMotivo, setPerguntandoMotivo] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const jaContou = useRef(false)

  // Conta a visualização uma vez por montagem. Sinal passivo, não aprovação.
  useEffect(() => {
    if (jaContou.current) return
    jaContou.current = true
    fetch(`/api/selecao/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imovel_id: imovelId, evento: 'visualizou' }),
    }).catch(() => {})
  }, [token, imovelId])

  async function responder(
    resposta: 'quero_visitar' | 'nao_e_pra_mim',
    motivoEscolhido?: Motivo
  ) {
    const anterior = { status, motivo }
    setStatus(resposta === 'quero_visitar' ? 'aprovado_comprador' : 'recusado')
    setMotivo(motivoEscolhido ?? null)
    setPerguntandoMotivo(false)
    setFalhou(false)

    try {
      const r = await fetch(`/api/selecao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imovel_id: imovelId, resposta, motivo: motivoEscolhido }),
      })
      if (!r.ok) throw new Error()
    } catch {
      // Reverte: mostrar "registrado" sem ter registrado é pior que mostrar o erro.
      setStatus(anterior.status)
      setMotivo(anterior.motivo)
      setFalhou(true)
    }
  }

  if (status === 'aprovado_comprador') {
    return (
      <div style={{ ...caixa, borderColor: 'var(--alta)', color: 'var(--alta)' }}>
        Quer visitar — já avisei seu corretor.
        <button type="button" onClick={() => responder('nao_e_pra_mim')} style={desfazer}>
          desfazer
        </button>
      </div>
    )
  }

  if (status === 'recusado') {
    return (
      <div style={{ ...caixa, color: 'var(--muted)' }}>
        Descartado{motivo ? ` — ${ROTULO[motivo as Motivo] ?? motivo}` : ''}.
        <button type="button" onClick={() => responder('quero_visitar')} style={desfazer}>
          mudei de ideia
        </button>
      </div>
    )
  }

  if (perguntandoMotivo) {
    return (
      <div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 10 }}>
          O que não serviu? Isso melhora a próxima leva.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MOTIVOS.map((m) => (
            <button key={m} type="button" onClick={() => responder('nao_e_pra_mim', m)} style={chip}>
              {ROTULO[m]}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => responder('quero_visitar')} className="btn btn-solid">
          Quero visitar
        </button>
        <button
          type="button"
          onClick={() => setPerguntandoMotivo(true)}
          className="btn btn-outline"
        >
          Não é pra mim
        </button>
      </div>
      {falhou ? (
        <p style={{ fontSize: 13, color: 'var(--alerta)', marginTop: 10 }}>
          Não consegui registrar. Tente de novo.
        </p>
      ) : null}
    </div>
  )
}

const caixa: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  border: '1px solid var(--line)',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14.5,
  fontWeight: 600,
}

const desfazer: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--muted-2)',
  fontFamily: 'var(--sans)',
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'underline',
  fontWeight: 400,
}

const chip: React.CSSProperties = {
  padding: '9px 15px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--elev)',
  color: 'var(--ink)',
  fontFamily: 'var(--sans)',
  fontSize: 13.5,
  cursor: 'pointer',
}
