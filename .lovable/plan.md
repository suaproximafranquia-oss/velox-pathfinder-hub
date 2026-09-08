# Validação final do desenho das etapas e transições

Somente leitura. Nada foi alterado: nem código, nem banco, nem mensagens, nem Biblioteca, nem Ação do Dia.

## 1. Fluxo E — caminho sem resposta

**Confirmado:** E0 → E1 → E2 → E3 → E4 → E7 → E8, sem nenhuma outra etapa entre elas. E5 e E6 existem apenas como ramificação com material e nunca aparecem no caminho sem resposta. A designação de funções está correta: E0 primeiro contato, E1 primeira tentativa (com as duas ligações internas), E2 segunda tentativa, E3 terceira tentativa, E4 quarta tentativa + oferta, E7 checkmate, E8 finalização.

## 2. Intervalos do fluxo E

**Confirmados sem ressalva comercial:** D0 · +1 · +2 · +2 · +2 · +4 · +3. Com a âncora aprovada (data teórica na origem + piso da execução anterior), o ciclo termina em D14 em qualquer entrada de segunda a sexta — exatamente a intenção de ~15 dias. Nenhum intervalo precisa de ajuste.

## 3. E4 → E5 e régua com material

**Confirmado.** O sinal é a resposta do lead pedindo ou concordando em receber a apresentação. E5 executa imediatamente como próxima ação, sem intervalo artificial. Depois: E5 → E6 em +7 dias, E6 → E7 em +2 dias, E7 → E8 em +3 dias. É a régua definitiva do ramo com material.

## 4. Dois contextos de E7/E8

**Confirmado.** Um único par de etapas E7/E8, cada uma com dois textos possíveis, e o motor escolhe pelo histórico estruturado do ciclo: existe registro de apresentação enviada → MATERIAL_ENVIADO; não existe → SEM_CONTATO. Nenhuma interpretação de texto em nenhum ponto.

## 5. Função comercial de E7

**Confirmado.** E7 não é finalização: busca uma definição sobre a continuidade da conversa, não uma decisão de compra. No contexto SEM_CONTATO é a tentativa final de abrir diálogo; no contexto MATERIAL_ENVIADO é o checkmate sobre o material — viu, faz sentido, tem dúvida, quer conversar, não quer continuar.

## 6. E8 — finalização

**Confirmado.** E8 encerra o ciclo atual por ausência de comunicação suficiente, sem apagar histórico. No contexto MATERIAL_ENVIADO, a mensagem deixa claro que o material foi enviado, que retorno foi solicitado, que houve novas tentativas, que o executivo encerra e que a porta permanece aberta.

## 7. Gatilho do R

**Confirmado.** O fluxo R só é liberado por decisão humana de mover o lead de AGENDAMENTO para FRIOS após o compromisso não ocorrer. Enquanto o lead estiver em AGENDAMENTO, toda a cadência (E, RE, R) fica congelada. O não comparecimento sozinho não inicia R.

## 8. R1–R4

**Confirmado.** Sem material: R1 · +2 R2 · +2 R3 · +4 R4. Com material: R1 · +2 R2 · +4 R4, e R3 é pulada. Confirmado também o requisito editorial: as mensagens R não podem conter referência temporal ligada à origem do lead ("há X dias", "desde o cadastro", "desde o E4") — precisam funcionar a partir de qualquer momento de entrada em Agendamento.

## 9. RE — reentrada

**Confirmado.** RE0 imediato, RE1 em +1 dia. Quando precisa de nova apresentação: RE1 · +2 RE2 · +5 RE3. Quando já existe apresentação enviada no ciclo de reentrada: RE1 · +3 RE3 direto. Estrutura correta, sem ajustes.

## 10. Condição de RE2

**Confirmado.** RE2 existe somente quando a reentrada precisa de uma nova apresentação. Com registro estruturado de material enviado, RE2 é pulada e o caminho vai direto para RE3.

## 11. RF

**Confirmado.** RF0/RF1 permanecem preservados como conceito futuro de relacionamento pós-finalização, fora desta construção. Nenhum RF novo será criado.

## 12. ER

**Confirmado.** ER não existe na cadência e fica totalmente fora desta construção: nada de criar, restaurar, renomear ou organizar ER0–ER3.

## 13. Passagem para Agendamento

**Confirmado.** Em qualquer etapa de E, R ou RE, quando o humano move o lead para AGENDAMENTO a cadência congela imediatamente e nenhuma etapa nova é gerada enquanto o lead lá permanecer. O retorno ao fluxo acontece somente pelas regras já definidas para o resultado do agendamento.

## 14. Apresentação enviada fora de E5

**Confirmado.** O registro manual de "apresentação digital enviada" no histórico do ciclo é suficiente para o motor reconhecer o contexto MATERIAL_ENVIADO dali em diante. Sem estágio novo, sem etiqueta, sem interpretação de mensagem e sem mexer no estágio atual do lead.

## 15. Etapas x ações internas

**Confirmado como regra estrutural.** Uma etapa pode ter várias ações internas ordenadas (ligação 1 → espera de 3h → ligação 2 → mensagem) e continua sendo uma única etapa no histórico e na Biblioteca. Nunca haverá E1.1, E1.2 ou equivalente. A mesma lógica vale para qualquer etapa futura com mais de uma ação.

## 16. Resultado final

1. Sequência E — **confirmada**.
2. Intervalos E — **confirmados**.
3. Ramificação E5/E6 — **confirmada**.
4. Contextos E7/E8 — **confirmados**.
5. R1–R4 — **confirmados**.
6. RE0–RE3 — **confirmados**.
7. RF — **preservado para futuro**.
8. ER — **totalmente fora**.
9. Agendamento congela a cadência — **confirmado**.
10. Registro de material fora de E5 — **confirmado**.
11. Ações internas não criam etapas — **confirmado**.
12. Decisões de negócio pendentes — **nenhuma**.

ARQUITETURA FINAL DA CADÊNCIA PRONTA PARA CONSTRUÇÃO.
