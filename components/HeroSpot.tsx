'use client'

import { useEffect, useRef } from 'react'

/**
 * Spotlight verde que segue o mouse dentro do hero, escrevendo --mx/--my.
 * Client Component isolado para manter a home inteira como Server Component.
 */
export default function HeroSpot() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hero = ref.current?.parentElement
    if (!hero) return

    const mover = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect()
      hero.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
      hero.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    }

    hero.addEventListener('mousemove', mover)
    return () => hero.removeEventListener('mousemove', mover)
  }, [])

  return <div ref={ref} className="hero-spot" />
}
