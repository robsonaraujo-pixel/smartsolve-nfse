import { useState } from "react";
import { api, type Sessao } from "../api";

export default function Login({ onLogin }: { onLogin: (s: Sessao) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setCarregando(true);
    try { onLogin(await api<Sessao>("/auth/login", { method: "POST", json: { email, senha } })); }
    catch (err) { setErro((err as Error).message); }
    finally { setCarregando(false); }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={entrar}>
        <h1>SmartSolve · NFS-e</h1>
        <p className="muted">Emissor no padrão nacional</p>
        {erro && <div className="alert bad">{erro}</div>}
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        <label style={{ marginTop: 10 }}>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <button className="btn primary" style={{ marginTop: 16, width: "100%" }} disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}
