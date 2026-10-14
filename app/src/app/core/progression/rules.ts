/**
 * Todas as regras de progressão da app, cada uma com a marca de origem (especificação «Progressão e ciclos»):
 * - `source`: o número vem de uma fonte aberta nos estudos (docs/research);
 * - `app`: não há número na literatura e a app precisa de um. Estes são editáveis quando têm `setting`.
 * É a mesma lista do ecrã Ajuda → Regras e fontes e do «Porquê?» de cada sugestão.
 */

export type RuleMark = 'source' | 'app';
export type RuleArea = 'carga' | 'estagnacao' | 'descarga' | 'volume' | 'descanso' | '1rm';

export interface RuleRef {
  label: string;
  url: string;
  /** O que se leu: artigo, resumo, comunicado ou cópia de terceiros. */
  note?: string;
}

export interface Rule {
  key: string;
  area: RuleArea;
  title: string;
  /** O valor que a app usa, em palavras. */
  value: string;
  mark: RuleMark;
  /** Fontes que dão o número (marca `source`) ou que enquadram a escolha (marca `app`). */
  refs: RuleRef[];
  /** Definição onde se muda o valor (só nas escolhas da app editáveis). */
  setting?: string;
}

export const AREA_LABEL: Record<RuleArea, string> = {
  carga: 'Próxima carga',
  estagnacao: 'Estagnação e mudança de estímulo',
  descarga: 'Fadiga e descarga',
  volume: 'Volume semanal',
  descanso: 'Descanso entre séries',
  '1rm': '1RM estimado',
};

export const REF = {
  acsm2009: { label: 'ACSM 2009, Progression models in resistance training', url: 'https://sfu.ca/~ryand/kin343/ACSMresistance.pdf', note: 'cópia alojada pela Simon Fraser University' },
  iusca2021: { label: 'Schoenfeld et al. 2021, posição da IUSCA', url: 'https://openrepository.aut.ac.nz/bitstreams/63402893-ffac-4862-8616-6185d450de18/download' },
  plotkin2022: { label: 'Plotkin et al. 2022, carga ou repetições', url: 'https://peerj.com/articles/14142/' },
  mann2010: { label: 'Mann et al. 2010, progressão autorregulada', url: 'https://scholarship.miami.edu/esploro/outputs/journalArticle/THE-EFFECT-OF-AUTOREGULATORY-PROGRESSIVE-RESISTANCE/991031785742302976', note: 'só o resumo' },
  bell2023: { label: 'Bell et al. 2023, consenso Delphi sobre deload', url: 'https://shura.shu.ac.uk/32417/1/s40798-023-00633-0.pdf' },
  barsuhn2025: { label: 'Barsuhn et al. 2025, manter ou subir o volume', url: 'https://openrepository.aut.ac.nz/server/api/core/bitstreams/4f83ffc5-1aad-4dc8-92fb-1c28156b3211/content' },
  camargo: { label: 'Camargo et al., subir 20% ou 120% o volume', url: 'https://www.fisiologiadelejercicio.com/wp-content/uploads/2026/07/Large-increases-in-resistance-training-volume-do-not-impair-muscle-hypertrophy.pdf', note: 'cópia alojada por terceiros' },
  lopez2021: { label: 'Lopez et al. 2021, carga e hipertrofia', url: 'https://jyx.jyu.fi/bitstreams/f20307ab-e6ed-4d8e-83af-6fb9830251a2/download' },
  kassiano2022: { label: 'Kassiano et al. 2022, variação de exercícios', url: 'https://lida.sport-iat.de/ta/Record/4077216?lng=en', note: 'só o resumo' },
  kassiano2024: { label: 'Kassiano et al. 2024, exercícios fixos ou variados', url: 'https://ro.ecu.edu.au/ecuworks2022-2026/4912', note: 'resumo' },
  singer2024: { label: 'Singer et al. 2024, descanso e hipertrofia', url: 'https://www.frontiersin.org/articles/10.3389/fspor.2024.1429789/full' },
  reynolds2006: { label: 'Reynolds, Gordon e Robergs 2006, previsão do 1RM', url: 'https://www.unm.edu/~rrobergs/478RMStrengthPrediction.pdf' },
  lacio2010: { label: 'Lacio et al. 2010, equações de 1RM no supino', url: 'https://www.redalyc.org/pdf/2730/273019708005.pdf' },
} satisfies Record<string, RuleRef>;

