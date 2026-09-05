# RODADA FINAL — Como uma nova etapa entra no fluxo (Financeira /f)

Somente leitura. Nada construído, alterado, migrado ou executado. As opções abaixo são apresentadas para sua decisão; não escolhi nenhuma regra de negócio em seu nome.

## P1 — Como E9 entra num fluxo

- **A) Entra automaticamente em algum fluxo.** Tecnicamente exigiria uma convenção de ordenação (alfanumérica, por exemplo). O motor hoje **não tem** nenhuma ordenação implícita: `nextStep()` percorre `FLOW_SEQUENCE` literalmente. Inventar essa convenção significaria que "E9" entraria entre "E4" e "E12" por acaso do texto — comportamento não previsível pelo administrador. **Não recomendo.**
- **B) Nasce cadastrada e INERTE até alguém definir o fluxo.** A mensagem existe, é editável e testável; o motor a reconhece como etapa válida, mas `nextStep()` nunca a escolhe porque ela não tem fluxo/posição. Custo técnico: um par de campos e uma verificação. **Menor risco.**
- **C) O próprio cadastro permite escolher o fluxo.** É (B) com a associação feita na mesma tela. Funciona, mas cria a chance de uma etapa entrar em produção no mesmo instante em que o texto ainda está sendo escrito.
- **D) Alternativa:** (B) + uma tela de "fluxo" separada, onde a Gestora arruma a sequência com todas as etapas já publicadas à vista. Separa "escrever conteúdo" de "mudar a operação" — que são decisões de naturezas diferentes.

## P2 — "Está na Biblioteca, então usa"

Sua interpretação — *"estar na Biblioteca significa que a etapa existe e está disponível ao motor, mas não necessariamente que ela é inserida automaticamente em todos os fluxos"* — **é tecnicamente correta e coerente com sua regra**: continua não havendo lista paralela no código; a Biblioteca segue mandando. Ela apenas passa a declarar duas informações em vez de uma: *existe* e *onde entra*.

**Impacto da interpretação alternativa** (Biblioteca = inserção automática): toda mensagem criada viraria obrigação para investidores reais no mesmo dia, inclusive rascunhos e testes; e como não há ordenação implícita, seria necessário inventar uma. Isso transformaria um erro de digitação numa mudança de cadência em produção.

**Decisão sua**, mas as duas leituras respeitam "a Biblioteca manda" — a diferença é se publicar conteúdo é, por si só, um ato operacional.

## P3 — Posição

- **A) Campo `position`** (número por fluxo): simples de ler no motor, mas exige recalcular números ao inserir no meio.
- **B) Arrastar e soltar**: melhor experiência; grava exatamente a mesma coisa que (A) por baixo. É uma camada de interface sobre (A), não uma arquitetura diferente.
- **C) "Depois de E3"** (lista encadeada): elegante, mas frágil — se E3 for desativada, a corrente quebra e a ordem fica ambígua.
- **D) Recomendação**: **(A) como armazenamento + (B) como interface**, quando houver tempo. É o mais seguro para o sistema atual porque `nextStep()` só precisa ordenar por um número.

## P4 — Prazo

Hoje `businessDaysAfterReference` vive em `STEPS` (`config.ts`) e é lido em `decide.ts:163`.

- **A) Na Biblioteca (na mensagem)**: prazo viaja com a versão publicada, ganhando versionamento de graça. Problema conceitual: o prazo é da *etapa no fluxo*, não do texto — mudar uma vírgula no texto publicaria uma nova versão do prazo junto.
- **B) Na configuração de fluxo** (na associação etapa↔fluxo): o prazo pertence ao par (fluxo, etapa) — que é exatamente o que ele significa. Permite E9 com 2 dias em `sem_resposta` e 5 dias em `reengajamento`.
- **C) Outro lugar**: fragmentaria a configuração.

**Preserva melhor a arquitetura: (B).** Conteúdo na mensagem; comportamento na associação com o fluxo.

## P5 — Nova etapa inerte

**Sim, recomendo tecnicamente.** Criar E9 sem fluxo/posição deve produzir uma mensagem existente, versionada, visível e **sem gerar nenhuma ação**. Motivo concreto: hoje um texto incompleto salvo na Biblioteca já é lido por `renderFromLibrary` na próxima execução da etapa; a inércia dá um espaço seguro entre "escrever" e "entrar em produção". É a arquitetura mais segura entre as viáveis.

## P6 — Rascunho / Publicado / Ativo no fluxo

