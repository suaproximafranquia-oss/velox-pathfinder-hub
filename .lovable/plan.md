# Corrigir vídeo e legenda da Apresentação Digital

## Diagnóstico confirmado
- A apresentação da Financeira está salva em `environment_presentations` com `mux_playback_id` e `intro_text` preenchidos.
- O Playback ID salvo responde normalmente no Mux.
- A linha vigente está com `is_published = false`; por isso, `getPublishedFinancePresentation()` retorna `null` e o resgate público entrega `muxPlaybackId: null` e `introText: null` juntos.
- O componente público já usa `muxPlaybackId`, remove espaços, renderiza o Mux Player quando há ID e mostra o placeholder somente quando o valor recebido está vazio.
- A legenda já é renderizada abaixo do player por `introText`, preservando quebras de linha. Ela não aparece porque a apresentação inteira é omitida enquanto estiver não publicada.
- Não há uso de `video_url` como fallback na experiência pública atual.

## Implementação
1. Alterar somente o rótulo administrativo de “Texto de contexto da apresentação” para “Legenda da apresentação”, mantendo `intro_text`, o conteúdo existente e o banco inalterados.
2. Preservar a regra de publicação: apresentações não publicadas continuam invisíveis no convite público.
3. Reforçar os testes do fluxo completo para comprovar:
   - `mux_playback_id` → `muxPlaybackId` → Mux Player;
   - `intro_text` → `introText` → legenda abaixo do vídeo;
   - espaços em branco resultam no placeholder;
   - legenda ausente não cria bloco vazio;
   - legenda pode aparecer com o placeholder quando não há vídeo;
   - nenhum uso de `video_url`, URL transformada ou iframe.
4. Pelo painel administrativo, salvar a apresentação vigente da Financeira com “Publicada” marcado, usando o Playback ID completo já existente e a legenda de teste solicitada; reabrir o painel para confirmar a persistência.
5. Abrir um convite vigente e confirmar separadamente que a resposta pública contém os dois valores, o Mux Player carrega e a legenda aparece.

## Validação
- Conferir desktop e mobile no Preview.
- Confirmar título, identificação Velox Financeira, player disponível, legenda correta e ausência do placeholder com ID publicado.
- Confirmar os cenários sem vídeo e sem legenda por testes isolados, sem apagar a apresentação vigente.
- Verificar console e rede do Mux.
- Executar testes focados, typecheck e validar o build automático.
- Não criar migration, não publicar/deployar e não alterar convites, tokens, regras operacionais, outras marcas ou módulos fora da Apresentação Digital.
