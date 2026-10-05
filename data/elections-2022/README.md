# Votação municipal de 2022

Dados públicos derivados do [arquivo oficial de votação nominal por município e zona do TSE](https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip), publicado no [Portal de Dados Abertos](https://dadosabertos.tse.jus.br/dataset/resultados-2022).

Cada arquivo compactado corresponde a uma UF. Contém somente o primeiro turno da eleição ordinária de 02/10/2022: nomes, ID de candidatura, número, partido, cargo, catálogo municipal e `QT_VOTOS_NOMINAIS_VALIDOS` agregados por candidatura e município. Zonas e modalidades de votação são somadas. Zero divulgado é conservado; município sem registro fica ausente. A presidência vem do membro BR; os demais cargos vêm dos membros estaduais. O membro BRASIL, que duplica esses registros, não é usado. Os CSVs completos, CPF, data de nascimento e outros dados pessoais não são publicados pelo projeto.

O campo de proveniência de cada arquivo registra URL, ETag e última modificação do ZIP, além de CRC32, SHA-256 e contagem das linhas dos membros usados. A extração valida os tamanhos e CRC32 antes de agregar. Estes dados não usam a validação JWS da divulgação de 2026.

Para regenerar, a partir da raiz do projeto:

```sh
python scripts/build-history-2022.py --work /caminho/fora/do/projeto/history-2022 --output data/elections-2022
```

O script usa HTTP Range para obter apenas os membros necessários, sem baixar a duplicação BRASIL. Os arquivos temporários devem ficar fora do projeto. `--states SC DF` permite atualizar apenas algumas UFs. As rotas de histórico e Excel incluem os arquivos por meio de `outputFileTracingIncludes`; os dados não são enviados no carregamento inicial do site.

A correspondência com 2026 exige nome completo normalizado e único nesta UF. Não usa número, partido ou nome de urna para inferir identidade. A interface permite conferir e escolher a candidatura histórica, inclusive quando houve mudança de cargo. A comparação é municipal e permanece na UF selecionada; dados ausentes não viram zero.
