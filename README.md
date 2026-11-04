# SmartSolve NFS-e — Emissor padrão nacional

Emissor de NFS-e integrado à **Sefin Nacional** e ao **ADN**, com usuários por papel (equipe SmartSolve × cliente restrito a um CNPJ) e **banco de XML** das notas emitidas e recebidas.

Leiaute atual: **DPS v1.01 / NT 004 v2.0** (produção até 30/11/2026). Preparado para receber a **NT 009** (01/12/2026): o XML é montado em um único módulo (`packages/core/src/dps/buildDps.ts`) e o grupo IBS/CBS entra como extensão.

## Estrutura

```
packages/core   @smartsolve/nfse-core — motor fiscal (sem dependência de banco ou web)
  dps/          tipos, identificador da DPS (42 posições), montagem do XML, parser da NFS-e
  sign/         carga do PFX (A1), assinatura XML-DSig enveloped RSA-SHA256, verificação
  http/         mTLS com o PFX, gzip+base64
  sefin/        cliente da Sefin Nacional (POST /nfse, GET /nfse/{chave}, GET|HEAD /dps/{id}, eventos) + pedido de cancelamento e101101
  adn/          cliente do ADN (distribuição de DF-e por NSU, DANFSe, parâmetros municipais)
apps/api        Fastify + Drizzle (SQLite/libsql em dev; Postgres em produção)
  db/schema.ts  usuários, vínculos usuário×empresa, empresas, certificados cifrados, tomadores,
                catálogo de serviços, DPS, tentativas, documentos (banco de XML), sync DF-e, auditoria
  services/     emissão (reserva de número, assinatura, transmissão idempotente), cancelamento, sincronização DF-e
  routes/       /auth, /usuarios, /empresas, tomadores, serviços, /dps, /documentos
apps/web        Vite + React: login, emissão em tela única, notas, banco de XML, cadastros, admin
```

## Papéis e escopo

| Papel | Vê | Pode |
| --- | --- | --- |
| ADMIN | todas as empresas | tudo, inclusive criar usuários e vincular CNPJs |
| OPERADOR | todas as empresas | cadastrar empresas, certificados, serviços; emitir e cancelar |
| CLIENTE | só as empresas vinculadas (normalmente 1 CNPJ) | emitir; cancelar só se `podeCancelar` |

O escopo é aplicado no servidor (`exigirEmpresa`), não só na tela.

## Colocar na web (serviço único, sem instalar nada no PC)

O projeto já vem com `Dockerfile`, `render.yaml` e `railway.json`. Caminho mais curto:

1. Suba este repositório no GitHub (privado).
2. **Railway** (recomendado): New Project → Deploy from GitHub → escolha o repositório. Em *Variables* defina `JWT_SECRET`, `APP_ENCRYPTION_KEY` (duas strings longas e aleatórias), `ADMIN_EMAIL` e `ADMIN_SENHA`. Em *Volumes* monte um volume em `/data`. Clique em *Generate Domain*. Pronto: `https://seu-app.up.railway.app`.
   - **Render**: New + → Blueprint → aponte para o repositório; o `render.yaml` cria o serviço com disco em `/data`; só falta digitar `ADMIN_SENHA`.
3. Abra a URL, entre com `ADMIN_EMAIL`/`ADMIN_SENHA`, cadastre a empresa, envie o .pfx, crie os usuários dos clientes.

Na primeira subida o servidor aplica as migrações e cria o admin sozinho. Para domínio próprio (ex.: `nfse.smartsolve.com.br`), aponte um CNAME para o domínio gerado.

Banco: SQLite no volume `/data` atende dezenas de empresas e milhares de notas. Se preferir banco gerenciado, use Turso (`DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`) sem mudar código.

## Subir em desenvolvimento

Requisitos: Node 20+, `openssl` no PATH (usado para ler o PFX).

```bash
npm install
cp apps/api/.env.example apps/api/.env   # ajuste JWT_SECRET e APP_ENCRYPTION_KEY
npm run -w apps/api db:push               # cria o SQLite
npm run -w apps/api seed                  # admin@smartsolve.com.br / admin12345 e um cliente de exemplo
npm run -w apps/api dev                   # API em http://localhost:3001
npm run -w apps/web dev                   # Web em http://localhost:5173 (proxy /api -> 3001)
npm test                                  # testes do motor fiscal
```

Primeiro uso: entre como admin → **Empresas e usuários** → cadastre a empresa (CNPJ, IBGE, regime, alíquota do Simples) → envie o **.pfx** → cadastre os **serviços do catálogo** (CTN + NBS) → crie o **usuário do cliente** vinculado ao CNPJ.

## Fluxo de emissão

1. `POST /empresas/:id/dps` → reserva `nDPS`, monta o XML (`buildDps`), grava `RASCUNHO`.
2. `transmitirDps` → assina `infDPS`, gzip+base64, `POST /nfse` na Sefin com mTLS.
3. Autorizada → `documentos` (XML íntegro, origem `EMITIDA`) + `dps.status = AUTORIZADA`.
4. Rejeitada → `dps.erros` com a lista `{codigo, descricao, complemento}` da Sefin; `tentativas` guarda o retorno bruto.
5. Timeout → `ERRO_COMUNICACAO`; a retransmissão consulta `HEAD /dps/{id}` antes de reenviar (idempotência).

Cancelamento: `POST /empresas/:id/dps/:dpsId/cancelar` → evento **e101101** assinado sobre `infPedReg`.

Banco de XML: `POST /empresas/:id/documentos/sincronizar` percorre `GET /contribuintes/DFe/{nsu}` no ADN e grava notas recebidas (`RECEBIDA`), emitidas por fora (`SINCRONIZADA`) e eventos. Em produção, agende a cada 15–30 min por empresa.

## O que falta (próximas entregas)

- **Validação local contra os XSD oficiais** (v1.01 e NT 009): baixe o pacote em gov.br/nfse → Documentação técnica e coloque em `packages/core/schemas/`; depois `xmllint --schema` ou `libxmljs2`.
- **Grupo IBSCBS** tipado (hoje aceita o XML pronto em `ibscbsXml`) e os releases da NT 009 (vAjusteBC, CST/cClassTrib reposicionados, 99.02–99.04).
- **DANFSe local** em PDF (NT 008) com QR Code; a API do ADN está prevista no cliente, mas integradores relatam que foi sobrestada em ago/2026.
- Envio ao tomador por e-mail/WhatsApp; cron de sincronização DF-e; Postgres em produção (trocar `sqlite-core` por `pg-core` no schema e o driver em `db/index.ts`).
- Confirmar os nomes exatos dos campos de retorno do ADN (`LoteDFe`, `ArquivoXml`, `NSU`) no swagger de produção restrita — o cliente aceita as variações conhecidas e guarda o `raw`.
- Fiz os nomes das rotas de parâmetros municipais a partir do manual; confira no swagger `/parametrizacao/docs`.

## Ambientes

| | Produção restrita (testes) | Produção |
| --- | --- | --- |
| Sefin | https://sefin.producaorestrita.nfse.gov.br/SefinNacional/ | https://sefin.nfse.gov.br/SefinNacional/ |
| ADN | https://adn.producaorestrita.nfse.gov.br/ | https://adn.nfse.gov.br/ |

`tpAmb` é por empresa (`empresas.tpAmb`); o core usa a URL correspondente, evitando a rejeição E0006.
