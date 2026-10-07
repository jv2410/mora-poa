'use client'

import { useState } from 'react'
import { useCorretor } from '@/lib/useCorretor'
import type { ImovelComScore } from '@/lib/tipos'

/**
 * A ponte entre o que a IA sugeriu e o que o comprador vai receber.
 *
 * O documento é explícito: se mandar a seleção der mais trabalho que mandar
 * prints no WhatsApp, o corretor não usa e a rastreabilidade do funil se
 * perde. Então o caminho inteiro é escolher, clicar e colar — o nome do
 * cliente é opcional, e gerar o link já marca a seleção como enviada.
 */
export default function MontarSelecao({
  imoveis,
  buscaId,
}: {
  imoveis: ImovelComScore[]
  buscaId?: number | null
}) {
  const corretorId = useCorretor()
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set())
  const [cliente, setCliente] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const alternar = (id: number) => {
    setLink(null)
    setEscolhidos((atual) => {
      const novo = new Set(atual)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  async function gerar() {
    if (!corretorId || escolhidos.size === 0) return
    setGerando(true)
    setErro(null)
    try {
      const itens = imoveis
        .filter((im) => escolhidos.has(im.id!))
        .map((im) => ({ imovel_id: im.id, faixa: im.faixa, ressalva: im.ressalva }))

      const r = await fetch('/api/selecao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corretorId, buscaId, cliente: cliente.trim() || null, itens }),
      })
      const dados = await r.json()
      if (!r.ok) throw new Error(dados?.erro ?? 'Falhou')
      setLink(`${location.origin}${dados.url}`)
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível gerar o link.')
    } finally {
      setGerando(false)
    }
  }

  async function copiar() {
    if (!link) return
    const texto = `${cliente.trim() ? `${cliente.trim()}, ` : ''}separei estes imóveis para você: ${link}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setErro('Não consegui copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {imoveis.map((im) => (
          <button
            key={im.id}
            type="button"
            onClick={() => alternar(im.id!)}
            aria-pressed={escolhidos.has(im.id!)}
            style={{
              padding: '7px 13px',
              borderRadius: 999,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'var(--sans)',
              border: `1px solid ${escolhidos.has(im.id!) ? 'var(--green)' : 'var(--line)'}`,
              background: escolhidos.has(im.id!) ? 'var(--alta-fundo)' : 'var(--elev)',
              color: escolhidos.has(im.id!) ? 'var(--green)' : 'var(--muted)',
            }}
          >
            {escolhidos.has(im.id!) ? '✓ ' : '+ '}
            {im.bairro} {Math.round(im.preco / 1000)}k
          </button>
        ))}
      </div>

      {escolhidos.size > 0 ? (
        <div
          style={{
            border: '1px solid var(--green-dim)',
            background: 'var(--alta-fundo)',
            borderRadius: 14,
            padding: '14px 16px',
          }}
        >
          {link ? (
            <>
              <p style={{ fontSize: 13.5, marginBottom: 10, color: 'var(--muted)' }}>
                Link da seleção com {escolhidos.size}{' '}
                {escolhidos.size === 1 ? 'imóvel' : 'imóveis'}. O cliente abre sem instalar
                nem fazer login — e você vê o que ele respondeu.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" onClick={copiar} className="btn btn-solid">
                  {copiado ? 'Copiado' : 'Copiar para o WhatsApp'}
                </button>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'underline' }}
                >
                  ver como o cliente vê
                </a>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="nome do cliente (opcional)"
                style={{
                  flex: '1 1 160px',
                  minWidth: 0,
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--campo)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--sans)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={gerar}
                disabled={gerando || !corretorId}
                className="btn btn-solid"
              >
                {gerando ? 'gerando…' : `Gerar link (${escolhidos.size})`}
              </button>
            </div>
          )}

          {erro ? (
            <p style={{ fontSize: 13, color: 'var(--alerta)', marginTop: 10 }}>{erro}</p>
          ) : null}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--muted-2)' }}>
          Toque nos imóveis que valem apresentar para montar a seleção do cliente.
        </p>
      )}
    </div>
  )
}
