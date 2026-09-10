import {
  LearningMapLevelResponseSchema,
  type LearningMapLevelResponse,
  type MapItem,
  type MapIconKey,
  type MapProgress,
  type MapRoute,
} from "@cediah/contracts";
import { ROOT_MAP_ROUTE } from "./map-route";
export const mapFixtureId = (n: number) =>
  `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function progress(completed: number, total: number): MapProgress {
  return {
    status: !total
      ? "empty"
      : completed === total
        ? "completed"
        : completed
          ? "in_progress"
          : "not_started",
    percentage: !total
      ? null
      : completed === total
        ? 100
        : Math.min(99, Math.round((100 * completed) / total)),
    completedEssentialSteps: completed,
    totalEssentialSteps: total,
    started: completed > 0,
  };
}
function item(
  id: string,
  title: string,
  kind: MapItem["kind"],
  iconKey: MapIconKey,
  c = 0,
  t = 3,
): MapItem {
  return {
    occurrenceId: id,
    canonicalKey: id,
    kind,
    title,
    iconKey,
    progress: progress(c, t),
    childCount: kind === "lesson" ? t : 8,
    childCountLabel: kind === "node" ? "8 bloques" : "8 lecciones",
    availability: "available",
    enrollmentState: "none",
    pathId: kind === "node" ? null : mapFixtureId(100),
    pathVersionId: kind === "node" ? null : mapFixtureId(101),
    unitStableKey: kind === "lesson" ? id.replace("lesson:", "") : null,
  };
}
const areas: [string, MapIconKey][] = [
  ["Anatomía", "anatomy"],
  ["Bioquímica", "molecule"],
  ["Fisiología", "heart"],
  ["Histología", "tissue"],
  ["Farmacología", "pill"],
  ["Medicina clínica", "stethoscope"],
];
const blocks: [string, MapIconKey][] = [
  ["Cabeza y cuello", "head"],
  ["Miembro superior", "arm"],
  ["Tórax", "chest"],
  ["Abdomen", "abdomen"],
  ["Pelvis", "pelvis"],
  ["Miembro inferior", "leg"],
  ["Sistema nervioso", "brain"],
  ["Sistema tegumentario", "skin"],
];
const lessons: [string, MapIconKey, number, number][] = [
  ["Pared torácica", "chest", 8, 8],
  ["Mediastino", "chest", 6, 9],
  ["Corazón", "heart", 1, 8],
  ["Pulmones", "lungs", 0, 3],
  ["Grandes vasos", "vessel", 0, 3],
  ["Diafragma", "diaphragm", 0, 3],
  ["Pleura", "lungs", 0, 3],
  ["Sistema linfático del tórax", "molecule", 0, 3],
];
export function mapVisualLevel(
  route: MapRoute,
  mode = "root",
): LearningMapLevelResponse {
  const direct = route.nodeId === mapFixtureId(3);
  const inBlock = Boolean(route.entryId && !direct),
    inNode = Boolean(route.nodeId);
  let items = inBlock
    ? lessons.map(([title, icon, c, t], i) =>
        item(`lesson:leccion-${i}`, title, "lesson", icon, c, t),
      )
    : inNode
      ? direct
        ? lessons
            .slice(0, 6)
            .map(([title, icon, c, t], i) => ({
              ...item(
                mapFixtureId(300 + i),
                `Fisiología de ${title.toLowerCase()}`,
                "lesson",
                icon,
                c,
                t,
              ),
              unitStableKey: `leccion-${i}`,
            }))
        : blocks.map(([title, icon], i) =>
            item(
              mapFixtureId(20 + i),
              title,
              "block",
              icon,
              i === 2 ? 15 : 0,
              i === 2 ? 40 : 12,
            ),
          )
      : areas.map(([title, icon], i) =>
          item(
            mapFixtureId(i + 1),
            title,
            "node",
            icon,
            i === 0 ? 15 : 0,
            i === 0 ? 124 : 30,
          ),
        );
  if (mode === "empty") items = [];
  if (mode === "large")
    items = Array.from({ length: 200 }, (_, i) =>
      item(
        mapFixtureId(1000 + i),
        `Contenido ${i + 1}`,
        "node",
        "folder",
        0,
        3,
      ),
    );
  if (mode === "long" && items[0])
    items[0] = {
      ...items[0],
      title:
        "Integración del aprendizaje y fundamentos de la organización anatómica",
    };
  if (mode === "retired" && items[0])
    items[0] = {
      ...items[0],
      title: "Contenido no disponible",
      availability: "retired",
      progress: {
        status: "unavailable",
        percentage: null,
        completedEssentialSteps: null,
        totalEssentialSteps: null,
        started: false,
      },
    };
  if (mode === "mixed" && inNode && !inBlock)
    items = [
      ...items.slice(0, 2),
      {
        ...item(mapFixtureId(300), "Corazón", "lesson", "heart", 1, 8),
        unitStableKey: "leccion-2",
      },
    ];
  const levelKey = inBlock
    ? `block:${route.entryId}`
    : inNode
      ? `node:${route.nodeId}`
      : "root";
  const selected = route.unitStableKey
    ? items.find((i) => i.unitStableKey === route.unitStableKey)
    : direct && route.entryId
      ? items.find((i) => i.occurrenceId === route.entryId)
      : null;
  const ancestry = [
    { title: "Mi mapa", route: ROOT_MAP_ROUTE },
    ...(inNode
      ? [
          {
            title: direct ? "Fisiología" : "Anatomía",
            route: { nodeId: route.nodeId, entryId: null, unitStableKey: null },
          },
        ]
      : []),
    ...(inBlock
      ? [{ title: "Tórax", route: { ...route, unitStableKey: null } }]
      : []),
  ];
  return LearningMapLevelResponseSchema.parse({
    mapId: mapFixtureId(900),
    structuralVersion: 1,
    route,
    levelKey,
    ancestry,
    layout: { schemaVersion: 1, levelKey, rowVersion: 0, positions: {} },
    items,
    edges: inBlock
      ? items
          .slice(1)
          .map((i, n) => ({
            sourceOccurrenceId: items[n]!.occurrenceId,
            targetOccurrenceId: i.occurrenceId,
            kind: "sequence",
            provenance: "fixture_published_order",
            label: "Orden recomendado; acceso libre",
          }))
      : [],
    selectedLesson: selected
      ? {
          pathId: mapFixtureId(100),
          pathSlug: "fixture-torax",
          pathVersionId: mapFixtureId(101),
          unitStableKey: selected.unitStableKey,
          title: selected.title,
          description:
            "Descripción ficticia para revisar el diseño. No es contenido médico publicado.",
          enrollmentId: null,
          enrollmentState: "none",
          enrollmentVersion: null,
          progress: selected.progress,
          activities: Array.from(
            { length: selected.progress.totalEssentialSteps ?? 8 },
            (_, i) => ({
              id: mapFixtureId(400 + i),
              stableKey: `actividad-${i}`,
              title:
                [
                  "Introducción",
                  "Guía de estudio",
                  "Organización y relaciones",
                  "Comprueba lo aprendido",
                  "Recuperación activa",
                  "Video de repaso",
                  "Aplicación de conceptos",
                  "Repaso final",
                ][i] ?? `Actividad ${i + 1}`,
              isEssential: true,
              state:
                i < (selected.progress.completedEssentialSteps ?? 0)
                  ? "completed"
                  : "not_started",
              options: [
                {
                  id: mapFixtureId(500 + i),
                  label: [
                    "Ver video",
                    "Leer guía",
                    "Responder cuestionario",
                    "Repasar tarjetas",
                  ][i % 4],
                  projection: ["video", "guide", "quiz", "flashcards"][i % 4],
                  estimatedMinutes: 5 + i,
                  isDefault: true,
                  existingAttemptId: null,
                },
              ],
            }),
          ),
        }
      : null,
    containerSummary: {
      title: inBlock
        ? "Tórax"
        : inNode
          ? direct
            ? "Fisiología"
            : "Anatomía"
          : "Mi mapa de aprendizaje",
      description: inBlock
        ? "Explora las estructuras y relaciones de este bloque."
        : "Conecta conocimientos y construye tu ruta de aprendizaje.",
      progress: inBlock ? progress(15, 40) : progress(15, 124),
    },
    nextActivity: selected
      ? {
          stepId: mapFixtureId(401),
          optionId: mapFixtureId(501),
          reason: "Siguiente actividad esencial pendiente",
        }
      : null,
    generatedAt: "2026-09-08T12:00:00.000Z",
    resolvedVersionIds: [mapFixtureId(101)],
  });
}
