# Diagnóstico somente-leitura — Arquitetura da Biblioteca de Mensagens (Financeira /f)

Nenhuma alteração, migration ou construção executada. Apenas inspeção de código.

## 1. O comando foi aplicado?

SIM, com uma ressalva pontual (ver item 7). Conclusão: **APLICADO**.

## 2. Quem determina a lista de etapas exibida

- `listLibraryMessages()` em `src/server/relationship/message-library.server.ts:315`.
- Ela chama `ensureLibrarySeed()` (linha 261), que percorre `OFFICIAL_STEP_KEYS` — derivado de `BASE_STEP_KEYS` = `STEPS` (config) + etapas oficiais fora da cadência (`E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA`) — e semeia slots faltantes (vazios/inativos quando não há texto oficial).
- A ordem de exibição vem de `display_position` (banco), não de lista fixa.
- O painel (`message-library-panel.tsx`) exibe operacionalmente apenas mensagens com `official === true`; registros fora da configuração aparecem em bloco separado "Histórico fora da configuração", preservados e não operacionais.

## 3. Lista derivada da configuração?

Sim. `OFFICIAL_STEP_KEYS` (message-library.server.ts:144) é construído a partir de `BASE_STEP_KEYS`, que vem de `STEPS`/`NON_CADENCE_STEPS` em `src/lib/relationship/config.ts` e `step-registry.ts`. Não há lista paralela alimentando o motor.

## 4. Ainda existem WORD_STEP_ORDER / LIBRARY_STEP_ORDER / WORD_ALIAS_STEPS / LEGACY_STEPS?

Sim, continuam declaradas em `message-library.server.ts:100-133`, MAS uma busca em todo `src` confirma que **nenhum outro arquivo as importa nem usa**: são constantes órfãs, sem efeito em semeadura, listagem ou motor. São resíduo inerte; não configuram segunda fonte de verdade. Recomendação futura (não executada): removê-las para evitar confusão.

## 5. Etapa nova na configuração aparece automaticamente?

Sim. `ensureLibrarySeed()` percorre `OFFICIAL_STEP_KEYS` a cada listagem; uma chave nova em `STEPS` entra em `BASE_STEP_KEYS` → recebe slot vazio/inativo ("Sem mensagem cadastrada" / "aguardando texto oficial") sem cadastro manual.

## 6. Nova versão preserva display_position?

Sim. `publishLibraryVersion()` (linhas 525-534) calcula `inheritedPosition` (menor posição existente da etapa) e grava no insert (linha 554). `assignMissingPositions()` (linhas 207-250) é conservadora: herda posição conhecida e só atribui número novo a etapa sem nenhuma posição prévia. Publicar não joga a etapa para o fim.

## 7. Existe botão/fluxo de "Adicionar etapa" na Biblioteca?

- **Interface:** NÃO. O painel (`message-library-panel.tsx`) não tem mais o formulário "Criar etapa" — nem estado `creating/newKey/newTitle`, nem botão. Nenhum componente importa `criarEtapaBiblioteca`.
- **Backend:** a server function `criarEtapaBiblioteca` em `src/lib/relationship/library.functions.ts:77` ainda existe (sem consumidor na UI), mas o servidor `createLibraryStep()` (message-library.server.ts:337) **rejeita qualquer chave fora da configuração** com erro explícito e, para chave oficial, só cria o slot se ainda não existir — exatamente o caso coberto pela semeadura automática. Não há conflito prático com a regra "configuração é a fonte de verdade"; a função está inerte para chaves arbitrárias. Comentário desatualizado na linha 73-75 do functions file ainda diz "A etapa passa a existir e a ser reconhecida" — texto residual, sem efeito.

## 8. Arquivos alterados pela implementação

1. `src/server/relationship/message-library.server.ts` — `OFFICIAL_STEP_KEYS`/`isOfficialStep`, campo `official` em `toMessage`, semeadura por configuração, `assignMissingPositions` conservadora, herança de `display_position` na publicação, guarda de chave oficial em `createLibraryStep`.
2. `src/server/relationship/step-registry.server.ts` — removida a leitura de chaves ativas da Biblioteca como fonte de etapas reconhecidas; restam configuração + histórico (sends/queue/cadences).
3. `src/lib/relationship/flows.functions.ts` — `etapasDisponiveis` reduz por `stepKey` (ativa ou maior versão) e filtra por `isOfficialStep`.
4. `src/components/executive/message-library-panel.tsx` — removida a criação livre de etapa; split oficial × histórico; drag-and-drop e edição de rótulo/versão preservados.

## Conclusão final

**APLICADO.** A configuração do motor é a única fonte de existência de etapas; a Biblioteca é repositório de mensagens/versionamento/posição. Etapas removidas da configuração saem da operação e ficam como histórico; etapas novas aparecem automaticamente; `display_position` é preservada ao versionar. Únicos resíduos inertes: constantes `WORD_STEP_ORDER`/`LIBRARY_STEP_ORDER`/`WORD_ALIAS_STEPS`/`LEGACY_STEPS` sem uso e a função `criarEtapaBiblioteca` sem consumidor — nenhum dos dois tem efeito operacional.

Sem nenhuma ação proposta. Não avancei para a Central dos Nomes.
