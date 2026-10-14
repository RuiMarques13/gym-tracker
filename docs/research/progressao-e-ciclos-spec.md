# Progressão e ciclos na app: especificação

Oct 14, 2026 · @Rui

## Visão

A app passa de registar o treino a sugerir o próximo passo: que carga usar, quando mudar o estímulo, como está o ritmo do peso face ao objetivo, e em que fase de um ciclo o utilizador está. Tudo é sugestão: o utilizador aceita, ajusta ou ignora, e a app aprende com o que ele faz de facto.

**Quatro capacidades novas:**

1. **Próxima carga** por exercício, antes de cada série, a partir das últimas sessões.
2. **Mudar o estímulo** quando um exercício ou um músculo estagna: mais volume, outra faixa de repetições, outro exercício ou uma semana de descarga.
3. **Objetivo e corpo**: hipertrofia, força, perda de gordura ou manutenção, cada um com o seu ritmo de peso e os seus sinais.
4. **Ciclos**: macrociclo, mesociclos e semanas, criados a partir de templates e ligados aos treinos planeados.

**Regra de origem.** Cada regra no código leva uma de duas marcas, visível no ecrã de ajuda:

- **Fonte**: o número vem de uma fonte aberta do estudo (por exemplo, subir 2–10% após 1–2 repetições acima do alvo, ACSM 2009).
- **Escolha da app**: não há número na literatura e a app precisa de um (por exemplo, quantas sessões sem progresso contam como estagnação). Estes valores são editáveis nas definições e o documento diz sempre qual é qual.

