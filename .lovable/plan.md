# Diagnóstico — GreenSales / Portal dos Leads / CRM / Ação do Dia (Financeira /f)

Investigação somente leitura. Nada foi alterado: nenhum card, nenhuma E0, nenhuma configuração, nenhum dado.

## Respostas objetivas

**1. Por que o Alexandre está no GreenSales e no Portal dos Leads, mas não no CRM/Workspace?**

Ele percorreu o fluxo inteiro corretamente. O identificador externo é **59125**:

- existe em `crm_leads` (entrada em 06/09 às 21:08, coluna "novos", não é teste);
- existe no Portal dos Leads como card `gs_59125`, responsável Thiago;
- o card foi criado em 07/09 às 00:14 (histórico registra "Card operacional criado").

O que o tirou da tela do CRM foi o **arquivamento em massa do Ponto Zero**: o card `gs_59125` está marcado como arquivado em 07/09 01:19:21, autor `ponto-zero-financeira`. Ou seja, ele entrou às 21:08, o Ponto Zero rodou depois e arquivou tudo que não estava na lista dos 12 IDs — o Alexandre foi varrido junto por ter chegado no intervalo. Não é falha de captura, é efeito colateral do arquivamento.

**2. O modo E0 MANUAL influenciou?**

Não. O modo manual só decide se o primeiro contato vira pendência ou envio; ele não bloqueia card nenhum. O card do Alexandre foi criado normalmente.

**3. Fluxo exato percorrido pelo Alexandre e onde parou**

Origem → `crm_leads` (lead criado) → identificação de lead novo → **card criado no Workspace** → **E0 adiada por janela operacional** (registro literal: "E0 adiada — fora da janela; Dom sem envio"). Parou exatamente aí, e depois o card foi arquivado pelo Ponto Zero.

**4. e 5. Quais dos 14 leads têm E0 e qual está sem**

Cards ativos hoje: 14 (59028, 59031, 59037, 59047, 59058, 59069, 59077, 59089, 59095, 59097, 59100, 59115, 59129 Thallia, 59137 Hamilton).
Pendências de E0 existentes: **13** — todas as acima **exceto 59137 (Hamilton Magalhães santos)**.

O Hamilton entrou em 06/09 às 23:37 (horário de Brasília), já fora da janela: o card nasceu, e a E0 foi **adiada**, sem gerar pendência imediata. Mesma coisa aconteceu com Thallia e com o Alexandre; a diferença é que a pendência da Thallia foi criada depois, manualmente, no comando anterior.

**6. Cal Gerson é obrigação antiga?**

Confirmado, e não é uma ligação: é um **compromisso de agenda** chamado "Call Gerson", de **28/08/2026**, do Thiago. Não pertence a nenhum dos leads novos e não tem card correspondente na carteira atual.

**7. Por que sobram 13 e não 14 depois de tirar o Cal Gerson?**

Porque falta exatamente a E0 do Hamilton (59137) — ver item 4/5. Não há E0 duplicada, não há E0 apontando para lead inexistente, e nenhuma pendência fora da carteira.

**8. Outras divergências GreenSales → Portal → CRM → Ação do Dia**

- 15 no GreenSales x 14 no CRM: a diferença é o Alexandre (59125), arquivado pelo Ponto Zero.
- Existem **13 ligações antigas (L2) pendentes** de leads antigos/arquivados (Josias, Anael, João Carlos, Sergio, Felipe, Leonardo etc.), ainda registradas. Hoje elas não aparecem na tela porque a Ação do Dia filtra cards arquivados, mas continuam abertas no banco — resíduo do mesmo Ponto Zero.
- O compromisso "Call Gerson" é o único item de agenda ativo e é antigo.

**9. Correção mínima necessária (a decidir, não executada)**

1. **Alexandre (59125)**: desarquivar apenas esse card, revertendo o efeito do Ponto Zero (ele chegou depois do corte). Nenhum dado novo, nenhuma exceção de regra.
2. **Causa raiz da E0 faltante**: a janela operacional está sendo usada como bloqueio da *criação da obrigação*, não só do envio. Hoje, quando o lead entra fora da janela, o card nasce mas a pendência manual só é criada mais tarde, quando a fila de retomada roda. A correção mínima é: **em modo MANUAL, criar a pendência E0 imediatamente na entrada, mesmo fora da janela** — a pendência não envia nada, ela só registra a obrigação para o próximo período operacional. Isso resolve Hamilton, Alexandre e qualquer entrada futura de fim de semana/madrugada, sem tocar na configuração MANUAL/AUTOMÁTICO e sem regra específica para ninguém.
3. **Cal Gerson**: encerrar/ocultar apenas esse compromisso de agenda antigo na operação atual, preservando o histórico.
4. **Ligações L2 antigas**: encerrar logicamente as 13 obrigações de ligação de leads arquivados, preservando histórico (mesmo tratamento já aplicado antes).

## Detalhes técnicos

- `src/server/crm/lead-intake.server.ts` (linhas ~298-302): quando `isE0NightWindow()` é verdadeiro, o fluxo faz `deferFirstContact()` e **retorna antes** de `createPendingE0Action()`. É esse retorno antecipado que produz "card sem E0".
- `src/server/crm/first-contact-queue.server.ts` cria a pendência manual na reabertura da janela, mas depende de a sincronização rodar e olha só os últimos 3 dias.
- `src/lib/crm/e0-window.ts`: domingo é bloqueado o dia inteiro — correto para envio, indevido como bloqueio da criação da obrigação.
- Cal Gerson = `workspace_agenda_events`, título "Call Gerson", 28/08/2026.
- Alexandre = `portal_leads.gs_59125`, `archived_by = 'ponto-zero-financeira'`.
