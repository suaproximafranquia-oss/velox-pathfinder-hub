# Bateria final — respostas de homologação e refino

Respostas numeradas. "Confirmado" = entendimento registrado como regra. Itens marcados **[DECISÃO]** dependem de resposta sua; itens **[VERIFICAR]** exigem leitura adicional antes de construir.

## 1. Manual do Investidor

1. Confirmado — remover vídeos dos capítulos 1, 7 e 14.
2. Confirmado — remover toda referência textual a vídeo nesses capítulos ("no vídeo a seguir", "assista", etc.).
3. Confirmado — complemento textual apenas de equilíbrio visual, sem inventar informação nova; qualquer texto novo será mínimo e neutro.
4. **[VERIFICAR]** O slot de vídeo é renderizado pelo componente de capítulo (`chapter-view.tsx` + `video-slot.tsx`); a lista exata de capítulos com vídeo sai da leitura do roteiro do Manual antes da construção. Se houver outros com vídeo, listo para sua confirmação antes de remover.

## 2. Remarketing

5. Confirmado — Remarketing passa a ocupar a mesma largura/área útil do CRM principal.
6. Confirmado — Campanhas e Conversas usam a área maior, mantendo as duas abas.
7. Confirmado — identificado como "CRM de Remarketing".
8. Confirmado — infraestrutura/motor/API Meta compartilháveis; leads, histórico, etapas, notas, ações e estados NUNCA se misturam.
9. Confirmado — nenhuma ligação automática entre etapas do CRM operacional e campanhas de Remarketing agora.
10. Confirmado — ER/redistribuição NÃO será implementado agora.
11. Confirmado — ER só volta no futuro, com todos os executivos no mesmo sistema e regra segura de conciliação Portal × GreenSales.

## 3. Templates de Remarketing

12. Confirmado — Central de Templates para cadastrar/administrar templates oficiais das campanhas.
13. Confirmado — somente templates previamente aprovados pela Meta; o Portal não aprova nada.
14. Confirmado — o Portal não altera o conteúdo aprovado; cadastro é apenas referência (nome, identificador, parâmetros de envio).
15. Confirmado — cadastro com nome, identificador Meta, idioma/categoria e situação ativa/inativa.
16. Confirmado — seletor "Template oficial" lista apenas ativos e válidos.
17. Confirmado — desativar template não apaga campanhas nem histórico.
18. Confirmado — o histórico da campanha guarda a identificação do template usado (snapshot da referência), mesmo após desativação.
19. Confirmado — o template do E0 segue o fluxo próprio do E0, independente de campanhas.
20. Confirmado — o E0 automático não será alterado por causa dos templates de Remarketing.

## 4. Larissa / Gestora

21. Confirmado — Gestora não aparece como executiva comercial no KPI Manager.
22. Confirmado — não aparece como executiva no Painel de Campanhas.
23. Confirmado — fora de rankings, comparações e indicadores de executivos.
24. Confirmado — visualiza individualmente cada executivo no KPI Manager.
25. Confirmado — KPI da Larissa: "Minha equipe" + seleção individual dos ativos.
26. Confirmado — vê todos os colaboradores ativos; nunca a si própria como executiva.
27. Confirmado — Larissa NÃO acessa o Remarketing.
28. Confirmado — Larissa NÃO acessa a Central de Captação.
29. Confirmado — mantém acesso à Biblioteca de Conteúdo.
30. Confirmado — edição na Biblioteca conforme permissão de gestão já existente.
31. Confirmado — mantém acesso à Central de Operações.
32. Confirmado — Central de Operações: visão consolidada + visão individual por colaborador.
33. Confirmado — mantém acesso à Central de Reuniões.
34. Confirmado — mantém acesso à Central de Alertas.
35. Confirmado — sem acesso administrativo à Revista Velox.
36. Confirmado — em Usuários, administra somente colaboradores; não edita o próprio perfil de gestora nem o administrador.

## 5. Portal dos Leads / visão gerencial

37. Confirmado — Portal da Larissa mostra leads de todos os executivos ativos.
38. Confirmado — indicadores representam a equipe, não o administrador.
39. Confirmado — filtro "Todos" ou executivo específico.
40. Confirmado — ao filtrar, indicadores, listas e detalhes passam a ser do executivo.
41. Confirmado — executivos veem somente os próprios leads.
42. Confirmado — administrador vê todos.
43. Confirmado — executivos inativos/excluídos não aparecem como seleção normal; histórico só quando necessário.

