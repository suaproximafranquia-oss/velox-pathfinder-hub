# Financeira /f — Mapa operacional da jornada E0–E8 (diagnóstico e recomendação)

Somente leitura. Nada foi alterado: código, banco, configuração, fila, mensagens e Ação do Dia permanecem intactos. Documentos históricos foram usados apenas como referência de entendimento, nunca como fonte do sistema.

## 1. Calendário da jornada E

Legenda de origem do prazo:
- **CONFIG** = valor que hoje existe de fato na configuração do motor.
- **NÃO DEFINIDO NO MATERIAL** = a régua de negócio descreve a etapa, mas nenhum documento ou configuração fixa o número de dias.

Observação importante: as etapas técnicas atuais (E0, E1, E3, E4, E12) **não são** as etapas da sua régua. Só E0 e E1 coincidem em posição. Por isso os prazos abaixo não podem ser herdados por semelhança de nome.

| Etapa | Função | Prazo | Quando aparece na Ação do Dia | Condição para entrar | Próxima |
|---|---|---|---|---|---|
| E0 | Primeiro contato | 0 — imediato (CONFIG) | No cadastro, dentro da janela 07:00–22:30 (Dom não) | Lead novo | E1 |
| E1 | 1ª tentativa | 1 dia útil (CONFIG) | 1 dia útil após E0, 09:00–21:00 | E0 executada e lead fora de NOVOS | E2 |
| E2 | 2ª tentativa | NÃO DEFINIDO NO MATERIAL | — | E1 executada, sem resposta | E3 |
| E3 | 3ª tentativa | NÃO DEFINIDO NO MATERIAL | — | E2 executada, sem resposta | E4 |
| E4 | 4ª tentativa + oferta do material | NÃO DEFINIDO NO MATERIAL | — | E3 executada, sem resposta | E5 se aceitar; E7 se não evoluir |
| E5 | Entrega/liberação do material digital | Prazo do ambiente = 7 dias (histórico); prazo de criação da própria etapa NÃO DEFINIDO | — | Evento explícito "aceitou receber material" | E6 |
| E6 | Acompanhamento/cobrança do material | NÃO DEFINIDO NO MATERIAL | — | E5 executada | E7, ou encerra se for retorno pós-E8 |
| E7 | Última sequência antes da finalização | NÃO DEFINIDO NO MATERIAL | — | E4 sem evolução, ou E6 concluída | E8 |
| E8 | Finalização | NÃO DEFINIDO NO MATERIAL | — | E7 executada | Encerra |

Único prazo comprovado além de E0/E1: os 7 dias do ambiente do material digital. Todos os demais precisam de decisão sua.

Falta decidir, em dias úteis: E1→E2, E2→E3, E3→E4, E4→E7, E5 (a partir do aceite), E5→E6, E6→E7, E7→E8. E também: E5/E6 são contados em dias úteis como as demais, ou em dias corridos por causa do prazo de 7 dias do ambiente?

## 2. Dia a dia — exemplo com lead entrando na segunda

Como só E0 e E1 têm prazo comprovado, os dias seguintes ficam marcados como dependentes de decisão.

**A) Nunca responde**
- Segunda: E0 (primeiro contato)
- Terça: E1 (1ª tentativa)
- Quarta em diante: E2 → E3 → E4 → E7 → E8, na cadência que você definir. Com 1 dia útil entre etapas, seria Quarta E2, Quinta E3, Sexta E4, Segunda E7, Terça E8.

**B) Responde e aceita o material**
- Segunda: E0
- Terça: E1
- Terça (resposta aceitando): a cadência de tentativas para; o caminho vira material
- Quarta: E5 (liberação do material, ambiente válido por 7 dias)
- Após o prazo de acompanhamento: E6 (cobrança do material)
- Depois: E7 e E8 conforme a régua

**C) Já finalizado em E8 e volta a responder**
- Segunda (resposta do investidor já finalizado): reabre no caminho do material
- Terça: E5
- Após o acompanhamento: E6
- Em seguida: encerra. **Não repete E7 nem E8.**

## 3. Eventos que mudam o caminho

