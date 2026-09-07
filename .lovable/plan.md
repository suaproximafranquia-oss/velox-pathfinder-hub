# Diagnóstico — Ordem e nomes das etapas na Biblioteca (Financeira /f)

Somente leitura. Nada foi alterado: nenhum registro criado, renomeado, reordenado ou apagado; nenhuma migração executada.

## 1. Fonte de verdade da ORDEM

A ordem é **uma coluna no banco**: `relationship_message_library.display_position`, dentro de `scope = 'production'`.

- A listagem ordena por `display_position` (crescente), depois `step_key`, depois `version` (mais nova primeiro).
- A tela apenas espelha essa ordem; o arrastar grava posições 10, 20, 30… por `step_key`.
- A ordem da Biblioteca é vitrine. Ela **não** é a ordem de execução — o motor continua usando a configuração de fluxos (`STEPS` / `FLOW_SEQUENCE`), que não foi tocada.

Existe também uma rotina automática de "preencher posição faltante": qualquer registro sem posição recebe `maior posição + 10` — e esse número é aplicado a **todas as versões daquela etapa**.

## 2. Inventário atual (26 etapas, todas com posição preenchida, todas com versão ativa)

Posição → chave técnica → nome exibido hoje → nº de versões:

| Pos | stepKey | Nome exibido | Versões |
|-----|---------|--------------|---------|
| 10 | E0 | E0 — Primeiro contato | 6 |
| 20 | E1 | E1 — Primeiro acompanhamento | 5 |
| 30 | E3 | E2 — Segundo acompanhamento | 4 |
| 40 | E12 | E3 — Terceiro acompanhamento | 4 |
| 50 | E2 | E4 — Oferta de apresentação digital | 2 |
| 60 | RE0 | E5 — Apresentação Digital | 5 |
| 70 | E20 | E6 — Acompanhamento da apresentação digital | 3 |
| 80 | E27 | E7 — Última tentativa de contato | 3 |
| 90 | RE1 | E8 — Finalização | 3 |
| 100 | E4 | R2 — Segundo reengajamento | 2 |
| 110 | E5 | R3 — Oferta de apresentação digital | 3 |
| 120 | RE2 | R4 — Finalização do Reengajamento | 3 |
| 130 | E6 | RE0 — Reentrada | 3 |
| 140 | E7 | RE1 — Reentrada / conteúdo | 2 |
| 150 | FINALIZACAO | RE2 — Reentrada / suporte | 2 |
| 160 | R1 | RE3 — Finalização / oferta digital | 2 |
| 170 | R2 | RF0 — Follow-up de reunião | 2 |
| 180 | R3 | RF1 — Finalização / alternativa digital | 2 |
| 190 | RE3 | ER0 - Etapa de RMK 0 | 3 |
| 200 | TESTE | ER1 - Etapa de RMK 1 | 2 |
| 210 | V4 | ER2 - Etapa de RMK 2 | 3 |
| 220 | RESPOSTA_AUTOMATICA | Liberado para novas mensagem | 2 |
| 230 | RF0 | Liberado para novas mensagem | 2 |
| 240 | RF1 | Liberado para novas mensagem | 2 |
| 250 | V3 | Liberado para novas mensagem | 2 |
| 260 | E0_V1 | Livre | 6 |

Observações do inventário:

- A posição está gravada **em cada linha de versão**, repetida para todas as versões da mesma etapa. Ou seja: hoje ela é, na prática, atributo da etapa, mas fisicamente vive na versão — e é justamente aí que nasce o problema.
- O "nome exibido" vem do campo `title` da versão ativa. Não existe validação alguma entre `title` e `step_key`.
- Grupo/tipo da etapa não é um campo: o agrupamento é apenas visual/por prefixo, e hoje o prefixo do nome não corresponde ao prefixo da chave.

## 3. O que acontece ao salvar uma NOVA VERSÃO

1. A versão ativa atual é desativada (nada é apagado).
2. É inserida **uma linha nova** com `version = anterior + 1`, herdando texto/link/rótulo informados.
3. Essa linha nova é criada **sem `display_position`** (fica nula) — o insert não copia a posição da etapa.
4. Na recarga da lista, a rotina de preenchimento vê a etapa com posição nula e grava, para **todas as versões dessa etapa**, o valor `maior posição existente + 10`.
5. Como esse valor é sempre maior que todos os outros, a etapa **vai para o fim da lista**.

Esse é o mecanismo exato do sintoma "salvei e a etapa foi para o final". As posições atuais (10 a 260, perfeitamente espaçadas) indicam que a lista já foi rearrastada manualmente depois desses saltos.

## 4. O caso do HAR (E2 → stepKey=E12)

Sim, é esperado que a requisição carregue uma chave diferente do nome na tela — e não é bug de envio, é o descasamento de rótulos:

- O nome "E2 — Segundo acompanhamento" está gravado na etapa de chave **E3**.
- O nome "E3 — Terceiro acompanhamento" está gravado na etapa de chave **E12**.

Então, ao editar o cartão rotulado "E3", a chamada sai com `stepKey=E12`; ao editar o rotulado "E2", sai com `stepKey=E3`. O identificador é interno e consistente com o registro editado — a inconsistência é de **nomenclatura**, não de gravação. O texto foi salvo na etapa certa do ponto de vista do banco, mas na etapa "errada" do ponto de vista de quem lê o nome.

## 5. Inventário de códigos reconhecidos pelo motor (configuração, não rótulos)

