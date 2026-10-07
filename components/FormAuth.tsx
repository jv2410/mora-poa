'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useCorretor } from '@/lib/useCorretor'

type Campo = { nome: string; label: string; tipo?: string; dica?: string; opcional?: boolean }

/**
 * Formulário de entrar e de criar conta.
 *
 * Carrega escondido o `corretorId` deste navegador para que as buscas e
 * seleções feitas antes do login não fiquem órfãs: ao entrar, elas passam a
 * aparecer no painel de quem as fez.
 */
export default function FormAuth({
  acao,
  campos,
  botao,
  rodape,
}: {
  acao: (estado: unknown, form: FormData) => Promise<{ erro: string } | undefined>
  campos: Campo[]
  botao: string
  rodape: { texto: string; link: string; href: string }
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined)
  const corretorId = useCorretor()

  return (
    <form action={enviar} style={{ display: 'grid', gap: 16 }}>
      <input type="hidden" name="corretorId" value={corretorId ?? ''} />

      {campos.map((c) => (
        <label key={c.nome} style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {c.label}
            {c.opcional ? (
              <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}> (opcional)</span>
            ) : null}
          </span>
          <input
            name={c.nome}
            type={c.tipo ?? 'text'}
            required={!c.opcional}
            autoComplete={c.tipo === 'password' ? 'current-password' : 'on'}
            style={{
              padding: '13px 16px',
              borderRadius: 11,
              border: '1px solid var(--line)',
              background: 'var(--campo)',
              color: 'var(--ink)',
              fontFamily: 'var(--sans)',
              fontSize: 15.5,
              outline: 'none',
            }}
          />
          {c.dica ? (
            <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{c.dica}</span>
          ) : null}
        </label>
      ))}

      {estado?.erro ? (
        <p
          style={{
            fontSize: 14,
            color: 'var(--alerta)',
            background: 'rgba(165,52,42,.07)',
            padding: '11px 14px',
            borderRadius: 10,
          }}
        >
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" className="btn btn-solid" disabled={pendente}>
        {pendente ? 'um instante…' : botao}
      </button>

      <p style={{ fontSize: 14, color: 'var(--muted)' }}>
        {rodape.texto}{' '}
        <Link href={rodape.href} style={{ borderBottom: '1px solid var(--muted-2)' }}>
          {rodape.link}
        </Link>
      </p>
    </form>
  )
}
