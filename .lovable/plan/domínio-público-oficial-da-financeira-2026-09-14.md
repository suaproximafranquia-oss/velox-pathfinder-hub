# Domínio público oficial da Financeira

## Implementação
- Centralizar em `portal-brands` a origem pública oficial `https://portalvelox.com.br` e a resolução por ambiente.
- Fazer os geradores existentes da Financeira usarem essa resolução, incluindo Portal personalizado, Manual, Material, Simulador, CTAs e convite da apresentação digital.
- Preservar caminhos, tokens, sessão, responsáveis, mensagens, assets e toda a regra atual da etapa E5.
- Manter localhost e homologação apontando para sua própria origem; qualquer origem de produção antiga passa a resolver para o domínio oficial.

## Validação
- Cobrir a origem oficial, os caminhos públicos e o comportamento de homologação com testes focados.
- Confirmar que não restou fallback público para `velox-pathfinder-hub.lovable.app`.
- Executar testes focados, verificação de tipos e confirmar a compilação automática.
