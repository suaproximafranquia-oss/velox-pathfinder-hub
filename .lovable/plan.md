# Auditoria — Mapa real das etapas do motor × Ação do Dia

Somente leitura. Nada foi alterado.

## A) Inventário das etapas

Fonte única executável: `STEPS` + `FLOW_SEQUENCE` em `src/lib/relationship/config.ts`, tipo `CadenceStep` em `types.ts`, registro de aceitação em `step-registry.ts`, rótulos em `step-labels.ts`.

| Código | Rótulo | Onde definido | No motor? | Texto oficial? | Executa envio? | Chega à Ação do Dia? |
|---|---|---|---|---|---|---|
| E0 | Primeiro contato | STEPS, sequência sem_resposta | sim | sim (v4 ativa) | sim | sim — `kind: primeiro_contato`, executável |
| E0_V1 | Primeiro contato (Portal) | STEPS (legado na Biblioteca) | sim | sim (v3 ativa) | sim | via mesma ação de E0 |
| E1 | Primeiro acompanhamento | STEPS | sim | sim | sim | sim — `kind: mensagem` (informativa) |
| E3 | Segundo acompanhamento | STEPS (recebe texto do "E2" do Word) | sim | sim | sim | sim — `mensagem` |
| E4 | Acompanhamento firme | STEPS (texto do "E3" do Word) | sim | sim | sim | sim — `mensagem` |
| E12 | Encerramento sem resposta | STEPS (texto do "E5" do Word) | sim | sim | sim | sim — `mensagem` |
| E30 | Recontato tardio | STEPS + `reactivation.ts` | sim, porém `E30_ENABLED = false` | não existe linha na Biblioteca | não | não |
| V3 / V4 | Fluxo de visualização | STEPS, fluxo `visualizacao` | sim (legado) | sim (ativas) | sim | sim se entrarem na fila |
| R1 / R2 / R3 | Reengajamento | STEPS, fluxo `reengajamento` | sim | sim | sim | sim se entrarem na fila |
| RE0–RE3 | Reentrada | STEPS, fluxo `reentrada` | sim | sim | sim | sim se entrarem na fila |
| RF0 / RF1 | Relacionamento esfriado | STEPS, fluxo `relacionamento_frio` | sim | sim | sim | sim se entrarem na fila |
| E20 (exibido "E6") | Apresentação Digital | `step-registry` NON_CADENCE + `e20.server.ts` | sim, fora da cadência | sim | sim, por emissão de convite | não como item próprio |
| E27 (exibido "E7") | Checkpoint da Apresentação | NON_CADENCE + `closure.server.ts` | sim | v3 ativa com texto | sim | sim — `kind: mensagem`, fonte `closure` |
| FINALIZACAO | Finalização do ciclo | NON_CADENCE + `closure.server.ts` | sim | sim | sim | sim — `mensagem`, fonte `closure` |
| RESPOSTA_AUTOMATICA | Resposta em janela 24h | NON_CADENCE + `auto-reply.server.ts` | sim | v2 ativa | sim | não |
| E2, E5, E6, E7 | rótulos editoriais do Word | `word-library.ts` + `WORD_ALIAS_STEPS` | **não são etapas do motor** | linhas ativas na Biblioteca (resíduo) | não | não |
| E8 | — | não encontrado em código nem no banco | **não comprovado** | não | não | não |
| E5–E8 como cadência | — | não existe fluxo com essas chaves | não comprovado | — | — | — |

Observação relevante: `WORD_STEP_TO_ENGINE_STEP` traduz E2→E3, E3→E4, E5→E12, E6→E20, E7→FINALIZACAO. As linhas E2/E5/E6/E7 na Biblioteca deveriam estar desativadas (`WORD_ALIAS_STEPS`), mas hoje estão `active = true` — é o que faz a tela mostrar siglas que o motor não executa.

## B) Fluxos reais (não é linear)

```text
sem_resposta:        E0 → E1 → E3 → E4 → E12 → (E30 desligada)
visualizacao:        E0 → E1 → V3 → V4
reengajamento:       R1 → R2 → R3
reentrada:           RE0 → RE1 → RE2 → RE3
relacionamento_frio: RF0 → RF1
paralelo (fora da cadência): E20 → E27 → FINALIZACAO
```

Condições: dias úteis por etapa (`businessDaysAfterReference`), janela 09–21h (E0 tem janela própria), etapa terminal encerra o fluxo, OPORTUNIDADE no fechamento das 22h bloqueia cadência, resposta do investidor na reentrada passa a condução ao Executivo.

