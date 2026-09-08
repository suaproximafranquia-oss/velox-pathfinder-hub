# Financeira /f — Recuperação das mensagens históricas (somente leitura)

Nada foi alterado: nenhuma versão criada, apagada, ativada, renomeada ou movida. Nenhuma migration. Fonte usada: a própria Biblioteca persistida (79 versões, todas no escopo produção) e o código do projeto. Word não foi usado.

## Descoberta central

Nada se perdeu. O que existe é um **descolamento entre o título editorial e a chave técnica**: a etapa que você chama de "E4" está guardada sob a chave técnica `E2`, a "E5" está sob `RE0`, e assim por diante. Todos os textos, em versão COM NOME e SEM NOME, estão preservados.

Mapa completo hoje (versão ativa de cada chave):

| Etapa do negócio | Chave técnica onde está guardada | Versão ativa |
|---|---|---|
| E0 — Primeiro contato | `E0` | v6 |
| E1 — Primeiro acompanhamento | `E1` | v5 |
| E2 — Segundo acompanhamento | `E3` | v4 |
| E3 — Terceiro acompanhamento | `E12` | v4 |
| E4 — Oferta da apresentação digital | `E2` | v2 |
| E5 — Apresentação digital | `RE0` | v5 |
| E6 — Acompanhamento do material | `E20` | v3 |
| E7 — Última tentativa de contato | `E27` | v3 |
| E8 — Finalização | `RE1` | v3 |
| R1 — Reengajamento | `E3` (v1 e v2, inativas) | histórico |
| R2 — Segundo reengajamento | `E4` | v2 |
| R3 — Oferta de apresentação digital | `E5` | v3 |
| R4 — Finalização do reengajamento | `RE2` | v3 |
| RE0 — Reentrada | `E6` | v3 |
| RE1 — Reentrada / conteúdo | `E7` | v2 |
| RE2 — Reentrada / suporte | `FINALIZACAO` | v2 |
| RE3 — Finalização / oferta digital | `R1` | v2 |
| RF0 / RF1 | `R2` / `R3` | v2 |
| ER0 / ER1 / ER2 | `RE3` / `TESTE` / `V4` | conteúdo de teste |

## 1. Recuperação pedida

### E4 — oferta da apresentação digital
- **Onde:** chave `E2`, versão 2, ativa. Origem: Biblioteca persistida. É a mensagem histórica original, não uma aproximação.
- **COM NOME:** "Olá, [Nome]. Quero te oferecer uma alternativa para conhecer melhor a Velox sem precisar agendar uma conversa neste momento. Tenho uma apresentação digital que permite conhecer a estrutura, o modelo de negócio e a oportunidade no seu próprio tempo. Se você quiser receber esse material, me responda por aqui e eu disponibilizo o acesso."
- **SEM NOME:** o mesmo texto começando em "Olá."
- Existe versão anterior (`E2` v1, inativa), com título "E5 — Oferta de apresentação digital" e texto diferente, sobre compartilhar mais um conteúdo. Também preservada.
- Observação: o texto usa o marcador literal `[Nome]` em vez da variável do sistema.

### R1 — primeiro contato pós-falta
- **Onde:** chave `E3`, versões 1 e 2, ambas inativas. Origem: Biblioteca persistida.
- **v2 (a mais recente), COM NOME:** "[Nome], vi que conseguimos iniciar nossa conversa, mas acabamos não conseguindo evoluir para o próximo passo. Sei que os dias são corridos e nem sempre conseguimos falar no momento ideal. Por isso, quero alinhar novamente sua disponibilidade para que possamos conversar. Minha disponibilidade é ampla. Me diga qual período fica bom para você e seguimos a partir daí. Enquanto isso, também quero compartilhar um conteúdo que pode contribuir para você conhecer melhor a Velox: [CONTEÚDO R1]"
- **SEM NOME:** existe, idêntica sem o nome.
- **v1** é outro texto ("Os dias passam rapidamente…"), sem versão SEM NOME.
- **Ressalva honesta:** este texto é de *reengajamento após conversa iniciada*, não fala em falta a reunião. É a mensagem histórica real de R1, mas **não** é uma mensagem de "pós-falta". Se R1 passar a significar pós-falta, o texto precisa de decisão editorial sua.

### R3 — oferta do material digital
- **Onde:** chave `E5`. Duas funções diferentes ao longo do tempo, ambas preservadas:
  - **v3 (ativa), "R3 — Oferta de apresentação digital", COM NOME:** "[Nome], percebi que a nossa conversa acabou ficando sem continuidade, mesmo depois de você ter me respondido. […] quero te oferecer uma alternativa. Posso disponibilizar uma apresentação digital para você conhecer toda a estrutura, o modelo de negócio e a oportunidade da Velox, no seu próprio tempo, sem precisar agendar uma conversa comigo agora. Esse formato faz sentido para você? Se fizer, me responde por aqui que eu te envio." SEM NOME existe.
  - **v2 (inativa), "R3 — Finalização do reengajamento":** encerra as tentativas e, antes de encerrar, oferece a apresentação digital. COM e SEM NOME.
  - **v1 (inativa):** oferta pura do material, praticamente idêntica ao E4.
- Todas históricas originais.

