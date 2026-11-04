import { DOMParser } from "@xmldom/xmldom";

export interface ResumoNfse {
  chaveAcesso?: string;
  nNFSe?: string;
  dhProc?: string;
  cLocIncid?: string;
  emitente?: { cnpj?: string; cpf?: string; xNome?: string };
  tomador?: { cnpj?: string; cpf?: string; xNome?: string };
  idDps?: string;
  dCompet?: string;
  vServ?: number;
  vLiq?: number;
  vISSQN?: number;
  cTribNac?: string;
  xDescServ?: string;
}

function txt(doc: Document, path: string[]): string | undefined {
  // caminho por local-name, a partir da raiz
  let nodes: Element[] = [doc.documentElement as unknown as Element];
  for (const name of path) {
    const next: Element[] = [];
    for (const n of nodes) {
      for (let i = 0; i < n.childNodes.length; i++) {
        const c = n.childNodes[i] as Element;
        if (c.nodeType === 1 && c.localName === name) next.push(c);
      }
    }
    nodes = next;
    if (!nodes.length) return undefined;
  }
  return nodes[0].textContent ?? undefined;
}

/** Extrai os campos de indexação do XML da NFS-e (NFSe/infNFSe/...) para o banco de XML. */
export function extrairResumoNfse(nfseXml: string): ResumoNfse {
  const doc = new DOMParser().parseFromString(nfseXml, "text/xml") as unknown as Document;
  const inf = doc.getElementsByTagName("infNFSe")[0] as Element | undefined;
  const chave = inf?.getAttribute("Id")?.replace(/^NFS/, "") ?? undefined;
  const infDps = doc.getElementsByTagName("infDPS")[0] as Element | undefined;
  const num = (p: string[]) => {
    const v = txt(doc, p);
    return v !== undefined ? Number(v) : undefined;
  };
  return {
    chaveAcesso: chave,
    nNFSe: txt(doc, ["infNFSe", "nNFSe"]),
    dhProc: txt(doc, ["infNFSe", "dhProc"]),
    cLocIncid: txt(doc, ["infNFSe", "cLocIncid"]),
    emitente: {
      cnpj: txt(doc, ["infNFSe", "emit", "CNPJ"]),
      cpf: txt(doc, ["infNFSe", "emit", "CPF"]),
      xNome: txt(doc, ["infNFSe", "emit", "xNome"]),
    },
    tomador: {
      cnpj: txt(doc, ["infNFSe", "DPS", "infDPS", "toma", "CNPJ"]),
      cpf: txt(doc, ["infNFSe", "DPS", "infDPS", "toma", "CPF"]),
      xNome: txt(doc, ["infNFSe", "DPS", "infDPS", "toma", "xNome"]),
    },
    idDps: infDps?.getAttribute("Id")?.replace(/^DPS/, "") ?? undefined,
    dCompet: txt(doc, ["infNFSe", "DPS", "infDPS", "dCompet"]),
    vServ: num(["infNFSe", "DPS", "infDPS", "valores", "vServPrest", "vServ"]),
    vLiq: num(["infNFSe", "valores", "vLiq"]),
    vISSQN: num(["infNFSe", "valores", "vISSQN"]),
    cTribNac: txt(doc, ["infNFSe", "DPS", "infDPS", "serv", "cServ", "cTribNac"]),
    xDescServ: txt(doc, ["infNFSe", "DPS", "infDPS", "serv", "cServ", "xDescServ"]),
  };
}
