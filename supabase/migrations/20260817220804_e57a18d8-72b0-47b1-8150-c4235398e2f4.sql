INSERT INTO public.magazine_editions (number, title, subtitle, starts_on, published, created_by_name)
VALUES (1, 'Edição de teste do formato', 'Como a Revista Velox será lida no Portal do Investidor', (now() AT TIME ZONE 'America/Sao_Paulo')::date, false, 'Gestão Velox')
ON CONFLICT (number) DO NOTHING;

INSERT INTO public.magazine_pages (edition_id, position, eyebrow, title, body, media_kind)
SELECT e.id, 1, 'Como ler', 'Uma revista aberta, em duas páginas',
'Cada página da Revista Velox é lida como uma revista impressa aberta: de um lado o texto, do outro a imagem ou o vídeo daquela matéria.

Use as setas do teclado ou os botões inferiores para virar as páginas. Esta edição está marcada como teste e permanece invisível para o investidor até ser publicada.'
, 'none'
FROM public.magazine_editions e WHERE e.number = 1
AND NOT EXISTS (SELECT 1 FROM public.magazine_pages p WHERE p.edition_id = e.id AND p.position = 1);

INSERT INTO public.magazine_pages (edition_id, position, eyebrow, title, body, media_kind)
SELECT e.id, 2, 'Ciclo editorial', 'Dez dias corridos por edição',
'Toda edição fica vigente por dez dias corridos a partir da data de início. Ao final desse período ela é encerrada automaticamente e passa ao acervo, onde continua disponível para leitura.

A Gestão publica a edição seguinte pelo Workspace, definindo capa, páginas, imagens e vídeos.'
, 'none'
FROM public.magazine_editions e WHERE e.number = 1
AND NOT EXISTS (SELECT 1 FROM public.magazine_pages p WHERE p.edition_id = e.id AND p.position = 2);