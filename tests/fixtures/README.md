# Fixtures oficiais de teste

Arquivos JWS baixados diretamente de `https://resultados.tse.jus.br/oficial/` em 04/10/2026, em diferentes momentos da divulgação. As assinaturas são verificadas nos testes com a chave oficial publicada pelo TSE. `ele-c.jws` é EA11; `mun-e006259-cm.jws` é EA12; arquivos `-u.jws` são EA20. `br-e006257-ab.jws` é o EA14 de acompanhamento presidencial por UF, capturado durante a totalização.

Estas fixtures **nunca são importadas pela aplicação ou pela API de produção**. Cenários com votos nos testes são mutações sintéticas locais da estrutura oficial, identificadas no código de teste.

Os arquivos estaduais de SP e DF foram capturados e validados em 04/10/2026 para testar a separação por UF e o cargo 8 de deputado distrital. Não são usados pela produção.
