# Reconciliação dos 5 warnings da Security View

## Escopo
Produzir um diagnóstico estritamente read-only da Financeira `/f`, sem alterar código, banco, permissões, políticas, storage ou dependências.

## Evidências já confirmadas
- O warning público é gerado por `public.can_access_e0_action(text, text)`: é `SECURITY DEFINER`, `STABLE`, usa `search_path=public` e ainda tem `EXECUTE` para `PUBLIC` e `anon`.
- As seis funções registradas na memória estão sem execução para `PUBLIC`/`anon`; `authenticated` mantém execução conforme o uso em RLS e Workspace.
- O bucket `revista` é privado e não possui policies em `storage.objects`; o sistema acessa-o exclusivamente no servidor e entrega PDFs por URL assinada de 5 minutos.
- `presentation_chapters` possui SELECT somente para admin; os fluxos da apresentação acessam a tabela no servidor com autorização privilegiada.
- As capturas públicas de `portal_leads` e `group_unit_leads` gravam por funções do servidor, não por INSERT anônimo direto.

## Entrega
Para cada um dos cinco warnings atuais:
1. nomear exatamente a função, tabela ou bucket envolvido;
2. comparar o achado com a memória de segurança;
3. distinguir exposição real de alerta preventivo ou gap funcional;
4. declarar se exige correção antes da publicação;
5. justificar objetivamente quando não exigir.

A conclusão de cada item será rotulada apenas como **BLOQUEANTE**, **NÃO BLOQUEANTE** ou **ACEITO POR DESENHO**. O diagnóstico ficará limitado aos cinco warnings atuais, sem auditoria geral e sem aplicar correções.
