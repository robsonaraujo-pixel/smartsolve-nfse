# Acesso e representação — NFS-e Nacional

## Modelo operacional da SmartSolve

A SmartSolve é o escritório contábil e possui procurações de seus clientes. No SmartEmitte, a emissão em nome de cliente representado será realizada pela API nacional utilizando o certificado digital do escritório/procurador, desde que a procuração esteja vigente, contenha os poderes aplicáveis e a SEFIN/ADN reconheça a representação para comunicação e assinatura.

O login gov.br com alternância de perfil é uma modalidade de acesso interativo ao Emissor Web. Não é o fluxo que será usado para a emissão automatizada deste teste.

## Cenário específico de homologação

- Escritório/procurador: SmartSolve, CNPJ 22.489.717/0001-81.
- Certificado do procurador: e-CNPJ A1 SmartSolve, validade informada até 14/04/2027; certificado validado no teste oficial SERPRO.
- Prestador/emitente representado: YellowX, CNPJ 56.153.537/0001-46.
- Procuração: a SmartSolve informa que possui procuração do cliente para acesso via certificado digital por procuração. A validade, poderes e reconhecimento no ambiente nacional ainda deverão ser conferidos antes da transmissão.
- Ambiente: produção restrita.
- Operação de teste: palestra em São Paulo, competência 04/11/2026, tomador SmartSolve, valor R$ 1,00, ISS sem retenção, sem destaque IBS/CBS conforme regra informada para o Simples Nacional na competência.

## Fluxo técnico a comprovar

1. Carregar o certificado A1 do escritório em ambiente seguro.
2. Validar que o certificado identifica o CNPJ da SmartSolve.
3. Configurar o prestador YellowX com modo de acesso CERT_ESCRITORIO e referência da procuração vigente.
4. Usar o certificado do escritório na conexão mTLS da API, conforme contrato do ambiente nacional.
5. Montar a DPS com o CNPJ e a IM do prestador YellowX como emitente.
6. Assinar a DPS com o certificado do procurador, conforme a regra oficial de representação.
7. Transmitir somente após validação local, confirmação da procuração e aprovação expressa do responsável.
8. Consultar a DPS/NFS-e e reconciliar a resposta da SEFIN.

## Separação obrigatória de identidades

- Titular do certificado de comunicação/assinatura: SmartSolve, CNPJ 22.489.717/0001-81.
- Emitente fiscal declarado na DPS: YellowX, CNPJ 56.153.537/0001-46.
- Representação jurídica: procuração SmartSolve → YellowX.
- Usuário executor no SmartEmitte: pessoa autenticada que iniciou a operação.
- Agente YellowDot: identidade técnica separada, vinculada a Robson Araújo; não herda automaticamente poderes de transmissão.

## Controles de segurança

- Não armazenar ou registrar senha, chave privada ou conteúdo de token em logs.
- Registrar a referência, vigência, escopo e evidência da procuração, sem copiar credenciais.
- Bloquear emissão se procuração estiver ausente, vencida, revogada ou sem poder aplicável.
- Registrar solicitante, aprovador, certificado utilizado, prestador representado, ID DPS, hash do XML, resposta e chave de acesso.
- Em timeout, consultar a existência da DPS antes de qualquer retransmissão.

## Status

A SmartSolve informou que possui a procuração. O certificado A1 do escritório passou no validador oficial de certificado. Ainda não foi comprovado, por chamada de API, que a SEFIN aceita a representação e a assinatura da DPS da YellowX com esse certificado. A transmissão permanece bloqueada até esse teste de autenticação/assinatura ser concluído e a autorização de transmissão ser dada.

Referência do Portal Nacional sobre representação e alternância de perfis (publicada em 31/10/2026):
https://www.gov.br/nfse/pt-br/noticias/nova-funcionalidade-possibilita-representacao-e-alternancia-de-perfis-na-nfse