export const RULES: Rule[] = [
  // ---- carga ----
  { key: 'load.increase', area: 'carga', mark: 'source', refs: [REF.acsm2009],
    title: 'Quando e quanto subir a carga',
    value: 'Todas as séries de trabalho no topo da faixa em 2 sessões seguidas: subir 2–10% (menos em músculos pequenos, mais em grandes).' },
  { key: 'load.reps', area: 'carga', mark: 'source', refs: [REF.plotkin2022],
    title: 'Entre subidas, progredir por repetições',
    value: 'Dentro da faixa, a carga mantém-se e tenta-se mais 1 repetição. Subir repetições ou carga deu hipertrofia parecida.' },
  { key: 'load.pick', area: 'carga', mark: 'app', refs: [REF.acsm2009],
    title: 'Que carga escolher dentro dos 2–10%',
    value: 'Multiarticular: a carga possível mais perto de +6%. Monoarticular: a mais baixa do intervalo. Arredonda ao incremento do material.' },
  { key: 'load.increments', area: 'carga', mark: 'app', refs: [], setting: 'loadIncrements',
    title: 'Incremento por material',
    value: 'Barras, halteres e polias 2,5 kg; máquinas 5 kg; kettlebells 4 kg. Nenhuma fonte dá incrementos em kg.' },
  { key: 'load.bigJump', area: 'carga', mark: 'app', refs: [REF.plotkin2022],
    title: 'Quando o menor salto passa os 10%',
    value: 'Manter a carga e subir até ao topo da faixa + 3 repetições antes do salto.' },
  { key: 'load.rirSkip', area: 'carga', mark: 'app', refs: [REF.mann2010],
    title: 'Subir mais cedo com reserva grande',
    value: 'Topo da faixa com 4 ou mais repetições em reserva: sobe já na sessão seguinte, sem esperar a segunda.' },
  { key: 'load.decrease', area: 'carga', mark: 'app', refs: [],
    title: 'Quando baixar',
    value: 'Abaixo do mínimo da faixa em 2 sessões seguidas: baixar um incremento.' },
  { key: 'load.start', area: 'carga', mark: 'app', refs: [],
    title: 'Primeira vez num exercício',
    value: 'Escolher uma carga que dê o número de repetições da faixa a 1–3 da falha.' },
  // ---- 1RM ----
  { key: 'e1rm', area: '1rm', mark: 'source', refs: [REF.reynolds2006, REF.lacio2010],
    title: 'Fórmula do 1RM estimado',
    value: 'Epley, peso × (1 + repetições / 30), em toda a app. Nas decisões só conta com séries até 10 repetições; acima disso a previsão perde exatidão.' },
  { key: 'e1rm.rir', area: '1rm', mark: 'app', refs: [],
    title: 'Repetições em reserva no 1RM',
    value: 'As repetições em reserva somam-se às feitas, como se a série fosse até à falha.' },
  // ---- volume ----
  { key: 'volume.advancedMax', area: 'volume', mark: 'source', refs: [REF.iusca2021],
    title: 'Máximo de séries por músculo (avançado)',
    value: '20 séries por semana: a evidência acima de 20 é limitada.' },
  // ---- descanso ----
  { key: 'rest.byMechanic', area: 'descanso', mark: 'source', refs: [REF.iusca2021, REF.singer2024], setting: 'restByMechanic',
    title: 'Descanso pelo tipo de exercício',
    value: 'Pelo menos 2 min em multiarticulares; 60–90 s em monoarticulares e máquinas. A app usa 2 min e 90 s quando o treino e o exercício não dizem outro.' },
  // ---- estagnação ----
  { key: 'stagnation.detect', area: 'estagnacao', mark: 'app', refs: [], setting: 'stagnationSessions',
    title: 'Quando um exercício está estagnado',
    value: '3 sessões seguidas sem subir carga, sem subir repetições na mesma carga e sem melhorar o 1RM estimado. Só contam sessões com 2 ou mais séries de trabalho.' },
  { key: 'stagnation.volume', area: 'estagnacao', mark: 'source', refs: [REF.iusca2021, REF.barsuhn2025, REF.camargo],
    title: 'Resposta 2: mais volume',
    value: 'Sem fadiga: subir as séries semanais do músculo cerca de 20%, até ao máximo do nível. Não se repete sem nova estagnação: mais volume não é sempre melhor.' },
  { key: 'stagnation.range', area: 'estagnacao', mark: 'source', refs: [REF.lopez2021, REF.iusca2021],
    title: 'Resposta 3: outra faixa de repetições',
    value: 'Já no máximo de volume: passar, por exemplo, de 8–12 para 5–8 ou 12–20. A hipertrofia não difere entre cargas quando as séries chegam perto da falha; a força pede carga alta.' },
  { key: 'stagnation.swap', area: 'estagnacao', mark: 'source', refs: [REF.kassiano2022, REF.kassiano2024, REF.iusca2021],
    title: 'Resposta 4: trocar o exercício',
    value: 'Por último, um exercício parecido para o mesmo músculo. Variação sistemática pode ajudar; variação excessiva ou aleatória pode prejudicar.' },
  { key: 'stagnation.order', area: 'estagnacao', mark: 'app', refs: [],
    title: 'Ordem das respostas',
    value: 'Descarga se há fadiga; senão volume, depois faixa, depois troca. Depois de aceitares uma, a seguinte só aparece se o exercício ficar outra vez as mesmas sessões sem progresso. Recusar esconde essa resposta até o exercício voltar a progredir.' },
  // ---- descarga ----
  { key: 'deload.when', area: 'descarga', mark: 'source', refs: [REF.bell2023], setting: 'deloadSuggestions',
    title: 'Quando fazer descarga',
    value: 'Quando há sinais de fadiga, fora da semana prevista, ou na última semana de cada mesociclo (consenso de peritos, não ensaio).' },
  { key: 'deload.how', area: 'descarga', mark: 'source', refs: [REF.bell2023],
    title: 'Como fazer descarga',
    value: 'Menos volume (séries, dias, repetições ou exercícios) com a mesma carga.' },
  { key: 'deload.amount', area: 'descarga', mark: 'app', refs: [REF.bell2023],
    title: 'Quanto e quanto tempo',
    value: 'Metade das séries de cada exercício, com a mesma carga, durante 7 dias. A duração não teve consenso; os 7 dias vêm da literatura citada no artigo.' },
  { key: 'fatigue.signals', area: 'descarga', mark: 'app', refs: [],
    title: 'Sinais de fadiga',
    value: 'Qualquer um: esforço da sessão 9 ou 10 em 2 das últimas 3 sessões; mais de metade das séries de trabalho a 0 em reserva nas últimas 2 sessões (com pelo menos 4 séries com reserva registada), quando o teu nível pede 1 ou mais; dor muscular 4 ou 5 nos últimos 3 dias; o 1RM estimado dos exercícios principais a cair mais de 2% por semana em 2 semanas.' },
];

export const RULE: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.key, r]));
