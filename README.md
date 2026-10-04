# RESULTADO ELEIÇÕES 2026 — Santa Catarina

Painel independente de apuração com resultados oficiais do TSE, atualização automática, acompanhamento de Daniela Reinehr e Oscar Gutz e votação em nove municípios do Oeste catarinense.

**Site:** https://resultado-eleicoes-2026.vercel.app

**Código:** https://github.com/VitorRodi/resultado-eleicoes-2026

## Executar

Node.js 22 ou superior.

```sh
npm ci
npm run dev
```

Abra http://localhost:3000. Nenhuma credencial ou variável de ambiente é necessária para consultar o TSE.

```sh
npm test
npm run lint
npm run build
npm start
```

## Stack e estrutura

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts, Zod e Lucide. Fontes Barlow Condensed e Manrope hospedadas junto à aplicação, sem consulta externa.

```text
app/page.tsx                   painel
app/api/elections/sc/route.ts   API central
components/layout/             cabeçalho, polling, composição
components/cards/              fotos e fallback
components/tracking/           acompanhamento especial
components/charts/             gráficos regionais
components/rankings/           rankings e busca
services/tse/                  cliente, assinaturas, parser, normalização
lib/                           cache, configuração, posições, variações, soma
types/                         contrato da API
tests/                         testes e fixtures oficiais
```

## Fontes oficiais e integração

Documentação vigente de 2026, consultada em 04/10/2026:

- [Informações técnicas TSE 2026](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)
- [Instruções de download](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-instrucoes-para-download-dos-arquivos-da-divulgacao-2026)
- [EA11: eleições](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea11-arquivo-de-configuracao-de-eleicoes)
- [EA12: municípios](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea12-arquivo-de-configuracao-de-municipios)
- [EA20: resultado unificado](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado)
- [Manual JWS e chave oficial, Apêndice B](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/manual-verificacao-jws)

O cliente consome arquivos JWS oficiais. São os mesmos dados JSON, com assinatura Ed25519 verificada pelo módulo `node:crypto`. A chave pública é fixada a partir do manual oficial, nunca obtida do arquivo recebido. A aplicação rejeita arquivos simulados, assinatura inválida, eleição/turno/cargo/abrangência incompatíveis e números inválidos.

Entrada de descoberta: https://resultados.tse.jus.br/oficial/comum/config/ele-c.jws

O EA11 determina dinamicamente os diretórios, ciclo e eleições do pleito de 04/10/2026. Na validação, retornou ciclo `ele2026`, pleito `3220`, eleição federal `6257` e estadual `6259`. Deputado federal pertence à eleição estadual no modelo do TSE.

Arquivos estaduais efetivamente validados:

```text
https://resultados.tse.jus.br/oficial/ele2026/6259/config/mun-e006259-cm.jws
https://resultados.tse.jus.br/oficial/ele2026/6257/dados/sc/sc-c0001-e006257-u.jws
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc-c0003-e006259-u.jws
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc-c0005-e006259-u.jws
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc-c0006-e006259-u.jws
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc-c0007-e006259-u.jws
```

Para cada município abaixo, são consultados os cargos 0006 e 0007:

```text
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc<CODIGO>-c0006-e006259-u.jws
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc<CODIGO>-c0007-e006259-u.jws
```

Os 25 arquivos consultados (configuração, municípios, cinco cargos e dezoito resultados municipais) aparecem com suas URLs exatas em “Consultar arquivos e metodologia” e no campo `source.files` da API.

## Candidatos acompanhados

Identificados pelo nome de urna, sem adivinhar número, partido ou ID. Uma correspondência ambígua é rejeitada. Metadados validados nos EA20 de SC:

| Candidatura | Cargo | Número | Partido | sqcand |
|---|---|---|---|---|
| Daniela Reinehr | Deputada federal | 2210 | PL | 240002539382 |
| Oscar Gutz | Deputado estadual | 22470 | PL | 240002539988 |

Fotos oficiais validadas com HTTP 200:

- https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc/240002539382.jpeg
- https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc/240002539988.jpeg

Fotos são resolvidas pelo diretório `ft` do EA11 e pelo `sqcand` do EA20. Presidente usa abrangência `br`; demais cargos, `sc`. Falha de imagem mostra as iniciais. Não há fotos geradas ou coletadas em outras fontes.

## Municípios

