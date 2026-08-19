'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImovelComScore } from './tipos'

export type Msg = {
  role: 'user' | 'assistant'
  content: string
  imoveis?: ImovelComScore[]
}

const CHAVE = 'mora:conversa:v1'
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000

type Salvo = { mensagens: Msg[]; imoveis: ImovelComScore[]; atualizadaEm: number }

/**
 * Estado da conversa, compartilhado entre o painel lateral e a página /chat.
 *
 * Persiste em localStorage porque não há login, e sem isso um F5 apaga vinte
 * minutos de conversa. Expira em 7 dias: imóvel sai do mercado, e retomar uma
 * conversa velha sobre um banco novo produz resposta errada com cara de certa.
 */
export function useConversa(perguntaInicial?: string | null) {
  const [mensagens, setMensagens] = useState<Msg[]>([])
  const [imoveis, setImoveis] = useState<ImovelComScore[]>([])
  const [parcial, setParcial] = useState('')
  const [status, setStatus] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [retomada, setRetomada] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hidratou = useRef(false)

  // Hidrata do localStorage no primeiro mount
  useEffect(() => {
    if (hidratou.current) return
    hidratou.current = true
    try {
      const bruto = localStorage.getItem(CHAVE)
      if (!bruto) return
      const s: Salvo = JSON.parse(bruto)
      if (Date.now() - s.atualizadaEm > VALIDADE_MS) {
        localStorage.removeItem(CHAVE)
        return
      }
      if (s.mensagens?.length) {
        setMensagens(s.mensagens)
        setImoveis(s.imoveis ?? [])
        const primeira = s.mensagens.find((m) => m.role === 'user')?.content
        if (primeira) setRetomada(primeira.slice(0, 90))
      }
    } catch {
      localStorage.removeItem(CHAVE)
    }
  }, [])

  // Salva quando uma resposta termina, nunca durante o streaming
  useEffect(() => {
    if (!hidratou.current || carregando || mensagens.length === 0) return
    try {
      const s: Salvo = { mensagens, imoveis, atualizadaEm: Date.now() }
      localStorage.setItem(CHAVE, JSON.stringify(s))
    } catch {
      // quota estourada: seguir sem persistir é melhor que quebrar
    }
  }, [mensagens, imoveis, carregando])

  const recomecar = useCallback(() => {
    abortRef.current?.abort()
    localStorage.removeItem(CHAVE)
    setMensagens([])
    setImoveis([])
    setParcial('')
    setStatus('')
    setRetomada(null)
    setCarregando(false)
  }, [])

  const parar = useCallback(() => {
    abortRef.current?.abort()
    setCarregando(false)
    setStatus('')
  }, [])

  const enviar = useCallback(
    async (texto: string, historico?: Msg[]) => {
      const limpo = texto.trim()
      if (!limpo) return

      setRetomada(null)
      const base = historico ?? mensagens
      const novas: Msg[] = [...base, { role: 'user', content: limpo }]
      setMensagens(novas)
      setCarregando(true)
      setParcial('')
      setStatus('pensando…')

      const ctrl = new AbortController()
      abortRef.current = ctrl

      let acumulado = ''
      let ultimosImoveis: ImovelComScore[] | undefined

      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Só role e content vão para a API: os imóveis são estado de UI.
          body: JSON.stringify({
            mensagens: novas.map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: ctrl.signal,
        })
        if (!r.body) throw new Error('sem corpo')

        const reader = r.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const linhas = buffer.split('\n\n')
          buffer = linhas.pop() ?? ''

          for (const linha of linhas) {
            if (!linha.startsWith('data: ')) continue
            const ev = JSON.parse(linha.slice(6))
            if (ev.tipo === 'texto') {
              acumulado += ev.texto
              setStatus('')
              setParcial(acumulado)
            } else if (ev.tipo === 'status') {
              setStatus(ev.detalhe)
            } else if (ev.tipo === 'imoveis') {
              ultimosImoveis = ev.imoveis
              setImoveis(ev.imoveis)
            } else if (ev.tipo === 'erro') {
              acumulado += (acumulado ? '\n\n' : '') + ev.mensagem
              setParcial(acumulado)
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          acumulado += acumulado ? '\n\n(interrompido)' : '(interrompido)'
        } else {
          acumulado += (acumulado ? '\n\n' : '') + 'Perdi a conexão. Tenta de novo?'
        }
      }

      setMensagens((m) => [
        ...m,
        { role: 'assistant', content: acumulado, imoveis: ultimosImoveis },
      ])
      setParcial('')
      setStatus('')
      setCarregando(false)
      abortRef.current = null
    },
    [mensagens]
  )

  /**
   * Dispara a pergunta que veio na URL (?q=), uma única vez e só depois de a
   * hidratação do localStorage ter rodado — senão ela entraria antes do
   * histórico salvo e a conversa nasceria fora de ordem.
   *
   * Precisa ficar depois da definição de `enviar`: efeitos rodam na ordem em
   * que são declarados, e declarado antes ele veria a função ainda indefinida.
   */
  const disparou = useRef(false)
  useEffect(() => {
    if (!perguntaInicial || disparou.current) return
    disparou.current = true
    enviar(perguntaInicial, [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perguntaInicial])

  return {
    mensagens,
    imoveis,
    parcial,
    status,
    carregando,
    retomada,
    enviar,
    parar,
    recomecar,
  }
}
