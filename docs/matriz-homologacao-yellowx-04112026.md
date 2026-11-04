# Matriz de homologação — YellowX → SmartSolve (04/11/2026)

## Fonte oficial vigente em produção restrita
Portal Nacional, página "Documentação Técnica (Homologação/testes)", atualizada em 20/10/2026:
https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita

Artefatos publicados nessa página:
- NT 009;
- ANEXO_I-SEFIN_ADN-DPS_NFSe-SNNFSe-PRODREST-v1.01-20261020;
- ANEXO_II-SEFIN_ADN-PEDREGEVT_EVT-SNNFSe-PRODREST-v1.01-20261020;
- ANEXO_B-NBS2-LISTA_SERVICO_NACIONAL-SNNFSe-PRODREST-v1.01-20260122;
- ANEXO_C-INDOP_IBSCBS-SNNFSe-PRODREST-v1.01-20260122;
- NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20261020.

A notícia oficial de 29/10/2026 esclarece que o leiaute NT009 v1.01/release 2 está em implantação gradual na produção restrita; a produção oficial ainda opera com NT004 + domínio NT007 até cronograma de implantação. Portanto, o teste deste projeto deve usar exatamente a documentação de produção restrita e não misturar XSD de produção.

## Classificação do serviço
O catálogo nacional embarcado no projeto contém:
- CTN 172401 — Apresentação de palestras, conferências, seminários e congêneres.
- NBS 122051400 — Serviços de palestras e conferências.

Os códigos acima são válidos no catálogo consultado. A correspondência jurídica/fiscal do fato efetivamente prestado continua sendo responsabilidade do prestador/contador.

## Cenário
- Prestador: YELLOWX PUBLICIDADE E TREINAMENTOS LTDA, CNPJ 56.153.537/0001-46, IM 1.444.889-0.
- Tomador: SMARTSOLVE AUDITORIA E CONSULTORIA CONTABIL LTDA., CNPJ 22.489.717/0001-81.
- Município: São Paulo, IBGE 3550308.
- Competência informada no cenário: 2026-11-04.
- Valor: R$ 1,00.
- ISS: sem retenção.
- IBS/CBS: não incluir grupo no rascunho deste teste conforme parâmetros informados para o cenário.

## Bloqueios que não podem ser removidos sem evidência
1. XSD oficial de produção restrita v1.01-20261020 efetivamente executado contra o XML.
2. Certificado A1 do escritório conferido por subject/documento, validade e cadeia; confirmar que o CNPJ é o da SmartSolve.
3. Procuração válida da SmartSolve para YellowX com poderes pertinentes e reconhecimento pela API/SEFIN.
4. Assinatura XMLDSig local verificada com a chave pública do certificado.
5. Chamada de emissão em produção restrita e resposta oficial inequívoca.

## Estado em 04/11/2026
- Core tests/build/typecheck: GitHub Actions concluído com sucesso no commit 31a9e2f2a6b726ae3dd73d5aa8a04ff3060b35ff.
- Railway: serviço online; branch de homologação implantada no commit 31a9e2f2a6b726ae3dd73d5aa8a04ff3060b35ff.
- A seed de YellowX/tomador/serviço/DPS foi implementada no bootstrap; não há evidência direta de leitura do banco confirmando o rascunho persistido.
- Há requisição POST bem-sucedida para /api/escritorio/certificado, mas isso não comprova titularidade, assinatura ou reconhecimento da procuração.
- SMARTEMITTE_FISCAL_WRITES_ENABLED permanece false; não transmitir nem remover a trava.
- Não existe ainda chave de acesso, protocolo de autorização ou XML de retorno da SEFIN para este teste.

## Observação técnica
A página oficial informa que o grupo IBS/CBS pode ser omitido sem rejeição técnica específica no ADN durante a transição, mesmo para contribuintes alcançados pela obrigação do Ato Conjunto, mas o preenchimento voluntário exige completude. Para este cenário, o grupo fica omitido; validar o enquadramento tributário específico antes de qualquer emissão fiscal com efeitos jurídicos.
