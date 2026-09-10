import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * O Next carrega .env.local sozinho em dev e no build; o Vitest não. Sem isto
 * os testes que tocam o banco falham com "database macos does not exist",
 * porque o `pg` cai no default de usar o nome do usuário do sistema.
 *
 * Parse próprio em vez de `@next/env`: naquele caminho as variáveis não
 * chegavam ao worker do Vitest, e um setup que falha calado é pior que
 * nenhum. Aqui o formato é o subconjunto que o projeto usa — CHAVE=valor,
 * uma por linha, com aspas opcionais.
 */
function carregar(arquivo: string): void {
  const caminho = resolve(process.cwd(), arquivo)
  if (!existsSync(caminho)) return

  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const corte = linha.indexOf('=')
    if (corte < 1 || linha.trimStart().startsWith('#')) continue

    const chave = linha.slice(0, corte).trim()
    // Variável já definida na shell ganha do arquivo: é assim que se aponta
    // um teste para outro banco sem editar arquivo nenhum.
    if (process.env[chave] !== undefined) continue

    process.env[chave] = linha
      .slice(corte + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
  }
}

carregar('.env.test')
carregar('.env.local')
