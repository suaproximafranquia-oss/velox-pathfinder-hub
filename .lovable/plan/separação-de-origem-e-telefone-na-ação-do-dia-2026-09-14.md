# Separação de origem e telefone na Ação do Dia

## Implementação
- Manter a origem atual da aplicação para navegação interna no editor, preview, localhost e homologação, sem redirecionamento global.
- Fazer os geradores externos da Financeira usarem exclusivamente `https://portalvelox.com.br`, incluindo link personalizado, Manual, Material, Simulador, CTAs e convite E5, preservando caminhos e tokens.
- Remover dos geradores públicos da Financeira a influência de `window.location.origin` ou da origem recebida pelo navegador, sem alterar as outras marcas.
- Adicionar uma única formatação visual pequena para o telefone exibido no card da Ação do Dia, preservando os dígitos originais, `tel:`, `wa.me`, banco e validações.

## Validação
- Cobrir domínio público, origem da aplicação, convite E5 e preservação do token com testes focados.
- Cobrir celulares brasileiros de 9 e 8 dígitos, ausência do nono dígito e entradas irregulares.
- Verificar o preview Lovable, navegação interna, testes focados, tipos e compilação automática.
