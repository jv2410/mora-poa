'use client'

import { useEffect, useState } from 'react'

const CHAVE = 'mora:corretor:v1'

/**
 * Identidade anônima do corretor neste navegador.
 *
 * O produto está sem login por decisão anterior, mas o funil do documento —
 * "quem aprovou, qual imóvel, para qual busca" — precisa de alguma noção de
 * "mesma pessoa" para o corretor reencontrar as seleções que mandou. Um id
 * aleatório de navegador resolve isso sem cadastro e sem coletar nada sobre
 * quem é a pessoa.
 *
 * Quando houver login de verdade, este id vira o ponto de costura: as buscas e
 * seleções já gravadas podem ser reatribuídas ao usuário autenticado.
 */
export function useCorretor(): string | null {
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    try {
      let atual = localStorage.getItem(CHAVE)
      if (!atual || !/^[a-z0-9-]{8,64}$/i.test(atual)) {
        atual = crypto.randomUUID()
        localStorage.setItem(CHAVE, atual)
      }
      setId(atual)
    } catch {
      // Navegação privada ou storage bloqueado: segue sem identidade. A busca
      // funciona, só não fica agrupada nem gera seleção.
      setId(null)
    }
  }, [])

  return id
}
