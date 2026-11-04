import { useEffect, useState } from "react";
import { api, fmtCnpj, fmtData, type Empresa } from "../api";

interface UsuarioRow { id: string; nome: string; email: string; papel: string; ativo: boolean; empresas: { empresaId: string; cnpj: string; razaoSocial: string; podeEmitir: boolean; podeCancelar: boolean }[] }
interface EscritorioInfo { cnpj: string | null; razaoSocial: string | null; nomeFantasia: string | null; email: string | null; fone: string | null; usarCertificadoParaTodas: boolean; certificado: { subject: string; cnpj?: string | null; validoAte: number } | null }

/** Escritório / Usuários: dados e certificado matriz do escritório contábil, e logins deste sistema (colaboradores e clientes). */
export default function Escritorio({ admin }: { admin: boolean }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [esc, setEsc] = useState<EscritorioInfo | null>(null);
  const [f, setF] = useState({ cnpj: "", razaoSocial: "", nomeFantasia: "", email: "", fone: "" });
  const [buscando, setBuscando] = useState(false);
  const [cert, setCert] = useState<{ senha: string; arquivo?: File }>({ senha: "" });
  const [u, setU] = useState<{ nome: string; email: string; senha: string; papel: string; empresas: string[]; podeCancelar: boolean }>({ nome: "", email: "", senha: "", papel: "CLIENTE", empresas: [], podeCancelar: false });
  const [filtroEmp, setFiltroEmp] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const carregar = async () => {
    api<Empresa[]>("/empresas").then(setEmpresas);
    if (admin) api<UsuarioRow[]>("/usuarios").then(setUsuarios);
    const e = await api<EscritorioInfo>("/escritorio");
    setEsc(e);
    setF({ cnpj: e.cnpj ?? "", razaoSocial: e.razaoSocial ?? "", nomeFantasia: e.nomeFantasia ?? "", email: e.email ?? "", fone: e.fone ?? "" });
  };
  useEffect(() => { carregar(); }, []);

  async function buscarCnpj() {
    const cnpj = f.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) return;
    setBuscando(true);
    try {
      const d = await api<{ razaoSocial: string; nomeFantasia?: string; email?: string; fone?: string }>(`/consultas/cnpj/${cnpj}`);
      setF((o) => ({ ...o, razaoSocial: d.razaoSocial ?? o.razaoSocial, nomeFantasia: d.nomeFantasia ?? o.nomeFantasia, email: d.email ?? o.email, fone: d.fone ?? o.fone }));
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
    finally { setBuscando(false); }
  }
  async function salvarEscritorio(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      await api("/escritorio", { method: "PUT", json: { cnpj: f.cnpj.replace(/\D/g, "") || undefined, razaoSocial: f.razaoSocial || undefined, nomeFantasia: f.nomeFantasia || undefined, email: f.email || undefined, fone: f.fone || undefined } });
      setMsg({ tipo: "ok", texto: "Dados do escritório salvos." }); carregar();
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function alternarFlag(valor: boolean) {
    setMsg(null);
    if (valor && !esc?.certificado) { setMsg({ tipo: "bad", texto: "Envie o certificado matriz antes de ligar esta opção." }); return; }
    try { await api("/escritorio", { method: "PUT", json: { usarCertificadoParaTodas: valor } }); carregar(); }
    catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function enviarCert(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    if (!cert.arquivo) return;
    const fd = new FormData(); fd.append("pfx", cert.arquivo); fd.append("senha", cert.senha);
    try {
      const r = await api<{ subject: string; validoAte: string; cnpjOuCpf?: string }>("/escritorio/certificado", { method: "POST", body: fd });
      const alerta = r.cnpjOuCpf && f.cnpj && r.cnpjOuCpf !== f.cnpj.replace(/\D/g, "") ? ` · atenção: o certificado é de ${fmtCnpj(r.cnpjOuCpf)}, diferente do CNPJ do escritório` : "";
      setMsg({ tipo: alerta ? "bad" : "ok", texto: `Certificado matriz: ${r.subject} · válido até ${fmtData(r.validoAte)}${alerta}` });
      setCert({ senha: "" }); carregar();
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function salvarUsuario(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      await api("/usuarios", { method: "POST", json: { nome: u.nome, email: u.email, senha: u.senha, papel: u.papel, empresas: u.papel === "CLIENTE" ? u.empresas.map((empresaId) => ({ empresaId, podeEmitir: true, podeCancelar: u.podeCancelar })) : [] } });
      setU({ nome: "", email: "", senha: "", papel: "CLIENTE", empresas: [], podeCancelar: false }); carregar();
      setMsg({ tipo: "ok", texto: u.papel === "CLIENTE" ? "Usuário do cliente criado. Ele verá apenas as empresas marcadas." : "Colaborador criado com acesso a todas as empresas." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function alternarAtivo(x: UsuarioRow) { await api(`/usuarios/${x.id}`, { method: "PATCH", json: { ativo: !x.ativo } }); carregar(); }
  async function trocarSenha(x: UsuarioRow) {
    const senha = prompt(`Nova senha para ${x.email} (mínimo 8 caracteres):`);
    if (!senha) return;
    try { await api(`/usuarios/${x.id}`, { method: "PATCH", json: { senha } }); setMsg({ tipo: "ok", texto: "Senha alterada." }); }
    catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function alternarEmpresaUsuario(x: UsuarioRow, empresaId: string, vinculado: boolean) {
    if (vinculado) await api(`/usuarios/${x.id}/empresas/${empresaId}`, { method: "DELETE" });
    else await api(`/usuarios/${x.id}/empresas/${empresaId}`, { method: "PUT", json: { podeEmitir: true, podeCancelar: false } });
    carregar();
  }

  const toggle = (id: string) => setU((o) => ({ ...o, empresas: o.empresas.includes(id) ? o.empresas.filter((x) => x !== id) : [...o.empresas, id] }));
  const empresasFiltradas = empresas.filter((x) => !filtroEmp || x.razaoSocial.toLowerCase().includes(filtroEmp.toLowerCase()) || x.cnpj.includes(filtroEmp.replace(/\D/g, "")));

  return (
    <>
      {msg && <div className={`alert ${msg.tipo}`}>{msg.texto}</div>}

      <div className="card">
        <h2>Escritório contábil</h2>
        <form className="grid" onSubmit={salvarEscritorio}>
          <div className="col-3"><label>CNPJ</label>
            <div className="row" style={{ flexWrap: "nowrap" }}><input value={f.cnpj} onChange={(x) => setF({ ...f, cnpj: x.target.value })} onBlur={buscarCnpj} disabled={!admin} /><button type="button" className="btn small" onClick={buscarCnpj} disabled={buscando || !admin}>{buscando ? "…" : "Buscar"}</button></div></div>
          <div className="col-5" style={{ gridColumn: "span 5" }}><label>Razão social</label><input value={f.razaoSocial} onChange={(x) => setF({ ...f, razaoSocial: x.target.value })} disabled={!admin} /></div>
          <div className="col-4"><label>Nome fantasia</label><input value={f.nomeFantasia} onChange={(x) => setF({ ...f, nomeFantasia: x.target.value })} disabled={!admin} /></div>
          <div className="col-4"><label>E-mail</label><input type="email" value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} disabled={!admin} /></div>
          <div className="col-3"><label>Telefone</label><input value={f.fone} onChange={(x) => setF({ ...f, fone: x.target.value })} disabled={!admin} /></div>
          {admin && <div className="col-5" style={{ gridColumn: "span 5", alignSelf: "end" }}><button className="btn primary">Salvar escritório</button></div>}
        </form>
      </div>

      <div className="card">
        <h2>Certificado matriz do escritório</h2>
        <p className="muted" style={{ fontSize: 13 }}>{esc?.certificado ? <>Atual: <strong>{esc.certificado.subject}</strong>{esc.certificado.cnpj ? ` (${fmtCnpj(esc.certificado.cnpj)})` : ""} · válido até {fmtData(esc.certificado.validoAte)}.</> : "Nenhum certificado cadastrado."}</p>
        {admin && (
          <form className="grid" onSubmit={enviarCert} style={{ marginBottom: 12 }}>
            <div className="col-6"><label>Arquivo .pfx</label><input type="file" accept=".pfx,.p12" onChange={(x) => setCert({ ...cert, arquivo: x.target.files?.[0] })} required /></div>
            <div className="col-3"><label>Senha</label><input type="password" value={cert.senha} onChange={(x) => setCert({ ...cert, senha: x.target.value })} required /></div>
            <div className="col-3" style={{ alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>{esc?.certificado ? "Substituir" : "Enviar"}</button></div>
          </form>
        )}
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--ink)", fontSize: 14, padding: 12, border: "1px solid var(--line)", borderRadius: 8, background: esc?.usarCertificadoParaTodas ? "var(--accent)" : "transparent" }}>
          <input type="checkbox" checked={!!esc?.usarCertificadoParaTodas} onChange={(x) => alternarFlag(x.target.checked)} disabled={!admin} style={{ width: "auto", marginTop: 3 }} />
          <span><strong>Usar o certificado matriz para emitir por todas as empresas cadastradas</strong><br />
            <span className="muted" style={{ fontSize: 13 }}>Com esta opção ligada, toda emissão pela API assina com o certificado do escritório (por procuração), ignorando o modo de acesso individual de cada empresa. Desligada, vale o que está em Empresas / Acessos.</span></span>
        </label>
      </div>

      {admin && (
        <div className="card">
          <h2>Usuários deste sistema</h2>
          <form className="grid" onSubmit={salvarUsuario} style={{ marginBottom: 16 }}>
            <div className="col-3"><label>Nome <span className="req">*</span></label><input value={u.nome} onChange={(x) => setU({ ...u, nome: x.target.value })} required /></div>
            <div className="col-3"><label>E-mail <span className="req">*</span></label><input type="email" value={u.email} onChange={(x) => setU({ ...u, email: x.target.value })} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>Senha (mín. 8)</label><input type="text" value={u.senha} onChange={(x) => setU({ ...u, senha: x.target.value })} minLength={8} required /></div>
            <div className="col-4"><label>Tipo de usuário</label>
              <select value={u.papel} onChange={(x) => setU({ ...u, papel: x.target.value })}>
                <option value="CLIENTE">Cliente — vê só as empresas marcadas</option>
                <option value="OPERADOR">Colaborador do escritório — emite por todas</option>
                <option value="ADMIN">Administrador — tudo, inclusive usuários</option>
              </select></div>
            {u.papel === "CLIENTE" && (
              <div className="col-12">
                <label>Empresas que este cliente poderá ver e emitir <span className="req">*</span> <span className="muted">({u.empresas.length} marcada{u.empresas.length === 1 ? "" : "s"})</span></label>
                <input placeholder="Filtrar por nome ou CNPJ" value={filtroEmp} onChange={(x) => setFiltroEmp(x.target.value)} style={{ marginBottom: 6 }} />
                <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 6 }}>
                  {empresasFiltradas.map((x) => (
                    <label key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 6px", color: "var(--ink)", fontSize: 14, margin: 0 }}>
                      <input type="checkbox" checked={u.empresas.includes(x.id)} onChange={() => toggle(x.id)} style={{ width: "auto" }} />{x.razaoSocial} <span className="muted mono">{fmtCnpj(x.cnpj)}</span>
                    </label>
                  ))}
                  {empresasFiltradas.length === 0 && <div className="muted" style={{ padding: 6 }}>Nenhuma empresa.</div>}
                </div>
                <label style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", color: "var(--ink)" }}><input type="checkbox" checked={u.podeCancelar} onChange={(x) => setU({ ...u, podeCancelar: x.target.checked })} style={{ width: "auto" }} />Pode cancelar notas</label>
              </div>
            )}
            <div className="col-12 row" style={{ justifyContent: "flex-end" }}><button className="btn primary" disabled={u.papel === "CLIENTE" && u.empresas.length === 0}>Criar usuário</button></div>
          </form>
          <table><thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Acesso</th><th></th></tr></thead>
            <tbody>{usuarios.map((x) => <tr key={x.id} style={x.ativo ? undefined : { opacity: 0.55 }}><td>{x.nome}{!x.ativo && <span className="pill bad" style={{ marginLeft: 6 }}>inativo</span>}</td><td className="mono">{x.email}</td>
              <td><span className="pill">{x.papel === "CLIENTE" ? "Cliente" : x.papel === "OPERADOR" ? "Colaborador" : "Admin"}</span></td>
              <td>{x.papel === "CLIENTE" ? <details><summary>{x.empresas.length} empresa{x.empresas.length === 1 ? "" : "s"}</summary>
                <div style={{ maxHeight: 160, overflow: "auto", marginTop: 6 }}>{empresas.map((e) => { const v = x.empresas.find((w) => w.empresaId === e.id); return <label key={e.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--ink)", margin: 0 }}><input type="checkbox" checked={!!v} onChange={() => alternarEmpresaUsuario(x, e.id, !!v)} style={{ width: "auto" }} />{e.razaoSocial} <span className="muted mono">{fmtCnpj(e.cnpj)}</span></label>; })}</div></details> : <span className="muted">todas as empresas</span>}</td>
              <td className="row" style={{ justifyContent: "flex-end" }}><button className="btn small" onClick={() => trocarSenha(x)}>Senha</button><button className="btn small" onClick={() => alternarAtivo(x)}>{x.ativo ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
