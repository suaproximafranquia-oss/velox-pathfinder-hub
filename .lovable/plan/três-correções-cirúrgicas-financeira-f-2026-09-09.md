# Três correções cirúrgicas — Financeira /f

## 1. Compromissos abertos sem atraso nem bloqueio

- Preservar a prioridade T-5 durante a janela de foco atual.
- Ao sair dessa janela, manter o compromisso em **Pendências abertas**, sem classificação ou contagem em **Atrasadas**.
- Liberar automaticamente a seleção da próxima ação operacional, sem exigir Pular, encerramento ou reagendamento.
- Permitir abrir o compromisso pendente e registrar seu desfecho, inclusive no dia seguinte, sem mudar a ordem das ações de cadência.
- A passagem do tempo não concluirá compromissos, não criará dívida e não produzirá novas ações. Preservar os desfechos explícitos e o fluxo GreenSales existente.
- Aplicar a mesma classificação no servidor e na atualização visual pelo relógio já existente. Não criar polling.

## 2. Reentrada baseada em nova submissão

- Primeira entrada de pessoa nova segue o primeiro contato E0 existente.
- Pessoa conhecida com nova submissão válida inicia **RE0**, usando o motor RE0–RE3 existente.
- Reconhecimento da pessoa, retorno ao Portal, contagem histórica, tags ou mudança de coluna, isoladamente, não iniciam RE0.
- Separar o reconhecimento de identidade do registro de uma nova submissão comercial. Repetir a mesma requisição ou receber novamente a mesma entrada não poderá abrir outro ciclo.
- No recebimento de dados GreenSales, usar a evidência de nova entrada comercial, sem condicionar RE à coluna NOVOS. Não alterar a sincronização, interpretação de tags, responsável ou follow_up.
- Encaminhar a reentrada uma única vez ao motor existente, sem executar também o ramo de E0 normal e preservando a configuração de execução do responsável.
- Sem backfill: registros antigos não serão reinterpretados nem ciclos reais reabertos nesta entrega.

## 3. PDF compartilhado da simulação

- Preservar os cálculos, a apresentação e o layout do PDF; persistir no servidor o arquivo efetivamente gerado e os dados da simulação, vinculados ao investidor.
- Reutilizar o armazenamento privado existente, com separação para relatórios da Financeira e identificador estável por simulação. Guardar PDF e metadados vinculados, sem nova tabela ou migração.
- Autorizar a gravação pela credencial assinada do investidor e validar seu vínculo e ambiente no servidor.
- Buscar o histórico pelo servidor no perfil executivo. Autorizar a leitura pelo acesso efetivo do executivo ao investidor e entregar o PDF por acesso temporário.
- Manter `simulator.completed`, sem duplicá-lo para registrar o arquivo. O evento continua com sua finalidade atual.
- Tratar falhas de gravação explicitamente e permitir nova tentativa idempotente; não afirmar que o relatório foi salvo quando existir somente no navegador.
- `localStorage` deixa de ser a fonte de verdade dos novos relatórios em `/f`. PDFs antigos que só existem em outro navegador não serão apresentados como recuperados.

## Pontos técnicos confirmados e alterações delimitadas

- **Compromissos:** `resolveBucket`, `actionRank`, `reclassifyDailyActions` e contadores em `src/lib/crm/daily-actions.ts`; montagem em `src/server/crm/daily-actions.server.ts`; seleção/apresentação em `daily-actions-overlay.tsx`. Ajustar a autorização de desfecho somente para o compromisso aberto acessível ao executivo, sem afrouxar os gates da cadência.
- **Reentrada:** `resolveEntryFlow` atualmente permite que `entryCount > 1` influencie a decisão sem nova entrada; o intake condiciona a entrada operacional à coluna e usa remarketing em `returning`. Corrigir esses pontos em `entry.ts` e `lead-intake.server.ts`, reutilizando a comparação de datas de `lead-service.server.ts`. No Portal, `resolvePortalIdentity` hoje chama o primeiro contato apenas quando o cadastro é criado; conectar a submissão válida ao mesmo caminho, sem alterar a resolução de identidade. Propagar RE ao ponto de abertura existente, sem mudar a sequência do motor.
- **PDF:** `simulator-modal.tsx` gera o PDF no navegador; `simulator-history.ts` guarda o arquivo localmente e `investor-profile-view.tsx` lê essa cópia. Acrescentar funções de gravação/listagem/abertura no servidor e conectá-las apenas ao fluxo `/f`. Reutilizar o bucket privado `revista` com prefixo exclusivo, sem alterar suas mídias, políticas ou configuração pública.
- Arquivos compartilhados receberão delimitação explícita de Financeira para manter os demais ambientes inalterados.

## Validação restrita

1. **Compromisso fictício:** prioridade durante T-5; saída automática do foco; outras ações liberadas; pendência disponível no dia seguinte; zero impacto no contador de atrasadas; abertura e desfecho autorizados. Conferir que o atraso normal da cadência permanece igual.
2. **Entradas fictícias:** novo → E0; conhecido + nova submissão → RE0; conhecido sem nova submissão → nenhum RE0. Repetição da mesma submissão não duplica ciclo; tags não decidem reentrada.
3. **Simulação fictícia:** concluir, persistir PDF e metadados, recuperar em outro contexto de navegador sem cache local e abrir o mesmo arquivo; conferir autorização, erro/repetição de gravação e preservação de `simulator.completed`. Inspecionar visualmente o PDF gerado.

Somente testes direcionados e conferência dos erros disponíveis. Nenhuma sincronização ou teste em lead real.

## Fora do escopo

Não alterar `/s`, `/s/portal`, `/seg`, Biblioteca, sequências E0–E8 e V0/V2/V3, R/RE/RF, histórico existente, filas, motor, integração GreenSales, regra dos 4 segundos, velocidade ou pré-gatilho/prefetch. Nenhuma nova tabela, fila, motor, migração, auditoria geral ou refatoração ampla. A única mudança de prioridade será retirar o compromisso vencido da disputa automática após sua janela de foco.