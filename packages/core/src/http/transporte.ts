import https from "node:https";
import zlib from "node:zlib";
import type { CertificadoA1 } from "../sign/certificado.js";

export function gzipBase64(xml: string): string {
  return zlib.gzipSync(Buffer.from(xml, "utf8")).toString("base64");
}

export function gunzipBase64(b64: string): string {
  return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

export interface HttpResposta<T = unknown> {
  status: number;
  body: T;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface ClienteHttpOpcoes {
  baseUrl: string;
  cert: CertificadoA1;
  timeoutMs?: number;
}

/** Cliente HTTPS com mTLS (certificado A1 do emitente). JSON in/out. */
export class ClienteHttp {
  private agent: https.Agent;
  constructor(private opts: ClienteHttpOpcoes) {
    this.agent = new https.Agent({
      pfx: opts.cert.pfx,
      passphrase: opts.cert.passphrase,
      keepAlive: true,
    });
  }

  request<T = unknown>(method: "GET" | "POST" | "HEAD", path: string, json?: unknown): Promise<HttpResposta<T>> {
    const url = new URL(path.replace(/^\//, ""), this.opts.baseUrl.endsWith("/") ? this.opts.baseUrl : this.opts.baseUrl + "/");
    const payload = json !== undefined ? JSON.stringify(json) : undefined;
    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method,
          agent: this.agent,
          timeout: this.opts.timeoutMs ?? 30000,
          headers: {
            Accept: "application/json",
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            let body: unknown = rawBody;
            try {
              body = rawBody ? JSON.parse(rawBody) : undefined;
            } catch {
              /* resposta não JSON (HTML de erro, por exemplo) */
            }
            resolve({ status: res.statusCode ?? 0, body: body as T, rawBody, headers: res.headers });
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
