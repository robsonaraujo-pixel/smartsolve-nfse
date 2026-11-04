import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import xpath from "xpath";
import type { CertificadoA1 } from "./certificado.js";
import { certBase64 } from "./certificado.js";

/**
 * Assinatura XML-DSig enveloped no padrão SPED/NFS-e:
 *  - Reference URI="#<Id do elemento>" (infDPS, infPedReg)
 *  - Transforms: enveloped-signature + C14N 1.0 (inclusive)
 *  - DigestMethod SHA-256, SignatureMethod RSA-SHA256
 *  - KeyInfo/X509Data/X509Certificate
 * A tag <Signature> entra como último filho do elemento raiz (DPS / pedRegEvento).
 */
export function assinarXml(xml: string, cert: CertificadoA1, elementoAssinado: string): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64(cert.certPem)}</X509Certificate></X509Data>`,
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${elementoAssinado}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${elementoAssinado}']`, action: "after" },
  });
  return sig.getSignedXml();
}

/** Verifica a assinatura contida no XML (usada em testes e para conferir XMLs recebidos). */
export function verificarAssinatura(xml: string): { valida: boolean; erro?: string } {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const nodes = xpath.select("//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']", doc as unknown as Node);
  const node = (nodes as Node[])[0];
  if (!node) return { valida: false, erro: "Signature não encontrada" };
  // Por padrão o xml-crypto ignora o certificado do KeyInfo; aqui queremos exatamente ele (é o que a Sefin faz).
  const sig = new SignedXml({ getCertFromKeyInfo: SignedXml.getCertFromKeyInfo });
  sig.loadSignature(node);
  try {
    const ok = sig.checkSignature(xml);
    return { valida: ok };
  } catch (e) {
    return { valida: false, erro: (e as Error).message };
  }
}
