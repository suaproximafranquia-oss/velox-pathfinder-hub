# Auditoria técnica — Cadência, Ação do Dia e Central de Nomes

Diagnóstico somente leitura. Nada foi alterado: nenhum arquivo, banco, migration, job ou dado.

## 1. Segurança / Meta / envio real — **SEGURO PARA PLANEJAMENTO**

Existem 6 pontos que chamam a Graph API: `whatsapp.server.ts` (linhas 75, 183, 265, 283, 475) e `remarketing/engine.server.ts:266`. **Todos os 6** chamam `blockRealWhatsappSend()` imediatamente antes do `fetch` (75→65-71, 183→175-180, 265/283→249-254, 475→445-452, 266→257-263). Nenhum caminho alcança a rede sem passar pela trava.

- **A) Caminho que envie hoje:** nenhum. [EXISTENTE]
- **B) Preparado mas bloqueado:** todos os 6 acima, mais o webhook `api/public/whatsapp/webhook.ts` (só recebe; a resposta automática cai no mesmo `sendTextMessage` guardado).
- **C) Safety Lock:** bloqueia por duas condições cumulativas — data < 01/01/2029 **e** `WHATSAPP_REAL_SEND_ENABLED=true`. A data sozinha não libera nada.
- **D) Jobs/cron:** dois pg_cron ativos — `remarketing-engine` (a cada minuto → `/api/public/remarketing/run` → `sendTemplate`) e `crm-lead-sync` (5 em 5 min → `runRelationshipTick` → dispatcher → `sendWhatsappText`). Ambos convergem para os pontos já travados. Nenhum contorna.
- **E)** Antes da trava ainda existe a decisão de ambiente (`execution-mode` / `channelMode`) e a ausência total das credenciais: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_REAL_SEND_ENABLED` **não existem** no ambiente. São três camadas independentes de bloqueio.

Ressalva honesta: só é auditável o que está no código. Edge functions criadas fora do repositório não seriam visíveis aqui (não há diretório `supabase/functions`).

## 2. Motor de Relacionamento atual

- **Fonte única executável** [EXISTENTE]: `src/lib/relationship/config.ts` — `STEPS` (18 etapas) + `FLOW_SEQUENCE` (5 fluxos). Intervalos sempre em **dias úteis** (`businessDaysAfterReference`); não existe unidade "dias corridos".
- Fluxos: `sem_resposta` E0→E1→E3→E4→E12→E30; `visualizacao` E0→E1→V3→V4; `reengajamento` R1→R2→R3; `reentrada` RE0→RE3; `relacionamento_frio` RF0→RF1 (0 cadências neste fluxo hoje).
- Núcleo: `machine.ts` (estado puro), `decide.ts` (próxima ação), `engine.ts` (executa e agenda), `clock.ts` (relógio real x virtual 12x).
- **A fila NÃO materializa o futuro** [EXISTENTE e importante]: `relationship_queue` tem índice único `(scope, run_id, lead_id, step)` e guarda **apenas o próximo passo**, reescrito a cada tick por `scheduleFollowUp` (`engine.ts:388`). Hoje: 26 linhas (15 EXECUTED, 11 PENDING) e 75 cadências ativas, todas `sem_resposta`.
- Fora da máquina: E20 é **manual** (`e20.server.ts:130`), E27 e FINALIZACAO derivam de datas gravadas na emissão da E20 e são executadas por `closure.server.ts` dentro do mesmo tick. E30 existe mas está desligada por flag (`E30_ENABLED=false`).
- **Configurável em banco hoje:** texto (`relationship_message_library`, versionado), mídia (`relationship_step_content_bindings`), template Meta, rótulo, feriados.
- **Hardcoded hoje (exige deploy):** o tipo `CadenceStep`, `STEPS`, `FLOW_SEQUENCE`, `NON_CADENCE_STEPS`, referências temporais por fluxo, `CANCELLING_EVENTS`, flags como E30. **Criar uma etapa nova hoje exige mexer em 3 a 5 arquivos TypeScript.** [CONFLITO com a Central de Cadência]

## 3. Central de Cadência — arquitetura recomendada [NOVA ARQUITETURA]

A boa notícia é estrutural: como a fila só guarda o próximo passo e recalcula a cada tick, **mudar a configuração já afeta naturalmente só o futuro**. Não é preciso reescrever histórico.

Recomendação em quatro camadas:

1. **Definição em banco** (novo): tabelas `cadence_flows`, `cadence_steps` (código, nome, fluxo, intervalo, unidade dias úteis/corridos, grupo de conteúdo, terminal, ativo, ordem) e `cadence_transitions` (ramificações condicionais). Substitui `STEPS`/`FLOW_SEQUENCE` como dado, **não** substitui o motor.
2. **Versionamento imutável** (novo): cada publicação gera uma versão; cada cadência aberta carrega `cadence_version_id`. Leads em andamento continuam na versão em que entraram até o próximo recálculo — histórico intacto por construção.
3. **Motor genérico** (adaptação pequena): trocar o union type `CadenceStep` por `string` validado contra o registro em banco, e ler `STEPS`/`FLOW_SEQUENCE` de um carregador com cache. `machine.ts`/`decide.ts` continuam idênticos.
4. **Regra do dia atual imutável** (nova): o recálculo só toca itens com `due_at > fim do dia corrente`; nada com vencimento hoje ou atrasado é apagado ou reescrito. Etapa já executada nunca é reprocessada (`executed_steps` já registra isso).
5. **Exclusão destrutiva proibida** (nova): etapa com uso registrado só pode ser arquivada (`active=false`), nunca removida — mesmo padrão já usado na Biblioteca.

Etapas fora da máquina (E20/E27/FINALIZACAO) devem ser declaradas como **tipo de etapa** ("manual", "derivada", "automática") em vez de listas de exceção em código.

## 4. Ação do Dia — estado atual [PARCIAL]

`daily-actions.server.ts` é um **agregador de leitura pura** — não cria, não avança e não reagenda cadência. Fontes e precedência exata: `first_contact` > `meeting` > `agenda` > `closure` > `queue` > `cadence`. Tipos: `primeiro_contato | reuniao | compromisso | mensagem | ligacao`.

Já funciona: dedupe por chave determinística; colapso "um lead = um card" com pendências menores viradas em `secondary[]`; buckets `agora/atrasada/hoje` (atraso nunca vira hoje); janela de busca de 45 dias atrás a 2 à frente; execução de E0 manual gravando em `workspace_e0_actions`; ligações com pergunta "atendeu? Sim/Não" gravando em `crm_cadence_tasks` + evento em `crm_lead_events`; registro de tentativa via WhatsApp; histórico de tentativas visível.

## 5. Ação do Dia — o que falta

- Botão **Pular com justificativa obrigatória** — [AUSENTE]. Hoje não existe "pular": o item simplesmente some ao fechar o overlay, sem persistir motivo.
- Campo de **observação** em qualquer ação — [AUSENTE].
- **Reagendar** (reunião ou qualquer item) — [AUSENTE].
- **Registro de resultado de reunião** e ramificação de fluxo depois — [AUSENTE]; reuniões só têm "abrir conversa" e "ver ficha".
- **Visualizar o conteúdo completo da mensagem** — [AUSENTE]; o card mostra só título e etapa.
- **Registro de resultado do envio de mensagem** pela tela — [AUSENTE].
- Janela da reunião é de **15 minutos**, não 5 — [CONFLITO com o requisito].
- **Limite artificial de 4 tentativas** de ligação, com encerramento antecipado se L2 e L3 forem "não" (`src/lib/crm/cadence.ts:198-229`) — [CONFLITO direto com "não queremos regra artificial que elimine chamadas"].
- Pergunta secundária "se não atendeu, você chamou?" — [PARCIAL]: existe o registro de tentativa por WhatsApp, mas não como pergunta encadeada.
- Bucket `futura` existe no tipo mas **não é renderizado** — [PARCIAL].
- Prioridade de novos leads: [EXISTENTE] via precedência de `first_contact`.
- "Não criar um segundo motor": [EXISTENTE] — a arquitetura atual já respeita isso e deve ser preservada.

## 6. Central de Nomes — estado atual [PARCIAL]

Não existe rota, tabela nem componente com esse nome. Existe, porém, uma biblioteca canônica real: `src/lib/relationship/names.ts` (`normalizeName`, `firstName`, `displayName`, `resolveTreatment`, `isPlausibleName`). Ela é usada **corretamente e apenas** pelo Motor/Biblioteca de Mensagens.

Fora dali, o primeiro nome é recalculado com `nome.split(" ")[0]` em pelo menos **10 arquivos** (executive-shell, kpi, home, celebração, gateway-overlay, portal-final-cta, contact-form, whatsapp-floating, manual/$chapter, executive-match), e as iniciais em mais 3 componentes. Três fallbacks distintos convivem para o mesmo conceito: `"caro investidor"` (motor), `"Investidor"` (~10 pontos hardcoded, inclusive na Ação do Dia) e `"Sem nome"` (GreenSales). No banco existe apenas `portal_leads.name` / `crm_leads.name` — sem colunas derivadas; correções manuais vivem dentro de `manual_overrides` (jsonb).

## 7. Central de Nomes — arquitetura recomendada [NOVA ARQUITETURA]

Promover `names.ts` a serviço único, sem reescrevê-lo:
1. Um resolvedor único `resolveInvestorNames(lead)` devolvendo `{ display, first, treatment, confidence, source }`.
2. Colunas explícitas em `portal_leads` (`display_name`, `confirmed_first_name`, `name_status`) substituindo a leitura implícita de `manual_overrides`.
3. Um único `NEUTRAL_TREATMENT` e um único `NO_NAME_LABEL` — proibidos literais soltos.
4. Normalização **na entrada** (Portal, GreenSales, importação), não em cada tela.
5. Uma tela administrativa de curadoria (confirmar, corrigir, marcar como inválido) — é isso que a "Central de Nomes" deve ser como produto.
6. Regra dura: nenhuma camada de exibição pode chamar `split(" ")`.

## 8. Integração Nomes → Biblioteca → Motor → Ação do Dia → Workspace → GreenSales → Portal → Ficha

Hoje o eixo **Nomes → Biblioteca → Motor** está íntegro. Os demais são desvios: Ação do Dia, Workspace e Ficha leem o nome cru (a ficha pode exibir "JOÃO SILVA" onde a mensagem diria "João Silva"); GreenSales normaliza por conta própria; o Portal grava o nome do formulário sem normalizar (a função SQL de identidade repassa o texto cru). Duplicidade principal: 10 implementações de primeiro nome e 3 fallbacks concorrentes.

## 9. Conflitos de steps / taxonomia [CONFLITO]

1. **Executáveis pelo motor hoje (18):** E0, E0_V1, E1, E3, E4, E12, E30 (desligada), V3, V4, R1, R2, R3, RE0-RE3, RF0, RF1. Mais 4 fora da máquina: E20, E27, FINALIZACAO, RESPOSTA_AUTOMATICA.
2. **Alias/editorial/histórico:** `current-steps.ts` (fotografia declaradamente não executável), `step-labels.ts` (só rótulo), o Word histórico.
3. **Aparece na fotografia mas o motor não reconhece:** E2, E5, E6, E7, E8, R4. Nos dados reais da fila só aparecem E1, E3, E4 — nenhum código órfão em produção.
4. **Motor reconhece mas não está na documentação histórica:** E0_V1, E12, E20, E27, E30, V3, V4, FINALIZACAO, RESPOSTA_AUTOMATICA.
5. **A resolver antes da Central:** decidir se E2/E5/E6/E7/E8/R4 são etapas novas, renomeações de existentes ou lixo editorial. Essa é decisão de negócio — não deve ser adivinhada pelo sistema.

## 10. O que já existe

Motor de estados; cadência por dias úteis; fila recalculada; Biblioteca versionada com mídia; E20/E27/FINALIZACAO; agregador da Ação do Dia com precedência, dedupe e colapso; E0 manual com auditoria; ligações com resultado; Safety Lock triplo; `names.ts` no eixo do motor; Central de Homologação.

## 11. O que está parcial

Ação do Dia (leitura ótima, execução mínima); nomes (canônico só no motor); rótulos de etapa (banco sobrescreve código, mas o elenco é código); bucket `futura`; pergunta "chamou?".

## 12. O que não existe

Central de Cadência (definição em banco, árvore, ramificações, criação de etapa sem deploy, versionamento com recálculo); Central de Nomes como produto; pular com justificativa; observações; reagendar; resultado de reunião com ramificação; visualização do texto completo na Ação do Dia.

## 13. O que não deve ser alterado

Safety Lock e os 6 pontos guardados; a regra "ambiente decide antes das credenciais"; a natureza de leitura pura da Ação do Dia; imutabilidade do histórico da Biblioteca; blindagem do Portal dos Leads e da integração GreenSales; a chave única de uma cadência ativa por lead; os dados reais de produção.

## 14. Ordem recomendada de implementação

1. **Central de Nomes** — menor risco, desbloqueia consistência em todas as telas.
2. **Conciliação de taxonomia** — decisão de negócio sobre E2/E5/E6/E7/E8/R4, sem código.
3. **Central de Cadência, fase leitura** — árvore e visualização dos fluxos a partir da configuração atual, sem escrita.
4. **Central de Cadência, fase escrita** — definição em banco, versionamento, motor genérico, regra do dia imutável.
5. **Evolução da Ação do Dia** — pular com justificativa, observações, reagendar, resultado de reunião, texto completo.
6. **Revisão da regra de ligações** — remover o limite artificial de 4 tentativas conforme a configuração da Central.

Nenhuma dessas etapas exige tocar no Safety Lock nem em dados de produção.
