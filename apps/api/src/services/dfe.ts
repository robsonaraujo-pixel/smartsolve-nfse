import { Adn, extrairResumoNfse, type Ambiente } from "@smartsolve/nfse-core";
import { and, eq } from "drizzle-orm";
import { db, schema, erro } from "./db.js";
import { certificadoDaEmpresa } from "./certificado.js";

const { empresas, documentos, syncDfe } = schema;

/**
 * Sincroniza a caixa de DF-e do ADN para uma empresa: NFS-e em que ela é tomadora/intermediária
 * (RECEBIDA), prestadora emitidas por fora (SINCRONIZADA) e eventos. Guarda o XML íntegro.
 */
export async function sincronizarDfe(empresaId: string, maxLotes = 20) {
  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.id, empresaId) });
  if (!empresa) throw erro(404, "Empresa não encontrada");
  const cert = await certificadoDaEmpresa(empresaId);
  const adn = new Adn(cert, empresa.tpAmb as Ambiente);
  await db.insert(syncDfe).values({ empresaId }).onConflictDoNothing();
  const sync = (await db.query.syncDfe.findFirst({ where: eq(syncDfe.empresaId, empresaId) }))!;

  let nsu = sync.ultimoNsu;
  let importados = 0;
  try {
    for (let i = 0; i < maxLotes; i++) {
      const lote = await adn.distribuirDfe(nsu + 1);
      if (lote.status === 404 || lote.documentos.length === 0) break;
      if (lote.status >= 400) throw new Error(`ADN HTTP ${lote.status}`);
      for (const d of lote.documentos) {
        const isEvento = (d.tipoDocumento ?? "").toUpperCase().includes("EVENTO") || d.arquivoXml.includes("<evento");
        if (isEvento) {
          const tipoEvento = /<infEvento[^>]*>[\s\S]*?<(e\d{6})>/.exec(d.arquivoXml)?.[1] ?? "evento";
          const chave = d.chaveAcesso ?? /<chNFSe>(\d{50})<\/chNFSe>/.exec(d.arquivoXml)?.[1] ?? "";
          await db
            .insert(documentos)
            .values({ empresaId, tipo: "EVENTO", origem: "RECEBIDA", chaveAcesso: chave, tipoEvento, nsu: d.nsu, xml: d.arquivoXml })
            .onConflictDoUpdate({ target: [documentos.empresaId, documentos.chaveAcesso, documentos.tipo, documentos.tipoEvento], set: { nsu: d.nsu } });
          if (tipoEvento.startsWith("e1011") || tipoEvento.startsWith("e1051")) {
            await db.update(documentos).set({ cancelada: true }).where(and(eq(documentos.empresaId, empresaId), eq(documentos.chaveAcesso, chave), eq(documentos.tipo, "NFSE")));
          }
        } else {
          const r = extrairResumoNfse(d.arquivoXml);
          const chave = r.chaveAcesso ?? d.chaveAcesso ?? "";
          const emitidaPorMim = r.emitente?.cnpj === empresa.cnpj;
          await db
            .insert(documentos)
            .values({
              empresaId,
              tipo: "NFSE",
              origem: emitidaPorMim ? "SINCRONIZADA" : "RECEBIDA",
              chaveAcesso: chave,
              tipoEvento: "",
              nsu: d.nsu,
              nNfse: r.nNFSe,
              dCompet: r.dCompet,
              dhProc: r.dhProc ? new Date(r.dhProc) : undefined,
              emitenteDoc: r.emitente?.cnpj ?? r.emitente?.cpf,
              emitenteNome: r.emitente?.xNome,
              tomadorDoc: r.tomador?.cnpj ?? r.tomador?.cpf,
              tomadorNome: r.tomador?.xNome,
              cTribNac: r.cTribNac,
              vServ: r.vServ,
              vLiq: r.vLiq,
              vIssqn: r.vISSQN,
              xml: d.arquivoXml,
            })
            .onConflictDoUpdate({ target: [documentos.empresaId, documentos.chaveAcesso, documentos.tipo, documentos.tipoEvento], set: { nsu: d.nsu } });
        }
        importados++;
      }
      nsu = lote.ultimoNsu;
      await db.update(syncDfe).set({ ultimoNsu: nsu, ultimaExec: new Date(), ultimoErro: null }).where(eq(syncDfe.empresaId, empresaId));
    }
  } catch (e) {
    await db.update(syncDfe).set({ ultimaExec: new Date(), ultimoErro: (e as Error).message }).where(eq(syncDfe.empresaId, empresaId));
    throw e;
  }
  return { importados, ultimoNsu: nsu };
}
