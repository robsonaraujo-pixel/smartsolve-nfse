/**
 * Identificador da DPS (42 caracteres), conforme Manual dos Contribuintes v1.2:
 *   cLocEmi (7) + tpInsc (1: 1=CNPJ, 2=CPF) + inscrição (14, CPF com zeros à esquerda)
 *   + série (5, zeros à esquerda) + nDPS (15, zeros à esquerda)
 * No XML vai como atributo Id="DPS" + identificador.
 */
export interface IdDpsParts {
  cLocEmi: string;
  cnpj?: string;
  cpf?: string;
  serie: string;
  nDPS: number | string;
}

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function buildIdDps(p: IdDpsParts): string {
  const cLocEmi = onlyDigits(p.cLocEmi);
  if (cLocEmi.length !== 7) throw new Error(`cLocEmi deve ter 7 dígitos (IBGE): ${p.cLocEmi}`);

  let tpInsc: "1" | "2";
  let insc: string;
  if (p.cnpj) {
    tpInsc = "1";
    insc = p.cnpj.toUpperCase().replace(/[^0-9A-Z]/g, ""); // tolera CNPJ alfanumérico
    if (insc.length !== 14) throw new Error(`CNPJ deve ter 14 posições: ${p.cnpj}`);
  } else if (p.cpf) {
    tpInsc = "2";
    insc = onlyDigits(p.cpf).padStart(14, "0");
    if (insc.length !== 14) throw new Error(`CPF inválido: ${p.cpf}`);
  } else {
    throw new Error("Informe cnpj ou cpf do emitente");
  }

  const serie = onlyDigits(p.serie).padStart(5, "0");
  if (serie.length !== 5) throw new Error(`Série deve ter até 5 dígitos: ${p.serie}`);

  const n = String(p.nDPS).padStart(15, "0");
  if (!/^\d{15}$/.test(n)) throw new Error(`nDPS deve ter até 15 dígitos: ${p.nDPS}`);

  return `${cLocEmi}${tpInsc}${insc}${serie}${n}`;
}

export function parseIdDps(id: string): IdDpsParts & { tpInsc: "1" | "2" } {
  const s = id.startsWith("DPS") ? id.slice(3) : id;
  if (s.length !== 42) throw new Error(`Identificador de DPS deve ter 42 posições: ${id}`);
  const tpInsc = s.slice(7, 8) as "1" | "2";
  const insc = s.slice(8, 22);
  return {
    cLocEmi: s.slice(0, 7),
    tpInsc,
    cnpj: tpInsc === "1" ? insc : undefined,
    cpf: tpInsc === "2" ? insc.replace(/^0{3}/, "") : undefined,
    serie: s.slice(22, 27),
    nDPS: Number(s.slice(27, 42)),
  };
}
