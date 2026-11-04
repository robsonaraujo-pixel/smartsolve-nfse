/** Builder mínimo de XML: escapa texto, omite campos vazios, preserva a ordem dos elementos (o XSD exige sequência). */

export type XmlNode = { [tag: string]: XmlValue };
export type XmlValue = string | number | boolean | null | undefined | XmlNode | XmlValue[];

export function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Decimal com 2 casas, ponto como separador, sem separador de milhar (padrão SPED). */
export function dec(v: number, casas = 2): string {
  return (Math.round(v * 10 ** casas) / 10 ** casas).toFixed(casas);
}

export function el(tag: string, value: XmlValue, attrs?: Record<string, string | undefined>): string {
  if (value === undefined || value === null || value === "") return "";
  const a = attrs
    ? Object.entries(attrs)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
        .join("")
    : "";
  if (Array.isArray(value)) return value.map((v) => el(tag, v, attrs)).join("");
  if (typeof value === "object") {
    const inner = Object.entries(value)
      .map(([k, v]) => el(k, v))
      .join("");
    if (inner === "") return "";
    return `<${tag}${a}>${inner}</${tag}>`;
  }
  if (typeof value === "boolean") return `<${tag}${a}>${value ? 1 : 0}</${tag}>`;
  return `<${tag}${a}>${esc(String(value))}</${tag}>`;
}

/** Insere XML bruto já montado (usado para o grupo IBSCBS gerado por outro módulo). */
export class Raw {
  constructor(public readonly xml: string) {}
}
export function raw(tag: string, value?: string): string {
  return value ? value : "";
}
