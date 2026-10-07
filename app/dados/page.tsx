import Link from 'next/link'
import Nav from '@/components/Nav'
import { getPool } from '@/lib/db'
import { haQuantoTempo } from '@/lib/formato'

export const revalidate = 3600

export const metadata = {
  title: 'De onde vêm os dados — MORA.AI',
  description:
    'Estoque de parceiros por feed, estoque próprio da imobiliária, nenhuma raspagem. Deduplicação entre fontes, citação literal em cada atributo e data visível em cada imóvel.',
}

async function panorama() {
  const { rows: fontes } = await getPool().query(`
    SELECT fonte, count(*)::int n, max(coletado_em) ultima
    FROM imoveis GROUP BY fonte ORDER BY n DESC
  `)
  const { rows: t } = await getPool().query(`
    SELECT (SELECT count(*)::int FROM imoveis) total,
           (SELECT count(DISTINCT bairro)::int FROM imoveis) bairros,
           (SELECT count(*)::int FROM atributos_extraidos) atributos,
           (SELECT max(coletado_em) FROM imoveis) ultima
  `)
  return { fontes, ...t[0] }
}

const ROTULOS: Record<string, string> = {
  auxiliadora: 'Auxiliadora Predial',
  foxter: 'Foxter Cia Imobiliária',
  guarida: 'Guarida Imóveis',
  zap: 'Zap Imóveis',
  vivareal: 'VivaReal',
  imovelweb: 'ImovelWeb',
}


export default async function Dados() {
  const p = await panorama()

  return (
    <>
      <Nav />
      <section className="section-pad" style={{ paddingTop: 60 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <span className="eyebrow">Transparência</span>
          <h2 style={{ margin: '20px 0 18px' }}>De onde vêm os dados.</h2>
          <p style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1.6, marginBottom: 48 }}>
            Você está prestes a tomar uma das maiores decisões financeiras da sua vida com
            ajuda de um site que não conhece. Você vai levar estes números para a frente de
            um cliente, então é justo que saiba exatamente o que está por trás de cada um.
          </p>

          <div className="card" style={{ marginBottom: 40, borderColor: 'var(--green-dim)' }}>
            <h3 style={{ marginBottom: 12 }}>Não vendemos imóvel.</h3>
            <p style={{ color: 'var(--muted)', fontSize: 15.5, lineHeight: 1.7 }}>
              Não somos imobiliária, não captamos, não recebemos comissão de ninguém e não
              somos pagos pelos portais que aparecem aqui. Não competimos com você: o cliente
              é seu, a venda é sua. O botão “ver anúncio original” manda direto para quem
              captou o imóvel. Como não ganhamos nada por indicar um em vez de outro, a ordem
              da lista é um cálculo — não uma negociação comercial.
            </p>
          </div>

          <h3 style={{ marginBottom: 18 }}>Os {p.total} anúncios</h3>
          <div
            style={{
              display: 'grid',
              gap: 1,
              background: 'var(--line)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 40,
            }}
          >
            {p.fontes.map((f: any) => (
              <div
                key={f.fonte}
                style={{
                  background: 'var(--bg)',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>{ROTULOS[f.fonte] ?? f.fonte}</span>
                <span className="tag">
                  {f.n} anúncios · coletado {haQuantoTempo(f.ultima)}
                </span>
              </div>
            ))}
          </div>

          {[
            {
              t: 'O modelo de dados é parceria, não raspagem',
              d: 'A MORA.AI não raspa portal. Em produção, o estoque vem de duas fontes: feed XML ou API de portais parceiros, com acordo formal de leitura, e o estoque próprio da imobiliária contratante. O mercado imobiliário brasileiro já opera nesse padrão de integração — a ImobiBrasil, por exemplo, integra nativamente com mais de cem portais. Acordo formal é o que elimina de uma vez o risco de LGPD, de contrato e de concorrência desleal.',
            },
            {
              t: 'O que você está vendo agora é um piloto técnico',
              d: `A base atual foi montada antes dessa decisão, lendo páginas públicas dos portais com robots.txt respeitado e uma requisição por segundo, para provar que o motor de match funciona com anúncio brasileiro de verdade. Ela não é a base de produção e não cresce: a última leitura foi ${haQuantoTempo(p.ultima)}. O que vale desta fase é o motor — faixas de compatibilidade, deduplicação, saída quantificada do "não encontrei" — e ele funciona igual com dado vindo de feed.`,
            },
            {
              t: 'A data aparece, e quando envelhece a MORA avisa',
              d: 'Anúncio some, preço muda, imóvel vende. Cada imóvel carrega quantos dias faz que a coleta o confirmou, e acima de trinta dias ele perde a alta compatibilidade e desce no ranking, com o aviso escrito na ressalva. Preferimos dizer "pode já estar vendido" a deixar você descobrir isso na frente do cliente.',
            },
            {
              t: 'O mesmo imóvel em dois portais vira um só',
              d: 'Zap e VivaReal são do mesmo grupo e compartilham base, então o mesmo apartamento aparecia duas vezes. Agrupamos por preço, área, dormitórios e bairro, e mantemos a versão mais informativa — a com mais fotos, depois a com descrição. Você nunca vê o mesmo imóvel se passando por dois.',
            },
            {
              t: `Os ${p.atributos} atributos têm a frase que os prova`,
              d: 'Coisas como “aceita pet”, “sol da manhã” ou “sem elevador” não existem em campo nenhum dos portais — estão soltas no texto do anúncio. Um modelo de linguagem leu as descrições e extraiu esses fatos, mas com uma trava: cada atributo precisa vir acompanhado da citação literal que o comprova, e o código confere se aquela frase existe mesmo no anúncio antes de gravar. O que não passou nessa conferência foi descartado. Na ficha do imóvel, cada item mostra o trecho de onde veio.',
            },
            {
              t: 'A IA não calcula nada',
              d: 'Nota de match, percentil de preço, mediana do bairro, ITBI, parcela do financiamento — tudo é calculado por código, em SQL e TypeScript, e testado. O modelo de linguagem recebe o resultado pronto e só escreve a explicação em português. Ele não estima, não arredonda e não inventa imóvel: se um apartamento aparece na conversa, ele existe no banco. Enquanto a busca roda, a interface mostra qual consulta está sendo feita, com os critérios reais.',
            },
            {
              t: 'Contato do anunciante não existe aqui',
              d: 'A MORA não guarda nem exibe nome, foto ou telefone de corretor anunciante ou de proprietário. Para imóvel de parceiro, você recebe os dados estruturados e o link do anúncio original — e esse link aparece só para você. Na seleção que vai ao seu cliente ele nunca aparece, porque o comprador chegando ao anúncio chega ao corretor que captou, ou seja, ao seu concorrente.',
            },
            {
              t: 'O que ainda é limitação',
              d: 'A amostra é pequena para alguns bairros: quando isso acontece, dizemos o tamanho da amostra em vez de fingir conclusão. Só um dos portais publica coordenadas, então não há busca por distância nem mapa ainda. Visitas, propostas e vendas virão do CRM do cliente e por enquanto não existem no painel — sem esse dado, indicador de retorno seria autodeclarado.',
            },
          ].map((s) => (
            <div key={s.t} style={{ marginBottom: 34 }}>
              <h3 style={{ marginBottom: 10 }}>{s.t}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 15.5, lineHeight: 1.75 }}>{s.d}</p>
            </div>
          ))}

          <div style={{ marginTop: 48, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/chat" className="btn btn-solid">
              Testar agora
            </Link>
            <Link href="/imoveis" className="btn btn-outline">
              Ver o catálogo
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
