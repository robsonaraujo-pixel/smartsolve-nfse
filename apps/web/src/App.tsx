import { useEffect, useState } from "react";
import { api, sessao, type Empresa, type Sessao, fmtCnpj } from "./api";
import Login from "./pages/Login";
import Emitir from "./pages/Emitir";
import Notas from "./pages/Notas";
import BancoXml from "./pages/BancoXml";
import Cadastros from "./pages/Cadastros";
import Empresas from "./pages/Empresas";
import Escritorio from "./pages/Escritorio";

type Aba = "emitir" | "notas" | "xml" | "cadastros" | "empresas" | "escritorio";

export default function App() {
  const [s, setS] = useState<Sessao | null>(() => sessao.get());
  const [empresas, setEmpresas] = useState<Empresa[]>(s?.empresas ?? []);
  const [empresaId, setEmpresaId] = useState<string>(() => localStorage.getItem("nfse.empresa") ?? "");
  const [aba, setAba] = useState<Aba>("emitir");

  useEffect(() => {
    if (!s) return;
    api<Empresa[]>("/empresas").then((lista) => {
      setEmpresas(lista);
      if (!lista.find((e) => e.id === empresaId)) setEmpresaId(lista[0]?.id ?? "");
    }).catch(() => {});
  }, [s]);
  useEffect(() => { if (empresaId) localStorage.setItem("nfse.empresa", empresaId); }, [empresaId]);

  if (!s) return <Login onLogin={(x) => { sessao.set(x); setS(x); }} />;
  const empresa = empresas.find((e) => e.id === empresaId);
  const admin = s.usuario.papel === "ADMIN";
  const interno = s.usuario.papel !== "CLIENTE";

  return (
    <>
      <header className="topbar">
        <span className="logo">SmartSolve · NFS-e</span>
        {empresas.length > 1 ? (
          <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial} — {fmtCnpj(e.cnpj)}</option>)}
          </select>
        ) : empresa ? <span>{empresa.razaoSocial} <span className="muted mono">{fmtCnpj(empresa.cnpj)}</span></span> : null}
        {empresa?.tpAmb === 2 && <span className="pill warn">Produção restrita (testes)</span>}
        <span className="spacer" />
        <span className="muted">{s.usuario.nome}</span>
        <button className="btn small" onClick={() => { sessao.set(null); setS(null); }}>Sair</button>
      </header>
      <nav className="tabs">
        <button className={aba === "emitir" ? "active" : ""} onClick={() => setAba("emitir")}>Emitir NFS-e</button>
        <button className={aba === "notas" ? "active" : ""} onClick={() => setAba("notas")}>Notas emitidas</button>
        <button className={aba === "xml" ? "active" : ""} onClick={() => setAba("xml")}>Banco de XML</button>
        <button className={aba === "cadastros" ? "active" : ""} onClick={() => setAba("cadastros")}>Tomadores e serviços</button>
        {interno && <button className={aba === "empresas" ? "active" : ""} onClick={() => setAba("empresas")}>Empresas / Acessos</button>}
        {interno && <button className={aba === "escritorio" ? "active" : ""} onClick={() => setAba("escritorio")}>Escritório / Usuários</button>}
      </nav>
      <main>
        {!empresa && aba !== "empresas" && aba !== "escritorio" ? <div className="card">Nenhuma empresa vinculada ao seu usuário. {interno ? "Cadastre uma em Empresas / Acessos." : "Fale com a SmartSolve."}</div> : null}
        {empresa && aba === "emitir" && <Emitir empresa={empresa} onEmitida={() => setAba("notas")} />}
        {empresa && aba === "notas" && <Notas empresa={empresa} papel={s.usuario.papel} />}
        {empresa && aba === "xml" && <BancoXml empresa={empresa} interno={interno} />}
        {empresa && aba === "cadastros" && <Cadastros empresa={empresa} interno={interno} />}
        {interno && aba === "empresas" && <Empresas onEmpresasChanged={() => api<Empresa[]>("/empresas").then(setEmpresas)} />}
        {interno && aba === "escritorio" && <Escritorio admin={admin} />}
      </main>
    </>
  );
}
