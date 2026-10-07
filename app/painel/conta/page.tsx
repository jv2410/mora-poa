import { redirect } from 'next/navigation'
import { usuarioAtual, VE_DIRETORIA } from '@/lib/auth'
import FormConta from '@/components/FormConta'

export const metadata = { title: 'Conta — MORA.AI' }
export const dynamic = 'force-dynamic'

export default async function Conta() {
  const u = (await usuarioAtual())!
  if (!VE_DIRETORIA.includes(u.papel)) redirect('/painel')

  return (
    <section className="section-pad" style={{ paddingTop: 40 }}>
      <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="section-head" style={{ marginBottom: 32 }}>
          <span className="eyebrow">Conta</span>
          <h2 style={{ fontSize: 'clamp(28px,4.5vw,40px)' }}>{u.conta_nome}</h2>
          <p>Estes três valores entram direto nas contas do painel.</p>
        </div>
        <FormConta
          comissao={u.comissao_pct}
          mensalidade={u.mensalidade}
          minutos={u.min_por_30_imoveis}
        />
      </div>
    </section>
  )
}
