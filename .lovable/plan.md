# Finalização visual da Apresentação Digital

## Objetivo
Transformar somente a experiência pública existente em uma apresentação institucional da Velox Financeira, sem alterar convite, dados, Mux ou regras operacionais.

## Implementação
- Enviar a fotografia anexada para os assets do projeto e usá-la como fundo em `cover`, com camada azul-marinho escura e posicionamento responsivo que preserve fachada e marca.
- Refinar o componente público existente com conteúdo central, hierarquia tipográfica, vídeo 16:9 intacto e profundidade visual sem poluição.
- Renderizar `introText` em bloco próprio abaixo do vídeo, preservando quebras, largura e conteúdo integral; omitir o bloco quando vazio.
- Adicionar botão “Continuar no Portal do Investidor” apontando diretamente para `https://portalvelox.com.br/f`.
- Ajustar somente os testes focados da apresentação pública para validar fundo, legenda, botão e estados sem vídeo/legenda.

## Validação
- Executar testes focados e verificação de tipos.
- Conferir a compilação automática.
- Validar no Preview desktop e mobile: fundo, vídeo, legenda, botão, destino, ausência de overflow e console.
- Não publicar.
