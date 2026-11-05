# SmartEmitte — Railway: preparação sem implantação

Status: código preparado em branch de homologação. Nenhum projeto Railway criado, nenhum serviço pago contratado e nenhuma transmissão fiscal autorizada.

## Configuração recomendada

- Serviço privado usando o Dockerfile existente na raiz e railway.json.
- Banco SQLite de desenvolvimento com volume persistente em /data. Não use SQLite efêmero em produção.
- Variáveis privadas: DATABASE_URL=file:/data/nfse.db, JWT_SECRET (aleatório forte), APP_ENCRYPTION_KEY (aleatória forte, gerida por cofre), ADMIN_EMAIL e ADMIN_SENHA (credenciais fortes), PORT=3000, LOG_LEVEL=info.
- Obrigatória: SMARTEMITTE_FISCAL_WRITES_ENABLED=false. Ausência da variável também bloqueia.
- Restrinja CORS_ORIGIN ao domínio exato da aplicação quando publicado.
- Healthcheck: /api/health. O healthcheck confirma apenas que o processo responde, não que a API nacional está homologada.
- Não publique a aplicação sem revisar autenticação, autorização por CNPJ, configuração de CORS, políticas de acesso, logs e armazenamento de certificados.

## Segurança operacional

1. Não colocar PFX, senha, certificado ou token em repositório, issue, chat, logs ou frontend.
2. Não habilitar SMARTEMITTE_FISCAL_WRITES_ENABLED enquanto assinatura, procuração, XSD, idempotência e aprovação humana não estiverem homologados.
3. O endpoint POST /empresas/:id/dps somente pode criar rascunho quando somenteRascunho=true; demais requisições são bloqueadas antes de reservar número.
4. Os métodos transmitirDps e cancelarNfse também possuem bloqueio central para impedir bypass da rota.
5. A implementação atual do SmartVault é apenas política pura. Não está conectada ao fluxo de transmissão; a opção global usarCertificadoParaTodas exige revisão e remoção antes de ativar emissão.
6. A função de consulta CNPJ SERPRO não está contratada e não é pré-requisito para validar a infraestrutura, mas cadastros devem indicar origem e evidência.

## Checklist para futura implantação (depende de aprovação específica)

- [ ] Revisar CI e corrigir falhas de testes/build.
- [ ] Revisar código e segredos; confirmar branch e commit.
- [ ] Confirmar custos do Railway e aprovação explícita.
- [ ] Criar projeto privado e volume persistente /data.
- [ ] Configurar variáveis privadas em cofre; não usar senha padrão de seed.
- [ ] Implantar com bloqueio fiscal ativo e verificar /api/health.
- [ ] Testar login, autorização por empresa e criação de rascunho.
- [ ] Confirmar que endpoints de transmissão/cancelamento respondem 403.
- [ ] Integrar SmartVault e validar procuração da YellowX antes de habilitar assinatura.

## Teste fiscal definido

YellowX 56.153.537/0001-46 → SmartSolve 22.489.717/0001-81, palestra, competência 04/11/2026, R$ 1,00, ambiente de produção restrita. Não transmitir sem autorização expressa posterior.