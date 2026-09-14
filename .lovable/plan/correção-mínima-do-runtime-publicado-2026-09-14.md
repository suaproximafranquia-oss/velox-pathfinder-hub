# Correção mínima do runtime publicado

## Diagnóstico confirmado

O domínio personalizado está ativo e aponta para a publicação Lovable. A falha não é de rota, DNS, autenticação ou função de negócio: o runtime publicado encerra qualquer requisição com `500` porque a entrada do servidor tenta carregar dinamicamente um pacote gerado que referencia `assets/react`, módulo ausente na publicação.

## Alteração

- Trocar somente o carregamento dinâmico da entrada padrão do TanStack Start em `src/server.ts` por importação estática suportada pelo empacotador.
- Preservar integralmente o tratamento de erros atual e todas as regras de `/f`, login, Ação do Dia, Portal e GreenSales.
- Não alterar rotas, domínio, DNS, variáveis, banco ou autenticação.

## Validação

- Confirmar compilação de tipos e build.
- Validar no preview `/`, `/f` e `/f/executivo`, incluindo a permanência do login corporativo.
- Executar testes focados existentes da Ação do Dia sem alterar seu comportamento.
- Publicar a correção e conferir `/`, `/f`, `/f/executivo` e as chamadas `/_serverFn/*` no domínio oficial.
