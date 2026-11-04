import { useEffect, useState } from "react";
import { api, fmtCnpj, fmtData, type Empresa } from "../api";

type ModoAcesso = "PORTAL_SENHA" | "CERT_PROPRIO" | "CERT_ESCRITORIO";
interface EmpresaRow extends Empresa { certSubject?: string | null; certValidoAte?: number | null; regApTribSN?: number | null; modoAcesso: ModoAcesso; portalLogin?: string | null; procuracaoValidaAte?: number | null }
interface CertEscritorio { subject: string; cnpj?: string | null; validoAte: number }

const ROTULO: Record<ModoAcesso, string> = { PORTAL_SENHA: "Usuário e senha do portal nacional", CERT_PROPRIO: "Certificado digital próprio", CERT_ESCRITORIO: "Certificado do escritório por procuração" };

/** Empresas (prestadores) e a forma de acesso de cada uma ao portal nacional. */
export default function Empresas({ onEmpresasChanged }: { onEmpresasChanged: () => void }) {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [certEsc, setCertEsc] = useState<CertEscritorio | null>(null);
  const [flagTodas, setFlagTodas] = useState(false);
  const [e, setE] = useState({ cnpj: "", razaoSocial: "", nomeFantasia: "", im: "", cMun: "", email: "", fone: "", modoTotTrib: "IBPT", pTribSN: "", regApTribSN: "1", opSimpNac: "3", tpAmb: "2" });
  const [buscando, setBuscando] = useState(false);
  const [infoCnpj, setInfoCnpj] = useState("");
  const [sel, setSel] = useState<EmpresaRow | null>(null);
  const [acesso, setAcesso] = useState<{ modo: ModoAcesso; login: string; senha: string; procuracao: string; pfx?: File; pfxSenha: string }>({ modo: "CERT_PROPRIO", login: "", senha: "", procuracao: "", pfxSenha: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const carregar = () => Promise.all([api<EmpresaRow[]>("/empresas").then(setEmpresas), api<{ certificado: CertEscritorio | null; usarCertificadoParaTodas: boolean }>("/escritorio").then((e) => { setCertEsc(e.certificado); setFlagTodas(e.usarCertificadoParaTodas); }).catch(() => {})]);
  useEffect(() => { carregar(); }, []);

  async function buscarCnpj() {
    const cnpj = e.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) return;
    setBuscando(true); setInfoCnpj(""); setMsg(null);
    try {
      const d = await api<{ razaoSocial: string; nomeFantasia?: string; cMun?: string; municipio?: string; uf?: string; email?: string; fone?: string; situacao?: string; optanteSimples?: boolean; optanteMei?: boolean; cnaePrincipal?: { codigo: string; descricao: string } }>(`/consultas/cnpj/${cnpj}`);
      setE((o) => ({ ...o, razaoSocial: d.razaoSocial ?? o.razaoSocial, nomeFantasia: d.nomeFantasia ?? o.nomeFantasia, cMun: d.cMun ?? o.cMun, email: d.email ?? o.email, fone: d.fone ?? o.fone, opSimpNac: d.optanteMei ? "2" : d.optanteSimples ? "3" : "1" }));
      setInfoCnpj(`${d.situacao ?? ""} · ${d.municipio ?? ""}/${d.uf ?? ""} · ${d.optanteMei ? "MEI" : d.optanteSimples ? "Simples Nacional" : "não optante"}${d.cnaePrincipal ? ` · CNAE ${d.cnaePrincipal.codigo} ${d.cnaePrincipal.descricao}` : ""}${d.cMun ? "" : " · informe o IBGE manualmente"}`);
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
    finally { setBuscando(false); }
  }

  async function salvarEmpresa(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      const nova = await api<EmpresaRow>("/empresas", { method: "POST", json: { cnpj: e.cnpj.replace(/\D/g, ""), razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia || undefined, im: e.im || undefined, cMun: e.cMun, email: e.email || undefined, fone: e.fone || undefined, modoTotTrib: e.modoTotTrib, pTribSN: e.modoTotTrib === "SN_NOMINAL" && e.pTribSN ? Number(e.pTribSN.replace(",", ".")) : undefined, regApTribSN: Number(e.regApTribSN), opSimpNac: Number(e.opSimpNac), tpAmb: Number(e.tpAmb) } });
      setE({ cnpj: "", razaoSocial: "", nomeFantasia: "", im: "", cMun: "", email: "", fone: "", modoTotTrib: "IBPT", pTribSN: "", regApTribSN: "1", opSimpNac: "3", tpAmb: "2" }); setInfoCnpj("");
      await carregar(); onEmpresasChanged();
      abrirAcesso({ ...nova, modoAcesso: "CERT_PROPRIO" });
      setMsg({ tipo: "ok", texto: "Empresa cadastrada. Agora defina o acesso ao portal nacional." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }

  function abrirAcesso(emp: EmpresaRow) {
    setSel(emp);
    setAcesso({ modo: emp.modoAcesso, login: emp.portalLogin ?? "", senha: "", procuracao: emp.procuracaoValidaAte ? new Date(emp.procuracaoValidaAte).toISOString().slice(0, 10) : "", pfxSenha: "" });
  }

  async function salvarAcesso(ev: React.FormEvent) {
    ev.preventDefault(); if (!sel) return; setMsg(null);
    try {
      if (acesso.modo === "PORTAL_SENHA") {
        if (!acesso.login || (!acesso.senha && sel.portalLogin !== acesso.login)) throw new Error("Informe usuário e senha do portal");
        if (acesso.senha) await api(`/empresas/${sel.id}/portal-credenciais`, { method: "PUT", json: { login: acesso.login, senha: acesso.senha } });
        else await api(`/empresas/${sel.id}`, { method: "PATCH", json: { modoAcesso: "PORTAL_SENHA" } });
      } else if (acesso.modo === "CERT_ESCRITORIO") {
        if (!certEsc) throw new Error("Cadastre primeiro o certificado do escritório em Escritório / Usuários");
        await api(`/empresas/${sel.id}`, { method: "PATCH", json: { modoAcesso: "CERT_ESCRITORIO", procuracaoValidaAte: acesso.procuracao || undefined } });
      } else {
        await api(`/empresas/${sel.id}`, { method: "PATCH", json: { modoAcesso: "CERT_PROPRIO" } });
        if (acesso.pfx) {
          const fd = new FormData(); fd.append("pfx", acesso.pfx); fd.append("senha", acesso.pfxSenha);
          const r = await api<{ subject: string; validoAte: string; alerta?: string }>(`/empresas/${sel.id}/certificado`, { method: "POST", body: fd });
          if (r.alerta) setMsg({ tipo: "bad", texto: r.alerta });
        } else if (!sel.certValidoAte) throw new Error("Envie o arquivo .pfx da empresa");
      }
      await carregar(); onEmpresasChanged(); setSel(null);
      if (!msg) setMsg({ tipo: "ok", texto: "Acesso ao portal nacional atualizado." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }

  const statusAcesso = (x: EmpresaRow) => {
    if (x.modoAcesso === "PORTAL_SENHA") return x.portalLogin ? <span className="pill warn">portal: {x.portalLogin}</span> : <span className="pill bad">portal sem credenciais</span>;
    if (x.modoAcesso === "CERT_ESCRITORIO") return certEsc ? <span className={`pill ${x.procuracaoValidaAte && new Date(x.procuracaoValidaAte) < new Date() ? "bad" : "ok"}`}>procuração{x.procuracaoValidaAte ? ` até ${fmtData(x.procuracaoValidaAte)}` : ""}</span> : <span className="pill bad">escritório sem certificado</span>;
    return x.certValidoAte ? <span className={`pill ${new Date(x.certValidoAte) < new Date() ? "bad" : "ok"}`}>A1 até {fmtData(x.certValidoAte)}</span> : <span className="pill bad">sem certificado</span>;
  };

  return (
    <>
      {msg && <div className={`alert ${msg.tipo}`}>{msg.texto}</div>}
      {flagTodas && <div className="alert warn">O escritório está configurado para emitir por todas as empresas com o certificado matriz (Escritório / Usuários). O modo de acesso individual abaixo fica em segundo plano enquanto essa opção estiver ligada.</div>}
      <div className="card">
        <h2>Empresas (prestadores)</h2>
        <form className="grid" onSubmit={salvarEmpresa} style={{ marginBottom: 16 }}>
          <div className="col-3"><label>CNPJ <span className="req">*</span></label>
            <div className="row" style={{ flexWrap: "nowrap" }}><input value={e.cnpj} onChange={(x) => setE({ ...e, cnpj: x.target.value })} onBlur={buscarCnpj} placeholder="00.000.000/0000-00" required /><button type="button" className="btn small" onClick={buscarCnpj} disabled={buscando}>{buscando ? "…" : "Buscar"}</button></div></div>
          <div className="col-5" style={{ gridColumn: "span 5" }}><label>Razão social <span className="req">*</span></label><input value={e.razaoSocial} onChange={(x) => setE({ ...e, razaoSocial: x.target.value })} required /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Inscrição municipal</label><input value={e.im} onChange={(x) => setE({ ...e, im: x.target.value })} /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Município IBGE <span className="req">*</span></label><input value={e.cMun} onChange={(x) => setE({ ...e, cMun: x.target.value })} placeholder="3550308" required /></div>
          {infoCnpj && <div className="col-12 muted" style={{ fontSize: 13, marginTop: -4 }}>{infoCnpj}</div>}
          <div className="col-4"><label>Nome fantasia</label><input value={e.nomeFantasia} onChange={(x) => setE({ ...e, nomeFantasia: x.target.value })} /></div>
          <div className="col-4"><label>E-mail</label><input type="email" value={e.email} onChange={(x) => setE({ ...e, email: x.target.value })} /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Telefone</label><input value={e.fone} onChange={(x) => setE({ ...e, fone: x.target.value })} /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Enquadramento</label>
            <select value={e.opSimpNac} onChange={(x) => setE({ ...e, opSimpNac: x.target.value })}><option value="3">ME/EPP Simples</option><option value="2">MEI</option><option value="1">Não optante</option></select></div>
          <div className="col-3"><label>Valor aproximado dos tributos (Lei 12.741)</label>
            <select value={e.modoTotTrib} onChange={(x) => setE({ ...e, modoTotTrib: x.target.value })}>
              <option value="INFORMAR">Informar a cada emissão</option>
              <option value="IBPT">Tributos aproximados IBPT 13,45%</option>
              <option value="SN_NOMINAL">Alíquota nominal do Simples Nacional</option>
            </select>
            {e.modoTotTrib === "SN_NOMINAL" && <input style={{ marginTop: 6 }} value={e.pTribSN} onChange={(x) => setE({ ...e, pTribSN: x.target.value })} placeholder="Alíquota nominal, ex.: 6,00" required />}
          </div>
          <div className="col-5" style={{ gridColumn: "span 5" }}><label>Regime de apuração no Simples</label>
            <select value={e.regApTribSN} onChange={(x) => setE({ ...e, regApTribSN: x.target.value })}>
              <option value="1">Federais e ISS pelo Simples Nacional (DAS)</option>
              <option value="2">Federais pelo Simples; ISS pela NFS-e (município exige)</option>
              <option value="3">Federais e ISS pela NFS-e</option>
            </select></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Ambiente</label>
            <select value={e.tpAmb} onChange={(x) => setE({ ...e, tpAmb: x.target.value })}><option value="2">Produção restrita</option><option value="1">Produção</option></select></div>
          <div className="col-2" style={{ gridColumn: "span 2", alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>Cadastrar</button></div>
        </form>
        <table><thead><tr><th>CNPJ</th><th>Razão social</th><th>Ambiente</th><th>Acesso ao portal nacional</th><th></th></tr></thead>
          <tbody>{empresas.map((x) => <tr key={x.id}><td className="mono">{fmtCnpj(x.cnpj)}</td><td>{x.razaoSocial}</td><td>{x.tpAmb === 1 ? <span className="pill ok">produção</span> : <span className="pill warn">testes</span>}</td>
            <td><div style={{ fontSize: 13 }}>{ROTULO[x.modoAcesso]}</div>{statusAcesso(x)}</td>
            <td><button className="btn small" onClick={() => abrirAcesso(x)}>Acesso</button></td></tr>)}
            {empresas.length === 0 && <tr><td colSpan={5} className="muted">Nenhuma empresa cadastrada.</td></tr>}</tbody></table>
      </div>

      {sel && (
        <div className="card">
          <h2>Acesso ao portal nacional · {sel.razaoSocial}</h2>
          <form onSubmit={salvarAcesso}>
            <div className="grid">
              <div className="col-12">
                {(["CERT_PROPRIO", "CERT_ESCRITORIO", "PORTAL_SENHA"] as ModoAcesso[]).map((m) => (
                  <label key={m} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--ink)", fontSize: 14, marginBottom: 8 }}>
                    <input type="radio" name="modo" checked={acesso.modo === m} onChange={() => setAcesso({ ...acesso, modo: m })} style={{ width: "auto", marginTop: 3 }} />
                    <span><strong>{ROTULO[m]}</strong><br /><span className="muted" style={{ fontSize: 13 }}>
                      {m === "CERT_PROPRIO" && "A empresa tem e-CNPJ A1. Emissão pela API da Sefin Nacional, direto deste sistema."}
                      {m === "CERT_ESCRITORIO" && "O escritório assina com o próprio certificado, amparado por procuração da empresa. Emissão pela API."}
                      {m === "PORTAL_SENHA" && "Sem certificado. A API da Sefin não aceita login e senha: a nota é preparada aqui e concluída no Emissor Web (gov.br)."}
                    </span></span>
                  </label>
                ))}
              </div>
              {acesso.modo === "CERT_PROPRIO" && <>
                <div className="col-5" style={{ gridColumn: "span 5" }}><label>Arquivo .pfx {sel.certValidoAte ? <span className="muted">(atual válido até {fmtData(sel.certValidoAte)})</span> : <span className="req">*</span>}</label><input type="file" accept=".pfx,.p12" onChange={(x) => setAcesso({ ...acesso, pfx: x.target.files?.[0] })} /></div>
                <div className="col-3"><label>Senha do certificado</label><input type="password" value={acesso.pfxSenha} onChange={(x) => setAcesso({ ...acesso, pfxSenha: x.target.value })} /></div>
              </>}
              {acesso.modo === "CERT_ESCRITORIO" && <>
                <div className="col-6">{certEsc ? <p className="muted" style={{ fontSize: 13 }}>Certificado do escritório: {certEsc.subject} · válido até {fmtData(certEsc.validoAte)}</p> : <div className="alert bad" style={{ margin: 0 }}>Cadastre o certificado do escritório em Escritório / Usuários.</div>}</div>
                <div className="col-3"><label>Procuração válida até</label><input type="date" value={acesso.procuracao} onChange={(x) => setAcesso({ ...acesso, procuracao: x.target.value })} /></div>
              </>}
              {acesso.modo === "PORTAL_SENHA" && <>
                <div className="col-4"><label>Usuário do portal (CPF/CNPJ ou e-mail)</label><input value={acesso.login} onChange={(x) => setAcesso({ ...acesso, login: x.target.value })} /></div>
                <div className="col-4"><label>Senha {sel.portalLogin && <span className="muted">(deixe vazio para manter)</span>}</label><input type="password" value={acesso.senha} onChange={(x) => setAcesso({ ...acesso, senha: x.target.value })} /></div>
              </>}
              <div className="col-12 row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setSel(null)}>Cancelar</button><button className="btn primary">Salvar acesso</button></div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
