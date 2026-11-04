import { useEffect, useState } from "react";
import { api, fmtBRL, fmtCnpj, fmtData, sessao, type Documento, type Empresa } from "../api";

export default function BancoXml({ empresa, interno }: { empresa: Empresa; interno: boolean }) {
  const [tipo, setTipo] = useState<"NFSE" | "EVENTO">("NFSE");
  const [origem, setOrigem] = useState("");
  const [comp, setComp] = useState("");
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<{ total: number; itens: Documento[] }>({ total: 0, itens: [] });
  const [msg, setMsg] = useState("");

  const carregar = () => api<{ total: number; itens: Documento[] }>(`/empresas/${empresa.id}/documentos?tipo=${tipo}&origem=${origem}&competencia=${comp}&tomador=${encodeURIComponent(busca)}`).then(setDados);
  useEffect(() => { carregar(); }, [empresa.id, tipo, origem, comp, busca]);

  async function sincronizar() {
    setMsg("Sincronizando com o ADN…");
    try { const r = await api<{ importados: number; ultimoNsu: number }>(`/empresas/${empresa.id}/documentos/sincronizar`, { method: "POST" }); setMsg(`${r.importados} documento(s) importado(s). Último NSU ${r.ultimoNsu}.`); carregar(); }
    catch (e) { setMsg(`Falha: ${(e as Error).message}`); }
  }
  async function baixar(d: Documento) {
    const s = sessao.get();
    const r = await fetch(`/api/empresas/${empresa.id}/documentos/${d.id}/xml`, { headers: { authorization: `Bearer ${s?.token}` } });
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${d.tipo}_${d.chaveAcesso}${d.tipoEvento ? "_" + d.tipoEvento : ""}.xml`; a.click();
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="toggle" style={{ width: 240 }}>
          <button className={`btn ${tipo === "NFSE" ? "on" : ""}`} onClick={() => setTipo("NFSE")}>Notas</button>
          <button className={`btn ${tipo === "EVENTO" ? "on" : ""}`} onClick={() => setTipo("EVENTO")}>Eventos</button>
        </div>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={{ width: 200 }}>
          <option value="">Todas as origens</option>
          <option value="EMITIDA">Emitidas aqui</option>
          <option value="SINCRONIZADA">Emitidas fora (ADN)</option>
          <option value="RECEBIDA">Recebidas como tomador</option>
        </select>
        <input type="month" value={comp} onChange={(e) => setComp(e.target.value)} style={{ width: 170 }} />
        <input placeholder="Tomador (nome ou CNPJ)" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
        {interno && <button className="btn" onClick={sincronizar}>Sincronizar com o ADN</button>}
      </div>
      {msg && <div className="alert warn">{msg}</div>}
      <p className="muted" style={{ fontSize: 13 }}>{dados.total} documento(s). O XML guardado é o original assinado, válido como documento fiscal.</p>
      <table>
        <thead><tr><th>Origem</th><th>NFS-e / Evento</th><th>Competência</th><th>Emitente</th><th>Tomador</th><th className="num">Valor</th><th></th></tr></thead>
        <tbody>
          {dados.itens.map((d) => (
            <tr key={d.id} style={d.cancelada ? { opacity: 0.55 } : undefined}>
              <td><span className={`pill ${d.origem === "RECEBIDA" ? "muted" : ""}`}>{d.origem === "EMITIDA" ? "Emitida" : d.origem === "RECEBIDA" ? "Recebida" : "ADN"}</span>{d.cancelada && <span className="pill bad" style={{ marginLeft: 4 }}>cancelada</span>}</td>
              <td className="mono">{d.tipo === "NFSE" ? d.nNfse ?? d.chaveAcesso.slice(-8) : d.tipoEvento}<div className="muted" style={{ fontSize: 11 }}>{d.chaveAcesso}</div></td>
              <td>{fmtData(d.dCompet)}</td>
              <td>{d.emitenteNome ?? fmtCnpj(d.emitenteDoc)}</td>
              <td>{d.tomadorNome ?? fmtCnpj(d.tomadorDoc)}</td>
              <td className="num">{fmtBRL(d.vServ)}</td>
              <td><button className="btn small" onClick={() => baixar(d)}>XML</button></td>
            </tr>
          ))}
          {dados.itens.length === 0 && <tr><td colSpan={7} className="muted">Nada por aqui ainda.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
