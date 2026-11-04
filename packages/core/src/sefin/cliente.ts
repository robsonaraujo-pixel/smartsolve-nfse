import { ClienteHttp, gzipBase64, gunzipBase64 } from "../http/transporte.js";
import type { CertificadoA1 } from "../sign/certificado.js";
import type { Ambiente, EmissaoResultado, SefinErro } from "../dps/types.js";

/** URLs oficiais (página "APIs - Prod. Restrita e Produção" do portal gov.br/nfse). */
export const SEFIN_URLS: Record<Ambiente, string> = {
  1: "https://sefin.nfse.gov.br/SefinNacional/",
  2: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/",
};

interface SefinRespostaNfse {
  tipoAmbiente?: number;
  versaoAplicativo?: string;
  dataHoraProcessamento?: string;
  idDPS?: string;
  chaveAcesso?: string;
  nfseXmlGZipB64?: string;
  erros?: SefinErro[];
  alertas?: SefinErro[];
}

export class SefinNacional {
  private http: ClienteHttp;
  constructor(cert: CertificadoA1, public readonly ambiente: Ambiente, baseUrl?: string) {
    this.http = new ClienteHttp({ baseUrl: baseUrl ?? SEFIN_URLS[ambiente], cert });
  }

  /** POST /nfse — envia a DPS assinada e recebe a NFS-e (síncrono). */
  async emitir(dpsXmlAssinada: string, idDps: string): Promise<EmissaoResultado> {
    const r = await this.http.request<SefinRespostaNfse>("POST", "nfse", { dpsXmlGZipB64: gzipBase64(dpsXmlAssinada) });
    const body = r.body ?? ({} as SefinRespostaNfse);
    const ok = r.status >= 200 && r.status < 300 && !!body.nfseXmlGZipB64;
    return {
      ok,
      httpStatus: r.status,
      idDps,
      chaveAcesso: body.chaveAcesso,
      nfseXml: body.nfseXmlGZipB64 ? gunzipBase64(body.nfseXmlGZipB64) : undefined,
      erros: body.erros ?? (ok ? undefined : [{ codigo: `HTTP${r.status}`, descricao: r.rawBody.slice(0, 500) }]),
      rawResponse: body,
    };
  }

  /** GET /nfse/{chaveAcesso} — XML da NFS-e autorizada. */
  async consultarNfse(chaveAcesso: string): Promise<{ status: number; nfseXml?: string; raw: unknown }> {
    const r = await this.http.request<SefinRespostaNfse>("GET", `nfse/${chaveAcesso}`);
    return { status: r.status, nfseXml: r.body?.nfseXmlGZipB64 ? gunzipBase64(r.body.nfseXmlGZipB64) : undefined, raw: r.body };
  }

  /** GET /dps/{id} — chave de acesso gerada a partir do identificador da DPS (só para ator da nota). */
  async consultarChavePorDps(idDps: string): Promise<{ status: number; chaveAcesso?: string; raw: unknown }> {
    const r = await this.http.request<{ chaveAcesso?: string }>("GET", `dps/${idDps}`);
    return { status: r.status, chaveAcesso: r.body?.chaveAcesso, raw: r.body };
  }

  /** HEAD /dps/{id} — true se já existe NFS-e para o identificador (idempotência antes de retransmitir). */
  async dpsJaGerada(idDps: string): Promise<boolean> {
    const r = await this.http.request("HEAD", `dps/${idDps}`);
    return r.status === 200;
  }

  /** POST /nfse/{chave}/eventos — pedido de registro de evento assinado. */
  async registrarEvento(chaveAcesso: string, pedRegEventoXmlAssinado: string) {
    const r = await this.http.request<{ eventoXmlGZipB64?: string; erros?: SefinErro[] }>("POST", `nfse/${chaveAcesso}/eventos`, {
      pedidoRegistroEventoXmlGZipB64: gzipBase64(pedRegEventoXmlAssinado),
    });
    return {
      ok: r.status >= 200 && r.status < 300 && !r.body?.erros?.length,
      status: r.status,
      eventoXml: r.body?.eventoXmlGZipB64 ? gunzipBase64(r.body.eventoXmlGZipB64) : undefined,
      erros: r.body?.erros,
      raw: r.body,
    };
  }

  /** GET /nfse/{chave}/eventos[/{tipo}[/{seq}]] */
  async consultarEventos(chaveAcesso: string, tipoEvento?: string, seq?: number) {
    const path = ["nfse", chaveAcesso, "eventos", tipoEvento, seq].filter((p) => p !== undefined).join("/");
    const r = await this.http.request<unknown>("GET", path);
    return { status: r.status, raw: r.body };
  }
}
