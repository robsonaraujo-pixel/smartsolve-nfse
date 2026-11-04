import { useEffect, useState } from "react";
import { api, fmtCnpj, fmtData, type Empresa } from "../api";

interface UsuarioRow { id: string; nome: string; email: string; papel: string; ativo: boolean; empresas: { empresaId: string; cnpj: string; razaoSocial: string; podeEmitir: boolean; podeCancelar: boolean }[] }
interface CertEscritorio { subject: string; cnpj?: string | null; validoAte: number }

/** Escritório / Usuários: certificado do escritório contábil e logins deste sistema (equipe e clientes). */
export default function Escritorio({ admin }: { admin: boolean }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [certEsc, setCertEsc] = useState<CertEscritorio | null>(null);
  const [cert, setCert] = useState<{ senha: string; arquivo?: File }>({ senha: "" });
  const [u, setU] = useState({ nome: "", email: "", senha: "", papel: "CLIENTE", empresaId: "", podeCancelar: false });
  const [msg, setMsg] = useState<{ tipo: "ok" | "bad"; texto: string } | null>(null);

  const carregar = () => { api<Empresa[]>("/empresas").then(setEmpresas); api<CertEscritorio | null>("/escritorio/certificado").then(setCertEsc).catch(() => {}); if (admin) api<UsuarioRow[]>("/usuarios").then(setUsuarios); };
  useEffect(() => { carregar(); }, []);

  async function enviarCert(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    if (!cert.arquivo) return;
    const fd = new FormData(); fd.append("pfx", cert.arquivo); fd.append("senha", cert.senha);
    try {
      const r = await api<{ subject: string; validoAte: string }>("/escritorio/certificado", { method: "POST", body: fd });
      setMsg({ tipo: "ok", texto: `Certificado do escritório: ${r.subject} · válido até ${fmtData(r.validoAte)}` });
      setCert({ senha: "" }); carregar();
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function salvarUsuario(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try {
      await api("/usuarios", { method: "POST", json: { nome: u.nome, email: u.email, senha: u.senha, papel: u.papel, empresas: u.papel === "CLIENTE" && u.empresaId ? [{ empresaId: u.empresaId, podeEmitir: true, podeCancelar: u.podeCancelar }] : [] } });
      setU({ nome: "", email: "", senha: "", papel: "CLIENTE", empresaId: "", podeCancelar: false }); carregar();
      setMsg({ tipo: "ok", texto: "Usuário criado. Envie e-mail e senha; um usuário cliente só enxerga o CNPJ vinculado." });
    } catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }
  async function alternarAtivo(x: UsuarioRow) {
    await api(`/usuarios/${x.id}`, { method: "PATCH", json: { ativo: !x.ativo } }); carregar();
  }
  async function trocarSenha(x: UsuarioRow) {
    const senha = prompt(`Nova senha para ${x.email} (mínimo 8 caracteres):`);
    if (!senha) return;
    try { await api(`/usuarios/${x.id}`, { method: "PATCH", json: { senha } }); setMsg({ tipo: "ok", texto: "Senha alterada." }); }
    catch (err) { setMsg({ tipo: "bad", texto: (err as Error).message }); }
  }

  return (
    <>
      {msg && <div className={`alert ${msg.tipo}`}>{msg.texto}</div>}
      <div className="card">
        <h2>Certificado digital do escritório</h2>
        <p className="muted" style={{ fontSize: 13 }}>Usado nas empresas configuradas como "certificado do escritório por procuração". {certEsc ? <>Atual: <strong>{certEsc.subject}</strong>{certEsc.cnpj ? ` (${fmtCnpj(certEsc.cnpj)})` : ""} · válido até {fmtData(certEsc.validoAte)}.</> : "Nenhum cadastrado."}</p>
        {admin && (
          <form className="grid" onSubmit={enviarCert}>
            <div className="col-6"><label>Arquivo .pfx</label><input type="file" accept=".pfx,.p12" onChange={(x) => setCert({ ...cert, arquivo: x.target.files?.[0] })} required /></div>
            <div className="col-3"><label>Senha</label><input type="password" value={cert.senha} onChange={(x) => setCert({ ...cert, senha: x.target.value })} required /></div>
            <div className="col-3" style={{ alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>{certEsc ? "Substituir" : "Enviar"}</button></div>
          </form>
        )}
      </div>

      {admin && (
        <div className="card">
          <h2>Usuários deste sistema</h2>
          <form className="grid" onSubmit={salvarUsuario} style={{ marginBottom: 16 }}>
            <div className="col-3"><label>Nome <span className="req">*</span></label><input value={u.nome} onChange={(x) => setU({ ...u, nome: x.target.value })} required /></div>
            <div className="col-3"><label>E-mail <span className="req">*</span></label><input type="email" value={u.email} onChange={(x) => setU({ ...u, email: x.target.value })} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>Senha (mín. 8)</label><input type="text" value={u.senha} onChange={(x) => setU({ ...u, senha: x.target.value })} minLength={8} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>Papel</label>
              <select value={u.papel} onChange={(x) => setU({ ...u, papel: x.target.value })}><option value="CLIENTE">Cliente (1 CNPJ)</option><option value="OPERADOR">Operador do escritório</option><option value="ADMIN">Administrador</option></select></div>
            {u.papel === "CLIENTE" && <>
              <div className="col-6"><label>Empresa que o cliente verá <span className="req">*</span></label><select value={u.empresaId} onChange={(x) => setU({ ...u, empresaId: x.target.value })} required><option value="">Selecione…</option>{empresas.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial} · {fmtCnpj(x.cnpj)}</option>)}</select></div>
              <div className="col-4 row" style={{ alignSelf: "end" }}><label style={{ margin: 0 }}><input type="checkbox" checked={u.podeCancelar} onChange={(x) => setU({ ...u, podeCancelar: x.target.checked })} style={{ width: "auto", marginRight: 6 }} />Pode cancelar notas</label></div>
            </>}
            <div className="col-2" style={{ gridColumn: "span 2", alignSelf: "end" }}><button className="btn primary" style={{ width: "100%" }}>Criar</button></div>
          </form>
          <table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Empresas</th><th></th></tr></thead>
            <tbody>{usuarios.map((x) => <tr key={x.id} style={x.ativo ? undefined : { opacity: 0.55 }}><td>{x.nome}{!x.ativo && <span className="pill bad" style={{ marginLeft: 6 }}>inativo</span>}</td><td className="mono">{x.email}</td><td><span className="pill">{x.papel}</span></td>
              <td>{x.papel === "CLIENTE" ? x.empresas.map((v) => <div key={v.empresaId}>{v.razaoSocial} <span className="muted mono">{fmtCnpj(v.cnpj)}</span>{v.podeCancelar && <span className="pill warn" style={{ marginLeft: 4 }}>cancela</span>}</div>) : <span className="muted">todas</span>}</td>
              <td className="row" style={{ justifyContent: "flex-end" }}><button className="btn small" onClick={() => trocarSenha(x)}>Senha</button><button className="btn small" onClick={() => alternarAtivo(x)}>{x.ativo ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