### RE1 — tentativa de recontato / reentrada
- **Onde:** chave `E7`, versão 2, ativa. Histórica original.
- **COM NOME:** "[Nome], como você voltou a se interessar pelo tema, quero contribuir com algo prático. Alguns critérios realmente importam para avaliar uma franquia: entender rentabilidade, suporte, maturação e perfil do franqueado costuma evitar decisões precipitadas em qualquer marca. Separei um conteúdo sobre esse assunto: [CONTEÚDO RE1] Se preferir, podemos conversar e analisar esses pontos juntos. Minha disponibilidade é ampla."
- **SEM NOME:** existe.
- `E7` v1 (inativa) tem outro texto, de encerramento após material enviado. Também preservado.

### ER1 — etapa de RMK 1
- **Onde:** chave `TESTE`, v1 (corpo vazio) e v2 ativa com o corpo "TESET". Sem versão SEM NOME.
- **Não existe mensagem histórica real de ER1.** Só conteúdo de teste. O mesmo vale para ER0 (chave `RE3`, corpo "TESTE") e ER2 (chave `V4`, corpo "TESTE").
- Nada foi inventado para preencher essa lacuna.

## 2. E4 — confirmação

A mensagem histórica do E4 atual é a de `E2` v2, transcrita acima, e **já possuía as duas variantes**, COM NOME e SEM NOME. Ressalva: o texto é de **oferta do material**, não de "quarta tentativa de ligação". Se, na régua nova, E4 for a 4ª tentativa de ligação *e* a oferta, o texto atual cobre só a segunda parte.

## 3. R1 e R3 — confirmação

- **R1 histórico** = retomada de conversa iniciada que não evoluiu, com conteúdo anexo (chave `E3`, v1 e v2). Não é, no texto, um contato pós-falta.
- **R3 histórico** = teve duas identidades: encerramento do reengajamento (v2) e oferta da apresentação digital (v3, a vigente). A versão vigente é claramente a oferta de material, coerente com a sua régua.
- Nenhum dos dois foi confundido com outra chave: a identificação foi feita pelo título gravado no registro e confirmada pelo corpo do texto.

## 4. RE1 e ER1 — confirmação

- **RE1:** existe mensagem histórica real, completa, COM e SEM NOME.
- **ER1:** não existe. E mais importante: **nunca existiu arquitetura de remarketing por executivo na Biblioteca.** A Biblioteca tem um único escopo (produção) e nenhuma coluna de executivo; a tabela de campanhas de remarketing também não tem vínculo com executivo. Portanto não havia — e não há — variantes COM NOME/SEM NOME por executivo para ER0/ER1/ER2. O que existe são três chaves ocupadas por rótulos "ER" com conteúdo de teste.

## 5. Modelo para os dois contextos de E7 e E8, sem criar etapas

A ideia é: **a etapa continua sendo uma só; o que muda é a variante escolhida no momento do envio.** Hoje cada etapa já escolhe entre duas variantes (COM NOME / SEM NOME) a partir de um dado estruturado — o nome confirmado. O mesmo mecanismo pode passar a considerar um segundo eixo, o contexto:

```text
E7 ─ contexto SEM_CONTATO      ─ COM NOME / SEM NOME
   └ contexto MATERIAL_ENVIADO ─ COM NOME / SEM NOME
E8 ─ contexto SEM_CONTATO      ─ COM NOME / SEM NOME
   └ contexto MATERIAL_ENVIADO ─ COM NOME / SEM NOME
```

Nenhuma chave nova, nenhuma renomeação: a chave técnica continua a mesma e ganha um atributo de contexto na versão publicada, do mesmo jeito que já tem título, link e as duas variantes de nome.

**Como o contexto é determinado de forma determinística, sem adivinhar pelo texto:** o motor já guarda, em cada ciclo, a lista de etapas efetivamente executadas. A regra fica objetiva:

- a lista de etapas executadas contém E5 (ou E5 e E6) → **MATERIAL_ENVIADO**;
- a lista não contém E5 → **SEM_CONTATO**.

Esse mesmo registro resolve as outras memórias que você descreveu: "já recebeu material" (pula R3, virando R1 → R2 → R4), "já foi finalizado" (retorno vai para E5 → E6 e encerra, sem repetir E7/E8) e "já esteve no R" (continua de onde parou em vez de reiniciar). Tudo lido do histórico estruturado do ciclo, nunca do conteúdo da mensagem.

## Resumo do que ficou pendente da sua decisão

1. Texto oficial de ER0/ER1/ER2 — não existe histórico, precisa ser escrito por vocês.
2. Se R1 passa a ser "pós-falta", o texto histórico não serve como está.
3. Se E4 acumula "4ª tentativa" e "oferta", o texto histórico cobre só a oferta.
4. Os textos de E7 e E8 no contexto MATERIAL_ENVIADO ainda não existem — o `E7` v1 inativo ("espero que você tenha conseguido visualizar o material que enviei…") é o único candidato natural, e a decisão de usá-lo é sua.
5. Vários textos usam o marcador literal `[Nome]` e `[CONTEÚDO Rx]` em vez das variáveis do sistema — algo a padronizar na construção futura.

Próximo passo sugerido: vocês revisam os textos acima, definem o oficial de cada etapa, e só então fazemos uma única construção no motor.
