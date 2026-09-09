# Diagnóstico consolidado — Financeira /f (somente leitura)

Nada foi alterado. Abaixo, para cada ponto: onde está, como se comporta hoje, causa provável, menor alteração e risco.

## 1. Central de Operações — Resolver pendência

Arquivos: `src/components/executive/central-operacoes/central-home.tsx`, `.../pending-resolver-modal.tsx`, `src/lib/crm/daily-actions.functions.ts` (`resolvePendingActionFn`), `src/server/crm/daily-actions-log.server.ts` (`listSkippedPendings`, `resumeSkippedAction`, `registerDailyActionMessage`, `recordSkipRecovery`), `src/server/crm/operations-center.server.ts`.

Comportamento atual:
- Abrir a pendência grava apenas um evento "retomada"; isso não resolve nada.
- A recuperação (`recordSkipRecovery`) e a contagem de "Mensagens copiadas" só acontecem quando `concludeQueueStep` devolve `concluded: true`, ou seja, quando o item da fila ainda estava executável.
- Os contadores vêm de `relationship_engine_log` (mensagem com resultado "copiada"/"enviada", pulo, recuperada). A lista de pendências abertas é o conjunto de pulos sem evento de recuperação.

Causa provável: a ação já não está mais executável na fila quando a pendência é reaberta (mensagem "Esta pendência não está mais disponível"). Como a conclusão não acontece, não há registro de recuperação nem de mensagem copiada — por isso o pulo continua aberto e os números não mudam. Há ainda dois agravantes: `recordSkipRecovery` procura o pulo original numa leitura genérica limitada a 4.000 linhas, sem filtrar pela própria ação, e `listSkippedPendings` também lê em bloco limitado — em volume, o pulo original pode simplesmente não ser encontrado. A Central só relê o relatório quando o card avisa que resolveu; se o servidor não confirmou, nada é relido.

Menor alteração: (a) filtrar a busca do pulo pela própria identificação da ação, em vez de varrer um bloco limitado; (b) quando a pendência já foi concluída/cancelada na fila, registrar a recuperação assim mesmo (a pendência deixa de estar aberta) e devolver esse estado à tela; (c) a Central só atualizar contadores e retirar a linha após a confirmação do servidor, relendo o relatório nesse momento — sem F5.

Risco: baixo; nada disso altera fila, motor ou histórico já gravado — apenas o registro de recuperação e a releitura da tela.

## 2. Central de Reuniões — GreenSales x reunião integrada

Arquivos: `src/routes/f.executivo.reunioes.tsx` (lista e botões), `src/server/crm/greensales-followup.server.ts` (espelho), `src/server/crm/daily-actions-log.server.ts` (`isGreenSalesMirror`).

Como o espelho GreenSales é gravado: identificação fixa `gsfu_<id do lead na origem>`, `origin: "greensales"`, `external_source: "greensales"`, `external_ref` derivado do mesmo identificador, `status` "Agendada" (e "Cancelada" quando sai da etapa), `topic` conforme a modalidade, sem endereço de reunião do Google e sem provedor de vídeo. AGENDAMENTOS e VÍDEO usam o mesmo registro; a modalidade vem da etapa de origem.

Comportamento atual: a lista mostra "Reenviar convite" para todos os registros, sem verificar a origem. Ao clicar num espelho GreenSales o sistema tenta tratá-lo como reunião integrada e chega a checar a conta Google. Já existe o campo que diferencia os dois tipos (`external_source`), inclusive usado no servidor em outros pontos — falta usá-lo na tela.

Menor alteração: exibir ações de Google (reenviar convite, copiar link) apenas quando o registro não for espelho GreenSales e realmente tiver endereço de reunião; para os espelhos, mostrar um selo de origem ("Compromisso GreenSales") e manter os cancelados visíveis no histórico com o motivo. É correção só de apresentação/ações.

Risco: nenhum sobre sincronismo, T-5, Ação do Dia ou histórico — nada disso é tocado.

## 3. Portal do Investidor — destino do card

Arquivos: `src/config/modules.ts` (item "Portal do Investidor" com `href: "/"`, `external: true`), renderizado em `src/routes/f.executivo.home.tsx`.

Hoje `"/"` é a landing do Grupo (três marcas) — daí o destino errado. Não existe URL externa fixa. `/f` já é o Portal do Investidor da Financeira, funcional (`src/routes/f.index.tsx` → `InvestorPortalHome`, marca financeira).

Menor alteração: trocar o destino do card para `/f` (via o auxiliar oficial `unitPath`). Como o card só existe na Home da Financeira, nenhum outro ambiente muda.

