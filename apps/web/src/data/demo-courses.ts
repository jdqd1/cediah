export type DemoCourse = {
  code: string;
  duration: string;
  lessons: number;
  modules: number;
  region: string;
  slug: string;
  summary: string;
  title: string;
};

export const demoCourses: readonly DemoCourse[] = [
  {
    code: "REG-01",
    duration: "6 h",
    lessons: 8,
    modules: 4,
    region: "Región cervical",
    slug: "cuello",
    summary: "Planos, fascias, triángulos y relaciones vasculonerviosas esenciales.",
    title: "Cuello",
  },
  {
    code: "REG-02",
    duration: "8 h",
    lessons: 10,
    modules: 5,
    region: "Cavidad torácica",
    slug: "torax",
    summary: "Pared torácica, mediastino, pulmones, corazón y grandes vasos.",
    title: "Tórax",
  },
  {
    code: "REG-03",
    duration: "9 h",
    lessons: 12,
    modules: 6,
    region: "Cavidad abdominal",
    slug: "abdomen",
    summary: "Pared, peritoneo, vísceras, irrigación y correlación topográfica.",
    title: "Abdomen",
  },
  {
    code: "REG-04",
    duration: "7 h",
    lessons: 9,
    modules: 5,
    region: "Región pélvica",
    slug: "pelvis-y-perine",
    summary: "Pelvis ósea, suelo pélvico, periné y órganos urogenitales.",
    title: "Pelvis y periné",
  },
  {
    code: "REG-05",
    duration: "8 h",
    lessons: 11,
    modules: 5,
    region: "Anatomía apendicular",
    slug: "miembro-superior",
    summary: "Cintura escapular, brazo, antebrazo y mano por compartimentos.",
    title: "Miembro superior",
  },
  {
    code: "REG-06",
    duration: "8 h",
    lessons: 11,
    modules: 5,
    region: "Anatomía apendicular",
    slug: "miembro-inferior",
    summary: "Cadera, muslo, pierna y pie con énfasis en trayectos clínicos.",
    title: "Miembro inferior",
  },
  {
    code: "REG-07",
    duration: "7 h",
    lessons: 9,
    modules: 5,
    region: "Región cefálica",
    slug: "cabeza",
    summary: "Cráneo, cara, cavidades, pares craneales y espacios profundos.",
    title: "Cabeza",
  },
  {
    code: "REG-08",
    duration: "10 h",
    lessons: 14,
    modules: 7,
    region: "Sistema nervioso",
    slug: "neuroanatomia",
    summary: "Encéfalo, médula, vías, meninges y organización funcional.",
    title: "Neuroanatomía",
  },
] as const;

export function getDemoCourse(slug: string) {
  return demoCourses.find((course) => course.slug === slug);
}