Os três conceitos **não são todos necessários**, porque dois já existem:
- **Publicado** = `version` + `active = true` (já implementado).
- **Ativo no fluxo** = ter fluxo + posição (é o conceito novo, e é o que P1-B propõe).
- **Rascunho** = **complexidade desnecessária hoje**. Uma etapa sem fluxo já é, na prática, um rascunho seguro. Adicionar um terceiro estado exigiria migration e uma regra de "quem promove o rascunho" que não tem dono definido.

**Recomendação: dois estados (publicado, ativo no fluxo).**

## P7 — Alteração de ordem (E0→E1→**E9**→E3→E4)

Recomendação mais segura, item a item:
- **A) Novos ciclos** — usam a nova ordem. Sem ressalvas.
- **B) Ciclos já iniciados** — **mantêm a ordem com que nasceram**. Mudar a ordem no meio da jornada muda o que o investidor recebe sem que ninguém tenha decidido isso caso a caso.
- **C) Ciclos que já executaram E3** — inserir E9 antes de E3 num ciclo que já executou E3 faria `isStepInOrder` recusar E9 permanentemente (ela exige que todas as anteriores estejam executadas, e E9 passaria a ser "anterior" a algo já feito). Resultado: fila travada ou etapa nunca criada. **Este é o argumento técnico mais forte a favor de B.**
- **D) Ações já na fila** — permanecem como estão. A fila é o passado decidido; nunca deve ser reescrita por mudança de configuração.

## P8 — Versionamento do fluxo

**Confirmo: é a solução tecnicamente mais segura**, e é ela que torna P7-B implementável. Sem guardar a versão do fluxo no ciclo, a única forma de proteger jornadas em andamento seria congelar a configuração — o que anula o objetivo. Com a versão gravada em `relationship_cadences`, cada ciclo é resolvido contra a sequência que valia quando nasceu, e a mudança administrativa fica automaticamente restrita a quem entra depois. É o mesmo princípio de `operational_since`, já implementado no Bloco 1.

## P9 — E9 em mais de um fluxo

**Pode e deve poder.** Modelagem recomendada: `step_key` é o identificador da **mensagem** (uma por chave, versionada); a associação `(fluxo, step_key)` é uma linha separada com `position` e `prazo`.

- Conteúdo: **o mesmo** — é a mesma mensagem.
- Prazo: **pode ser diferente** por fluxo.
- Posição: **pode ser diferente** por fluxo.

Se um dia o texto precisar variar por fluxo, o caminho é criar uma chave distinta (ex.: `E9_RE`), nunca duplicar `step_key`.

## P10 — A chave pode ser "qualquer coisa"?

A chave **pode** ser identificador puro, mas existem hoje **exceções reais com tratamento especial no código** — e essas não podem virar apenas configuração:

| Chave/grupo | Onde | Tratamento especial |
|---|---|---|
| `E0`, `E0_V1` | `decide.ts:15` (`FIRST_CONTACT_STEPS`) | Únicas permitidas enquanto o lead está em NOVOS |
| `E0_V1` | `machine.ts:176` | Ocupa a posição de E0 nos executados |
| `RE0` | `machine.ts:171` | Abertura obrigatória da reentrada |
| `E30` | `decide.ts:158` | Conta a partir do início da jornada, não da última mensagem |
| `E20`, `E27`, `FINALIZACAO`, `RESPOSTA_AUTOMATICA` | `step-registry.ts:16` | Fora da máquina de cadência |
| `E12` | `config.ts` | Encerra o fluxo enquanto E30 estiver desativada |

Ou seja: `E10`, `V5`, `R4`, `RF2` seriam chaves comuns, sem obstáculo. As seis linhas acima continuam sendo comportamento de código.

## P11 — E0

**Confirmado: E0 permanece exceção arquitetural.** Origem, titularidade, ownership, `workspace_e0_actions`, `ownership_seq` e primeiro contato **não são tocados**.

Por quê, tecnicamente: E0 não é decidida pelo fluxo — é decidida na *entrada* do lead (`lead-intake.server.ts`), depende do responsável resolvido, tem janela horária própria (Seg–Sex 07:00–22:30, Sáb até mais cedo), modo manual/automático por executivo, e sua unicidade é `(card_id, ownership_seq)` — atrelada à titularidade, não ao ciclo. Colocá-la sob a configuração da Biblioteca misturaria a regra de entrada com a regra de cadência e reabriria o risco de E0 duplicada por redistribuição.

## P12 — Redação final proposta da regra

