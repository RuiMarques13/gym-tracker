/**
 * Fontes do estudo «Músculos por exercício» (docs/research/musculos-por-exercicio.md).
 * RM = o músculo cresceu (ressonância/ecografia); EMG = o músculo estava ativo; ANAT = só a função anatómica.
 */
export type Measure = 'RM' | 'EMG' | 'ANAT';

export interface Source {
  key: string;
  label: string;
  measure: Measure;
  url: string;
  /** Nota curta: lido por resumo ou cópia de terceiros. */
  note?: string;
}

export const SOURCES: Record<string, Source> = {
  ace2018: { key: 'ace2018', label: 'Edelburg, Porcari et al., ACE 2018', measure: 'EMG',
    url: 'https://www.acefitness.org/continuing-education/certified/april-2018/6959/ace-sponsored-research-what-is-the-best-back-exercise/' },
  ekstrom2003: { key: 'ekstrom2003', label: 'Ekstrom, Donatelli, Soderberg 2003', measure: 'EMG',
    url: 'https://bearworks.missouristate.edu/articles-chhs/1184' },
  campos2020: { key: 'campos2020', label: 'Campos et al. 2020', measure: 'EMG', url: 'https://johk.pl/?p=5707' },
  ridao2020: { key: 'ridao2020', label: 'Rodríguez-Ridao et al. 2020', measure: 'EMG', url: 'https://www.mdpi.com/1660-4601/17/19/7339' },
  bergquist2018: { key: 'bergquist2018', label: 'Bergquist 2018', measure: 'EMG', url: 'https://ntnuopen.ntnu.no/ntnu-xmlui/handle/11250/2586025' },
  maeo2022: { key: 'maeo2022', label: 'Maeo et al. 2022', measure: 'RM', url: 'https://www.strongerbyscience.com/?p=57800',
    note: 'lido pelo resumo da Stronger By Science' },
  marcolin2018: { key: 'marcolin2018', label: 'Marcolin et al. 2018', measure: 'EMG', url: 'https://peerj.com/articles/5165' },
  kassiano2025: { key: 'kassiano2025', label: 'Kassiano et al. 2025', measure: 'RM',
    url: 'https://sci-sport.com/en/effects-of-incline-and-preacher-curls-on-regional-hypertrophy-and-strength-266/', note: 'ecografia; lido por resumo' },
  neto2020: { key: 'neto2020', label: 'Neto et al. 2020 (revisão)', measure: 'EMG', url: 'https://jssm.org/19-1-195.p_d_f' },
  macadam2015: { key: 'macadam2015', label: 'Macadam, Cronin, Contreras 2015 (revisão)', measure: 'EMG',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4595911/' },
  serner2014: { key: 'serner2014', label: 'Serner et al. 2014', measure: 'EMG', url: 'https://bjsm.bmj.com/content/48/14/1108' },
  kinoshita2026: { key: 'kinoshita2026', label: 'Kinoshita, Maeo et al. 2026', measure: 'RM',
    url: 'https://www.fisiologiadelejercicio.com/wp-content/uploads/2026/02/hypertrophic_effects_of_single__versus_multi_joint.1002-1.pdf',
    note: 'cópia alojada por terceiros' },
  bourne2017: { key: 'bourne2017', label: 'Bourne et al. 2017', measure: 'EMG', url: 'https://bjsm.bmj.com/content/51/13/1021' },
  maeo2021: { key: 'maeo2021', label: 'Maeo et al. 2021', measure: 'RM',
    url: 'https://repository.nie.edu.sg/server/api/core/bitstreams/ce76098e-921a-40ac-8dc6-79f1ff5a9443/content',
    note: 'valores citados num artigo posterior' },
  kinoshita2023: { key: 'kinoshita2023', label: 'Kinoshita et al. 2023', measure: 'RM',
    url: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/full' },
  marchetti2011: { key: 'marchetti2011', label: 'Marchetti et al. 2011', measure: 'EMG', url: 'https://jssm.org/jssm-10-322.xml%3EFulltext' },
  kawama2022: { key: 'kawama2022', label: 'Kawama et al. 2022', measure: 'EMG', url: 'https://jssm.org/jssm-21-493.xml%3EFulltext' },
  physiopedia: { key: 'physiopedia', label: 'Physiopedia (anatomia)', measure: 'ANAT', url: 'https://www.physio-pedia.com/Trapezius',
    note: 'função anatómica, não medição' },
};