## 6. KPI / Campanhas

44. Confirmado — Administrador vê todos os ativos no KPI Manager.
45. Confirmado — Gestora vê todos os ativos individualmente no KPI Manager.
46. Confirmado — Colaborador vê somente os próprios indicadores.
47. Confirmado — Administrador vê todos os ativos no Painel de Campanhas.
48. Confirmado — Gestora vê todos os ativos no Painel de Campanhas.
49. Confirmado — Larissa fora desses painéis como executiva.
50. Confirmado — novos executivos ativos aparecem automaticamente, sem cadastro manual.
51. Confirmado — desativados deixam de aparecer.

## 7. Central de Operações / ações puladas

52. Confirmado — cada colaborador vê as próprias ações puladas.
53. Confirmado — histórico original do pulo nunca é apagado.
54. Confirmado — ação pulada pode ser recuperada/concluída depois.
55. Confirmado — mensagem pulada e depois enviada: sai de "Puladas" (-1) e entra em "Mensagens concluídas" (+1).
56. Confirmado — ligação pulada e depois realizada: mesma regra de contagem.
57. Confirmado — a recuperação não apaga a evidência de que foi pulada.
58. Confirmado — o sistema registra quando a ação pulada foi recuperada/concluída.
59. Confirmado — sem alterar a lógica atual de geração das ações do dia.
60. Confirmado — sem alterar a janela operacional atual.

## 8. Brian Analytics / IA

61. Confirmado — nenhuma IA em produção dependente de créditos da plataforma de desenvolvimento.
62. Confirmado — sem contratação obrigatória de API externa só para manter o botão.
63. Confirmado (proposta) — remover o botão "IA Executiva / Relatório Inteligente" por enquanto. Os arquivos existem (`brain-ai-report.ts`, `executive-ai-dialog.tsx`, rota `f.executivo.brain.tsx`); a remoção é só do ponto de entrada, sem apagar relatórios tradicionais.
64. Confirmado — relatórios tradicionais (sem IA generativa) permanecem.
65. N/A se a 63 for "sim". Se for "não", paro e pergunto: fonte oficial da IA e responsável pelo custo.

## 9. Apresentação Digital

66. Confirmado — a estrutura atual não corresponde ao desejado.
67. Confirmado — reconstrução simples em vez de adaptação.
68. Confirmado — administração apenas com o necessário.
69. Confirmado — conteúdo: um pequeno texto + um vídeo.
70. Confirmado — página própria no navegador, com URL específica.
71. Confirmado — dentro do ambiente administrativo, mantém o menu lateral do Workspace.
72. Confirmado — a página pública do investidor NÃO tem menu administrativo.
73. Confirmado — sem capítulos.
74. Confirmado — sem roteiro complexo.
75. Confirmado — sem thumbnail obrigatória.
76. Confirmado — sem múltiplos vídeos.
77. Confirmado — sem conteúdo inventado para preencher.
78. Confirmado — administrador cadastra URL do vídeo + texto e publica.
79. Confirmado — "Ver como o investidor" continua, pré-visualizando a página pública exata.
80. **[DECISÃO]** Recomendo UMA apresentação vigente por ambiente (Financeira, Solar, Seguradora) — mais simples e coerente com "URL específica". Se precisar de várias por campanha, o modelo muda. Aguardo confirmação.

## 10. Rotas públicas / ambientes

Estado atual confirmado no código: existem `/f`, `/financeira`, `/solar`, `/seguradora`, `/s` (com `/s/portal` e `/s/{executivo}`), `/seg` (com `/seg/{executivo}`). Não existe `/sol`.