| Evento | Transição esperada |
|---|---|
| Não respondeu | Continua a linha de tentativas: E1→E2→E3→E4, e depois E7→E8 |
| Respondeu (sem aceitar material) | Automação pausa; o Executivo conduz; retoma na etapa seguinte se voltar a silenciar |
| Aceitou receber material | Sai da linha de tentativas e entra em E5 |
| Recebeu material (E5 executada) | Habilita E6 e marca a memória "já recebeu material" |
| Visualizou material | Sinal de engajamento; pode antecipar ou dispensar a cobrança do E6 — **precisa de decisão sua** |
| Agendou | Bloqueia toda a cadência automática (já é o comportamento atual) |
| Compareceu | Sai do fluxo automático; condução do Executivo, com reagendamento se houver |
| Não compareceu | Entra no fluxo R: R1→R2→R3→R4; se já recebeu material, pula R3 → R1→R2→R4 |
| Voltou depois do E8 | Reabre em E5→E6 e encerra; nunca E7/E8 de novo |
| Já recebeu material anteriormente | Nunca reofertar: pula E5 no caminho E e pula R3 no fluxo R |
| Já estava em R e não compareceu de novo | Continua de onde parou, sem reiniciar o R |

Hoje, dos eventos acima, o motor só trata: não respondeu, respondeu e agendou. Aceite de material, entrega, visualização de material, comparecimento, não comparecimento e retorno pós-finalização não existem como eventos que mudem o caminho.

## 4. Ação do Dia

Confirmado: a cadeia permanece exatamente essa —

motor decide → fila cria a obrigação → Ação do Dia mostra → executivo copia/executa → concluído → snapshot/histórico → motor decide a próxima.

A Ação do Dia hoje já é apenas leitura da fila: ela não escolhe etapa, não calcula prazo e não cria obrigação. Isso não muda com a nova régua. A única evolução necessária do lado dela é que o desfecho de reunião ("não compareceu") passe a **emitir um evento** para o motor — quem decide a transição continua sendo o motor.

## 5. Biblioteca

Confirmado: cada etapa E0–E8 deve buscar o texto diretamente da Biblioteca, respeitando versão ativa, variante COM NOME / SEM NOME conforme a Central dos Nomes, e gravando snapshot no instante da execução. Nenhum texto paralelo em código. Sem versão ativa válida, a ação aparece com o motivo e o COPIAR fica bloqueado — sem inventar conteúdo. Esse comportamento já existe hoje e deve ser preservado.

## 6. Fechamento

**a) Comprovado pelos documentos e pelo sistema:** a sequência de nove etapas E0–E8; os dois caminhos (sem evolução e com material); a existência do ambiente de material com 7 dias; o retorno pós-E8 indo para E5→E6 e encerrando; o fluxo R de não comparecimento com salto de R3 quando o material já foi entregue.

**b) Precisa de decisão sua:** todos os intervalos entre E1 e E8; se E5/E6 contam em dias úteis ou corridos; o que exatamente caracteriza "aceitou o material" (resposta afirmativa, clique no link, ambos); se a visualização do material altera o E6; quantos dias após o fim dos 7 dias entra o E6; se o retorno pós-E8 pode ocorrer mais de uma vez; e como o R interage com a memória de material.

**c) Prazos comprovados:** E0 imediato; E1 um dia útil; ambiente do material 7 dias.

**d) Prazos não comprovados:** E2, E3, E4, E5, E6, E7, E8 — nenhum documento fixa esses números.

**e) Estrutura mínima para virar a régua sem destruir histórico:**
1. Nova versão de fluxo, versionada, com as nove etapas e seus prazos. Ciclos em andamento continuam na versão antiga — o versionamento de fluxo já existe.
2. Um registro de memória da jornada por lead: já recebeu material, já foi finalizado, já passou pelo R.
3. Novos eventos no motor: aceite de material, entrega de material, comparecimento, não comparecimento, retorno pós-finalização.
4. Decisão condicional no motor: a próxima etapa deixa de ser "a próxima da lista" e passa a considerar o caminho e a memória.
5. Textos oficiais das etapas novas publicados na Biblioteca antes de qualquer ativação.
6. Nenhuma renomeação de chave técnica existente e nenhuma remoção de versão histórica: a régua nova nasce ao lado da atual.

Recomendação: **mudança estrutural**, feita em uma construção única e versionada, e só depois que os prazos do item (b) estiverem decididos.
