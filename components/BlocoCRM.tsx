import Link from 'next/link'

/**
 * Os indicadores que vêm do CRM, com o visual montado e sem número inventado.
 *
 * O documento é direto: sem o dado de desfecho, o painel de ROI é teatro, e o
 * dono de imobiliária percebe isso na segunda renovação. Então a escolha aqui
 * é mostrar a estrutura real — os mesmos blocos, nas mesmas posições — com o
 * valor substituído por um traço e o motivo escrito.
 *
 * Mostrar "0 visitas" quando o que falta é conectar o CRM seria pior que não
 * mostrar nada: o diretor leria como "a ferramenta não gerou resultado".
 */
export default function BlocoCRM({
  aprovacoes,
  compacto = false,
}: {
  aprovacoes: number
  compacto?: boolean
}) {
  const doCRM = [
    { rotulo: 'Visitas geradas', prova: 'o primeiro resultado concreto' },
    { rotulo: 'Propostas', prova: 'onde o funil aperta' },
    { rotulo: 'Vendas', prova: 'o desfecho' },
    { rotulo: 'VGV influenciado', prova: 'o tamanho do dinheiro em jogo' },
  ]

  return (
    <section style={{ marginBottom: 48 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0 }}>Resultado comercial</h3>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: 'var(--mono)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--ressalva)',
            background: 'var(--ressalva-fundo)',
            padding: '5px 11px',
            borderRadius: 999,
          }}
        >
          CRM não conectado
        </span>
      </div>

      {/* O último número real do funil antes do CRM. */}
      <div
        className="card"
        style={{ marginBottom: 16, borderColor: 'var(--green-dim)' }}
      >
        <span className="tag">Aprovações do comprador</span>
        <p style={{ fontSize: 40, fontWeight: 800, color: 'var(--green)', margin: '6px 0' }}>
          {aprovacoes}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6 }}>
          Compradores que clicaram em &ldquo;quero visitar&rdquo; na seleção que você mandou.
          Este número a MORA mede sozinha — é o passo imediatamente anterior à visita.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${compacto ? 150 : 180}px, 1fr))`,
          gap: 12,
          marginBottom: 16,
        }}
      >
        {doCRM.map((d) => (
          <div
            key={d.rotulo}
            style={{
              border: '1px dashed var(--line)',
              borderRadius: 16,
              padding: '20px 18px',
              background: 'var(--elev)',
            }}
          >
            <span className="tag">{d.rotulo}</span>
            <p
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: 'var(--muted-2)',
                margin: '6px 0 4px',
              }}
            >
              —
            </p>
            <p style={{ color: 'var(--muted-2)', fontSize: 13 }}>{d.prova}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--muted)' }}>
          Visita, proposta e venda acontecem no seu CRM, não aqui — e a MORA não vai estimar
          o que não mediu. Quando o CRM estiver conectado, estes quatro blocos se preenchem e
          liberam o múltiplo de retorno: a visita conta como originada pela MORA se o imóvel
          visitado estiver entre os aprovados pelo comprador e a visita ocorrer em até 90
          dias após o envio.{' '}
          <Link href="/dados" style={{ borderBottom: '1px solid var(--muted-2)' }}>
            como calculamos
          </Link>
        </p>
      </div>
    </section>
  )
}
