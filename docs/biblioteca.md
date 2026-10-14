# Biblioteca de exercícios

A biblioteca é um catálogo **só de consulta** que vem com a app (1158 exercícios, por grupo muscular e
equipamento: os 433 do teu catálogo mais 725 do free-exercise-db). Nada entra nos teus exercícios até tocares em **Adicionar** (Exercícios → Biblioteca).
Depois de adicionado, o exercício é teu e editas como quiseres.

## Fonte

`tools/exercise-library/catalogo-exercicios.md`: as tuas tabelas, uma secção por grupo muscular, uma
linha por equipamento, exercícios separados por vírgulas. Para acrescentar ou corrigir, edita esse
ficheiro e gera de novo:

```bash
node tools/exercise-library/build-library.mjs
```

## Como é convertida

- Vírgulas fora de parênteses separam exercícios.
- Parênteses com vírgula ou «/» são variantes, por exemplo «Puxada à frente (pega larga, fechada, …)».
  Vão para as notas do exercício ao adicionar. Os outros parênteses ficam no nome, como «(flyes)».
- O mesmo exercício com o mesmo equipamento em duas secções (Pullover em Peito e Costas, Face pull em
  Costas e Ombros) fica um só item: a primeira secção dá o músculo principal, as outras os secundários.
- Nomes iguais com equipamentos diferentes levam o equipamento: «Supino plano (halteres)» e «Supino plano (barra)».
- Músculo principal/secundários, Push/Pull, medida (carga × reps, reps, duração) e unilateral são
  inferidos por palavras-chave em `build-library.mjs`. São um ponto de partida: corrige na app depois de adicionar.
- Peso corporal, elásticos e funcional medem-se por reps; pranchas, wall sit, dead hang e carries por duração.

## IDs

Um exercício adicionado tem id `UUID v5("library:<chave>")`, onde a chave é nome + equipamento. Adicionar
o mesmo item no telemóvel e no PC dá o mesmo exercício (não duplica no sync). Adicionar de novo
depois de arquivar reativa a mesma linha.

## Cardio

Os 24 exercícios de cardio (passadeira, bicicleta, elíptica, remo, escada, ski erg) entram como tipo
CARDIO, medidos por duração, com o aparelho no nome («Passadeira: corrida contínua») e grupo «Cardio».
Distância e calorias registam-se em cada série (colunas `distance_m` e `calories_kcal`).

## Nomes em inglês e free-exercise-db (v5, outubro 2026)

- Os nomes estão em inglês (`tools/exercise-library/names-en.tsv`, por chave). O português fica em `namePt`,
  para a tradução da app; a pesquisa da biblioteca encontra pelos dois. As chaves (e os ids) não mudaram.
- Os teus exercícios que tinham o nome português da biblioteca passam ao inglês no arranque
  (`refine-stored-names.ts`): mesmo id e histórico, só o nome. Nomes que mudaste à mão ficam.
- [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domínio público, Unlicense), copiado em
  `tools/exercise-library/free-exercise-db.json`. 151 itens cruzam com o catálogo (nome + equipamento, mais a
  lista `ALIAS` no script) e ganham tipo de movimento (multi/monoarticular), nível e instruções; os outros 725 entram
  como itens novos. Músculos do free-exercise-db são só ponto de partida (a base não cita fontes).
- As instruções (inglês) estão em `library-instructions.generated.ts`, um chunk à parte que só carrega ao abrir
  um exercício na biblioteca. As imagens do free-exercise-db não entram, por agora.
