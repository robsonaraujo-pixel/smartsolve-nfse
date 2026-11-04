import { useEffect, useState } from "react";
import { api, fmtBRL, fmtData, type DpsRow, type Empresa, type Papel } from "../api";
import { formatErros } from "./Emitir";

const cor: Record<string, string> = { AUTORIZADA: "ok", REJEITADA: "bad", ERRO_COMUNICACAO: "warn", CANCELADA: "muted", SUBSTITUIDA: "muted", RASCUNHO: "warn", ENVIANDO: "warn" };

export default function Notas({ empresa, papel }: { empresa: Empresa; papel: Papel }) {
  const [rows, setRows] = useState<DpsRow[]>([]);
  const [comp, setComp] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = () => api<DpsRow[]>(`/empresas/${empresa.id}/dps?competencia=${comp}&status=${status}`).then(setRows);
  useEffect(() => { carregar(); }, [empresa.id, comp, status]);

  async function transmitir(id: string) {
    setMsg(null);
    try { const r = await api<DpsRow>(`/empresas/${empresa.id}/dps/${id}/transmitir`, { method: "POST" }); setMsg({ tipo: r.status === "AUTORIZADA" ? "ok" : "bad", texto: `Status: ${r.status}` }); }
    catch (e) { const d = (e as { detalhes?: DpsRow }).detalhes; setMsg({ tipo: "bad", texto: d?.erros ? formatErros(d.erros) : (e as Error).message }); }
    carregar();
  }
  async function cancelar(id: string) {
    const xMotivo = prompt("Motivo do cancelamento (opcional):") ?? undefined;
    if (!confirm("Confirmar o cancelamento da NFS-e na Sefin Nacional?")) return;
    setMsg(null);
    try { await api(`/empresas/${empresa.id}/dps/${id}/cancelar`, { method: "POST", json: { cMotivo: 1, xMotivo } }); setMsg({ tipo: "ok", texto: "NFS-e cancelada." }); }
    catch (e) { setMsg({ tipo: "bad", texto: (e as Error).message }); }
    carregar();
  }

  const totais = rows.filter((r) => r.status === "AUTORIZADA").reduce((a, r) => a + (r.vServ ?? 0), 0);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="v">{rows.filter((r) => r.status === "AUTORIZADA").length}</div><div className="l">autorizadas na competência</div></div>
        <div className="kpi"><div className="v">{fmtBRL(totais)}</div><div className="l">valor dos serviços</div></div>
        <div className="kpi"><div className="v">{rows.filter((r) => r.status === "REJEITADA" || r.status === "ERRO_COMUNICACAO").length}</div><div className="l">pendentes de atenção</div></div>
      </div>
      {msg && <div className={`alert ${msg.tipo}`}><pre style={{ margin: 0, background: "none", color: "inherit", padding: 0 }}>{msg.texto}</pre></div>}
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="month" value={comp} onChange={(e) => setComp(e.target.value)} style={{ width: 170 }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 220 }}>
            <option value="">Todos os status</option>
            {["AUTORIZADA", "REJEITADA", "ERRO_COMUNICACAO", "RASCUNHO", "CANCELADA", "SUBSTITUIDA"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>DPS</th><th>NFS-e</th><th>Competência</th><th>Tomador</th><th className="num">Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <>
                <tr key={r.id}>
                  <td className="mono">{r.serie}-{r.nDps}</td>
                  <td className="mono">{r.nNfse ?? ""}</td>
                  <td>{fmtData(r.dCompet)}</td>
                  <td>{r.tomadorNome ?? <span className="muted">—</span>}</td>
                  <td className="num">{fmtBRL(r.vServ)}</td>
                  <td><span className={`pill ${cor[r.status] ?? ""}`}>{r.status.replace("_", " ")}</span></td>
                  <td className="row" style={{ justifyContent: "flex-end" }}>
                    {(r.status === "RASCUNHO" || r.status === "ERRO_COMUNICACAO" || r.status === "REJEITADA") && <button className="btn small" onClick={() => transmitir(r.id)}>Transmitir</button>}
                    {r.status === "AUTORIZADA" && papel !== "CLIENTE" && <button className="btn small danger" onClick={() => cancelar(r.id)}>Cancelar</button>}
                    {r.erros && <button className="btn small" onClick={() => setAberto(aberto === r.id ? null : r.id)}>Erros</button>}
                  </td>
                </tr>
                {aberto === r.id && r.erros && <tr><td colSpan={7}><pre>{formatErros(r.erros)}</pre></td></tr>}
              </>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">Nenhuma DPS nesta competência.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
