CREATE TABLE `auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`empresa_id` text,
	`acao` text NOT NULL,
	`detalhe` text,
	`em` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `certificados` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`pfx_cifrado` blob NOT NULL,
	`senha_cifrada` blob NOT NULL,
	`iv` blob NOT NULL,
	`subject` text NOT NULL,
	`valido_ate` integer NOT NULL,
	`criado_em` integer NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificados_empresa_id_unique` ON `certificados` (`empresa_id`);--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`tipo` text NOT NULL,
	`origem` text NOT NULL,
	`chave_acesso` text NOT NULL,
	`tipo_evento` text DEFAULT '' NOT NULL,
	`nsu` integer,
	`n_nfse` text,
	`d_compet` text,
	`dh_proc` integer,
	`emitente_doc` text,
	`emitente_nome` text,
	`tomador_doc` text,
	`tomador_nome` text,
	`c_trib_nac` text,
	`v_serv` real,
	`v_liq` real,
	`v_issqn` real,
	`cancelada` integer DEFAULT false NOT NULL,
	`xml` text NOT NULL,
	`pdf_path` text,
	`importado_em` integer NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documentos_chave_unica` ON `documentos` (`empresa_id`,`chave_acesso`,`tipo`,`tipo_evento`);--> statement-breakpoint
CREATE INDEX `documentos_empresa_compet` ON `documentos` (`empresa_id`,`d_compet`);--> statement-breakpoint
CREATE INDEX `documentos_empresa_tomador` ON `documentos` (`empresa_id`,`tomador_doc`);--> statement-breakpoint
CREATE TABLE `dps` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`serie` text NOT NULL,
	`n_dps` integer NOT NULL,
	`id_dps` text NOT NULL,
	`status` text DEFAULT 'RASCUNHO' NOT NULL,
	`d_compet` text NOT NULL,
	`entrada_json` text NOT NULL,
	`xml_assinado` text,
	`chave_acesso` text,
	`erros` text,
	`documento_id` text,
	`criado_por_id` text,
	`criado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dps_id_dps_unique` ON `dps` (`id_dps`);--> statement-breakpoint
CREATE UNIQUE INDEX `dps_chave_acesso_unique` ON `dps` (`chave_acesso`);--> statement-breakpoint
CREATE UNIQUE INDEX `dps_empresa_serie_num` ON `dps` (`empresa_id`,`serie`,`n_dps`);--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` text PRIMARY KEY NOT NULL,
	`cnpj` text NOT NULL,
	`razao_social` text NOT NULL,
	`nome_fantasia` text,
	`im` text,
	`c_mun` text NOT NULL,
	`email` text,
	`fone` text,
	`op_simp_nac` integer DEFAULT 3 NOT NULL,
	`reg_ap_trib_sn` integer DEFAULT 1,
	`reg_esp_trib` integer DEFAULT 0 NOT NULL,
	`aliquota_sn` real,
	`informar_ibs_cbs` integer DEFAULT false NOT NULL,
	`tp_amb` integer DEFAULT 2 NOT NULL,
	`serie_dps` text DEFAULT '1' NOT NULL,
	`proximo_n_dps` integer DEFAULT 1 NOT NULL,
	`ativa` integer DEFAULT true NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empresas_cnpj_unique` ON `empresas` (`cnpj`);--> statement-breakpoint
CREATE TABLE `servicos_catalogo` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`apelido` text NOT NULL,
	`c_trib_nac` text NOT NULL,
	`c_trib_mun` text,
	`c_nbs` text,
	`c_ind_op` text,
	`descricao_padrao` text NOT NULL,
	`cst_pis_cofins` text DEFAULT '00' NOT NULL,
	`tp_ret_pis_cofins` integer,
	`padrao` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_dfe` (
	`empresa_id` text PRIMARY KEY NOT NULL,
	`ultimo_nsu` integer DEFAULT 0 NOT NULL,
	`ultima_exec` integer,
	`ultimo_erro` text,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tentativas` (
	`id` text PRIMARY KEY NOT NULL,
	`dps_id` text NOT NULL,
	`http_status` integer,
	`resposta` text,
	`erro` text,
	`em` integer NOT NULL,
	FOREIGN KEY (`dps_id`) REFERENCES `dps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tomadores` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`cnpj` text,
	`cpf` text,
	`nif` text,
	`nome` text NOT NULL,
	`im` text,
	`email` text,
	`fone` text,
	`c_mun` text,
	`cep` text,
	`logradouro` text,
	`numero` text,
	`complemento` text,
	`bairro` text,
	`c_pais` text,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tomadores_empresa_cnpj` ON `tomadores` (`empresa_id`,`cnpj`);--> statement-breakpoint
CREATE INDEX `tomadores_empresa_cpf` ON `tomadores` (`empresa_id`,`cpf`);--> statement-breakpoint
CREATE TABLE `usuario_empresas` (
	`usuario_id` text NOT NULL,
	`empresa_id` text NOT NULL,
	`pode_emitir` integer DEFAULT true NOT NULL,
	`pode_cancelar` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`usuario_id`, `empresa_id`),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`papel` text DEFAULT 'CLIENTE' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);