```text
CRIAR        administrador cadastra step_key + título + texto na Biblioteca
   ↓
CONFIGURAR   link, rótulo, exigência de material (opcional)
   ↓
PUBLICAR     versão N fica ativa — a etapa EXISTE e é reconhecida pelo motor,
             mas ainda NÃO gera ação (inerte)
   ↓
ASSOCIAR     administrador associa a etapa a um fluxo, com posição e prazo
AO FLUXO     → isso incrementa a VERSÃO DO FLUXO
   ↓
ATIVAR       (não é um passo separado — associar já ativa)
   ↓
MOTOR        etapa válida = existe na Biblioteca (ativa) OU consta do histórico
RECONHECE
   ↓
NOVOS        ciclos criados a partir de agora nascem com a nova versão do fluxo
CICLOS       e passam a receber a etapa; ciclos em andamento seguem a versão
             com que nasceram
   ↓
DESATIVAR    etapa sem versão ativa deixa de gerar NOVAS ações;
             itens já na fila são bloqueados com motivo legível
   ↓
HISTÓRICO    queue, engine_log, timeline e o snapshot em
PRESERVADO   relationship_message_sends nunca são reescritos
```

**Passo desnecessário:** "ATIVAR" como ato separado — associar ao fluxo já é a ativação. Manter os dois seria burocracia sem ganho.

## P13 — Menor arquitetura possível

1. `step_key` continua sendo a identidade imutável (**já existe**).
2. Versionamento de conteúdo (**já existe**).
3. Snapshot da execução em `relationship_message_sends` (**campos já existem**; falta a escrita no caminho manual).
4. **Uma tabela nova**: associação `(flow, step_key, position, business_days)` + um número de versão do fluxo.
5. **Uma coluna nova** em `relationship_cadences`: versão do fluxo com que o ciclo nasceu.
6. `CadenceStep` deixa de ser tipo literal e passa a ser `string` validada em runtime.
7. `isKnownStep` = Biblioteca ativa ∪ histórico.
8. `decide.ts` lê sequência e prazo da associação, em vez de `FLOW_SEQUENCE`/`STEPS`.

Uma tabela, uma coluna. Nada mais é estritamente necessário.

## P14 — Risco

| Parte | Risco | Motivo |
|---|---|---|
| Biblioteca dinâmica (listar do banco) | 🟢 | Só remove listas literais de exibição |
| Novas etapas (reconhecimento) | 🟡 | Depende de `isKnownStep` e da tipagem |
| Fluxo configurável | 🔴 | Passa a governar o que o investidor recebe |
| Posição | 🟡 | Erro reordena cadência; mitigado pelo versionamento |
| Prazo | 🟡 | Erro adianta/atrasa envios |
| Versionamento de fluxo | 🟢 | É justamente a proteção |
| Migração de `CadenceStep` | 🟡 | Alto volume, baixo risco lógico; testes existentes cobrem |
| Alteração de `decide.ts` | 🔴 | Coração da decisão do motor |
| Impacto em E0 | 🟢 | Fora do escopo por decisão explícita |
| Impacto na fila | 🟡 | Só se a fila for recriada — o que a arquitetura proíbe |

---

## CONCLUSÕES

### A) Regra já fechada
Biblioteca é a fonte de verdade sobre quais etapas existem e qual conteúdo usar; fim da lista paralela no código; versão ativa manda nas novas ações; desativar não gera novas ações; histórico preservado; E0/ownership/Safety Lock intocados; `/s`, `/seg`, `/` intocados.

### B) Precisa da sua decisão (negócio, não técnica)
1. **Publicar na Biblioteca é, por si só, um ato operacional?** — inerte até associar ao fluxo (recomendado) **ou** entra em produção ao publicar.
2. **Onde fica o prazo** — na mensagem **ou** na associação com o fluxo (recomendado).
3. **Ciclos em andamento** ao mudar a ordem — mantêm a versão antiga (recomendado), adotam a nova, ou decisão caso a caso.
4. **Onde a ordem é editada** — na própria tela da Biblioteca **ou** em uma tela de fluxo separada.

### C) Recomendação técnica
Etapa nasce inerte; prazo e posição na associação `(fluxo, etapa)`; versão do fluxo gravada no ciclo; ordem editada em tela própria; E0 fora do modelo.

### D) Podemos construir?
**SIM** — e não construirei nada até sua autorização.

**Primeiro bloco recomendado: o snapshot da execução** (gravar `library_id`, `library_version` e `rendered_body` em `relationship_message_sends` quando a Ação do Dia confirma a execução). Por quê: é o único item que **não depende de nenhuma decisão pendente**, não precisa de migration, não muda comportamento operacional, e resolve hoje a perda de rastreabilidade — além de ser pré-requisito de tudo que vem depois, porque sem snapshot qualquer mudança futura na Biblioteca já começa a apagar a memória do que foi usado.

## Observação de escopo
Em modo de planejamento só posso escrever este arquivo; `roadmap.md` será atualizado no primeiro bloco de construção aprovado.
