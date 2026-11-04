export type Papel = "ADMIN" | "OPERADOR" | "CLIENTE";
export interface Sessao { token: string; usuario: { id: string; nome: string; papel: Papel }; empresas: Empresa[] }
export interface Empresa { id: string; cnpj: string; razaoSocial: string; tpAmb?: number; certValidoAte?: number | null; aliquotaSN?: number | null; informarIbsCbs?: boolean }
export interface Tomador { id: string; cnpj?: string | null; cpf?: string | null; nome: string; cMun?: string | null }
export interface Servico { id: string; apelido: string; cTribNac: string; cNBS?: string | null; descricaoPadrao: string; padrao: boolean }
export interface DpsRow { id: string; serie: string; nDps: number; idDps: string; status: string; dCompet: string; chaveAcesso?: string | null; erros?: string | null; nNfse?: string | null; tomadorNome?: string | null; vServ?: number | null; cancelada?: boolean | null; criadoEm: number }
export interface Documento { id: string; tipo: string; origem: string; chaveAcesso: string; tipoEvento: string; nNfse?: string | null; dCompet?: string | null; dhProc?: number | null; emitenteDoc?: string | null; emitenteNome?: string | null; tomadorDoc?: string | null; tomadorNome?: string | null; vServ?: number | null; vLiq?: number | null; cancelada: boolean }

const KEY = "nfse.sessao";
export const sessao = {
  get(): Sessao | null {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; }
  },
  set(s: Sessao | null) {
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public detalhes?: unknown) { super(message); }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const s = sessao.get();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (s) headers.authorization = `Bearer ${s.token}`;
  let body = init.body;
  if (init.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(init.json); }
  const r = await fetch(`/api${path}`, { ...init, headers, body });
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) {
    if (r.status === 401) { sessao.set(null); location.reload(); }
    throw new ApiError(r.status, (data as { erro?: string })?.erro ?? `HTTP ${r.status}`, data);
  }
  return data as T;
}

export const fmtCnpj = (v?: string | null) => (v && v.length === 14 ? v.replace(/^(..)(...)(...)(....)(..)$/, "$1.$2.$3/$4-$5") : v ?? "");
export const fmtBRL = (v?: number | null) => (v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const fmtData = (v?: string | number | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");
