# E0 Dinâmica — Meta, Botões e Executivo Responsável

Plano derivado da auditoria. Nada aqui altera identidade, GreenSales, Portal dos Leads, Remarketing, Ação do Dia ou a regra NOVO/EM ANDAMENTO/ENCERRADO. E20 permanece evento paralelo, nunca etapa de cadência.

## Decisões que precisam ser confirmadas antes de começar
1. O botão de apresentação da E0 usa uma E20 emitida no momento do envio (validade de 7 dias) ou o link estável do Portal do responsável?
2. O botão "Falar com o executivo" aponta para o responsável atual do lead ou para o responsável congelado no envio?
3. Sem WhatsApp cadastrado no responsável: a E0 é bloqueada ou sai sem esse botão?
4. O texto da resposta automática ganha entrada própria na Biblioteca ou continua reaproveitando R1?

## 1. Dados de origem
Preencher `executive_profiles.whatsapp` dos 7 perfis (hoje todos vazios) e cadastrar o template E0 aprovado da Meta — nome técnico, idioma, variáveis do corpo e a definição dos botões — numa fonte única. Hoje o único nome de template no código é o de validação de identidade, e as tabelas de templates estão vazias.

## 2. Payload da Meta com botões
Estender a camada de envio para aceitar componentes de botão com parâmetros dinâmicos por destinatário, mantendo o comportamento atual de ambiente antes de credencial: homologação e lead de teste continuam sem chamar a Meta.

## 3. Resolvedor de destinos por lead
Uma resolução no servidor, a partir do responsável do lead, que devolve o destino da apresentação e o destino do contato humano já validados. Sem número válido, resultado controlado com motivo legível — nunca número fixo.

## 4. E0 no caminho oficial
Migrar a E0 para a mesma trilha do motor: texto da Biblioteca, assinatura do responsável real e snapshot no envio. Desativar o caminho legado de boas-vindas para que exista um único disparo possível.

## 5. Histórico à prova de mudança de responsável
Registrar no snapshot os destinos usados nos botões, o nome do template Meta e o identificador do executivo responsável no momento do envio, para que uma redistribuição futura não reescreva o passado.

## 6. Resposta automática dentro da janela de 24h
Conteúdo que deixa claro que o canal serve apenas ao primeiro contato e oferece o caminho para o executivo responsável, com o destino resolvido dinamicamente. As travas atuais (uma por janela, duas no total, escalada para humano) permanecem.

## 7. Higiene de links de contato
Eliminar o número fixo como alternativa nas telas públicas e concentrar a geração de link no normalizador único já existente.

## Detalhes técnicos
- Envio: `src/server/whatsapp.server.ts` (payload), `src/server/crm/messaging.server.ts` (fachada).
- E0: `src/server/crm/first-contact.server.ts`, hoje usando `buildWelcomeMessage` de `src/server/crm/automation.server.ts`.
- Identidade: `resolveLeadExecutive` sobre `portal_leads.responsible_executive_id` → `executive_profiles`.
- Snapshot: `relationship_message_sends` (já possui `meta_template_name`, `content_url`, `library_version`, `simulated`).
- Telefone: `src/lib/whatsapp-number.ts` como única fonte de link.
- Riscos a controlar: mudança simultânea do texto da E0; impacto do novo payload sobre validação de identidade e Remarketing; 2 leads sem responsável; mudança de destino real ao preencher WhatsApp.
