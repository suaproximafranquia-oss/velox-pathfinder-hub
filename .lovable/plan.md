# Financeira /f — Recuperação cirúrgica do conteúdo histórico ausente

## O que a comparação mostrou

Antes de propor qualquer coisa, fiz a comparação completa: documento oficial "Biblioteca de Mensagens — Jornada do Investidor V2" (que está no projeto e é a origem dos textos), textos históricos que ainda vivem no próprio código do projeto, e todas as versões gravadas na Biblioteca hoje.

Resultado importante: **os textos históricos não foram perdidos**. Todos continuam no projeto e/ou na Biblioteca. O que existe são exatamente **duas lacunas** — duas etapas da régua atual cuja mensagem oficial não está ativa em lugar nenhum.

### Classificação de cada conteúdo histórico

| Conteúdo histórico | Situação | Ação |
|---|---|---|
| E0 primeiro contato | já existe atualmente, versão humanizada | não mexer |
| E1 primeiro acompanhamento | já existe atualmente | não mexer |
| E2 segundo acompanhamento ("continuar contribuindo… mais um conteúdo") | já existe atualmente | não mexer |
| **E3 terceiro acompanhamento ("os dias passam rapidamente…")** | **desapareceu da Biblioteca** — a posição está ocupada por uma cópia do texto de E2 | **recuperar** |
| E4 oferta da apresentação digital | existe, na chave técnica E2 | não mexer, só registrar a correspondência |
| E5 liberação da apresentação (7 dias) | existe, na chave técnica RE0 | não mexer |
| E6 acompanhamento da apresentação | existe atualmente, versão posterior humanizada | não mexer |
| E7 última tentativa | existe atualmente | não mexer |
| E8 finalização | existe, na chave técnica RE1 | não mexer |
| **R1 primeira tentativa ("vi que conseguimos iniciar nossa conversa…")** | **desapareceu da Biblioteca** | **recuperar** |
| R2 segundo reengajamento | existe, na chave técnica E4 | não mexer |
| R3 encerramento do reengajamento | existe, na chave técnica E5 | não mexer |
| R4 | existe só como texto atual na chave RE2 | preservar, não inventar |
| RE0, RE1, RE2, RE3 | todos existem | não mexer |
| RF0, RF1 | ambos existem, nas chaves R2 e R3 | não mexer |
| TESTE, ER0–ER3 | teste/legado | permanecem só no histórico |

## O que a construção vai fazer

Só duas coisas, ambas aditivas:

1. **Recuperar o texto oficial da E3** (terceiro acompanhamento) como **nova versão** da etapa que hoje representa a E3 editorial. O texto vem do documento oficial do projeto, palavra por palavra — nada inventado. A versão atual continua gravada como histórico.
2. **Recuperar o texto oficial da R1** (primeira tentativa após o investidor sumir) como **nova versão** da etapa R1. Mesmo critério.

Nada mais é tocado. Nenhuma mensagem atual é substituída, nenhuma versão é apagada, nenhuma chave técnica muda, nenhuma posição é renumerada.

## Antes de eu executar, preciso de uma confirmação sua

A régua editorial atual (E0–E8, R1–R4, RE0–RE3, RF0–RF1) está gravada hoje apenas nos **títulos digitados** de cada mensagem, e esses títulos estão sobre chaves técnicas trocadas. Isso significa que a E3 editorial e a R1 editorial estão fisicamente guardadas em chaves com outro nome.

Duas formas de gravar as recuperações:

- **Opção A (recomendada, conservadora):** gravar a nova versão exatamente na chave onde o título editorial já está hoje. A E3 do negócio continua onde está, só ganha o texto certo. Zero risco, zero movimentação, e o motor segue idêntico.
- **Opção B:** gravar na chave que o motor executa para aquela finalidade. Isso alinharia texto e execução, mas mexe em onde a mensagem aparece na tela e exige tratar a régua editorial na mesma construção.

Minha recomendação é a **A** agora, e a organização editorial (nomes e ordem E0–E8 numa camada própria) numa construção separada, como você mesmo pediu no item 17.

## Detalhe técnico

- Fonte dos dois textos: `src/lib/relationship/messages.ts` (E3 e R1), que preserva literalmente o conteúdo do documento oficial. Nenhum texto é redigido por mim.
- Gravação pelo mecanismo de publicação já existente da Biblioteca: cria versão nova, desativa a anterior sem apagá-la, preserva autor e data das versões antigas.
- Sem migração, sem UPDATE destrutivo, sem DELETE.
- Nada em `STEPS`, `FLOW_SEQUENCE`, decisão de etapa, E0, fila, Ação do Dia, CRM, Portal, Meta, Safety Lock, `/`, `/s`, `/seg`.
- Ao final: verificação de tipos e build, e relatório com etapa, chave técnica interna, versão criada e confirmação de que R0 não foi criado, R4 não foi inventado, ER0–ER3 não foram criados e nenhum histórico foi apagado.