Códigos confirmados no EA12 oficial, descobertos novamente pelo servidor a cada carga da configuração. São códigos TSE, distintos dos códigos IBGE.

| Município | Código TSE |
|---|---|
| Bom Jesus do Oeste | 81469 |
| Riqueza | 80560 |
| Caibi | 80594 |
| Palmitos | 82376 |
| Águas de Chapecó | 80098 |
| São Carlos | 83151 |
| Planalto Alegre | 80543 |
| Cunha Porã | 80918 |
| Saudades | 83410 |

Cunha Porã existe uma única vez na configuração e na soma de cada candidato. Os dois gráficos mostram apenas dados oficiais, ordenados por votos, e o andamento municipal. Municípios sem totalização mostram uma mensagem, não votos inventados. Somatórios parciais indicam quantos municípios têm dados.

## Atualização e confiabilidade

- Navegador consulta somente `/api/elections/sc` para resultados, a cada 15 segundos após a consulta anterior. Fotos são carregadas diretamente do TSE.
- Atualização manual, contagem regressiva, horário da consulta e horários oficiais por cargo.
- Polling pausa em abas ocultas. Não há consultas simultâneas no mesmo navegador.
- Cache de snapshot de 12 segundos por instância do servidor; configuração, 5 minutos. Requisições concorrentes compartilham o mesmo carregamento. CDN Vercel usa `s-maxage=10`, `stale-while-revalidate=5` em respostas válidas.
- Cliente TSE usa ETag/Last-Modified, timeout de 8 segundos e no máximo seis downloads em paralelo. Erros 404 têm espera de 60 segundos; 403/429, 610 segundos.
- Falha preserva dados anteriores e mostra aviso. O navegador também preserva seu snapshot se uma nova instância retornar sem dados. Cache em memória não garante persistência entre reinícios/cold starts; não há banco de snapshots históricos.
- Totalização global usa seções de governador em SC, com referência explícita. Cada ranking tem o progresso do próprio cargo. Não se soma totalização entre cargos.
- Posições são nominais, por votos; empates compartilham posição. Antes da totalização, não se atribui posição ou líder.
- Situação oficial e indicação de eleito são provenientes de `st`/`e`, separadas da posição nominal. Não se estima “votos para se eleger”.
- Variações comparam o mesmo candidato entre duas atualizações de votação. Atualizações recebidas fora de ordem não substituem dados mais novos.
- Só se exibe a liderança presidencial em SC; a aplicação não conclui resultado nacional pelo arquivo estadual.
- Produção nunca importa fixtures. Antes da apuração, aparece **Aguardando início da totalização**. A zerésima oficial permite mostrar 0% de seções, mas os votos ainda são exibidos como “—”.

## API

`GET /api/elections/sc` retorna `status`, `updatedAt` (hora oficial), `checkedAt` (consulta), `stale`, `warnings`, `progress`, `leaders`, cinco listas por cargo, `offices` (progresso e geração por cargo), `trackedCandidates`, `regionalMunicipalVotes` e `source`.

`null` representa ausência de dado. `waiting` é uma zerésima oficial validada; `unavailable` é ausência/falha da fonte. O aviso de indisponibilidade não é ocultado como “conectado”.

## Deploy

Publicado na Vercel com o framework Next.js e a API em Node.js. Na primeira publicação a URL pública e a API responderam HTTP 200 sem autenticação de visitante. Para atualizar:

```sh
npm test
npm run lint
npm run build
npx vercel deploy --prod --yes
```

Não publicar `.env`, credenciais, cookies, `.vercel`, `node_modules` ou `.next`. A autenticação local da Vercel pertence à ferramenta e não entra no repositório. Não é necessária variável de ambiente para esta aplicação.

## Validação

27 testes automatizados: assinatura e adulteração, estrutura dos cinco cargos, rejeição de simulado/abrangência incorreta, identificação dos dois candidatos, ranking e empates, separação de eleito/posição, suspensão de divulgação, variações, soma regional, ausência de resultado, deduplicação, cache e preservação em erro. Integração usa os 25 arquivos oficiais gravados exclusivamente para testes. Lint, TypeScript e build verificados. Layout e busca verificados em desktop e mobile.

## Disclaimer

Os dados eleitorais exibidos neste projeto são obtidos a partir das fontes oficiais de divulgação de resultados da Justiça Eleitoral. Este projeto é independente e não possui vínculo oficial com o Tribunal Superior Eleitoral (TSE).
