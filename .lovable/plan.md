# Ação do Dia — Homologação × Real (diagnóstico somente leitura)

Nenhum arquivo, banco, permissão ou regra foi alterado.

## Fato central

Os dois ambientes usam **o mesmo componente de tela**: `src/components/crm/daily-actions-overlay.tsx`.
A única coisa que muda é o **adaptador** injetado. Logo, botões, gate do "Concluído",
janela operacional e textos de aviso são idênticos; o que muda é o que acontece por trás.

## 1. Fluxo Homologação

- Rota: `src/routes/f.executivo.homologacao.acao-do-dia.tsx` (legado `/f/executivo/acao-do-dia-demo` redireciona)
- Componente de entrada: `src/components/executive/homologation-daily-actions-demo.tsx` → `DailyActionsOverlay`
- Adaptador: `createDemoDailyActionsAdapter()` em `src/lib/crm/daily-actions.demo.ts`
- Fonte da fila: 36 registros fictícios em memória (`SEEDS`), gerados no navegador
- Fonte da mensagem: **texto fabricado no próprio adaptador** ("Mensagem fictícia de demonstração para …"); não toca a Biblioteca
- Copiar: mesmo `copyToClipboard` do real (clipboard verdadeiro)
- Concluído: `registerMessage` do demo → sempre `ok: true`, `requeue: true` → item volta ao fim da fila
- Persistência: **nenhuma**. Nada de servidor, banco, cadência, snapshot ou notas
- Ver ficha completa: `onOpenLead` é uma função vazia — não abre nada

## 2. Fluxo Real

- Rota/tela: `src/components/crm/portal-leads-board.tsx` (Portal dos Leads, `/f`), que abre o mesmo `DailyActionsOverlay`
- Adaptador: `useRealDailyActionsAdapter()` em `src/components/crm/daily-actions-real-adapter.ts`
- Fila: `listDailyActions` (`src/lib/crm/daily-actions.functions.ts`) → `src/server/crm/daily-actions.server.ts`
- Fonte da mensagem: `getDailyActionMessageFn` → `prepareStepMessage` (`src/server/relationship/step-message.server.ts`)
  → versão ATIVA de `relationship_message_library` + executivo responsável + link do Portal.
  Sem versão ativa, retorna `blockedReason` e **nenhum texto** (nada é improvisado)
- Copiar: `copyToClipboard` (`src/lib/clipboard.ts`), com alternativa `execCommand` quando a API do navegador falha
- Concluído: `registerDailyActionMessageFn` → `registerDailyActionMessage`
  (`src/server/crm/daily-actions-log.server.ts`) → conclui o item da fila, grava snapshot imutável
  da mensagem e, havendo texto, cria a nota do executivo. Item sai da fila (`dropAction`)
- Pular: `skipDailyActionFn`; Observação: `noteDailyActionFn` (ambos em `daily-actions-log.server.ts`)
- Ver ficha completa: abre `/f/executivo/dashboard?perfil=<leadId>&escopo=<scope>` em nova aba

## 3. Tabela de diferenças

| Item | Homologação | Real |
| --- | --- | --- |
| Tela/botões | mesmo overlay | mesmo overlay |
| Fila | fixture em memória | servidor autenticado |
| Texto do "Copiar" | frase fictícia do adaptador | Biblioteca ativa via `prepareStepMessage` |
| Texto pode faltar | nunca (sempre há corpo) | sim: `blockedReason` quando não há versão ativa ou executivo sem WhatsApp/slug |
| Confirmação da cópia | mesmo `copyToClipboard`, estado `copied` | idêntico |
| Gate do "Concluído" | `!message?.body || !copied` | idêntico |
| Efeito do "Concluído" | volta ao fim da fila, nada gravado | conclui etapa, snapshot, nota, sai da fila |
| Pular | mensagem simulada | grava em Notas do Executivo (executivo, etapa, data/hora, motivo) |
| Observação | não grava | grava |
| Ver ficha | não faz nada | abre a ficha exata do lead |
| Janela operacional | mesma trava (domingo fechado) | mesma trava |

## 4. O que a Homologação faz "melhor" (e por quê)

Não há comportamento superior de código: a sensação vem de a demo **nunca falhar**.
Ela sempre tem texto, sempre conclui e sempre reabastece a fila. No real, os mesmos
botões dependem de: existir versão ativa na Biblioteca para a etapa, o executivo
responsável ter slug/WhatsApp, e a janela operacional estar aberta.

Um ponto legítimo a levar para o real: **transparência do bloqueio**.
Hoje, com a janela fechada (domingo), o botão "Concluído" do painel de mensagem
continua com aparência habilitada e o clique simplesmente não faz nada — `handleRegisterMessage`
retorna sem mensagem quando `operationalWindow.open` é falso (overlay, linha ~399).
O mesmo silêncio ocorre em ligação e reunião. Isso explica a impressão de "o real não conclui".

## 5. O que é apenas mock e NÃO deve ser copiado

- Fila circular (`requeue`) — no real a ação concluída deve sair da fila
- Texto de mensagem gerado no cliente
- Resultados sempre `ok: true`
- `onOpenLead` vazio
- Telefones e nomes fictícios

## 6. Conclusão objetiva

Já correto no real:
- Ver ficha completa abre o lead exato
- Pular grava executivo, etapa, data, hora e motivo nas Notas
- Copiar usa a mensagem oficial da Biblioteca, com fallback de cópia manual
- "Concluído" só habilita após cópia confirmada
- "Concluído" conclui a etapa, grava snapshot e avança a fila

Precisa de correção (único ponto encontrado, sem presumir outros):
- Fora da janela operacional (hoje, domingo) o "Concluído" do painel de mensagem
  parece clicável e não devolve nenhuma explicação; deveria ficar visivelmente
  desabilitado ou informar "fora da janela operacional". Mesmo silêncio em ligação,
  reunião e reagendamento.

Arquivos envolvidos numa futura correção (apenas apresentação):
- `src/components/crm/daily-actions-overlay.tsx` (estado `locked` já existe; falta aplicá-lo
  ao botão do painel de mensagem e emitir feedback nos retornos antecipados)

Validação funcional de ponta a ponta do "Copiar → Concluído" com dados reais só pode
ocorrer dentro da janela (segunda a sábado), por causa da própria regra operacional.