- **E***: E0, E0_V1, E1, E3, E4, E12, E30 (E30 travada/desativada), mais E20 e E27 como etapas fora da cadência.
- **V***: V3, V4 (fluxo de visualização).
- **R***: R1, R2, R3.
- **RE***: RE0, RE1, RE2, RE3.
- **RF***: RF0, RF1.
- **FINALIZACAO** e **RESPOSTA_AUTOMATICA**: etapas oficiais fora da cadência.
- **ER***: **não existe nenhuma etapa ER no motor nem no banco.**
- Chaves presentes na Biblioteca sem papel no motor: E2, E5, E6, E7 (aliases históricos) e **TESTE** (etapa criada manualmente).

## 6. R0 / R1 / R2 / R3 / R4

- Configuração do motor: existem **R1, R2, R3** (fluxo de reengajamento, 2 dias úteis entre etapas; R3 é terminal). **R0 e R4 não existem** no motor.
- Banco: as chaves R1, R2 e R3 existem, cada uma com 2 versões e versão ativa com texto.
- Nenhuma delas foi removida. O que aconteceu é que os **rótulos foram deslocados**: R1 exibe "RE3", R2 exibe "RF0", R3 exibe "RF1". Os nomes "R2/R3/R4" que aparecem na tela pertencem, na verdade, às chaves E4, E5 e RE2.
- Conclusão: R1/R2 não sumiram nem foram filtrados — elas apenas deixaram de se chamar R1/R2 na exibição.

## 7. RE0 / RE1 / RE2 / RE3

- RE = **Reentrada**: lead já conhecido que se cadastra de novo e não recomeça o primeiro contato. Sequência própria RE0 → RE1 → RE2 → RE3 (0, 2, 3 e 5 dias úteis; RE3 encerra).
- São etapas reais do motor, com prazo e conteúdo definidos em configuração.
- Não são "reengajamento" (esse é o fluxo R) nem remarketing.
- Hoje as chaves RE0, RE1, RE2 e RE3 estão exibindo, respectivamente, os nomes "E5", "E8", "R4" e "ER0" — de novo, deslocamento de rótulo.

## 8. ER0 / ER1 / ER2

- **ER não é uma etapa do motor.** Não existe na configuração, não existe como chave no banco e ninguém consome "ER".
- São apenas **nomes digitados** nos rótulos de três registros existentes: RE3 ("ER0 - Etapa de RMK 0"), TESTE ("ER1 - Etapa de RMK 1") e V4 ("ER2 - Etapa de RMK 2").
- Pelo texto do rótulo ("RMK"), a intenção era Remarketing — mas o Remarketing não lê a Biblioteca de Mensagens; ele usa os templates Meta. Ou seja, essas três entradas hoje ocupam chaves da cadência principal (inclusive V4, que é etapa executável do fluxo de visualização).
- Aparecem "junto das demais" porque a Biblioteca é uma lista única e plana, sem separação por grupo.

## 9. Fontes concorrentes de ordem e nomenclatura

Ordem:

1. `display_position` no banco — única fonte real da lista.
2. Rotina automática de posição faltante — sobrescreve com "fim da lista".
3. Ordem do motor (`FLOW_SEQUENCE`) — independente e não refletida na tela.
4. Listas em código (ordem do documento oficial, snapshot das etapas) — usadas só na semeadura inicial e na tela de "fotografia", não na ordenação.

Nomenclatura:

1. `title` da versão ativa (o que aparece na tela) — editável livremente.
2. Tabela de rótulos padrão em código (usada só quando não há título salvo).
3. `step_key` (chave técnica, imutável, usada por motor/fila/histórico).
4. Tradução fixa de apresentação E20→E6 e E27→E7 em código.

São quatro camadas sem nenhuma amarração entre si — daí o descasamento atual.

## 10. Conclusão

**A) Por que a etapa vai para o fim ao salvar:** a nova versão é inserida sem posição, e a rotina de preenchimento atribui "maior posição + 10" a toda a etapa.

**B) Por que R2/R1 parecem ter sumido:** não sumiram. As chaves existem e estão ativas; os rótulos exibidos foram deslocados para outras chaves, e os nomes "R…" hoje estão em E4/E5/RE2.

**C) Por que ER0/ER1/ER2 aparecem junto das etapas:** são rótulos digitados sobre as chaves RE3, TESTE e V4. Não existe grupo ER, e a Biblioteca é uma lista única sem separação por família.

**D) Há inconsistência entre chave e nome exibido?** Sim, generalizada: 20 das 26 entradas exibem um nome cujo prefixo não corresponde à chave técnica. O dado gravado está correto; a leitura humana é que está enganosa.

**E) Menor correção possível (proposta, não executada):**

1. Ao publicar nova versão, copiar a posição da versão anterior no próprio insert — uma linha de código. Isso já elimina o salto para o fim, preserva histórico e não toca no motor.
2. Tornar a rotina de posição faltante conservadora: preencher só quando a etapa realmente não tem nenhuma posição em nenhuma versão, herdando o valor existente quando houver.
3. Exibir a chave técnica ao lado do rótulo em cada cartão, para que nome e chave nunca mais se percam de vista (só apresentação).
4. Agrupar visualmente por família derivada da chave (E, V, R, RE, RF, avulsas), mantendo a ordenação manual dentro do grupo.
5. Corrigir os rótulos deslocados é decisão de conteúdo, não de código: exige uma passada de renomeação consciente — nenhuma renomeação automática deve ser feita pelo sistema.
6. Nada acima altera regra, prazo, fluxo, fila, histórico ou envio.