A base é o estudo [Periodização e progressão de carga](https://claude.ai/code/artifact/11a4b26e-c7e3-4e73-b52e-6966e5779e7d); as fontes novas desta especificação estão no fim.

## Sugestão de carga: quando e quanto subir

A app sobe a carga quando todas as séries de trabalho chegam ao topo da faixa de repetições em duas sessões seguidas, e sobe 2–10% (menos em exercícios de músculos pequenos, mais nos de músculos grandes). É a regra do ACSM 2009 (categoria B) aplicada a uma faixa de repetições; entre subidas, a progressão faz-se por repetições, que Plotkin 2022 mostrou dar hipertrofia parecida à de subir a carga.

&#91;embedded content: decisão da próxima carga · 3 perguntas, 3 resultados\]

Entre subidas a carga mantém-se e a progressão faz-se por repetições; a subida só aparece quando a faixa fica curta duas vezes seguidas.

**Entradas por exercício.**

- Faixa de repetições (mín–máx) no treino, em vez de um número só. Por defeito vem do objetivo (secção Objetivos).
- Séries de trabalho das últimas sessões desse exercício: carga, repetições, RIR. As de aquecimento não contam.
- Tipo de exercício: multiarticular ou monoarticular. É um campo novo, pré-preenchido na biblioteca e editável.
- Incremento do material (barra, halteres, máquina, polia). Definição do utilizador, porque nenhuma fonte dá incrementos em kg.

**Regras.**

| Situação | Sugestão | Origem |
| --- | --- | --- |
| Todas as séries no topo da faixa em 2 sessões seguidas | Subir a carga 2–10%: perto de 2% nos monoarticulares e perto de 10% nos multiarticulares de músculos grandes; o alvo volta ao mínimo da faixa | Fonte: ACSM 2009, categoria B |
| Arredondar a carga sugerida | Ao incremento do material mais próximo, sem passar 10% | Escolha da app |
| O menor incremento passa 10% (halteres leves, máquinas com placas grandes) | Manter a carga e subir repetições acima da faixa, ou acrescentar uma série | Escolha da app, compatível com Plotkin 2022 |
| Dentro da faixa | Manter a carga e tentar +1 repetição nas séries abaixo do topo | Fonte: Plotkin 2022 (progressão por repetições) |
| Topo da faixa com RIR 4 ou mais | Pode subir já na sessão seguinte, sem esperar a segunda | Escolha da app; a autorregulação pelo desempenho do dia teve melhores resultados que a linear num estudo com 23 atletas (Mann 2010) |
| Abaixo do mínimo da faixa em 2 sessões seguidas | Baixar a carga para o valor da última sessão boa e verificar estagnação (secção seguinte) | Escolha da app |
| Exercício unilateral | Decide pelo lado mais fraco | Escolha da app |
| Peso corporal, elástico ou duração | Subir repetições ou tempo dentro da faixa, depois uma série; sugerir uma variante mais difícil | Escolha da app; nenhuma fonte aberta dá regra |

**Exemplo.** Supino com barra, faixa 8–12, incremento 2,5 kg. Duas sessões seguidas com 3×12 a 60 kg. Multiarticular de músculo grande: a app sugere 62,5 kg (+4,2%, dentro dos 2–10%) e alvo de 8 repetições. Numa elevação lateral a 8 kg com halteres de 2 em 2 kg, o próximo halter seria +25%: a app sugere ficar nos 8 kg e fazer 13–15 repetições antes de mudar.

**As contas são da app, não tuas.** Quando a regra manda subir, a app calcula o intervalo de 2–10% em kg, lista as cargas que o teu material permite dentro dele, e escolhe uma:

| Passo | Supino, barra, 60 kg, incremento 2,5 kg | Elevação lateral, halteres, 8 kg, de 2 em 2 kg |
| --- | --- | --- |
| Intervalo de 2–10% | 61,2–66 kg | 8,16–8,8 kg |
| Cargas possíveis no intervalo | 62,5 kg e 65 kg | nenhuma (o próximo halter é 10 kg, +25%) |
| Escolha | 62,5 kg: a mais próxima de +6% nos multiarticulares | Fica nos 8 kg; alvo passa a 13–15 repetições |
| O que vês | «Sobe para 62,5 kg (podes ir até 65 kg)» | «Mantém 8 kg, faz até 15 repetições antes de passar a 10 kg» |

Nos monoarticulares a app escolhe a carga possível mais baixa do intervalo; nos multiarticulares, a mais próxima de +6% (meio do intervalo). O ACSM 2009 só diz «menos nos músculos pequenos, mais nos grandes», por isso estes dois pontos de escolha são escolhas da app, editáveis. A outra carga possível aparece sempre ao lado, para escolheres com um toque.

**O que a app mostra.** No cartão do exercício, na sessão: «Hoje: 62,5 kg × 8–12 (subiste: 2 sessões no topo)», com um toque para ver porquê e outro para recusar. A série nova já vem pré-preenchida com a carga sugerida em vez da carga anterior. Recusar não muda a regra: a app volta a sugerir na sessão seguinte.

## Mudar o estímulo: estagnação e respostas

Quando um exercício deixa de progredir, a app propõe por esta ordem: verificar a fadiga e fazer descarga, subir o volume do músculo em cerca de 20%, mudar a faixa de repetições, e só por último trocar o exercício por um parecido. Nenhuma fonte define estagnação em números, por isso os limiares são escolhas da app; as respostas têm fonte.

**Deteção (escolhas da app, editáveis):**

- **Exercício estagnado:** 3 sessões seguidas sem subir carga, sem subir repetições na mesma carga e sem melhorar o 1RM estimado. Conta só com 2 ou mais séries de trabalho por sessão.
- **Desempenho a cair:** o melhor 1RM estimado dos exercícios principais desce mais de 2% por semana durante 2 semanas. É o limiar que a app já usa no modo cut (`volume-rules.ts`), passa a valer para todos os objetivos.
- **Sinais de fadiga:** esforço da sessão (sRPE) alto em várias sessões, séries com RIR 0 onde o alvo era 1–3, dor muscular forte registada no ecrã de recuperação.

**Respostas, por ordem:**

| Ordem | Resposta | O que a fonte diz | Fonte |
| --- | --- | --- | --- |
| 1 | Se há sinais de fadiga ou o desempenho cai: semana de descarga, com menos séries ou dias e a mesma carga | Descarregar quando o atleta se sente fatigado (100% de acordo) e reduzir o volume mantendo a intensidade (95,2%) | Bell 2023 (consenso Delphi) |
| 2 | Sem fadiga: subir as séries semanais do músculo em cerca de 20%, até ao máximo do nível | Subir no máximo \~20% por ciclo de \~4 semanas (IUSCA). Num estudo dentro do mesmo sujeito, subir 20% face ao volume habitual deu mais hipertrofia que um volume fixo (Scarpelli 2020, como descrito por Barsuhn 2025). Subir 120% não deu mais que subir 20% (Camargo) | IUSCA 2021; Barsuhn 2025; Camargo |
| 3 | Se já está no máximo de volume: mudar a faixa de repetições (por exemplo de 8–12 para 5–8 ou 12–20) | A hipertrofia não difere entre cargas baixas, moderadas e altas quando as séries chegam perto da falha; a força pede carga alta (Lopez 2021). Combinar faixas pode ajudar, com evidência preliminar (IUSCA) | Lopez 2021; IUSCA 2021 |
| 4 | Trocar o exercício por um parecido para o mesmo músculo, de preferência um que o carregue em comprimento longo | Variação sistemática pode ajudar a hipertrofia regional e a força; variação excessiva ou aleatória pode prejudicar (Kassiano 2022, 8 estudos). Num ensaio com 70 mulheres, exercícios fixos e variados deram ganhos semelhantes (Kassiano 2024) | Kassiano 2022; Kassiano 2024; IUSCA 2021 |

**O que não fazer, segundo as fontes:** mais volume não é sempre melhor. Em 29 homens treinados, manter cerca de 14 séries semanais deu a mesma hipertrofia do quadríceps que subir 30% ou 60%, e mais 1RM (Barsuhn 2025, com o estudo sem potência estatística suficiente segundo os autores). Por isso a resposta 2 tem teto e não se repete sem nova estagnação.

**Como aparece na app.** Um cartão «Supino estagnado há 3 sessões» no fim da sessão e na Home, com a resposta sugerida, o porquê e a fonte. Aceitar a resposta altera o treino ou o ciclo (por exemplo, acrescenta uma série ou marca a semana seguinte como descarga); recusar esconde o cartão até nova deteção.

## Objetivos e corpo

Cada objetivo muda três coisas na app: a faixa de repetições por defeito, o volume e o ritmo de peso que a app vigia. Na perda de gordura, o treino de força serve sobretudo para manter o músculo: numa meta-análise de 6 ensaios com pessoas mais velhas e obesas, juntar treino de força à restrição calórica evitou quase toda a perda de massa magra (diferença de 0,82 kg), mas a perda de gordura foi igual com e sem treino (Sardeli 2018).

| Objetivo | Repetições por defeito | Volume e esforço | Ritmo de peso que a app vigia | Fontes |
| --- | --- | --- | --- | --- |
| Hipertrofia (com ganho de peso) | 8–12 | Faixas atuais por nível, com o máximo do avançado limitado a 20; RIR 1–3 | +0,25 a 0,5% do peso por semana em iniciantes e intermédios; mais devagar em avançados | ACSM 2009 (8–12, A); IUSCA 2021; Iraki 2019 |
| Força (novo) | 8–12 no iniciante; 4–6 no intermédio e avançado | 2–3 séries por exercício a cerca de 80% de 1RM; descanso de 2–3 min nos principais | Não vigia | ACSM 2026 (comunicado); ACSM 2009 (1–6 RM no avançado; 4–6 é escolha da app dentro dessa faixa) |
| Perda de gordura (cut) | Mantém a do objetivo anterior | Mantém a carga; volume como antes, reduzido 25% se o desempenho cair 2 semanas (regra atual, escolha da app) | −0,5 a −1% do peso por semana; aviso acima de 1% | Helms 2014 (0,5–1%/semana); Garthe 2011 (0,7%/semana deu +2,1% de massa magra; 1,4%/semana não a alterou) |
| Manutenção | Mantém | Faixas atuais (3–8 séries abaixo dos 60 anos, 4–10 acima) | Peso estável | As fontes que o código cita não foram abertas; ficam marcadas como não verificadas |

**Como a app mede o ritmo de peso.** Média dos registos de peso dos últimos 7 dias contra a dos 7 dias anteriores, em % do peso. Precisa de pelo menos 3 pesagens em cada janela; com menos, a app não conclui nada. A janela e o mínimo de pesagens são escolhas da app.

**Sinais e mensagens (exemplos):**

- Cut a perder 1,4% por semana durante 2 semanas: «Estás a perder mais de 1% por semana. Ritmos mais lentos preservaram melhor a massa magra (Garthe 2011, Helms 2014).»
- Hipertrofia com peso a subir 0,8% por semana: «Estás acima dos 0,25–0,5% por semana que Iraki 2019 propõe para iniciantes e intermédios.»
- Hipertrofia com peso parado 4 semanas e exercícios estagnados: a app junta os dois sinais e sugere rever a alimentação, além das respostas da secção anterior.

**Fora do âmbito da app.** As fontes dão também valores de proteína (1,6–2,2 g/kg/dia no ganho, Iraki 2019; 2,3–3,1 g/kg de massa magra em definição, Helms 2014) e de calorias. A app não regista alimentação, por isso estes valores só aparecem como informação no ecrã do objetivo, com a fonte, e nunca como cálculo. Estas recomendações foram escritas para culturistas e atletas.

## Ciclos: macro, meso e microciclo

Os ciclos são um plano por cima dos treinos que já existem: o macrociclo junta mesociclos, cada mesociclo junta semanas, e cada semana diz que faixa de repetições, que volume e que esforço usar. O template por defeito é o mais simples, sem periodização, porque o ACSM 2026 não achou vantagem consistente da periodização complexa em adultos saudáveis; os outros ficam disponíveis para quem quer força ou variedade.

**Os três níveis na app.**

- **Macrociclo:** um objetivo e uma data de início e fim, por exemplo «Hipertrofia até junho». Evans 2019 descreve-o como o ciclo mais longo, normalmente um ano.
- **Mesociclo:** um bloco de semanas com um foco (base, volume, força, cut, descarga). Evans 2019 dá cerca de um mês; na app vai de 3 a 8 semanas.
- **Microciclo:** a semana de segunda a domingo que a app já usa nos Planeados. Cada semana tem um tipo (normal, sobrecarga, descarga, teste) e três ajustes: faixa de repetições, multiplicador de séries e RIR alvo.

&#91;embedded content: macro, meso e microciclo · exemplo de 24 semanas\]

O mesociclo em destaque é o template Hipertrofia por volume aberto semana a semana; o cut não tem descarga marcada, só a que a app sugere se o desempenho cair.

**Templates de partida.** Os números de cada semana são escolhas da app construídas a partir das fontes indicadas; o utilizador pode editar tudo.

| Template | Para quem | Estrutura | Base |
| --- | --- | --- | --- |
| Simples (por defeito) | Qualquer objetivo, sobretudo saúde e hipertrofia | Faixa fixa, progressão de carga e repetições, descarga só quando a app deteta fadiga | ACSM 2026 (periodização complexa sem vantagem consistente); Bell 2023 (descarga quando há fadiga) |
| Iniciante | Primeiros meses ou regresso | 2–3 treinos por semana, 1–3 séries, 8–12 repetições, RIR 2–3, sem falha | ACSM 2009 (noviço, A); IUSCA 2021 (noviços crescem sem treinar perto da falha) |
| Hipertrofia por volume | Intermédio ou avançado | Mesociclo de 4 semanas: semana 1 com o volume habitual e RIR 3, semanas 2 e 3 a subir séries até +20% no total e RIR até 1, semana 4 de descarga com menos séries e a mesma carga | IUSCA 2021 (subir volume e acabar com recuperação, sem evidência empírica; no máximo \~20% por ciclo); Bell 2023 (descarga na última semana do mesociclo, 95,2%) |
| Força linear | Quem quer força máxima | 3 mesociclos de 4 semanas: 8–12, depois 6–8, depois 3–6 repetições, cada um com a última semana de descarga; teste de 1RM opcional no fim | ACSM 2009 (de 1–12 RM para 1–6 RM no avançado); Williams 2017 (periodizado > não periodizado na força) |
| Ondulatório | Quem treina o mesmo músculo 3× por semana e quer variar | Cada treino da semana com uma faixa diferente (por exemplo 12–15, 8–10, 4–6) | Williams 2017 (ondulatório à frente do linear na força, resultado equívoco); IUSCA 2021 (combinar faixas, preliminar) |
| Cut | Perda de gordura | Mantém treinos e cargas; semana de descarga se o desempenho cair 2 semanas; vigia o ritmo de peso | Sardeli 2018; Helms 2014; Garthe 2011 |

**Mudança de mesociclo.** Na última semana de cada mesociclo a app mostra um resumo (séries por músculo, cargas, exercícios estagnados, ritmo de peso) e propõe o próximo: repetir com mais volume, mudar de faixa ou passar a outro foco. É aqui que entram as respostas à estagnação da secção anterior, num momento planeado em vez de a meio da semana.

**Exemplo de macrociclo (24 semanas, hipertrofia com fase de força).** 2 mesociclos de hipertrofia por volume (8 semanas), 1 de força com 6–8 repetições (4 semanas), 2 de hipertrofia (8 semanas), 1 de cut (4 semanas). A ordem e as durações são exemplo, não recomendação de nenhuma fonte.

## Valores por capacidade

O ACSM 2009 é a única fonte aberta que dá valores para as quatro capacidades e os três níveis, com grau de evidência (A = ensaios aleatórios com muitos dados; B = poucos dados ou meta-análises; C = estudos não aleatórios; D = consenso do painel). A app usa esta tabela como valores por defeito de cada objetivo e template; onde o ACSM 2026 atualiza um valor, a nota diz qual.

| Capacidade e nível | Carga e repetições | Séries | Descanso | Velocidade | Treinos por semana |
| --- | --- | --- | --- | --- | --- |
| Força, noviço | 60–70% de 1RM, 8–12 (A) | 1–3 (A) | Principais 2–3 min (B); assistência 1–2 min (C) | Lenta e moderada (A) | 2–3 (A) |
| Força, intermédio | 60–70% de 1RM, 8–12 (A) | Várias, a variar volume e intensidade (B) | Igual ao noviço | Moderada (A) | 3–4 (B) |
| Força, avançado | 80–100% de 1RM (A); resumo: 1–12 RM periodizado com ênfase em 1–6 RM | Várias (B) | Resumo: 3–5 min | De involuntariamente lenta a rápida (C) | 4–6 (C) |
| Hipertrofia, noviço e intermédio | 70–85% de 1RM, 8–12 (A) | 1–3 (A) | 1–2 min (C) | Lenta a moderada (C) | 2–3 noviço (A); 3–4 intermédio (B) |
| Hipertrofia, avançado | 70–100% de 1RM, 1–12, periodizado, ênfase em 6–12 (A na tabela, C no texto) | 3–6 | Principais 2–3 min; outros 1–2 min (C) | Lenta, moderada e rápida (C) | 4–6 (C) |
| Potência, noviço e intermédio | 30–60% de 1RM no tronco superior, 0–60% no inferior, 3–6 repetições (A) | 1–3 (A) | Principais 2–3 min; assistência 1–2 min (D) | Rápida | 2–3 noviço; 3–4 intermédio (C) |
| Potência, avançado | 85–100% de 1RM mais cargas leves a moderadas explosivas, 1–6 repetições, periodizado (B) | 3–6 (B) | Igual | Rápida | 4–5 (C) |
| Resistência muscular, noviço e intermédio | Carga leve, 10–15 repetições (A); resumo: 40–60% de 1RM | Várias | 1–2 min para 15–20 ou mais repetições; menos de 1 min para 10–15 (C) | Intencionalmente lenta em 10–15; moderada a rápida em 15–25 ou mais (B) | 2–3 noviço (A); 3–4 intermédio |
| Resistência muscular, avançado | Várias séries de 10–25 ou mais repetições, cargas leves, periodizado (C) | Várias | Igual | Igual | 4–6 (C) |

**Atualizações do ACSM 2026 (só pelo comunicado).** Força: cerca de 80% de 1RM em 2–3 séries por exercício. Hipertrofia: cerca de 10 séries por grupo muscular por semana. Potência: 30–70% de 1RM, o mais rápido possível na fase de subida. Todos os grupos grandes pelo menos 2× por semana. Os restantes valores do ACSM 2026 ficam por confirmar no artigo.

**Carga em % de 1RM e repetições.** Lopez 2021 usa esta correspondência, útil para a app converter: carga baixa < 60% de 1RM (mais de 15 RM), moderada 60–79% (9–15 RM), alta ≥ 80% (até 8 RM). A app já calcula o 1RM estimado, por isso pode mostrar a carga alvo em kg a partir da percentagem.

**Limites na app.** A app não mede a velocidade da barra, por isso a velocidade aparece só como instrução no exercício. A potência e a resistência muscular entram como objetivos e templates numa fase posterior, depois de hipertrofia e força.

## Alargar a biblioteca de exercícios

A biblioteca tem hoje 445 exercícios, gerados a partir do teu catálogo (`tools/exercise-library/catalogo-exercicios.md`). A melhor base aberta para alargar é o free-exercise-db: 876 exercícios em domínio público (licença Unlicense), cada um com equipamento, nível, tipo de movimento, instruções e imagens. Serve como lista e como descrição; os músculos por exercício continuam a vir do estudo dos músculos, porque a base não cita fontes.

**O que o free-exercise-db traz (contado no ficheiro):**

| Campo | Valores | Uso na app |
| --- | --- | --- |
| `mechanic` | compound 491, isolation 298, vazio 87 | Pré-preencher o campo multiarticular ou monoarticular (descanso e incremento) |
| `force` | pull 371, push 371, static 104, vazio 30 | Completar o tipo de movimento (Push, Pull) e marcar isométricos |
| `level` | beginner 525, intermediate 294, expert 57 | Filtrar sugestões de troca de exercício pelo nível do utilizador |
| `equipment` | barbell 170, dumbbell 123, other 122, body only 111, cable 81, vazio 77, machine 67, kettlebells 56, bands 20 e outros | Ligar ao equipamento da app e ao incremento do material |
| `category` | strength 584, stretching 123, plyometrics 61, powerlifting 38, olympic weightlifting 35, strongman 21, cardio 14 | Pliométricos e olímpicos para o objetivo de potência; alongamentos para a mobilidade |
| `instructions`, `images` | Passos em inglês e duas imagens por exercício | Ecrã do exercício, traduzido para português |
| `primaryMuscles`, `secondaryMuscles` | 17 grupos genéricos, sem fonte | Só como ponto de partida; os papéis e as porções vêm do estudo dos músculos |

**Ficha de cada exercício na app (campos novos a negrito):** nome em português e sinónimos; equipamento; **multiarticular ou monoarticular**; **padrão de movimento** (agachamento, dobradiça da anca, empurrar horizontal ou vertical, puxar horizontal ou vertical, isolamento, transporte, core); unilateral; isométrico; **nível**; músculos com papel, confiança e fonte; **carrega o músculo em comprimento longo** (só quando há estudo, por exemplo leg curl sentado ou extensão de tríceps por cima da cabeça); instruções; imagem; **variantes** (mais fácil, mais difícil, mesmo músculo) para a troca de exercício e para a progressão com peso corporal.

**Processo, por grupo muscular:**

1. Cruzar o free-exercise-db com o teu catálogo pelo nome e equipamento; listar os que faltam.
2. Escolher os que entram (tu decides; proponho começar pelos que têm imagens e nível iniciante ou intermédio).
3. Traduzir e preencher os campos novos; o padrão de movimento e as variantes são escolhas da app, revistas por ti.
4. Atribuir os músculos segundo o estudo dos músculos: confiança A quando um estudo testou o exercício, B quando herda do mais parecido, C só por anatomia.
5. Para os exercícios que mais usas (pelo teu histórico), procurar estudos específicos e subir a confiança.

**A verificar antes de começar:** a licença das imagens (o repositório diz Unlicense para o conjunto) e outras bases abertas, como a wger, que ainda não abri.

## Ecrãs e interações

As sugestões aparecem onde a decisão se toma: a carga no cartão do exercício durante a sessão, a estagnação e o ritmo de peso no fim da sessão e na Home, e a mudança de estímulo na passagem de mesociclo. Todas têm um «Porquê?» com a regra, a marca Fonte ou Escolha da app, e a ligação à fonte.

| Ecrã | O que muda |
| --- | --- |
| Sessão: cartão do exercício | Linha «Hoje: 62,5 kg × 8–12» com a razão curta; a série nova vem com a carga sugerida; depois de cada série, indicação discreta «topo da faixa» ou «faltam 2 repetições» |
| Sessão: fim | Resumo «Próxima vez» por exercício (subir, manter, baixar) e cartões de estagnação, se houver |
| Home | Widget «Ciclo» (mesociclo, semana 3 de 4, próxima semana de descarga) e widget «Sugestões» (estagnação, fadiga, ritmo de peso) |
| Ciclos (novo) | Lista de macrociclos; criar a partir de um template; linha do tempo dos mesociclos e semanas; editar o tipo de cada semana e os três ajustes; resumo ao fechar cada mesociclo |
| Editor de treinos | Faixa de repetições (mín–máx) em vez de um número; descanso sugerido pelo tipo de exercício (pelo menos 2 min em multiarticulares, 60–90 s em monoarticulares, IUSCA 2021) |
| Exercício | Campo multiarticular ou monoarticular |
| Perfil | Objetivo com Força; ritmo de peso alvo; nível sugerido pelo histórico, com confirmação |
| Corpo | Gráfico do peso com a média semanal e a faixa de ritmo do objetivo |
| Definições → Progressão | Incrementos por material, limiares de estagnação, janela do ritmo de peso, descarga automática ligada ou desligada |
| Ajuda → Regras e fontes | Todas as regras numa lista, cada uma com a marca, o valor e a fonte |

**Princípios de interface.** Uma sugestão de cada vez por exercício; nada bloqueia o registo; recusar é um toque; a app nunca muda um treino ou um ciclo sem o utilizador aceitar.

## Modelo de dados e código

As regras ficam em código puro e testado, como já acontece com `volume-rules.ts`; a base de dados só guarda o que o utilizador cria (ciclos, faixas, incrementos) e o histórico das sugestões. Tudo sincroniza com o Supabase, como os treinos.

**Alterações a tabelas existentes:**

| Tabela | Colunas novas | Notas |
| --- | --- | --- |
| `exercise` | `mechanic` (COMPOUND, ISOLATION ou vazio), `pattern`, `level` | Pré-preenchidas pela biblioteca; editáveis |
| `planned_exercise` | `target_reps_min`, `target_reps_max`, `target_rir` | `target_reps` antigo passa a `target_reps_max`; o mínimo por defeito vem do objetivo |
| `equipment` | `increment_kg` | Valor do utilizador; vazio = a app não arredonda e avisa |
| `scheduled_workout` | `cycle_week_id` | Liga o treino planeado à semana do ciclo |

**Tabelas novas:**

| Tabela | Campos principais | Para quê |
| --- | --- | --- |
| `training_cycle` | nome, objetivo, início, fim, template de origem, notas | O macrociclo |
| `cycle_block` | ciclo, posição, nome, foco, número de semanas | Os mesociclos |
| `cycle_week` | bloco, número da semana, tipo (normal, sobrecarga, descarga, teste), repetições mín e máx, multiplicador de séries, RIR alvo | Os microciclos e os seus ajustes |
| `suggestion` | tipo (carga, estagnação, ritmo de peso, descarga, fim de mesociclo), exercício ou músculo, regra, valores, estado (mostrada, aceite, recusada), sessão | Para não repetir sugestões recusadas e para medir se as aceites funcionaram |

**Código novo em `core/progression`:**

- `rules.ts`: cada regra com chave, valor, marca (Fonte ou Escolha da app) e referência à fonte. É a mesma lista que aparece em Ajuda → Regras e fontes.
- `load.ts`: `suggestLoad(histórico, faixa, mecânica, incremento)` devolve subir, manter ou baixar, a carga e a razão.
- `stagnation.ts`: `detectStagnation` por exercício e por músculo, e a resposta seguinte da lista.
- `body.ts`: ritmo de peso com médias de 7 dias e o aviso do objetivo.
- `cycles.ts`: templates como dados, criar um ciclo a partir de um template, e saber em que semana se está.
- Uma única fórmula de 1RM estimado partilhada por métricas e gráficos.

**Definições novas** (no registo existente, sem migração): limiar de estagnação em sessões, queda de desempenho por semana, janela e mínimo de pesagens, descarga automática, mostrar ou não as fontes nos ecrãs.

A numeração das migrações fica para a implementação, porque o plano dos músculos também pede uma.

## Fases de implementação e testes

A ordem vai do que dá valor em todas as sessões (a próxima carga) para o que muda a forma de planear (os ciclos). Cada fase fica utilizável sozinha e entra no APK e na PWA quando acaba.

1. **Base.** Uma fórmula de 1RM; máximo do avançado limitado a 20 séries; `rules.ts` com as marcas; ecrã Ajuda → Regras e fontes.
2. **Próxima carga.** Campos `mechanic`, faixa de repetições e incremento por material; `suggestLoad`; sugestão no cartão do exercício e pré-preenchimento; resumo «Próxima vez» no fim da sessão; descanso sugerido por tipo de exercício.
3. **Estagnação e descarga.** `detectStagnation`, cartões de estagnação e fadiga, tabela `suggestion`, semana de descarga aplicada aos treinos.
4. **Objetivos e corpo.** Objetivo Força; ritmo de peso e avisos; nível sugerido pelo histórico.
5. **Ciclos.** Tabelas dos ciclos, templates, ecrã Ciclos, widget na Home, resumo de fim de mesociclo.
6. **Biblioteca.** Cruzar com o free-exercise-db, traduzir, campos novos e variantes, por grupo muscular, com a tua revisão.
7. **Potência e resistência muscular.** Objetivos e templates com a tabela de valores por capacidade.

**Testes por fase:**

- Testes unitários das regras com casos da especificação: o exemplo do supino (60 kg → 62,5 kg), o halter de 8 kg que não sobe, o unilateral pelo lado mais fraco, o RIR 4 que antecipa a subida.
- Dados de demonstração (`demo-data.ts`) com 12 semanas, estagnação e descarga, para ver os cartões no ecrã.
- Testes de migração e de sincronização das tabelas novas, como os atuais.
- Teste e2e no browser: sessão com sugestão aceite, sessão com sugestão recusada, criação de um ciclo a partir de template.
- No telemóvel: uma semana real de treino com sugestões ligadas antes de passar à fase seguinte.

## Decisões para ti

Com estas respostas posso começar a fase 1 e 2. As propostas por defeito estão entre parênteses.

- **Sugestão de carga:** pré-preencher a série com a carga sugerida, ou só mostrar a sugestão e manter a carga anterior? (Pré-preencher.)
- **Incrementos por material:** quais usas? (Barra 2,5 kg, halteres 2 kg, máquinas e polias 5 kg; ajustáveis por equipamento.)
- **Estagnação:** 3 sessões sem progresso chega, ou preferes mais tempo? (3 sessões.)
- **Descarga automática:** a app sugere quando deteta fadiga, ou só nas semanas marcadas no ciclo? (As duas, sugestão desligada até a ativares.)
- **Objetivo Força:** entra já na fase 4 ou depois dos ciclos? (Fase 4.)
- **Nível:** passa a ser sugerido pelo histórico, com a tua confirmação? (Sim.)
- **Ciclos:** começas com o template Simples e passas aos outros quando quiseres? (Sim; os ciclos são opcionais e a app funciona sem eles.)
- **Fontes no ecrã:** mostrar a fonte em cada sugestão, ou só em Ajuda → Regras e fontes? (No «Porquê?» de cada sugestão.)
- **Biblioteca:** importar do free-exercise-db só os que têm imagem, ou todos os 876 para escolheres? (Uma lista dos que faltam, por grupo, para escolheres.)

## Fontes

As fontes do estudo anterior (ACSM 2009 e 2026, IUSCA 2021, Bell 2023, Plotkin 2022, Lopez 2021, Williams 2017, Evans 2019 e outras) estão listadas, com ligações, em [Periodização e progressão de carga](https://claude.ai/code/artifact/11a4b26e-c7e3-4e73-b52e-6966e5779e7d). Abaixo, só as novas, todas abertas; a nota diz o que li.

**Estímulo e volume**

- Kassiano et al. 2022, variação de exercícios, revisão sistemática: [registo na base LIDA](https://lida.sport-iat.de/ta/Record/4077216?lng=en) (só o resumo)
- Kassiano et al. 2024, exercícios fixos contra variados em 70 mulheres: [registo na ECU](https://ro.ecu.edu.au/ecuworks2022-2026/4912) (resumo)
- Barsuhn et al. 2025, manter contra subir 30% ou 60% o volume: [PDF no repositório da AUT](https://openrepository.aut.ac.nz/server/api/core/bitstreams/4f83ffc5-1aad-4dc8-92fb-1c28156b3211/content) (artigo; é também de onde vem a descrição de Scarpelli 2020, que não abri)
- Camargo et al., subir 20% contra 120% o volume: [PDF alojado por terceiros](https://www.fisiologiadelejercicio.com/wp-content/uploads/2026/07/Large-increases-in-resistance-training-volume-do-not-impair-muscle-hypertrophy.pdf) (artigo do Journal of Applied Physiology; o ano não aparece no PDF)
- Mann et al. 2010, progressão autorregulada contra linear: [registo na Universidade de Miami](https://scholarship.miami.edu/esploro/outputs/journalArticle/THE-EFFECT-OF-AUTOREGULATORY-PROGRESSIVE-RESISTANCE/991031785742302976) (só o resumo; as regras exatas do método não estão lá)

**Corpo e objetivos**

- Helms, Aragon e Fitschen 2014, preparação de culturismo natural: [PDF na Springer](https://link.springer.com/content/pdf/10.1186/1550-2783-11-20.pdf)
- Garthe et al. 2011, dois ritmos de perda de peso em atletas: [registo na base LIDA](https://lida.sport-iat.de/ta/Record/4020931?lng=en) (só o resumo)
- Iraki et al. 2019, alimentação de culturistas fora de competição: [MDPI Sports](https://mdpi.com/486090)
- Sardeli et al. 2018, treino de força durante restrição calórica: [MDPI Nutrients](https://www.mdpi.com/2072-6643/10/4/423)

**Exercícios**

- free-exercise-db: [README](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/README.md) e [ficheiro com os 876 exercícios](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json) (contagens feitas por mim no ficheiro)

**Código da app lido:** `core/metrics/volume-rules.ts` e `volume.ts`, `data/models/workout.ts` e `exercise.ts`, `core/db/migrations`, `tools/exercise-library/catalogo-exercicios.md`.
