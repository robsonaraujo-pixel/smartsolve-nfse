CREATE TABLE `escritorio` (
	`id` text PRIMARY KEY DEFAULT 'escritorio' NOT NULL,
	`cnpj` text,
	`razao_social` text,
	`nome_fantasia` text,
	`email` text,
	`fone` text,
	`usar_certificado_para_todas` integer DEFAULT false NOT NULL,
	`atualizado_em` integer NOT NULL
);
