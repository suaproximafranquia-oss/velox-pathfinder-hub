# Comando 2/3 — Desbloqueio da E0, calendário administrável, rigor de contadores e higiene de legado

Base: fotografia da Bateria 1/3. Nada de texto oficial é inventado; nenhum dado histórico é reescrito.

## 1. Desbloquear a E0 (prioridade máxima)

Hoje os sete perfis têm WhatsApp vazio no cadastro, então toda E0 em produção está bloqueada — e o telefone institucional herdado dos usuários semente esconde essa pendência na tela.

- Remover o telefone institucional único dos usuários semente. O perfil passa a mostrar "A cadastrar" quando não há número próprio, sem cair em número genérico.
- O aviso na tela "Meu Perfil" passa a considerar apenas o WhatsApp real do cadastro.
- Nova visão para a gestão: lista de executivos sem WhatsApp, com quantos leads de cada um estão com a E0 travada, alimentada pelos registros de bloqueio já auditados.
- Campo de WhatsApp editável pelo próprio executivo e pela gestão, com validação de número (mesma normalização já usada pelo motor).
- Nenhuma mudança na regra: sem número válido, a E0 continua 100% bloqueada, com motivo registrado.

## 2. Limite da janela E0 às 22:30

- 22:30 em ponto passa a enviar; o fechamento vale a partir de 22:31. Sábado e domingo inalterados.
- Testes de borda: 06:59, 07:00, 22:29, 22:30, 22:31, virada de meia-noite e domingo.

## 3. Calendário administrável

- Nova tabela de dias sem envio, com data única, motivo e autor, e leitura pelo motor junto do calendário oficial de feriados nacionais + SP.
- Tela de administração para incluir/remover datas, com efeito imediato no próximo cálculo (sem migração, sem deploy).
- Datas duplicadas são impedidas pelo próprio banco; a lista oficial calculada (nacionais + SP, incluindo Carnaval e Corpus Christi) continua existindo e não é editável.
- Testes: feriado prolongado, virada de ano e cálculo próximo da meia-noite.

## 4. Rigor de contadores e idempotência

- O contador de uso do conteúdo passa a ser incrementado somente após entrega efetiva: simulação não conta, bloqueio não conta, falha de canal não conta, retry conta uma única vez.
- O incremento passa a ser atômico no banco (função dedicada), eliminando corrida entre dois envios simultâneos.
- Checkpoint e finalização ganham travas de unicidade no banco, além dos identificadores determinísticos já existentes.

## 5. Higiene de legado e interface

- Remover o botão "reenviar boas-vindas" do quadro do Portal dos Leads e a mensagem de sucesso enganosa.
- Remover a função de boas-vindas legada, já sem chamadores, e a função de retry que só devolve recusa.
- A importação da biblioteca a partir do Word deixa de ser acionável em operação normal: fica restrita a uma rotina de manutenção explícita, mantendo a proteção às edições manuais.
- Quando um botão do template não puder ser montado por falta de destino, registrar no histórico qual botão foi omitido.

## Fora deste comando

- Textos oficiais de E20, E27, Finalização e Resposta Automática (aguardando envio).
- Conteúdo das sete etapas ativas sem vínculo (E12, V4, R3, RE0, RE3, RF0, RF1) — o diagnóstico continua exibindo a pendência.
- Os 36 registros históricos em "oportunidades" permanecem intocados.

## Detalhes técnicos

- `src/lib/executive-auth.ts`: remoção do `phone` institucional dos sete registros semente; exibição passa a usar apenas `executive_profiles.whatsapp`.
- `src/lib/crm/e0-window.ts`: fechamento passa a `> 22:30`; novos testes de borda com `Intl` em `America/Sao_Paulo`.
- Nova tabela `relationship_non_business_days` (data única, motivo, autor) com RLS de gestão e leitura server-side; `RELATIONSHIP_CONFIG.nonBusinessDays` passa a somar calendário calculado + tabela.
- `src/server/relationship/content-usage.server.ts`: incremento via função SQL atômica, chamado após confirmação de entrega em `dispatch.server.ts`, nunca em simulação.
- Índices únicos parciais em `relationship_e20_occurrences` para checkpoint e finalização.
- Remoção de `processWelcome`, `retryCrmWelcome` e do respectivo botão em `portal-leads-board.tsx`; `importWordLibrary` deixa de ser exposta em `library.functions.ts` para uso comum.
