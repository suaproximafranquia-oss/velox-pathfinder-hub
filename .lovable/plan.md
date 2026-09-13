# Portal do Investidor e prioridade operacional do `/f`

## Escopo protegido

- Alterar somente o ambiente Financeira (`/f`).
- Não modificar `/s`, `/s/portal`, `/seg`, conteúdos, imagens, Editor do Portal, tags, etapas, reentrada, GreenSales ou a cadência E0–E8.
- Reutilizar o agregador, alerta, conclusão, ordenação, configuração e janela operacional existentes; não criar motor, fila ou tabela paralela.

## 1. Visibilidade dos seis módulos

- Ampliar a configuração administrativa persistida já existente com seis estados independentes, usando como chaves o registro oficial `PORTAL_MODULES`.
- Adotar os padrões solicitados: Manual, Material e Simulador ativos; Estrutura, Revista e Princípios inativos.
- Expor os seis controles em Configurações do `/f`, com leitura e gravação protegidas para Administrador.
- Carregar essa configuração na Home Financeira e filtrar somente os cards; módulos, rotas e conteúdos permanecem preservados.
- Garantir explicitamente que a base compartilhada do Portal Solar não aplique esse filtro.

## 2. Limpeza visual da homologação

- Remover apenas os atalhos “Biblioteca de Conteúdos” e “Ação do Dia — Demonstração” da página inicial da Central de Homologação.
- Manter a Biblioteca real no menu principal, a Ação do Dia real, a rota de demonstração e seus componentes sem exclusão.

## 3. Conclusão do alerta de atividade

- Manter `listPortalActivityAlerts`, a chave `portal_alert:${leadId}:${at}` e o registro de conclusão atual.
- Ao concluir, validar no servidor que a chave pertence ao lead e atualizar `portal_leads.viewed_at` exatamente até o instante do alerta concluído.
- Não usar abertura de ficha/ação como resolução e não chamar `markLeadViewed` nesse fluxo.
- Não avançar além do evento concluído: atividade posterior continua como NOVO e permanece elegível ao alerta correspondente.
- Atualizar o cache visual do Workspace após a confirmação do servidor para o NOVO desaparecer sem afetar outros leads.

## 4. Prioridade e convivência por lead

- Ajustar apenas a ordenação existente para: ação claimada; agendamento/emergência em foco; alerta do Portal; E0; atrasados; ações normais do dia; futuros/pendências conforme as regras atuais.
- Preservar a ação `PROCESSING` na posição 1.
- Criar no `collapseByLead` somente a exceção necessária para que um agendamento urgente do mesmo lead permaneça visível logo após a ação claimada, sem liberar duplicação geral.
- Manter domingo fechado por `resolveOperationalWindow`, sem alterar ou apagar pendências e sem antecipar ações futuras.

## 5. Validação direcionada

- Cobrir os padrões e a alternância individual dos seis módulos, incluindo isolamento do Solar.
- Cobrir alerta idempotente, abertura sem resolução, conclusão com avanço preciso de `viewed_at`, atividade posterior preservada e ausência de efeitos em E0/cadência/CRM.
- Cobrir a ordem completa, incluindo claim, agendamento do mesmo lead, alerta, E0, atrasados e ações normais.
- Cobrir domingo bloqueado com pendências preservadas.
- Verificar visualmente Configurações, Portal Financeira e Central de Homologação em desktop e mobile, além dos testes focados e do estado final da compilação.

## Detalhes técnicos

- A configuração será adicionada ao registro único `crm_automation_settings`, sem nova tabela, com funções públicas de leitura e gravação administrativa autenticada.
- O Portal continuará usando `MODULES` para apresentação e `PORTAL_MODULES` para as chaves oficiais; somente `/f` receberá a lista habilitada.
- A conclusão continuará registrada em `relationship_engine_log` e passará a atualizar `portal_leads.viewed_at` na mesma operação lógica, depois de validar a origem do alerta.