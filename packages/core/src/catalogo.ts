import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

/** Catálogo oficial ANEXO_B (lista de serviços nacional + NBS) e enums do XSD v1.01, trazidos do portal gov.br/nfse. */
interface CatalogoJson {
  version: string;
  sourceURL: string;
  serviceCodes: { code: string; description: string }[];
  nbsCodes: { code: string; description: string }[];
}
interface EnumsJson {
  version: string;
  regApTribSN: { code: string; label: string }[];
  pisCofinsCst: { code: string; label: string }[];
  tipoRetencaoPisCofins: { code: string; label: string }[];
  retencaoIss: { code: string; label: string }[];
}

const catalogo = require("../data/catalogo-nacional.json") as CatalogoJson;
const enums = require("../data/enums-xsd.json") as EnumsJson;

export const CATALOGO_VERSAO = catalogo.version;
export const ENUMS_VERSAO = enums.version;
export const codigosTribNac = catalogo.serviceCodes;
export const codigosNbs = catalogo.nbsCodes;
export const enumsXsd = { regApTribSN: enums.regApTribSN, pisCofinsCst: enums.pisCofinsCst, tipoRetencaoPisCofins: enums.tipoRetencaoPisCofins, retencaoIss: enums.retencaoIss };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function buscarTribNac(q: string, limite = 30) {
  const n = norm(q.trim());
  if (!n) return codigosTribNac.slice(0, limite);
  const digits = n.replace(/\D/g, "");
  return codigosTribNac.filter((s) => (digits && s.code.startsWith(digits)) || norm(s.description).includes(n)).slice(0, limite);
}
export function buscarNbs(q: string, limite = 30) {
  const n = norm(q.trim());
  if (!n) return codigosNbs.slice(0, limite);
  const digits = n.replace(/\D/g, "");
  return codigosNbs.filter((s) => (digits && s.code.startsWith(digits)) || norm(s.description).includes(n)).slice(0, limite);
}
export const tribNacValido = (code: string) => codigosTribNac.some((s) => s.code === code);
export const nbsValido = (code: string) => codigosNbs.some((s) => s.code === code);