## 4. Portal do Investidor — modos Navegador e Editor

Estrutura: base única `src/components/portal/investor-portal-home.tsx` (usada por `/f` e `/s/portal`), com overlays (`estrutura-overlay`, `principios-overlay`, `magazine-overlay`).

Imagens — dois mundos:
1. Fixas (hero e capas dos cards): declaradas em `src/lib/assets/registry.ts` com chave estável (`portal-hero-sede`, `portal-capa-manual`, `portal-capa-material-institucional`, `portal-capa-sede`, `portal-capa-revista`, `portal-capa-experiencias`, `portal-capa-simulador`) apontando para arquivos no CDN. Manifesto estático, não editável em runtime.
2. Administráveis (Revista e blocos institucionais): já ficam no armazenamento do backend, com referência `storage://` e link assinado de 6 h (`src/server/magazine.server.ts`).

Ou seja: já existe identificação estável por imagem e já existe upload reutilizável (`uploadMagazineMedia` / função autenticada `uploadMagazineFile`). Administrador é identificado por permissão real (`user_roles`/`has_role`, `src/server/authorization.server.ts`). Não existe hoje nenhum modo de edição dentro do Portal — a edição vive em telas separadas do Workspace.

Menor caminho futuro: uma tabela pequena de substituições (chave da imagem → arquivo no armazenamento, restrita à Financeira), lida uma vez pelo Portal; sem substituição, tudo continua exatamente como está. O modo Editor é um sinalizador na própria rota `/f`, liberado só após conferência de permissão no servidor; as trocas ficam apenas na tela até o "Salvar". Nada de segundo Portal, segundo acervo ou toque no Manual do Investidor.

Risco: contido, desde que a leitura das substituições tenha fallback para a imagem atual.

## 5. Mensagem E0 — link duplicado

Arquivo: `src/server/relationship/step-message.server.ts`. O texto oficial é renderizado a partir da Biblioteca com a variável do link já substituída; logo em seguida, quando a mensagem tem "botão", o endereço é acrescentado de novo ao final do corpo (`corpo + quebra + endereço do botão`). Se o texto salvo já traz o link, ele aparece duas vezes.

Causa exata: acréscimo automático do endereço do botão sobre um texto que já contém o mesmo endereço. Não é duplicação na Biblioteca nem no envio.

Menor alteração: só acrescentar o endereço do botão quando ele ainda não estiver presente no corpo. O texto oficial salvo permanece intocado.

Risco: mínimo; afeta apenas a montagem exibida/copiada.

## 6. Cadência atual — confirmação

`src/lib/relationship/cadence-v2.ts`: sequência E0 → E1 → E2 → E3 → E4; o mapa de contexto V contém apenas E2→V2 e E3→V3; há regra explícita de que E1 é sempre normal. `src/lib/relationship/operational-steps.ts` não associa mais E1 a V1 (V1 continua listada só como contexto histórico da Biblioteca). `src/server/relationship/cadence-v2-state.server.ts` faz a avaliação (mesma função de sempre, em `visual-path.server.ts`) na chegada da E2, exigindo E1 concluída, e grava a decisão uma única vez. `resolveStepContextForLead` devolve contexto apenas para E2 e E3. Confirmado: V0 intacta, V1 fora da sequência operacional, referências antigas apenas para histórico.

## 7. Intervalos implementados hoje

- E0 → E1: 1 dia
- E1 → E2: 2 dias
- E2 → E3: 2 dias
- E3 → E4: 2 dias

(E0 tem regra própria interna: ligação 1 → 10 minutos → ligação 2 → mensagem, e usa a janela do executivo.)

## 8. Pré-gatilho — confirmação

`src/components/crm/daily-action-card.tsx` aciona o preparo apenas quando o resultado escolhido é "Não atendeu": aquece o caminho do servidor e inicia a leitura antecipada da mensagem oficial. `src/lib/crm/daily-actions-prefetch.ts` guarda só uma leitura, com validade curta e uso único; trocar a decisão, abandonar ou trocar de card descarta. `src/lib/crm/daily-actions.functions.ts` (`prewarmOutcomeFn`) apenas carrega módulos — não grava, não cria obrigação, não avança motor, não registra histórico. A confirmação continua sendo exclusivamente o "Concluído", e a fila oficial devolvida por ele é a autoridade; respostas atrasadas são descartadas por versão no overlay.

## Próximo passo

Diagnóstico apenas. A construção cirúrgica dos pontos 1, 2, 3, 4 e 5 só começa após sua autorização.
