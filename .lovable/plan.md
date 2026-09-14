# Diagnóstico — `/f` no domínio público

## Conclusão

`portalvelox.com.br` e o ambiente `.lovableproject.com` **não são o mesmo deployment nem o mesmo runtime**.

### Qual deployment serve cada endereço

- **`portalvelox.com.br`**: hospedagem **KingHost/Apache**, IP `191.6.209.44`, nomes DNS da KingHost. O domínio não está conectado como domínio personalizado deste projeto na Lovable.
- **`ce3eb05c-3308-4ff2-9b94-650cb0170e82.lovableproject.com`**: ambiente de desenvolvimento/preview da **Lovable**, com runtime completo da aplicação e auth bridge da Lovable.
- **Publicação Lovable do projeto**: `velox-pathfinder-hub.lovable.app`. É uma terceira implantação, separada do preview e da KingHost.
- **Workflow externo**: publica somente `dist/client` na branch `stable-website`; a KingHost serve esse pacote estático via Apache e `.htaccess`. `dist/server` não é publicado nem executado.

## Evidências objetivas

1. O DNS de `portalvelox.com.br` aponta para `191.6.209.44`; as respostas vêm com `server: Apache`.
2. O domínio não aparece entre os domínios personalizados conectados ao projeto Lovable.
3. `/`, `/f` e `/f/executivo` no domínio público devolvem o mesmo arquivo de 7.149 bytes e o mesmo hash. Isso confirma que o `.htaccess` está fazendo o fallback para `_shell.html`.
4. Portanto, **a rota `/f` é encontrada pelo navegador**. Não é 404 nem ausência de fallback.
5. Ao abrir `/f`, o cliente solicita funções internas em `/_serverFn/...`. O Apache responde `200 text/html` com o próprio `_shell.html`, em vez da resposta estruturada da função.
6. Em seguida, a página recebe dados ausentes e lança `TypeError: Cannot read properties of undefined (reading 'length')` no pacote de `investor-portal-home`; o limite de erro mostra “This page didn't load”.
7. `/` funciona porque sua tela institucional não depende, na abertura, dessas funções internas. `/f/executivo` consegue mostrar a tela inicial de login porque essa primeira tela também pode ser montada pelo cliente; isso não prova que o fluxo autenticado e as funções protegidas funcionem na KingHost estática.
8. O ambiente `.lovableproject.com` possui runtime completo: os registros mostram chamadas `/_serverFn/...` respondendo com dados estruturados e autorização. Por isso o acesso chega ao login real.
9. A publicação Lovable atual em `velox-pathfinder-hub.lovable.app` não é a que serve `portalvelox.com.br` e, neste momento, também responde `500` em `/`, `/f` e `/f/executivo`. Os logs publicados registram `500` em rotas `/f`. Portanto, ela não deve ser tratada como equivalente ao preview sem uma nova publicação validada.
10. O arquivo estático da KingHost foi atualizado em `14/09/2026 14:26 UTC`, logo após a revisão atual das `14:24 UTC`, mas isso comprova apenas proximidade do código cliente. Ele nunca pode ser a mesma implantação funcional do preview, porque não contém nem executa o servidor.

## Classificação da falha

- **Rota ausente:** não.
- **Fallback SPA ausente:** não; o fallback está funcionando.
- **Erro de servidor na KingHost:** não há servidor da aplicação sendo executado.
- **Erro de runtime no navegador:** sim, consequência direta das respostas inválidas das funções internas.
- **Outro deployment:** sim.
- **Publicação estática incompatível:** sim; esta é a causa principal.
- **Diferença de variáveis:** existe por consequência da arquitetura, mas não é a causa primária observada. O runtime de servidor e suas variáveis simplesmente não existem no deployment estático.

## Correção mínima necessária — não executada

Parar de usar `dist/client` isolado como implantação funcional da aplicação. Há duas opções válidas:

1. **Recomendada:** publicar uma versão Lovable que passe em `/f`, conectar `portalvelox.com.br` a essa publicação em **Project Settings → Domains** e então alterar o DNS da KingHost conforme a configuração fornecida pela Lovable.
2. **Alternativa KingHost:** implantar e manter o runtime completo do TanStack Start, incluindo `dist/server`, encaminhando páginas, `/_serverFn/*` e `/api/*` ao processo da aplicação. O Apache pode continuar servindo arquivos estáticos, mas não pode responder essas chamadas com `_shell.html`.

A simples alteração de rota, `_shell.html` ou `.htaccess` **não corrige** o problema. Antes de apontar o domínio para a publicação Lovable atual, é necessário publicar/validar uma versão em que `/f` não retorne `500` no endereço Lovable publicado.

Nenhum código, dado, rota, autenticação ou configuração foi alterado neste diagnóstico.
