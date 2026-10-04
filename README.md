# Resultado Eleições 2026 · Santa Catarina e presidência no Brasil

Painel independente com dados oficiais do TSE. Reúne os cinco cargos do primeiro turno de 2026 em Santa Catarina e os dois candidatos a presidente mais votados no Brasil até o momento.

[Acessar o painel](https://resultado-eleicoes-2026.vercel.app/) · [Código no GitHub](https://github.com/VitorRodi/resultado-eleicoes-2026)

## Recursos

- Presidência nacional: dois mais votados, votos, percentuais, totalização e horário oficial. Usa o arquivo BR, incluindo o exterior, sem somar arquivos estaduais.
- Panorama estadual, rankings por votos e busca por nome ou número.
- Três quadros largos abaixo da presidência para Senado, deputados federais e estaduais, no mesmo estilo visual: posições, fotos, votos, percentuais, vagas e andamento oficial. “Por posição” usa as primeiras posições nominais até o número de vagas publicado pelo TSE (2, 16 e 40 na consulta de SC), incluindo empates na última posição.
- Cada quadro permite alternar para “Eleitos confirmados”, que considera a lista completa, inclusive candidaturas fora das primeiras posições nominais. Governador mantém o resumo de eleitos no ranking.
- Acompanhamento especial de qualquer candidatura dos cinco cargos em SC, com votos, percentual, situação oficial e variação de votos entre atualizações.
- Seleção múltipla de candidatos no acompanhamento municipal: o mesmo conjunto de cidades é aplicado a todos os selecionados, com verificação do limite antes de salvar.
- Mapa do Brasil com o percentual de seções totalizadas para presidente nas 27 UFs, seleção por mouse ou teclado e atualização a cada 30 segundos. Arquivo EA14 oficial do TSE; malha geográfica simplificada do IBGE.
- Rodapé com autoria de Vitor Rodi, LinkedIn e botão para copiar a chave Pix de apoio voluntário.
- Votação municipal personalizada: cada candidato pode ter suas próprias cidades entre os 295 municípios de SC. É possível editar e remover acompanhamentos. Cunhataí está disponível no catálogo oficial.
- O acompanhamento inicial solicitado pelo autor inclui Daniela Reinehr, Oscar Gutz e Massocco, identificados por nome e número no catálogo oficial, nos mesmos cartões de votos e situação oficial. Os nove municípios são Cunhataí, Riqueza, Caibi, Palmitos, Águas de Chapecó, São Carlos, Planalto Alegre, Cunha Porã e Saudades. É possível remover, editar e adicionar acompanhamentos; a configuração inicial é aplicada uma única vez e não volta após uma remoção. Preferências ficam no `localStorage` deste navegador, sem conta ou sincronização entre dispositivos.
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

A descoberta começa no [EA11 oficial](https://resultados.tse.jus.br/oficial/comum/config/ele-c.jws), que define ciclo, diretórios, pleito e eleições. O EA12 fornece o catálogo municipal completo de SC. Os EA20 fornecem resultados nacionais, estaduais e municipais. Na validação, o ciclo foi `ele2026`, o pleito `3220`, a eleição federal `6257` e a estadual `6259`.

O arquivo nacional validado foi `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.jws`. Ele tem abrangência BR. O parser de SC rejeita arquivos BR e o parser da presidência nacional rejeita resultados estaduais.

Arquivos JWS são verificados com Ed25519 (`node:crypto`) e chave pública fixada a partir do Apêndice B do manual. Chaves informadas pelo arquivo recebido não são aceitas. São rejeitados arquivos simulados, assinatura inválida, eleição, turno, cargo ou abrangência incompatíveis e números inválidos.

Candidaturas são identificadas por cargo e `sqcand`, com a configuração inicial solicitada resolvida no catálogo oficial, sem resultados inseridos manualmente. Fotos usam o diretório `ft` do EA11 e o ID oficial; presidente usa abrangência `br` e demais cargos, `sc`. Falhas de imagem exibem iniciais.

A consulta inicial usa oito arquivos: configuração eleitoral, catálogo municipal, cinco cargos estaduais e presidência nacional. Resultados municipais são consultados sob demanda. Candidatos do mesmo cargo na mesma cidade compartilham uma consulta. Todas as URLs usadas aparecem em `source.files`.

## Confiabilidade e limites

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
- Falhas preservam o último resultado válido disponível e mostram aviso. Cache em memória não é compartilhado entre instâncias ou reinícios. Não há banco de snapshots históricos.
- Respostas saudáveis sem seleção municipal usam cache CDN (`s-maxage=10`, `stale-while-revalidate=5`). Consultas personalizadas e respostas com falha usam `no-store`.

## API

`GET /api/elections/br/progress` retorna apenas percentuais, seções e andamento das UFs para a eleição presidencial. Usa o diretório `ab` do EA11 e valida o arquivo `br-e006257-ab.jws`, incluindo assinatura, fase oficial, turno, eleição, UFs, duplicações e limites numéricos. Brasil agregado e exterior não entram no mapa. Dados ausentes continuam indisponíveis; falhas preservam o último progresso válido.

`GET /api/elections/sc` retorna `status`, `updatedAt`, `checkedAt`, `stale`, `warnings`, `progress`, `leaders`, `nationalPresident`, cinco listas de candidatos de SC, `offices`, `municipalities`, `municipalResults` e `source`.

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

43 testes cobrem assinaturas, parser dos cinco cargos e nacional, seleção dos dois mais votados, ranking, empates no limite de vagas, ausência de posições antes da contagem, confirmação de eleitos fora das primeiras posições, segundo turno, suplentes, eleição por QP/média fora do top 20, suspensão de divulgação, variações, soma parcial, preferências vazias ou inválidas, deduplicação, isolamento de cidades por candidato, consultas, catálogo de 295 municípios, carregamento sob demanda, cache, preservação em falhas e concorrência global. Fixtures oficiais são usadas exclusivamente em testes.

TypeScript, lint, build e fluxos de personalização são verificados em desktop e celular.

## Aviso de independência

Os dados eleitorais exibidos neste projeto são obtidos a partir das fontes oficiais de divulgação de resultados da Justiça Eleitoral. Este projeto é independente e não possui vínculo oficial com o Tribunal Superior Eleitoral (TSE).
