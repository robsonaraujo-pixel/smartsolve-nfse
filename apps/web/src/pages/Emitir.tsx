import { useEffect, useState } from "react";
import { api, fmtCnpj, type Empresa, type Servico, type Tomador } from "../api";

/**
 * Emissão em tela única. Reproduz os passos da "Emissão completa" do Emissor Web
 * já com os defaults do Simples Nacional preenchidos pela contabilidade (empresa + catálogo).
 */
export default function Emitir({ empresa, onEmitida }: { empresa: Empresa; onEmitida: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState({ dCompet: hoje, tomadorId: "", servicoId: "", xDescServ: "", vServ: "", tpRetISSQN: 1 as 1 | 2, vDescIncond: "", tpRetPisCofins: 2 as 1 | 2, vRetIRRF: "", vRetCSLL: "", vRetCP: "", pTotTrib: "" });
  const [estado, setEstado] = useState<{ tipo: "ok" | "bad" | "warn"; msg: string; detalhe?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [previa, setPrevia] = useState<string>("");

  useEffect(() => {
    api<Servico[]>(`/empresas/${empresa.id}/servicos`).then((s) => { setServicos(s); const p = s.find((x) => x.padrao) ?? s[0]; if (p) setF((o) => ({ ...o, servicoId: p.id, xDescServ: p.descricaoPadrao })); });
  }, [empresa.id]);
  useEffect(() => {
    const t = setTimeout(() => api<Tomador[]>(`/empresas/${empresa.id}/tomadores?q=${encodeURIComponent(busca)}`).then(setTomadores), 200);
    return () => clearTimeout(t);
  }, [empresa.id, busca]);

  const set = (k: keyof typeof f, v: string | number) => setF((o) => ({ ...o, [k]: v }));
  const servico = servicos.find((s) => s.id === f.servicoId);
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

  function corpo(somenteRascunho: boolean) {
    return {
      dCompet: f.dCompet, tomadorId: f.tomadorId || undefined, servicoId: f.servicoId, xDescServ: f.xDescServ || undefined,
      vServ: num(f.vServ), vDescIncond: num(f.vDescIncond),
      tribMun: { tribISSQN: 1, tpRetISSQN: f.tpRetISSQN },
      tribFed: { tpRetPisCofins: f.tpRetPisCofins, vRetIRRF: num(f.vRetIRRF), vRetCSLL: num(f.vRetCSLL), vRetCP: num(f.vRetCP) },
      totTrib: empresa.modoTotTrib === "INFORMAR" && num(f.pTotTrib) !== undefined ? { pTotTrib: num(f.pTotTrib) } : undefined,
      somenteRascunho,
    };
  }

  async function previsualizar() {
    setEstado(null); setPrevia("");
    try {
      const r = await api<{ xml: string }>(`/empresas/${empresa.id}/dps`, { method: "POST", json: corpo(true) });
      setPrevia(r.xml);
      setEstado({ tipo: "warn", msg: "Rascunho gerado (consumiu um número de DPS). Confira o XML e transmita em Notas emitidas, ou emita direto pelo botão Emitir." });
    } catch (e) { setEstado({ tipo: "bad", msg: (e as Error).message }); }
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    if (!f.tomadorId && !confirm("Emitir sem tomador informado?")) return;
    setEstado(null); setEnviando(true);
    try {
      const r = await api<{ status: string; chaveAcesso?: string; erros?: string }>(`/empresas/${empresa.id}/dps`, { method: "POST", json: corpo(false) });
      if (r.status === "AUTORIZADA") { setEstado({ tipo: "ok", msg: `NFS-e autorizada. Chave ${r.chaveAcesso}` }); setTimeout(onEmitida, 1200); }
      else setEstado({ tipo: "bad", msg: `Nota ${r.status.toLowerCase().replace("_", " ")}`, detalhe: r.erros ? formatErros(r.erros) : undefined });
    } catch (err) {
      const d = (err as { detalhes?: { status?: string; erros?: string } }).detalhes;
      setEstado({ tipo: "bad", msg: d?.status ? `Nota ${d.status.toLowerCase().replace("_", " ")}` : (err as Error).message, detalhe: d?.erros ? formatErros(d.erros) : undefined });
    } finally { setEnviando(false); }
  }

  return (
    <form onSubmit={emitir}>
      {estado && <div className={`alert ${estado.tipo}`}>{estado.msg}{estado.detalhe && <pre style={{ marginTop: 8 }}>{estado.detalhe}</pre>}</div>}
      {empresa.certValidoAte != null && new Date(empresa.certValidoAte) < new Date() && <div className="alert bad">Certificado digital vencido. Peça à SmartSolve para atualizar.</div>}

      <div className="card">
        <h3>1 · Quando e para quem</h3>
        <div className="grid">
          <div className="col-3"><label>Competência <span className="req">*</span></label><input type="date" value={f.dCompet} onChange={(e) => set("dCompet", e.target.value)} required /></div>
          <div className="col-9"><label>Tomador (cliente)</label>
            <div className="row">
              <input placeholder="Buscar por nome ou CNPJ/CPF" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1 }} />
              <select value={f.tomadorId} onChange={(e) => set("tomadorId", e.target.value)} style={{ flex: 2 }}>
                <option value="">— Tomador não informado —</option>
                {tomadores.map((t) => <option key={t.id} value={t.id}>{t.nome} · {fmtCnpj(t.cnpj) || t.cpf}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>2 · O que foi prestado</h3>
        <div className="grid">
          <div className="col-6"><label>Serviço do catálogo <span className="req">*</span></label>
            <select value={f.servicoId} onChange={(e) => { const s = servicos.find((x) => x.id === e.target.value); set("servicoId", e.target.value); if (s) set("xDescServ", s.descricaoPadrao); }} required>
              <option value="">Selecione…</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.apelido} · CTN {s.cTribNac}{s.cNBS ? ` · NBS ${s.cNBS}` : ""}</option>)}
            </select>
            {servico && <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>Código de tributação nacional {servico.cTribNac}{servico.cNBS ? `, NBS ${servico.cNBS}` : ", sem NBS (ok para Simples em 2026)"}.</p>}
          </div>
          <div className="col-6"><label>Descrição na nota <span className="req">*</span> <span className="muted">({f.xDescServ.length}/2000)</span></label>
            <textarea value={f.xDescServ} onChange={(e) => set("xDescServ", e.target.value.slice(0, 2000))} required /></div>
        </div>
      </div>

      <div className="card">
        <h3>3 · Valores e retenções</h3>
        <div className="grid">
          <div className="col-3"><label>Valor do serviço (R$) <span className="req">*</span></label><input inputMode="decimal" value={f.vServ} onChange={(e) => set("vServ", e.target.value)} placeholder="0,00" required /></div>
          <div className="col-3"><label>Desconto incondicionado (R$)</label><input inputMode="decimal" value={f.vDescIncond} onChange={(e) => set("vDescIncond", e.target.value)} /></div>
          <div className="col-3"><label>ISS retido pelo tomador?</label>
            <div className="toggle"><button type="button" className={`btn ${f.tpRetISSQN === 1 ? "on" : ""}`} onClick={() => set("tpRetISSQN", 1)}>Não</button><button type="button" className={`btn ${f.tpRetISSQN === 2 ? "on" : ""}`} onClick={() => set("tpRetISSQN", 2)}>Sim</button></div></div>
          <div className="col-3"><label>PIS/COFINS/CSLL retidos?</label>
            <div className="toggle"><button type="button" className={`btn ${f.tpRetPisCofins === 2 ? "on" : ""}`} onClick={() => set("tpRetPisCofins", 2)}>Não</button><button type="button" className={`btn ${f.tpRetPisCofins === 1 ? "on" : ""}`} onClick={() => set("tpRetPisCofins", 1)}>Sim</button></div></div>
          {empresa.modoTotTrib === "INFORMAR" && <div className="col-3"><label>Tributos aproximados (% do valor)</label><input inputMode="decimal" value={f.pTotTrib} onChange={(e) => set("pTotTrib", e.target.value)} placeholder="ex.: 13,45" /></div>}
          {f.tpRetPisCofins === 1 && <>
            <div className="col-3"><label>IRRF retido (R$)</label><input inputMode="decimal" value={f.vRetIRRF} onChange={(e) => set("vRetIRRF", e.target.value)} /></div>
            <div className="col-3"><label>CSLL retida (R$)</label><input inputMode="decimal" value={f.vRetCSLL} onChange={(e) => set("vRetCSLL", e.target.value)} /></div>
            <div className="col-3"><label>Contrib. previdenciária retida (R$)</label><input inputMode="decimal" value={f.vRetCP} onChange={(e) => set("vRetCP", e.target.value)} /></div>
          </>}
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Regime: Simples Nacional, ISS apurado no DAS. Tributos aproximados: {empresa.modoTotTrib === "IBPT" ? "IBPT 13,45%" : empresa.modoTotTrib === "SN_NOMINAL" ? `alíquota nominal do Simples ${empresa.pTribSN ?? "?"}%` : "informados a cada emissão"}. IBS/CBS: {empresa.informarIbsCbs ? "informado" : "não informado (regra geral do Simples em 2026)"}. Esses parâmetros são definidos pela SmartSolve no cadastro da empresa.
        </p>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={previsualizar} disabled={enviando}>Gerar rascunho (ver XML)</button>
        <button className="btn primary" disabled={enviando}>{enviando ? "Transmitindo…" : "Emitir NFS-e"}</button>
      </div>
      {previa && <details className="card" open><summary>XML da DPS (antes da assinatura)</summary><pre>{previa}</pre></details>}
    </form>
  );
}

export function formatErros(json: string): string {
  try {
    const arr = JSON.parse(json) as { codigo: string; descricao: string; complemento?: string }[];
    return arr.map((e) => `${e.codigo} — ${e.descricao}${e.complemento ? `\n   ${e.complemento}` : ""}`).join("\n");
  } catch { return json; }
}
