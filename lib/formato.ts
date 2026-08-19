/**
 * Formatadores puros, sem 'use client' nem 'use server': precisam ser
 * importáveis dos dois lados da fronteira.
 */

export const brl = (n: number | null | undefined) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      })

export const brlExato = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function haQuantoTempo(d: Date | string): string {
  const dias = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}