## C) Motor

`decide.ts` (decisão) + `machine.ts` (estado) + `engine.ts` (orquestração) + `calendar.ts`/`closing.ts` (tempo) + `scheduler.server.ts` (tick de produção) → grava em `relationship_queue` / `relationship_cadences`. É uma máquina de estados real e centralizada, não regras espalhadas.

## D) Mensagens

Tabela `relationship_message_library` (versionada, `active`), texto oficial em `word-library.ts`, renderização em `messages.ts`, envio em `step-message.server.ts` / `dispatch.server.ts`, com Safety Lock global. E30 não tem linha; E20/E27/FINALIZACAO têm texto e hoje estão ativas.

## E/F) Matriz Ação do Dia

Fonte: `daily-actions.server.ts`.

| Etapa | Motor | Chega à Ação do Dia | Kind | Executável ali | Fonte |
|---|---|---|---|---|---|
| E0 | sim | sim | primeiro_contato | **sim** | `workspace_e0_actions` |
| E1/E3/E4/E12 | sim | sim | mensagem | não (informativa) | `relationship_queue` |
| V3/V4/R1–R3/RE0–RE3/RF0–RF1 | sim | sim quando enfileiradas | mensagem | não | `relationship_queue` |
| E27 / FINALIZACAO | sim | sim | mensagem | não | `relationship_e20_occurrences` |
| Ligações L1–L4 | motor legado | sim | ligacao | **sim** (SIM/NÃO + WhatsApp) | `crm_cadence_tasks` |
| Reuniões | — | sim | reuniao | não | `portal_meetings` |
| Compromissos | — | sim | compromisso | não | `workspace_agenda_events` |
| E20, RESPOSTA_AUTOMATICA, E30 | sim/desligada | não | — | — | — |

Só existem dois executores no painel: E0 e ligação. Todo o resto é apresentação.

## G) Comparação com o fixture atual (`daily-actions.demo.ts`)

Correto: E0, E1, E3, E4, R1, V3, checkpoint E7/E27, Finalização, ligações com tentativas, reuniões e compromissos; os cinco `kind` e os quatro buckets.

Incorreto/inventado:
- **E2** (2 itens): não é etapa executável do motor — é rótulo do Word que corresponde a E3.
- Rótulo "E7 — Checkpoint" está certo na apresentação, mas o fixture não expõe a chave técnica E27 como o real faz (`stepDisplayLabel`).
- `scope: "demonstracao"` não existe entre as carteiras reais.

Faltando: E12, E30 (como caso "não envia"), fluxo de reentrada RE0–RE3, relacionamento esfriado RF0/RF1, R2/R3, V4, E0_V1 (Portal) e itens sem responsável/atrasados de mais de um fluxo simultâneo no mesmo lead (o colapso `secondary`).

## H) Proposta da demonstração fiel (não implementada)

1. Derivar os rótulos do fixture de `DEFAULT_STEP_LABELS`/`stepDisplayLabel`, em vez de strings escritas à mão — nenhuma sigla inventada.
2. Remover E2 (e qualquer alias do Word) do fixture.
3. Representar por fluxo, não por sigla solta: sem_resposta (E0→E1→E3→E4→E12), visualização (V3/V4), reengajamento (R1–R3), reentrada (RE0–RE3), esfriado (RF0/RF1), fechamento (E27/FINALIZACAO).
4. Manter apenas dois executáveis (E0 e ligação), igual ao real; o restante permanece card informativo.
5. Incluir um caso de lead com pendência dupla para demonstrar o colapso `secondary`.
6. E30 não entra como ação; no máximo como nota de "etapa existente que não envia".
7. Usar `scope` de carteira real (ex.: `greensales`, `portal`) para o visual da ficha ser fiel.

## I) Arquivos que uma futura construção tocaria

- `src/lib/crm/daily-actions.demo.ts` (fixture — principal)
- eventualmente `src/routes/f.executivo.acao-do-dia-demo.tsx` (texto de contexto)

Nenhum arquivo de motor, E0, cadência, mensagens ou Homologação seria alterado.

## Achado adicional (fora do escopo, apenas registrado)

As linhas E2, E5, E6 e E7 da Biblioteca estão `active = true` embora o código as classifique como aliases não executáveis. Isso não afeta o motor (ele só aceita chaves de `step-registry`), mas polui a lista exibida na Homologação. Correção futura, se desejada, seria de dados — não de motor.
