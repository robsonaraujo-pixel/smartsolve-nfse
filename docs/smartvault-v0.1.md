# SmartVault v0.1 — Núcleo de autorização (não implantado)

## Entrega
O módulo puro `packages/core/src/vault/policy.ts` fornece uma decisão de autorização fail-closed antes do uso de certificado do escritório para outro prestador. O teste em `packages/core/test/smartvault-policy.test.ts` cobre o cenário YellowX/SmartSolve, procuração ausente, pendente, revogada, vencida, poder insuficiente, certificado incompatível/vencido e agente sem aprovação.

## Limites
Este código **não é** um cofre de produção: não importa PFX, não armazena segredo, não consulta a Receita/SEFIN e não assina. Os dados de procuração no teste são **fictícios** e NÃO comprovam que a procuração real da YellowX está validada. O módulo não está conectado ao serviço de transmissão.

## Próxima implementação obrigatória
1. Metadados do certificado e da procuração em banco com RLS por escritório e CNPJ; evidência e origem da validação, revogação e expiração.
2. PFX cifrado em armazenamento privado, chaves de envelopamento em KMS, controle de rotação e auditoria de acesso.
3. Serviço de assinatura isolado que nunca exporte PFX, senha ou chave privada para frontend ou agente.
4. Integrar o guard de autorização no backend antes de mTLS e de cada assinatura. Não usar o toggle global `usarCertificadoParaTodas` como bypass.
5. Confirmar representação real no Portal Nacional e no contrato API; autenticação mTLS e assinatura devem ser testadas separadamente.
6. CI, testes XSD, testes de integração em produção restrita e revisão de segurança antes de produção.

## Identidades
- Escritório: SmartSolve, CNPJ 22.489.717/0001-81.
- Prestador representado: YellowX, CNPJ 56.153.537/0001-46.
- Agente externo YellowDot: identidade técnica vinculada ao proprietário humano Robson Araújo; aprovação específica para ações sensíveis.

**Transmissão fiscal continua bloqueada.**
