# Auditoria (somente leitura) — eliminar o conceito de "Novo conteúdo" da Biblioteca (/f)

Nada foi implementado, alterado ou excluído: sem código, sem banco, sem migration, sem motor, sem E0, sem Safety Lock. (Neste modo só o arquivo de plano pode ser gravado; a nova tarefa ainda não foi anotada em `roadmap.md`.)

## Respostas

**1. Sim.** A seção "Novo conteúdo" do print é exatamente `relationship_contents` (o material: nome, tipo, URL, ativo, `usage_count`) mais `relationship_step_content_bindings` (os chips E0…RESPOSTA_AUTOMATICA, que marcam em quais etapas aquele material pode ser usado). O texto "Utilizado em: E1 — Primeiro acompanhamento" vem do vínculo.

**2/3. Quem depende hoje**

| Camada | Arquivo | Papel |
|---|---|---|
| UI | `src/routes/f.executivo.biblioteca.tsx`, `src/components/executive/message-library-panel.tsx` | a própria tela do print |
| Leitura de mídia | `src/server/relationship/step-media.server.ts` | `loadStepContentMap`, `loadStepContentBindings`, `setStepContentBinding` |
| Escolha | `src/lib/relationship/content.ts` | `selectFromPool`, `selectContent`, `contentLibraryGaps` |
| Motor | `src/lib/relationship/engine.ts` | escolhe o conteúdo antes de despachar |
| Envio | `src/server/relationship/dispatch.server.ts` | recebe `contentId/contentUrl`, grava snapshot e chama `registerContentUsage` |
| Uso | `src/server/relationship/content-usage.server.ts` (+ RPC `increment_content_usage`) | contador de utilização |
| Leitura da Ação do Dia | `src/server/relationship/step-message.server.ts` (`resolveStepContent`) | resolve a mídia da etapa |
| Render | `src/lib/relationship/messages.ts` | placeholder `{{conteudo_*}}` e botão "▶ Assistir conteúdo" |
| Definição | `src/lib/relationship/config.ts`, `internal-templates.ts` | campo `contentGroup` por etapa |
| Diagnóstico | `library-diagnostics.server.ts`, `audit.server.ts` (`contentGaps`) | apontam etapas sem conteúdo |
| Homologação | `homologation.server.ts`, `f.executivo.homologacao.index.tsx`, `homologation-crm.tsx` | simulação usa a mesma seleção |
| Infra | `backup.server.ts`, `workspace-reset.server.ts` | tabelas na lista de backup/reset |

**4. Sim, hoje é obrigatório — mas só para as etapas cujo texto tem o placeholder.** `prepareStepMessage` chama `resolveStepContent` e, se o corpo contiver `{{conteudo_*}}` sem `contentName`, `messages.ts:471-476` bloqueia. As etapas com `contentGroup` são E1, E3, R1, R2, RE1, RE2 e FINALIZACAO; as demais já são autossuficientes hoje.

**5. Sim, e é a simplificação natural.** A `relationship_message_library` já é versionada, tem exatamente uma versão ativa por etapa (índice único parcial) e já carrega `title`, `body`, `body_without_name`, `button_kind`. Bastaria a versão da mensagem carregar também o link e o rótulo do material (dois campos de texto). O conjunto "texto + link" passa a ser a comunicação oficial da etapa, versionada junto — se o link mudar, publica-se nova versão e a mudança é auditável, o que hoje não acontece (trocar a URL do conteúdo não gera versão).

**6. Sim.** A Ação do Dia já consome `prepareStepMessage` → `renderFromLibrary`. Removida a resolução de mídia, ela devolve o texto pronto com o link embutido, sem nenhuma segunda decisão do executivo.

**7. Não há impedimento no Motor.** O motor decide *quando* e *qual etapa*; conteúdo é apenas insumo de render. `dispatch.server.ts` aceita `contentId`/`contentUrl` opcionais (`?? null`) e o snapshot imutável continua guardando a URL efetivamente enviada — que passaria a vir da própria mensagem.

**8/9. Sim, há outros consumidores** — todos derivados, nenhum crítico ao negócio:
- **rotação/uso**: `registerContentUsage` + `usage_count`/`last_used_at` (existe para não repetir material entre leads — perde sentido no novo modelo, já que a etapa passa a ter material fixo);
- **auditoria/diagnóstico**: `contentGaps` em `audit.server.ts:57` e `library-diagnostics.server.ts` (passariam a checar "mensagem ativa tem link quando exige");
- **homologação/simulação**: `homologation.server.ts` e as telas de homologação usam a mesma seleção;
- **backup e reset**: as duas tabelas estão nas listas de `backup.server.ts` e `workspace-reset.server.ts`;
- **histórico**: `relationship_message_sends` guarda `content_id`/`content_url` de envios passados — por isso as tabelas **não devem ser apagadas**, apenas deixar de ser fonte.

**10. Menor alteração arquitetural**
1. Acrescentar dois campos à versão da mensagem (`content_url`, `content_label`) — aditivo, nada é removido.
2. Em `renderMessageSpec`, resolver o placeholder `{{conteudo_*}}` com o link da própria mensagem, em vez de com `input.contentName/contentUrl`.
3. `prepareStepMessage` deixa de chamar `resolveStepContent`; `engine.ts` deixa de selecionar conteúdo antes do despacho (passa `null`).
4. UI: remover a seção "Novo conteúdo" e os chips de etapa; o editor de mensagem ganha o campo de link.
5. Diagnóstico e homologação passam a validar "mensagem ativa exige link e tem link".
6. `relationship_contents` e `relationship_step_content_bindings` ficam **congeladas como legado** (padrão já usado com `relationship_content_groups`), preservadas em backup e no histórico.

Nada disso toca Motor de decisão, E0, fila, Jornada ou Safety Lock — o histórico continua legível porque os snapshots antigos guardam a URL usada na época.

**11. Sim.** Não se cria um segundo mecanismo: a Biblioteca de Mensagens continua sendo a única fonte, apenas mais completa. `renderFromLibrary` permanece a única função de render, usada igualmente por Ação do Dia e despacho real.

**12. Estrutura final mais simples e segura**

```text
relationship_message_library (versão ativa da etapa)
  step_key | body | body_without_name | content_url | content_label | active | version
                     ↓
        renderFromLibrary (única render, resolve nome/assinatura/link)
                     ↓
        prepareStepMessage  →  Ação do Dia: "Etapa N — Copiar mensagem"
                     ↓
              executivo copia (clipboard)
                     ↓
             "Mensagem enviada?"  SIM / NÃO
       SIM → registra histórico + conclui o item da fila → motor agenda a próxima etapa
       NÃO → nada é concluído; o item permanece pendente
```

Efeitos colaterais positivos: acaba a ambiguidade de "6 vínculos ativos em E1" (causa do erro "nenhum conteúdo ativo foi selecionado"), o link passa a ser versionado junto do texto e a Ação do Dia deixa de ter qualquer decisão de mídia.

Nenhuma implementação foi feita e nenhum registro foi excluído.
