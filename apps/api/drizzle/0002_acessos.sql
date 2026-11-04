ALTER TABLE `empresas` ADD `modo_acesso` text DEFAULT 'CERT_PROPRIO' NOT NULL;--> statement-breakpoint
ALTER TABLE `empresas` ADD `portal_login` text;--> statement-breakpoint
ALTER TABLE `empresas` ADD `portal_senha_cifrada` blob;--> statement-breakpoint
ALTER TABLE `empresas` ADD `procuracao_valida_ate` integer;--> statement-breakpoint
CREATE TABLE `certificado_escritorio` (
	`id` text PRIMARY KEY DEFAULT 'escritorio' NOT NULL,
	`pfx_cifrado` blob NOT NULL,
	`senha_cifrada` blob NOT NULL,
	`iv` blob NOT NULL,
	`subject` text NOT NULL,
	`cnpj` text,
	`valido_ate` integer NOT NULL,
	`criado_em` integer NOT NULL
);
