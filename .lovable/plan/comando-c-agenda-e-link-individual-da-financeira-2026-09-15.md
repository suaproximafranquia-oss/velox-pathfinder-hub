# Comando C — Agenda e link individual da Financeira

## Implementação

- Incorporar uma Agenda compacta na lateral da Ação do Dia, independente da fila principal.
- Consultar somente reuniões e compromissos existentes do executivo autenticado para a data visual selecionada.
- Exibir os oito intervalos operacionais, sem o almoço, marcando cada um como LIVRE ou OCUPADO e mostrando apenas o título disponível.
- Permitir avançar e voltar um dia somente na Agenda e atualizar seus dados silenciosamente a cada três minutos.
- Manter a Agenda estritamente somente leitura: sem criação, edição, exclusão, fila, cadência ou alteração de leads.
- Criar uma área no perfil para copiar o link público curto do executivo autenticado, usando o slug oficial retornado pelo servidor.
- Validar o alias público antes do redirecionamento e manter a chegada no Manual pelo fluxo existente, sem criar lead, E0, RE ou identidade paralela.

## Detalhes técnicos

- Reutilizar `portal_meetings` e os compromissos atuais já consolidados, filtrando apenas itens com horário.
- Separar a projeção de slots em funções puras para testes de horários, sobreposição, almoço e mudança de data.
- Reutilizar `identidadeDoUsuario`, `executive_profiles.slug`, as regras de slug reservado e o gerador oficial do domínio público.
- Manter `/f/$slug` como alias da experiência atual; alias inválido terá tratamento seguro sem assumir executivo padrão.
- Criar testes focados para Agenda, aliases distintos/estáveis, cópia ligada à sessão e ausência de efeitos operacionais.

## Validação

- Executar os testes focados das duas frentes, verificação de tipos e compilação.
- Conferir `/f` e a área executiva no Preview, incluindo o console.
- Confirmar que `/s`, `/s/portal`, `/seg` e os demais módulos protegidos não foram alterados.
- Não publicar.
