# Resultado Eleições 2026 · Brasil e estados

Painel independente com dados oficiais do TSE. Reúne os cinco cargos do primeiro turno de 2026 nas 27 UFs e a presidência nacional. Santa Catarina é a seleção inicial; o menu lateral permite trocar de estado e o celular usa um seletor no topo.

[Acessar o painel](https://resultado-eleicoes-2026.vercel.app/) · [Código no GitHub](https://github.com/VitorRodi/resultado-eleicoes-2026)

## Recursos

- “Excel por cidade”: selecione cargo e candidato (busca por nome, número ou partido) para consultar os votos em todos os municípios da UF aberta. Gera `.xlsx` com uma linha por cidade em ordem alfabética, votos numéricos, situação, percentual de seções apuradas, horário em Brasília, código municipal e fonte TSE. Inclui filtro e cabeçalho congelado. Consulta lotes de até 20 cidades com a concorrência global existente; permite interromper e baixar arquivo parcial, conservando todas as cidades e marcando as não consultadas. Células de votos ausentes ficam vazias, sem serem convertidas em zero. A identidade do candidato é conferida no arquivo estadual oficial de seu cargo. O gerador de Excel roda somente no servidor; não adiciona ExcelJS ao código enviado ao navegador.
- Ordenação dos estados nos cartões da aba Geral e na lista do mapa: alfabética, mais seções pendentes, maior ou menor percentual apurado. O filtro “Somente estados ainda em apuração” oculta somente UFs com totalização final, mantendo resultados desconhecidos visíveis. O painel estadual também pode filtrar cargos ainda sem totalização final, incluindo os acompanhamentos e sua exportação.
- Resumo nacional de seções apuradas, pendentes e totais para presidente, incluindo o exterior. Usa diretamente os metadados oficiais BR, com seu horário; não soma arquivos estaduais.
- “Compartilhar meu painel” gera um link com UF, IDs das candidaturas e cidades escolhidas. As escolhas ficam no fragmento do link, sem resultados ou dados pessoais. Quem recebe vê uma prévia e escolhe entre salvar essas escolhas ou voltar ao próprio painel. Favoritos salvos não são substituídos ao abrir o link; payloads inválidos ou fora dos limites são rejeitados.
- Avisos dentro do painel para subida de posição e confirmação de eleição pelo TSE, somente para candidaturas acompanhadas e após uma nova geração válida do cargo. Há botão para ativar/pausar e limpar os avisos. Primeira consulta não gera alerta; posições nominais não são usadas para inferir eleitos. Retém até 20 avisos nesta visita.
- Histórico do percentual apurado por estado abaixo do mapa nacional: até 240 mudanças oficiais por UF, com horário, tabela e CSV. Fica neste navegador e começa ao abrir o mapa. Não recupera períodos anteriores ou em que o painel esteve fechado, nem grava novamente uma contagem inalterada ou uma resposta antiga.
- Mapa dos municípios nas 27 UFs com malhas simplificadas do IBGE e associação pelos códigos IBGE publicados no catálogo TSE. Mostra o progresso municipal da eleição federal (EA15), seções apuradas e pendentes; ao selecionar uma cidade, consulta os dois presidenciáveis mais votados ali (EA20). Busca por nome, cidades acompanhadas primeiro, filtro de apuração, teclado, padrões opcionais e tela cheia. “Consultar todas as lideranças” carrega em lotes de 20, com interrupção e preservação dos dados já recebidos; interrompe ao encontrar falha de atualização. A cidade selecionada atualiza a cada 30s, e as outras lideranças conservam o horário da última consulta. Localidades sem polígono na malha continuam acessíveis pela lista.
- Barra de filtros ao abrir cada estado: “Tudo”, “Resultados por cargo”, “Meus candidatos”, “Municípios”, “Comparar candidatos”, “Histórico”, “Partidos e federações”, “Votantes e nulos”, “Mapa dos municípios”, “Avisos”, “Mapa da apuração” e “Fontes”. O filtro por cargo atua nos resultados e acompanhamentos; “Limpar filtros” restaura a visão completa. Filtrar não modifica favoritos nem cidades salvas. Novos acompanhamentos começam com o cargo escolhido no filtro.
- Gráficos estaduais de eleitorado apto, comparecimento e abstenções; votos válidos, brancos e nulos, com quantidade, percentual dos nulos e horário oficial. Cargo de referência selecionável, integrado ao filtro do painel. Categorias de votos anulados, sub judice e sem candidato aparecem quando têm votos. São gráficos separados para pessoas e votos: no Senado, cada eleitor pode votar em dois candidatos.
- Comparação lado a lado de dois a quatro candidatos acompanhados do mesmo cargo: votos, percentual, posição e diferença para o mais votado da comparação. A abrangência pode ser estadual ou qualquer cidade acompanhada para aquele cargo. A posição municipal considera todas as candidaturas daquele arquivo, respeitando empates. Ausência de resultado permanece “—”, incluindo a diferença de votos.
- Histórico estadual de votos, posição e percentual das candidaturas acompanhadas, salvo por UF neste navegador. Começa na primeira consulta com votos: não recupera atualizações anteriores ou publicadas durante o período em que o painel ficou fechado. Retém até 240 gerações por candidato e 100 candidaturas recentes; não duplica a geração e rejeita regressão de horário. Há tabela acessível e download CSV do histórico.
- Botão “Gerar imagem” nos cartões e na lista compacta: prévia e download PNG de 1080 × 1350 com candidato, cargo, UF, votos, percentual, posição, vagas, situação oficial, horário em Brasília e link do projeto. Inclui aviso de dados preservados em falha. Compartilhamento nativo de arquivo aparece quando suportado pelo navegador.
- Exportação dos candidatos e cidades selecionados em CSV UTF-8 com BOM, separador ponto e vírgula e proteção contra fórmulas em células textuais. Inclui resultado estadual e municipal, horário oficial, horário da consulta, situação e condição da fonte. CSV pode ser aberto em planilhas; campos ausentes ficam vazios.
- Lista compacta opcional, inclusive no celular, preservando votos, posição, vagas e situação. A escolha do formato fica salva no navegador. Candidatos e municípios já acompanhados aparecem primeiro nos seletores; a busca aceita nome, número, partido e federação, sem distinguir acentos.
- Tela cheia para candidatos/comparações/histórico ou mapa. Usa a API nativa com alternativa dentro da página em navegadores incompatíveis; permite sair pelo botão ou Escape.
- Votação proporcional por partido ou federação para deputados federais e estaduais/distritais: usa `tvtn` (válidos nominais) e `tvtl` (válidos de legenda) do EA20, sem inferir totais pela soma de votos de candidatos. Federações vêm dos agrupamentos oficiais `tp=f`. Eleitos são somente os confirmados pelo TSE; nenhuma projeção de vagas é calculada.
- Acessibilidade: texto maior e opção de padrões/símbolos no mapa, com preferências persistidas. Tabelas de comparação, histórico e partidos aceitam navegação por teclado e rolagem horizontal no celular.
- Mapa com liderança presidencial por votos: vermelho para Lula (13/PT), azul para Flávio Bolsonaro (22/PL), indicação distinta para empate, outro candidato ou ausência de dados. Usa os votos oficiais da própria UF; mantém percentuais de apuração e uma opção para voltar ao mapa por progresso. Clicar em uma UF no mapa ou na lista atualiza somente os detalhes no painel ao lado, sem mudar de página ou UF do menu. O botão “Abrir painel completo” permite navegar ao estado quando desejado. O painel estadual tem retorno à visão nacional. Seleção de UF também funciona por `?uf=sc` e pelo voltar/avançar do navegador. Liderança parcial não representa confirmação de eleição.
- Aba “Geral · Brasil” acima dos estados: resultado presidencial nacional, incluindo o exterior, com os dois mais votados, ranking completo e progresso nacional. Usa o arquivo BR oficial, sem somar votos de arquivos estaduais.
- Na aba Geral, quadros com os dois presidenciáveis mais votados em cada uma das 27 UFs, fotos, votos, percentuais estaduais, quantidade e percentual de votos nulos para presidente e andamento da apuração. Atualização a cada 30 segundos; falhas preservam o último resultado válido daquela UF.
- Seleção dos 26 estados e Distrito Federal. Cada seleção troca os resultados, fotos, candidaturas e catálogo municipal. No DF, o cargo local usa o código 8 e o nome deputado distrital.
- Preferências independentes por UF, preservando as escolhas anteriores de SC. Somente o estado selecionado é consultado pelo navegador; não há download de todos os resultados na primeira visita.
- Cartões acompanhados mostram posição nominal por votos e faixa de situação eleitoral oficial. A posição não produz uma projeção de eleição; o selo de confirmação exige a indicação validada do TSE.

- Presidência nacional: dois mais votados, votos, percentuais, totalização e horário oficial. Usa o arquivo BR, incluindo o exterior, sem somar arquivos estaduais.
- Panorama estadual, rankings por votos e busca por nome ou número.
- Três quadros largos abaixo da presidência para Senado, deputados federais e estaduais, no mesmo estilo visual: posições, fotos, votos, percentuais, vagas e andamento oficial. “Por posição” usa as primeiras posições nominais até o número de vagas publicado pelo TSE (2, 16 e 40 na consulta de SC), incluindo empates na última posição.
- Cada quadro permite alternar para “Eleitos confirmados”, que considera a lista completa, inclusive candidaturas fora das primeiras posições nominais. Governador mantém o resumo de eleitos no ranking.
- Acompanhamento especial de qualquer candidatura dos cinco cargos da UF selecionada, com votos, posição, percentual, situação oficial e variação de votos entre atualizações.
- Seleção múltipla de candidatos no acompanhamento municipal: o mesmo conjunto de cidades é aplicado a todos os selecionados, com verificação do limite antes de salvar.
- Mapa do Brasil com o percentual de seções totalizadas para presidente nas 27 UFs, quantidade de seções apuradas e quantas faltam em cada cartão. O detalhe da UF também mostra o total de seções. Contagem disponível nos modos de liderança e progresso, inclusive nas descrições acessíveis do mapa. “Faltam” usa o total oficial menos as seções já totalizadas; ausência de dados permanece “—”. Seleção por mouse ou teclado e atualização a cada 30 segundos. Arquivo EA14 oficial do TSE; malha geográfica simplificada do IBGE.
- Rodapé com autoria de Vitor Rodi, LinkedIn e botão para copiar a chave Pix de apoio voluntário.
- Votação municipal personalizada: cada candidato pode ter suas próprias cidades entre os municípios da UF selecionada (295 em SC). É possível editar e remover acompanhamentos. Cunhataí está disponível no catálogo oficial.
- O acompanhamento inicial solicitado pelo autor inclui Daniela Reinehr, Oscar Gutz e Massocco, identificados por nome e número no catálogo oficial, nos mesmos cartões de votos e situação oficial. Os nove municípios são Cunhataí, Riqueza, Caibi, Palmitos, Águas de Chapecó, São Carlos, Planalto Alegre, Cunha Porã e Saudades. É possível remover, editar e adicionar acompanhamentos; a configuração inicial é aplicada uma única vez e não volta após uma remoção. Preferências ficam no `localStorage` deste navegador, com uma chave por UF, sem conta ou sincronização entre dispositivos.
- Atualização a cada 15 segundos após a consulta anterior, botão manual e pausa em abas ocultas.
- Layout responsivo, diálogo nativo, seleção por teclado e busca de cidades.
- Fontes e horários oficiais em “Consultar arquivos e metodologia”.

## Executar e verificar

Node.js 22 ou superior. Não são necessárias credenciais ou variáveis de ambiente para consultar o TSE.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000.

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

## Estrutura

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, Zod e Lucide. Manrope e Barlow Condensed são hospedadas com a aplicação.

```text
app/api/elections/sc/route.ts   API e validação de consulta municipal
components/layout/             composição, atualização e preferências
components/cards/              fotos, lideranças e presidência nacional
components/tracking/           seleção de candidatos e cidades, cards
components/charts/             votação municipal e soma parcial
components/rankings/           rankings e busca
services/tse/                  cliente JWS, parser, normalização e cache
lib/preferences.ts             validação, deduplicação e seleção municipal
types/election.ts              contratos compartilhados
tests/                         testes e fixtures oficiais
```

## Fontes e integração

[Documentação técnica TSE 2026](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados), [EA20](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado) e [manual JWS](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/manual-verificacao-jws), consultados em 04/10/2026.

A descoberta começa no [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.jws), que define ciclo, diretórios, pleito e eleições. O EA12 fornece o catálogo municipal completo da UF selecionada. Os EA20 fornecem resultados nacionais, estaduais e municipais. Na validação, o ciclo foi `ele2026`, o pleito `3220`, a eleição federal `6257` e a estadual `6259`.

O arquivo nacional validado foi `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.jws`. Ele tem abrangência BR. O parser da UF rejeita arquivos de outra UF ou BR e o parser da presidência nacional rejeita resultados estaduais.

Arquivos JWS são verificados com Ed25519 (`node:crypto`) e chave pública fixada a partir do Apêndice B do manual. Chaves informadas pelo arquivo recebido não são aceitas. São rejeitados arquivos simulados, assinatura inválida, eleição, turno, cargo ou abrangência incompatíveis e números inválidos.

Candidaturas são identificadas por cargo e `sqcand`, com a configuração inicial solicitada resolvida no catálogo oficial, sem resultados inseridos manualmente. Fotos usam o diretório `ft` do EA11 e o ID oficial; presidente usa abrangência `br` e demais cargos, `sc`. Falhas de imagem exibem iniciais.

A consulta inicial usa oito arquivos: configuração eleitoral, catálogo municipal, cinco cargos estaduais e presidência nacional. Resultados municipais são consultados sob demanda. Candidatos do mesmo cargo na mesma cidade compartilham uma consulta. Todas as URLs usadas aparecem em `source.files`.

O recurso de mapa municipal consulta ainda um EA15 da UF e o EA20 presidencial da cidade selecionada. Seus arquivos e horários aparecem no próprio mapa. As malhas municipais ficam em `public/maps`, são carregadas apenas para a UF aberta e podem ser regeneradas com `python scripts/build-municipal-geometry.py` a partir da [API oficial do IBGE](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3). A integração do EA15 segue a [especificação TSE](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea15-arquivo-de-acompanhamento-uf).

## Confiabilidade e limites

- Estatísticas do EA20: `e.te` é o eleitorado apto total; `e.esa`, `e.c` e `e.a` descrevem eleitorado, comparecimento e abstenções nas seções já apuradas. Eleitores de seções pendentes nunca são classificados como abstenção. `v.tvn` já inclui os nulos técnicos (`v.vnt`); anulados e sub judice são categorias separadas. O percentual de nulos usa `ptvnn`/`ptvn` ou o total computado `tv`, nunca o percentual interno dos nulos comuns. Dados ausentes permanecem “—”; zerésima não é apresentada como zero votos apurados.
- Cabeçalho mostra seções totalizadas para governador em SC. Presidência nacional e cada ranking têm o andamento de sua própria abrangência e cargo.
- Posições são nominais, com empates. Liderança parcial não implica eleição. Deputados seguem o sistema proporcional; situação oficial é separada da posição por votos.
- Os quadros de deputados por posição não são uma projeção de vagas proporcionais. Estar entre os primeiros por votos não garante eleição. O selo de eleito exige confirmação do TSE.
- O quadro usa a indicação oficial de eleito (`e`), respeita `st` e aguarda a totalização. Para presidente e governador, `e=s` também pode indicar segundo turno; nesses cargos, a confirmação de eleição exige `st=Eleito` ou definição matemática `md=e`. Segundo turno, suplentes e não eleitos não entram no quadro.
- Presidência nacional mostra até dois nomes. Empatados compartilham posição e são ordenados por nome. Antes da totalização, nenhum nome é apresentado como mais votado.
- Antes da totalização, votos aparecem como “—”. Produção não importa fixtures.
- Dados municipais ausentes não entram na soma. Somatórios parciais indicam quantos municípios têm dados.
- Comparações usam o mesmo candidato entre duas gerações oficiais. Respostas atrasadas não substituem dados mais recentes.
- Cache de snapshot de 12 segundos por instância; configuração por cinco minutos. Carregamentos simultâneos são compartilhados.
- Máximo de seis downloads simultâneos por instância, timeout de oito segundos, ETag/Last-Modified e espera após erros: 60 segundos para 404 e 610 segundos para 403/429.
- Arquivos, períodos de espera e snapshots municipais têm retenção limitada a 200 entradas por instância. O painel permite até 30 combinações distintas de cargo e município e 50 acompanhamentos de cada tipo.
- Falhas preservam o último resultado válido disponível e mostram aviso. Cache em memória não é compartilhado entre instâncias ou reinícios. O histórico de acompanhamento é local ao navegador, sem banco de snapshots no servidor.
- Respostas saudáveis sem seleção municipal usam cache CDN (`s-maxage=10`, `stale-while-revalidate=5`). Consultas personalizadas e respostas com falha usam `no-store`.

## API

`GET /api/elections/municipal/candidate?uf=sc&office=stateDeputy&candidate=ID_TSE&cities=80594,80918` consulta uma candidatura em até 20 cidades por lote. Valida UF, cargo, ID, catálogo municipal, assinatura e abrangência dos arquivos oficiais. Retorna identificação da candidatura e linhas com votos, situação, horário, fonte e validade da consulta. Reutiliza os resultados municipais já consultados no painel; falhas preservam o último resultado válido e sinalizam `stale`. Candidato ausente no arquivo municipal permanece sem quantidade de votos, com situação explícita.

`POST /api/elections/municipal/export` recebe `{uf,candidate,rows}` do resultado da consulta e gera um arquivo Excel. O corpo é limitado e validado (tipos numéricos, municípios únicos, fontes da UF/cargo/cidade). Textos são armazenados como textos, nunca como fórmulas. O arquivo contém as linhas recebidas, sem novas consultas ou atualização automática após o download. ExcelJS é uma dependência somente do servidor, com `uuid` atualizado por override.

`GET /api/elections/br/president/states` retorna `states` com as 27 UFs, cada uma com até dois candidatos mais votados, `meta`, `stale`, `verifiedSignatures` e `source`, além de `checkedAt` e `stale` gerais. Consulta somente os arquivos presidenciais estaduais, valida assinatura e abrangência individual, limita a concorrência e mantém o último resultado válido por UF. Não produz ranking antes do início da contagem; dados ausentes permanecem indisponíveis. Em empate, exibe até dois nomes em ordem alfabética entre empatados.

`GET /api/elections/br/president` retorna todos os candidatos à Presidência no resultado nacional, `meta`, `checkedAt`, `stale` e `source`. Valida assinatura e abrangência BR, compartilha a consulta com o destaque nacional das UFs e preserva a última geração válida em falha ou regressão de horário. Antes da contagem, os registros permanecem disponíveis sem posição ou votos apresentados como resultado.

`GET /api/elections/br/progress` retorna apenas percentuais, seções e andamento das UFs para a eleição presidencial. Usa o diretório `ab` do EA11 e valida o arquivo `br-e006257-ab.jws`, incluindo assinatura, fase oficial, turno, eleição, UFs, duplicações e limites numéricos. Brasil agregado e exterior não entram no mapa. Dados ausentes continuam indisponíveis; falhas preservam o último progresso válido.

`GET /api/elections/sc?uf=sp` seleciona São Paulo; a ausência de `uf` mantém SC. São aceitas apenas as 27 siglas conhecidas, sem distinção de maiúsculas. A API rejeita municípios de outra UF e usa caches separados por UF e cargo/município.

`GET /api/elections/sc` retorna `state` com sigla e nome da UF, `status`, `updatedAt`, `checkedAt`, `stale`, `warnings`, `progress`, `leaders`, `nationalPresident`, cinco listas de candidatos de SC, `offices`, `municipalities`, `municipalResults` e `source`.

`nationalPresident` contém até dois candidatos, `meta` com progresso/horário nacional e `stale`. O resultado nacional não substitui o ranking presidencial de SC.

Exemplo de consulta personalizada:

```text
GET /api/elections/sc?regional=federalDeputy:80594,stateDeputy:80918
```

`regional` aceita pares `cargo:codigoTSE` separados por vírgula. Cargos: `president`, `governor`, `senator`, `federalDeputy`, `stateDeputy`. O código de cinco dígitos vem do EA12 e é distinto do código IBGE. Entradas inválidas, cidades fora de SC ou excesso de pares retornam HTTP 400.

`municipalResults` é indexado por `cargo:codigoTSE`. Cada entrada informa município, cargo, metadados, estado de atualização e `candidateVotes` por ID oficial. Sem pedido municipal, o objeto é vazio. Favoritos e cidades por candidato ficam no navegador; o servidor recebe apenas os pares de cargo e município necessários.

`null` representa ausência de dado. `waiting` indica zerésima validada; `unavailable` indica falha ou suspensão de divulgação.

## Publicação

O site usa Vercel, com API em Node.js. Para atualizar uma conta autenticada:

```sh
npm test
npm run lint
npm run build
npx vercel deploy --prod --yes
```

Não incluir credenciais, `.env`, cookies, `.vercel`, `node_modules` ou `.next` no repositório. A autenticação da ferramenta de publicação fica fora do projeto.

## Validação

80 testes cobrem assinaturas, parser dos cinco cargos e nacional, seleção dos dois mais votados por UF, isolamento entre estados, deputado distrital, mapa de andamento, seleção municipal múltipla, ranking, empates no limite de vagas, ausência de posições antes da contagem, confirmação de eleitos fora das primeiras posições, segundo turno, suplentes, eleição por QP/média fora do top 20, suspensão de divulgação, variações, soma parcial, preferências vazias ou inválidas, deduplicação, isolamento de cidades por candidato, consultas, catálogo de 295 municípios, carregamento sob demanda, cache, preservação em falhas, concorrência global, busca, histórico, posição municipal, exportação, agregação oficial por partido/federação e estatísticas de eleitorado/votos (nulos técnicos, zerésima, dados ausentes, zero divulgado, validação e preservação em falhas), links compartilhados, avisos por geração, ordenação/filtros, histórico de seções e acompanhamento municipal assinado e Excel municipal (zero, ausência, cobertura, fontes, tipos, horários e preservação em falhas). Fixtures oficiais são usadas exclusivamente em testes.

TypeScript, lint, build e fluxos de personalização são verificados em desktop e celular.

## Aviso de independência

Os dados eleitorais exibidos neste projeto são obtidos a partir das fontes oficiais de divulgação de resultados da Justiça Eleitoral. Este projeto é independente e não possui vínculo oficial com o Tribunal Superior Eleitoral (TSE).