81. **`/f`** — workspace operacional da Financeira (CRM, executivo, Portal dos Leads) + link público `/f/{executivo}`.
82. **`/financeira`** — página institucional pública da marca Financeira.
83. **`/sol`** — não existe hoje; proposta: não criar.
84. **`/solar`** — página institucional pública da marca Solar.
85. **`/seg`** — workspace/ambiente lógico da Seguradora + link público `/seg/{executivo}`.
86. **`/seguradora`** — página institucional pública da marca Seguradora.
87. **`/s`** — hoje é o ambiente Solar (inclui `/s/portal` e `/s/{executivo}`).
88. **[DECISÃO]** Minha recomendação: **manter `/s`** como prefixo curto oficial do Portal do Investidor Solar (curto funciona melhor em WhatsApp). Alternativa: aposentar `/s` e usar só `/solar/{executivo}`.
89. **[DECISÃO]** Conforme a 88: `…/s/{executivo}` (recomendado) ou `…/solar/{executivo}`.
90. **[DECISÃO]** Portal do Investidor Seguradora: `…/seg/{executivo}` (já existe). Alternativa: `/seguradora/{executivo}`.
91. **[DECISÃO]** Para a entrada conjunta Solar + Seguradora, proponho uma rota única nova, ex.: `/solar-seguros` (institucional conjunta). Aguardo nome/URL definitivos.
92. Confirmado — Financeira, Solar e Seguradora seguem logicamente separadas.
93. Confirmado — o conjunto Solar + Seguradora é entrada/gestão conjunta, sem misturar dados das operações.

## 11. Corporate Workspace

94. Confirmado — um único item para o ambiente conjunto Solar + Seguradora.
95. **[DECISÃO]** Sugestão de nome: "Solar + Seguros". ("Seg + Sol" também funciona; aguardo escolha.)
96. Confirmado — leads da Solar chegam ao ambiente Solar.
97. Confirmado — leads da Seguradora chegam ao ambiente Seguradora.
98. Confirmado — leads da Financeira ficam exclusivamente em `/f`.
99. Confirmado — nenhuma alteração na Financeira afeta Solar/Seguradora, salvo pedido explícito.

## 12. Central de Homologação

100. Confirmado — simulador bilateral antigo (E0, E1, E3, E4, E12, E30) está obsoleto.
101. Confirmado — não manter interface apresentando etapas antigas como atuais.
102. Confirmado (proposta) — remover o simulador antigo.
103. Se a decisão for não remover, ele será totalmente adaptado às etapas atuais — nunca um meio-termo.
104. Confirmado — nenhuma etapa nova será criada por causa do simulador.

## 13. GreenSales

105. Confirmado — conexão individual do GreenSales não será tocada agora.
106. Confirmado — cada executivo usa as próprias credenciais, sem compartilhamento.
107. Confirmado — a visão consolidada da gestora não usa credenciais individuais dos executivos.
108. Confirmado — propriedade dos leads na GreenSales não será alterada agora.
109. Confirmado — rotação interna do Portal × proprietário na GreenSales fica para fase futura, junto com ER.

## 14. Regras intocáveis

110. Confirmado — motor do E0 não será alterado.
111. Confirmado — Biblioteca de Conteúdo é a fonte oficial das mensagens.
112. Confirmado — registros históricos de ações e mensagens imutáveis.
113. Confirmado — nenhum histórico operacional real será apagado por causa de interface.
114. Confirmado — nenhum disparo real de WhatsApp será liberado.
115. Confirmado — WhatsApp Safety Lock permanece intacto.
116. Confirmado — verdade no servidor; localStorage/sessionStorage nunca como fonte de verdade.
117. Confirmado — nenhuma segunda fonte paralela de verdade.
118. Confirmado — sem migrations quando a estrutura existente resolver. (Exceção provável: Central de Templates e nova Apresentação Digital podem exigir tabelas novas — serão propostas separadamente, com GRANT + RLS.)
119. Confirmado — sem refatoração estética de módulos funcionando.
120. Confirmado — o próximo comando atua somente no confirmado aqui.
121. Confirmado — consolidação em UM único comando de construção, dentro de ~10.000 caracteres.
122. Confirmado — se algo exigir investigação, paro e faço uma pergunta específica antes de construir.

## Pendências de decisão (bloqueiam o comando único)

- **Q80** — uma apresentação vigente por ambiente? (recomendo: sim)
- **Q88/89** — `/s/{executivo}` permanece como URL oficial do Portal Solar? (recomendo: sim)
- **Q90** — Portal Seguradora em `/seg/{executivo}`? (recomendo: sim)
- **Q91/95** — nome e URL da entrada conjunta Solar + Seguradora. (sugestão: "Solar + Seguros", rota `/solar-seguros`)
- **Q102/103** — remover ou adaptar o simulador antigo? (recomendo: remover)
