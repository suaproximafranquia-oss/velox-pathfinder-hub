# E0 Dinâmica — Meta, Botões e Executivo Responsável

Plano derivado das duas rodadas de auditoria. Não altera identidade, GreenSales, Portal dos Leads, Remarketing, Ação do Dia nem a regra NOVO/EM ANDAMENTO/ENCERRADO. E20 permanece evento paralelo.

## Decisões recomendadas (confirmar antes de começar)
1. Botão da apresentação: link estável do Portal do executivo responsável. A E20 não é emitida junto com a E0, porque cada emissão abre uma nova instância de cadência e expira em 7 dias.
2. Botão de contato: aponta para o responsável no momento do envio, congelado. Mensagem já entregue não muda de destino.
3. Sem WhatsApp válido no responsável: a E0 fica pendente com motivo legível. Nunca número fixo.
4. Resposta automática dentro da janela de 24h ganha entrada própria na Biblioteca, deixando de reaproveitar R1.

## 1. Dados de origem
Preencher o WhatsApp dos 7 perfis de executivo (hoje todos vazios) e cadastrar o template E0 aprovado da Meta — nome técnico, idioma, categoria, variáveis e botões — na tabela de templates oficiais, hoje vazia.

## 2. Construtor de componentes do template
Montar os componentes do template, incluindo parâmetros de botão por índice, num único ponto da camada de envio. A mudança é aditiva: validação de identidade e Remarketing continuam funcionando sem alteração de comportamento.

## 3. Resolvedor de destinos por lead
Uma resolução no servidor, a partir do executivo responsável, que devolve o destino da apresentação e o destino de contato já validados pelo normalizador único. Sem número válido, resultado controlado com motivo.

## 4. E0 no caminho oficial
Migrar a E0 para a mesma trilha do motor: texto da Biblioteca, assinatura do responsável real, envio como template oficial e registro de snapshot. Encerrar o caminho legado de boas-vindas e o texto fixo em código, mantendo a chave idempotente atual por lead.

## 5. Congelamento do histórico
Gravar no snapshot os destinos usados em cada botão, o nome do template Meta, o executivo responsável e o telefone utilizados no envio. Estrutura anulável, sem afetar registros existentes.

## 6. Resposta automática
Conteúdo próprio informando que o canal serve ao primeiro contato e oferecendo o caminho para o executivo responsável, com destino resolvido dinamicamente. As travas atuais (uma por janela, duas no total, escalada para humano) permanecem.

## 7. Apresentação Digital (E20) na ficha
Botão de emitir, reutilização da ocorrência vigente em vez de nova emissão, cópia do link e histórico com validade, primeira abertura e total de aberturas. Registrar também o user agent no resgate.

## 8. Higiene de contato
Eliminar o número fixo como alternativa nas telas públicas e concentrar a geração de link no normalizador único.

## Detalhes técnicos
- Envio: `src/server/whatsapp.server.ts`; fachada `src/server/crm/messaging.server.ts`.
- E0 hoje: `src/server/crm/first-contact.server.ts` + `buildWelcomeMessage` (`automation.server.ts`) sobre `CRM_FIRST_CONTACT` de `src/lib/crm/templates.ts`.
- Legado vivo a encerrar: `processWelcome` via `src/lib/crm/leads.functions.ts`.
- Identidade: `resolveLeadExecutive` sobre `portal_leads.responsible_executive_id` → `executive_profiles`.
- Snapshot: `relationship_message_sends` (já tem `meta_template_name`, `content_url`, `library_version`, `simulated`, `message_id` único).
- Telefone: `src/lib/whatsapp-number.ts` como única fonte de link.
- Riscos: troca simultânea do texto da E0; payload não aditivo afetando validação de identidade e Remarketing; 2 leads sem responsável; retry da Meta duplicando entrega externa.

## Critérios de aceite
Um único caminho de E0; nenhuma E0 sem snapshot; nenhum envio com número fixo; homologação e lead de teste sem chamada à Meta; destinos de botão auditáveis por mensagem; redistribuição não altera histórico.
