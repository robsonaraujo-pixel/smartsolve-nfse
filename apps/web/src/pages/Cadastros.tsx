import { useEffect, useState } from "react";
import { api, fmtCnpj, type Empresa, type Servico, type Tomador } from "../api";

export default function Cadastros({ empresa, interno }: { empresa: Empresa; interno: boolean }) {
  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [t, setT] = useState({ doc: "", nome: "", email: "", cMun: "", cep: "", logradouro: "", numero: "", bairro: "" });
  const [s, setS] = useState({ apelido: "", cTribNac: "", cNBS: "", descricaoPadrao: "", padrao: false });
  const [msg, setMsg] = useState("");

  const carregar = () => Promise.all([api<Tomador[]>(`/empresas/${empresa.id}/tomadores`).then(setTomadores), api<Servico[]>(`/empresas/${empresa.id}/servicos`).then(setServicos)]);
  useEffect(() => { carregar(); }, [empresa.id]);

  async function salvarTomador(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const doc = t.doc.replace(/\D/g, "");
    const body = { nome: t.nome, email: t.email || undefined, cMun: t.cMun || undefined, cep: t.cep.replace(/\D/g, "") || undefined, logradouro: t.logradouro || undefined, numero: t.numero || undefined, bairro: t.bairro || undefined, ...(doc.length === 14 ? { cnpj: doc } : doc.length === 11 ? { cpf: doc } : {}) };
    try { await api(`/empresas/${empresa.id}/tomadores`, { method: "POST", json: body }); setT({ doc: "", nome: "", email: "", cMun: "", cep: "", logradouro: "", numero: "", bairro: "" }); carregar(); }
    catch (err) { setMsg((err as Error).message); }
  }
  async function salvarServico(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    try { await api(`/empresas/${empresa.id}/servicos`, { method: "POST", json: { ...s, cNBS: s.cNBS || undefined } }); setS({ apelido: "", cTribNac: "", cNBS: "", descricaoPadrao: "", padrao: false }); carregar(); }
    catch (err) { setMsg((err as Error).message); }
  }

  return (
    <>
      {msg && <div className="alert bad">{msg}</div>}
      <div className="card">
        <h2>Tomadores</h2>
        <form className="grid" onSubmit={salvarTomador} style={{ marginBottom: 16 }}>
          <div className="col-3"><label>CNPJ ou CPF <span className="req">*</span></label><input value={t.doc} onChange={(e) => setT({ ...t, doc: e.target.value })} required /></div>
          <div className="col-6"><label>Nome / Razão social <span className="req">*</span></label><input value={t.nome} onChange={(e) => setT({ ...t, nome: e.target.value })} required /></div>
          <div className="col-3"><label>E-mail</label><input type="email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></div>
          <div className="col-3"><label>Município (IBGE 7)</label><input value={t.cMun} onChange={(e) => setT({ ...t, cMun: e.target.value })} placeholder="3550308" /></div>
          <div className="col-3"><label>CEP</label><input value={t.cep} onChange={(e) => setT({ ...t, cep: e.target.value })} /></div>
          <div className="col-4"><label>Logradouro</label><input value={t.logradouro} onChange={(e) => setT({ ...t, logradouro: e.target.value })} /></div>
          <div className="col-2" style={{ gridColumn: "span 2" }}><label>Nº</label><input value={t.numero} onChange={(e) => setT({ ...t, numero: e.target.value })} /></div>
          <div className="col-4"><label>Bairro</label><input value={t.bairro} onChange={(e) => setT({ ...t, bairro: e.target.value })} /></div>
          <div className="col-12"><button className="btn primary">Salvar tomador</button></div>
        </form>
        <table><thead><tr><th>Documento</th><th>Nome</th><th>Município</th></tr></thead>
          <tbody>{tomadores.map((x) => <tr key={x.id}><td className="mono">{fmtCnpj(x.cnpj) || x.cpf}</td><td>{x.nome}</td><td className="mono">{x.cMun}</td></tr>)}</tbody></table>
      </div>

      <div className="card">
        <h2>Serviços do catálogo</h2>
        <p className="muted" style={{ fontSize: 13 }}>Códigos definidos pela contabilidade a partir do CNAE do cliente (base CNAE × LC 116 × CTN × NBS). O cliente só escolhe entre estes.</p>
        {interno && (
          <form className="grid" onSubmit={salvarServico} style={{ marginBottom: 16 }}>
            <div className="col-3"><label>Apelido <span className="req">*</span></label><input value={s.apelido} onChange={(e) => setS({ ...s, apelido: e.target.value })} required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>CTN (6 dígitos) <span className="req">*</span></label><input value={s.cTribNac} onChange={(e) => setS({ ...s, cTribNac: e.target.value })} placeholder="170201" required /></div>
            <div className="col-2" style={{ gridColumn: "span 2" }}><label>NBS (9 dígitos)</label><input value={s.cNBS} onChange={(e) => setS({ ...s, cNBS: e.target.value })} /></div>
            <div className="col-5" style={{ gridColumn: "span 5" }}><label>Descrição padrão <span className="req">*</span></label><input value={s.descricaoPadrao} onChange={(e) => setS({ ...s, descricaoPadrao: e.target.value })} required /></div>
            <div className="col-12 row"><label style={{ margin: 0 }}><input type="checkbox" checked={s.padrao} onChange={(e) => setS({ ...s, padrao: e.target.checked })} style={{ width: "auto", marginRight: 6 }} />Serviço padrão</label><button className="btn primary">Salvar serviço</button></div>
          </form>
        )}
        <table><thead><tr><th>Apelido</th><th>CTN</th><th>NBS</th><th>Descrição</th><th></th></tr></thead>
          <tbody>{servicos.map((x) => <tr key={x.id}><td>{x.apelido}</td><td className="mono">{x.cTribNac}</td><td className="mono">{x.cNBS}</td><td>{x.descricaoPadrao}</td><td>{x.padrao && <span className="pill">padrão</span>}</td></tr>)}</tbody></table>
      </div>
    </>
  );
}
