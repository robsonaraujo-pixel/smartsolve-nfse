import { ClienteHttp, gunzipBase64 } from "../http/transporte.js";
import type { CertificadoA1 } from "../sign/certificado.js";
import type { Ambiente } from "../dps/types.js";

export const ADN_URLS: Record<Ambiente, string> = {
  1: "https://adn.nfse.gov.br/",
  2: "https://adn.producaorestrita.nfse.gov.br/",
};

export interface DocumentoDfe {
  nsu: number;
  chaveAcesso?: string;
  tipoDocumento?: string; // NFSE | EVENTO
  arquivoXml: string; // descompactado
  dataHoraGeracao?: string;
  raw: unknown;
}

/**
 * ADN — Ambiente de Dados Nacional.
 * Usa o swagger de contribuintes (/contribuintes/docs) e de parametrização (/parametrizacao/docs).
 * Os nomes exatos dos campos de retorno variam entre versões do swagger; por isso guardamos `raw`
 * e extraímos o que é estável (NSU, chave, XML gzip/base64).
 */
export class Adn {
  private http: ClienteHttp;
  constructor(cert: CertificadoA1, public readonly ambiente: Ambiente, baseUrl?: string) {
    this.http = new ClienteHttp({ baseUrl: baseUrl ?? ADN_URLS[ambiente], cert });
  }

  /**
   * Distribuição de DF-e: GET /contribuintes/DFe/{nsu}
   * Retorna o lote de documentos a partir do NSU informado (notas em que o certificado é prestador,
   * tomador ou intermediário, e eventos). Guarde o maior NSU para a próxima chamada.
   */
  async distribuirDfe(nsuInicial: number): Promise<{ status: number; documentos: DocumentoDfe[]; ultimoNsu: number; raw: unknown }> {
    const r = await this.http.request<any>("GET", `contribuintes/DFe/${nsuInicial}`);
    const lista: any[] = r.body?.LoteDFe ?? r.body?.loteDFe ?? r.body?.documentos ?? [];
    const documentos: DocumentoDfe[] = lista.map((d) => ({
      nsu: Number(d.NSU ?? d.nsu),
      chaveAcesso: d.ChaveAcesso ?? d.chaveAcesso,
      tipoDocumento: d.TipoDocumento ?? d.tipoDocumento,
      arquivoXml: gunzipBase64(d.ArquivoXml ?? d.arquivoXml ?? d.xmlGZipB64),
      dataHoraGeracao: d.DataHoraGeracao ?? d.dataHoraGeracao,
      raw: d,
    }));
    const ultimoNsu = documentos.reduce((m, d) => Math.max(m, d.nsu), nsuInicial);
    return { status: r.status, documentos, ultimoNsu, raw: r.body };
  }

  /** GET /contribuintes/NFSe/{chave} — XML de uma NFS-e específica (como ator). */
  async consultarNfse(chaveAcesso: string) {
    const r = await this.http.request<any>("GET", `contribuintes/NFSe/${chaveAcesso}`);
    const b64 = r.body?.ArquivoXml ?? r.body?.arquivoXml ?? r.body?.nfseXmlGZipB64;
    return { status: r.status, nfseXml: b64 ? gunzipBase64(b64) : undefined, raw: r.body };
  }

  /** GET /danfse/{chave} — PDF oficial (pode estar sobrestado; trate 404/501 e gere localmente). */
  async danfse(chaveAcesso: string): Promise<{ status: number; pdf?: Buffer }> {
    const r = await this.http.request<any>("GET", `danfse/${chaveAcesso}`);
    const b64 = typeof r.body === "object" ? r.body?.arquivoPdfGZipB64 ?? r.body?.pdfBase64 : undefined;
    return { status: r.status, pdf: b64 ? Buffer.from(b64, "base64") : undefined };
  }

  // ---- Parâmetros municipais ----
  async convenio(cMun: string) {
    return this.http.request<unknown>("GET", `parametrizacao/${cMun}/convenio`);
  }
  async aliquota(cMun: string, cServ: string, competencia: string) {
    return this.http.request<unknown>("GET", `parametrizacao/${cMun}/${cServ}/${competencia}/aliquota`);
  }
  async retencoes(cMun: string) {
    return this.http.request<unknown>("GET", `parametrizacao/${cMun}/retencoes`);
  }
  async regimesEspeciais(cMun: string, cServ: string, competencia: string) {
    return this.http.request<unknown>("GET", `parametrizacao/${cMun}/${cServ}/${competencia}/regimes_especiais`);
  }
  async beneficio(cMun: string, nBM: string, competencia: string) {
    return this.http.request<unknown>("GET", `parametrizacao/${cMun}/${nBM}/${competencia}/beneficio`);
  }
}
