'use client'

import { useActionState } from 'react'
import { acaoSalvarConta } from '@/lib/acoesAuth'

export default function FormConta({
  comissao,
  mensalidade,
  minutos,
}: {
  comissao: number
  mensalidade: number | null
  minutos: number
}) {
  const [estado, enviar, pendente] = useActionState(acaoSalvarConta, undefined)

  const campos = [
    {
      nome: 'comissao_pct',
      label: 'Comissão (%)',
      valor: String(comissao),
      dica: 'Entra no cálculo da comissão potencial sobre o VGV influenciado.',
      step: '0.1',
    },
    {
      nome: 'mensalidade',
      label: 'Mensalidade do plano (R$)',
      valor: mensalidade == null ? '' : String(mensalidade),
      dica: 'Divisor do múltiplo de retorno. Em branco, o múltiplo não é calculado.',
      step: '1',
    },
    {
      nome: 'min_por_30_imoveis',
      label: 'Minutos para analisar 30 imóveis à mão',
      valor: String(minutos),
      dica: 'Parâmetro das horas economizadas. Ajuste para o tempo real da sua equipe.',
      step: '1',
    },
  ]

  return (
    <form action={enviar} style={{ display: 'grid', gap: 18 }}>
      {campos.map((c) => (
        <label key={c.nome} style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</span>
          <input
            name={c.nome}
            type="number"
            step={c.step}
            defaultValue={c.valor}
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
          <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{c.dica}</span>
        </label>
      ))}

      {estado && 'erro' in estado && estado.erro ? (
        <p style={{ fontSize: 14, color: 'var(--alerta)' }}>{estado.erro}</p>
      ) : null}
      {estado && 'ok' in estado && estado.ok ? (
        <p style={{ fontSize: 14, color: 'var(--green)' }}>{estado.ok}</p>
      ) : null}

      <button type="submit" className="btn btn-solid" disabled={pendente}>
        {pendente ? 'salvando…' : 'Salvar'}
      </button>
    </form>
  )
}
