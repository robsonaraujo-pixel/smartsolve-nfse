import { useEffect, useState } from "react";
import { api, fmtCnpj, fmtData, sessao, type Empresa } from "../api";

interface UsuarioRow { id: string; nome: string; email: string; papel: string; ativo: boolean; empresas: { empresaId: string; cnpj: string; razaoSocial: string; podeEmitir: boolean; podeCancelar: boolean }[] }
interface EmpresaRow extends Empresa { certSubject?: string | null; certValidoAte?: number | null; aliquotaSN?: number | null; regApTribSN?: number | null }

export default function Admin({ admin, onEmpresasChanged }: { admin: boolean; onEmpresasChanged: () => void }) {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [e, setE] = useState({ cnpj: "", razaoSocial: "", nomeFantasia: "", im: "", cMun: "", email: "", fone: "", aliquotaSN: "", regApTribSN: "1", opSimpNac: "3", tpAmb: "2" });
  const [buscando, setBuscando] = useState(false);
  const [infoCnpj, setInfoCnpj] = useState<string>("");

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
  const [u, setU] = useState({ nome: "", email: "", senha: "", papel: "CLIENTE", empresaId: "", podeCancelar: false });
  const [cert, setCert] = useState<{ empresaId: string; senha: string; arquivo?: File }>({ empresaId: "", senha: "" });
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const carregar = () => { api<EmpresaRow[]>("/empresas").then(setEmpresas); if (admin) api<UsuarioRow[]>("/usuarios").then(setUsuarios); };
  useEffect(() => { carregar(); }, []);

  async function salvarEmpresa(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      await api("/empresas", { method: "POST", json: { cnpj: e.cnpj.replace(/\D/g, ""), razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia || undefined, im: e.im || undefined, cMun: e.cMun, email: e.email || undefined, fone: e.fone || undefined, aliquotaSN: e.aliquotaSN ? Number(e.aliquotaSN.replace(",", ".")) : undefined, regApTribSN: Number(e.regApTribSN), opSimpNac: Number(e.opSimpNac), tpAmb: Number(e.tpAmb) } });
      setE({ cnpj: "", razaoSocial: "", nomeFantasia: "", im: "", cMun: "", email: "", fone: "", aliquotaSN: "", regApTribSN: "1", opSimpNac: "3", tpAmb: "2" }); setInfoCnpj(""); carregar(); onEmpresasChanged();
      setMsg({ tipo: "ok", texto: "Empresa cadastrada. Agora envie o certificado A1 e cadastre os serviços do catálogo." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function enviarCert(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    if (!cert.arquivo) return;
    const fd = new FormData(); fd.append("pfx", cert.arquivo); fd.append("senha", cert.senha);
    try {
      const r = await api<{ subject: string; validoAte: string; alerta?: string }>(`/empresas/${cert.empresaId}/certificado`, { method: "POST", body: fd });
      setMsg({ tipo: r.alerta ? "bad" : "ok", texto: `${r.subject} · válido até ${fmtData(r.validoAte)}${r.alerta ? ` · ${r.alerta}` : ""}` });
      setCert({ empresaId: "", senha: "" }); carregar(); onEmpresasChanged();
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function salvarUsuario(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      await api("/usuarios", { method: "POST", json: { nome: u.nome, email: u.email, senha: u.senha, papel: u.papel, empresas: u.papel === "CLIENTE" && u.empresaId ? [{ empresaId: u.empresaId, podeEmitir: true, podeCancelar: u.podeCancelar }] : [] } });
      setU({ nome: "", email: "", senha: "", papel: "CLIENTE", empresaId: "", podeCancelar: false }); carregar();
      setMsg({ tipo: "ok", texto: "Usuário criado. Envie e-mail e senha ao cliente; ele só verá o CNPJ vinculado." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }

  return (
    <>
      {msg && <div className={`alert ${msg.tipo}`}>{msg.texto}</div>}
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
          <div className="col-3"><label>Alíquota efetiva do Simples (%)</label><input value={e.aliquotaSN} onChange={(x) => setE({ ...e, aliquotaSN: x.target.value })} placeholder="6,00" /></div>
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
        <table><thead><tr><th>CNPJ</th><th>Razão social</th><th>Ambiente</th><th>Certificado</th></tr></thead>
          <tbody>{empresas.map((x) => <tr key={x.id}><td className="mono">{fmtCnpj(x.cnpj)}</td><td>{x.razaoSocial}</td><td>{x.tpAmb === 1 ? <span className="pill ok">produção</span> : <span className="pill warn">testes</span>}</td>
            <td>{x.certValidoAte ? <span className={`pill ${new Date(x.certValidoAte) < new Date() ? "bad" : "ok"}`}>até {fmtData(x.certValidoAte)}</span> : <span className="pill bad">sem certificado</span>}</td></tr>)}</tbody></table>
      </div>

      <div className="card">
        <h2>Certificado digital A1</h2>
        <form className="grid" onSubmit={enviarCert}>
          <div className="col-5" style={{ gridColumn: "span 5" }}><label>Empresa</label><select value={cert.empresaId} onChange={(x) => setCert({ ...cert, empresaId: x.target.value })} required><option value="">Selecione…</option>{empresas.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}</select></div>
          <div className="col-3"><label>Arquivo .pfx</label><input type="file" accept=".pfx,.p12" onChange={(x) => setCert({ ...cert, arquivo: x.target.files?.[0] })} required /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Senha</label><input type="password" value={cert.senha} onChange={(x) => setCert({ ...cert, senha: x.target.value })} required /></div>
          <div className="col-2" style={{ gridColumn: "span 2", alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>Enviar</button></div>
        </form>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>O arquivo é cifrado (AES-256-GCM) antes de ir para o banco. A senha nunca fica em claro.</p>
      </div>

      {admin && (
        <div className="card">
          <h2>Usuários</h2>
          <form className="grid" onSubmit={salvarUsuario} style={{ marginBottom: 16 }}>
            <div className="col-3"><label>Nome <span className="req">*</span></label><input value={u.nome} onChange={(x) => setU({ ...u, nome: x.target.value })} required /></div>
            <div className="col-3"><label>E-mail <span className="req">*</span></label><input type="email" value={u.email} onChange={(x) => setU({ ...u, email: x.target.value })} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>Senha (mín. 8)</label><input type="text" value={u.senha} onChange={(x) => setU({ ...u, senha: x.target.value })} minLength={8} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>Papel</label>
              <select value={u.papel} onChange={(x) => setU({ ...u, papel: x.target.value })}><option value="CLIENTE">Cliente (1 CNPJ)</option><option value="OPERADOR">Operador SmartSolve</option><option value="ADMIN">Administrador</option></select></div>
            {u.papel === "CLIENTE" && <>
              <div className="col-6"><label>Empresa que o cliente verá <span className="req">*</span></label><select value={u.empresaId} onChange={(x) => setU({ ...u, empresaId: x.target.value })} required><option value="">Selecione…</option>{empresas.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial} · {fmtCnpj(x.cnpj)}</option>)}</select></div>
              <div className="col-4 row" style={{ alignSelf: "end" }}><label style={{ margin: 0 }}><input type="checkbox" checked={u.podeCancelar} onChange={(x) => setU({ ...u, podeCancelar: x.target.checked })} style={{ width: "auto", marginRight: 6 }} />Pode cancelar notas</label></div>
            </>}
            <div className="col-2" style={{ gridColumn: "span 2", alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>Criar</button></div>
          </form>
          <table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Empresas</th></tr></thead>
            <tbody>{usuarios.map((x) => <tr key={x.id}><td>{x.nome}{!x.ativo && <span className="pill bad" style={{ marginLeft: 6 }}>inativo</span>}</td><td className="mono">{x.email}</td><td><span className="pill">{x.papel}</span></td>
              <td>{x.papel === "CLIENTE" ? x.empresas.map((v) => <div key={v.empresaId}>{v.razaoSocial} <span className="muted mono">{fmtCnpj(v.cnpj)}</span>{v.podeCancelar && <span className="pill warn" style={{ marginLeft: 4 }}>cancela</span>}</div>) : <span className="muted">todas</span>}</td></tr>)}</tbody></table>
          <p className="muted" style={{ fontSize: 13 }}>Logado como {sessao.get()?.usuario.nome}.</p>
        </div>
      )}
    </>
  );
}
