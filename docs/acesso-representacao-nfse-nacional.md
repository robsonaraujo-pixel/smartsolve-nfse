# Acesso e representação — NFS-e Nacional

## Três formas de acesso ao Emissor Web

O Emissor Web Nacional apresenta três alternativas de autenticação interativa:
1. Usuário e senha do próprio ambiente NFS-e.
2. Certificado digital.
3. Login gov.br.

A terceira alternativa permite que uma pessoa autenticada atue em nome de pessoa física ou jurídica que represente legitimamente, após alternância de perfil, com base em procuração eletrônica cadastrada nos serviços da Receita Federal ou em vínculo cadastral admitido pelo sistema.

Essa é uma experiência de acesso ao Emissor Web. Não deve ser modelada como se o token de sessão gov.br fosse automaticamente uma credencial de API.

## Representação nas APIs

A comunicação automatizada com as APIs de Emissão e Distribuição possui contrato técnico próprio. A comunicação e a assinatura dos documentos fiscais são validadas com o certificado digital utilizado, considerando as autorizações de representação válidas.

Portanto, o SmartEmitte deve separar explicitamente:
- Acesso interativo ao Emissor Web: USUARIO_SENHA, CERTIFICADO_WEB ou GOVBR_REPRESENTANTE.
- Acesso automatizado às APIs: certificado próprio do prestador ou certificado do escritório/procurador com representação válida, conforme aceitação e regras da SEFIN/ADN.
- Identidade fiscal do emitente: sempre o CNPJ/CPF do prestador representado, nunca o CNPJ do escritório apenas por ser o titular do certificado de comunicação.
- Assinatura da DPS: deve ser validada segundo a regra oficial para o cenário de representação; não presumir que o certificado do escritório seja automaticamente aceito como assinatura fiscal do prestador.

## Cenário de homologação SmartEmitte

- Escritório representante: SmartSolve, CNPJ 22.489.717/0001-81.
- Prestador representado: YellowX, CNPJ 56.153.537/0001-46.
- Ambiente: produção restrita.
- Pré-requisito: procuração eletrônica vigente com os poderes específicos de NFS-e.
- Testes separados: (1) login gov.br no Emissor Web e alternância para o perfil YellowX; (2) API com certificado da SmartSolve e representação reconhecida; (3) assinatura da DPS e confirmação da SEFIN.
- Nenhuma emissão será transmitida até todos os testes de autenticação, representação e assinatura serem aprovados.

## Referência oficial

Notícia do Portal Nacional publicada em 31/10/2026: “Nova funcionalidade possibilita representação e alternância de perfis na NFS-e”. A notícia informa que, a partir de 01/11/2026, a representação no Emissor Web pode ocorrer por procuração eletrônica ou vínculo cadastral e que as APIs de Emissão e Distribuição também podem ser acessadas em nome de terceiros. A validação da representação ocorre por meio do certificado digital utilizado na comunicação com as APIs e das assinaturas eletrônicas dos documentos fiscais.

https://www.gov.br/nfse/pt-br/noticias/nova-funcionalidade-possibilita-representacao-e-alternancia-de-perfis-na-nfse