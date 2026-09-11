# Diagnóstico cirúrgico — mensagens da Ação do Dia `/f`

## Objetivo
Entregar uma auditoria somente leitura do caminho das mensagens E0, E1, E2, E3, E4, E6, E7 e E8, sem alterar código, banco, Biblioteca ou publicação.

## Entrega
1. Documentar o fluxo real desde a ação persistida em `relationship_queue` até o segundo card de mensagem.
2. Montar a matriz por etapa com origem, `kind`, `stepLabel`, `messageRef`, etapa enviada ao carregamento, resolução no servidor, registro/contexto procurado e possibilidade de abertura.
3. Separar claramente:
   - mensagem válida que não abre por falha de clipboard;
   - mensagem bloqueada por conteúdo/link/contexto;
   - mensagem ausente na combinação ativa da Biblioteca.
4. Explicar a diferença efetiva entre E0 e as demais etapas, inclusive prioridade e dados atuais da Biblioteca.
5. Registrar a menor correção futura e os arquivos envolvidos, sem implementá-la.
6. Listar explicitamente tudo que deve permanecer intocado, incluindo E5 como fluxo manual de material.

## Evidências já verificadas
- A abertura do segundo card está condicionada ao retorno positivo da cópia automática.
- As ações E0–E8 analisadas chegam à tela pelo mesmo formato de mensagem da fila; E0 possui filtros e prioridade próprios, mas não um modal separado.
- A Biblioteca procura uma única versão ativa por etapa e contexto, sem fallback.
- E7/E8 exigem `SEM_CONTATO` ou `MATERIAL_ENVIADO`; COM_NOME/SEM_NOME são variantes de corpo da mesma versão, não contextos de fila.
- O estado atual da Biblioteca foi consultado somente para leitura, permitindo distinguir registros válidos, bloqueados e ausentes.

## Restrições
- Nenhuma implementação, migration, escrita de dados, edição da Biblioteca, teste destrutivo ou deploy.
- Nenhuma investigação fora de `/f`, Ação do Dia, resolução de mensagens e Biblioteca.
