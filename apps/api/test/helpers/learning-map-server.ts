/** Disposable loopback-only E2E API. This module is never imported by the application. */
import { randomUUID } from "node:crypto";
import { LearningPathCreateRequestSchema } from "@cediah/contracts";
import { createLearningMapTestDb } from "./learning-map-db.js";
import { createPostgresGuidedLearningProvider } from "../../src/providers/postgres-guided-learning.js";
import { createPostgresLearningMapProvider } from "../../src/providers/postgres-learning-map.js";
import { buildApp } from "../../src/app.js";
if (
  process.env.NODE_ENV !== "test" ||
  process.env.MAP_E2E_TEST_SERVER !== "true"
)
  throw new Error("Explicit test environment required");
const { database, pg, close } = await createLearningMapTestDb();
const creator = randomUUID(),
  student = "c1000000-0000-4000-8000-000000000001",
  other = "c1000000-0000-4000-8000-000000000002",
  topic = randomUUID(),
  source = randomUUID();
await database
  .insertInto("auth_users")
  .values([
    { id: creator, name: "Editor de prueba", email: "editor.map@example.test" },
    {
      id: student,
      name: "Estudiante de prueba",
      email: "student.map@example.test",
    },
    { id: other, name: "Otra cuenta", email: "other.map@example.test" },
  ])
  .execute();
await pg.query(
  "insert into content_items (id,kind,slug,title,summary,topic,content,author_user_id,status,published_by,published_at) values ($1,'topic','tema-e2e','Tema E2E','Fixture','Tema E2E',$2,$3,'published',$3,now())",
  [
    topic,
    { introduction: "Fixture", objectives: ["Probar"], regions: ["Tema"] },
    creator,
  ],
);
await pg.query(
  "insert into content_items (id,kind,slug,title,summary,topic,content,author_user_id,status,published_by,published_at) values ($1,'video','recurso-e2e','Recurso E2E','Fixture','Tema E2E',$2,$3,'published',$3,now())",
  [
    source,
    {
      description: "Fixture E2E",
      durationSeconds: null,
      externalUrl: null,
      guide: {
        document: null,
        sections: [
          {
            heading: "Sección de prueba",
            body: "Contenido sintético sin uso médico.",
          },
        ],
      },
      keyPoints: ["Fixture"],
      quiz: {
        questions: Array.from({ length: 5 }, (_, i) => ({
          correctOptionIndex: 0,
          explanation: "Fixture",
          options: ["Correcta", "Otra"],
          prompt: `Pregunta ${i + 1}`,
        })),
      },
      regions: ["Tema"],
    },
    creator,
  ],
);
const guided = createPostgresGuidedLearningProvider(database),
  map = createPostgresLearningMapProvider(database);
const draft = LearningPathCreateRequestSchema.parse({
  title: "Bloque E2E",
  slug: "bloque-e2e",
  summary: "Contenido sintético para comprobar el mapa.",
  coverKey: "heart",
  topicContentId: topic,
  definition: {
    units: [0, 1].map((i) => {
      const objective = randomUUID();
      return {
        title: `Lección E2E ${i + 1}`,
        stableKey: `leccion-${i + 1}`,
        objectives: [
          { id: objective, title: "Verificar funcionamiento", importance: 1 },
        ],
        steps: [
          {
            title: `Actividad E2E ${i + 1}`,
            stableKey: `paso-${i + 1}`,
            purpose: "understand",
            isEssential: true,
            objectiveIds: [objective],
            options: [
              {
                label: "Leer guía",
                projection: "guide",
                sourceContentId: source,
                rewardIdentity: randomUUID(),
                isDefault: true,
                estimatedMinutes: 1,
              },
            ],
          },
        ],
      };
    }),
  },
});
const created = await guided.createPath({ actorUserId: creator, draft });
if (created.status !== "success") throw new Error(JSON.stringify(created));
// Fixture publication retains the same relational constraints; no production editor is touched.
await database
  .updateTable("learning_path_versions")
  .set({ status: "published", published_at: new Date(), published_by: creator })
  .where("id", "=", created.value.version.id)
  .execute();
await database
  .updateTable("learning_paths")
  .set({ published_version_id: created.value.version.id })
  .where("id", "=", created.value.id)
  .execute();
const ensured = await map.mutate({
  operation: "ensure",
  request: {},
  userId: student,
  idempotencyKey: randomUUID(),
});
if (ensured.status !== "success") throw new Error("ensure");
await map.mutate({
  operation: "nodes",
  request: {
    expectedVersion: ensured.value.structuralVersion,
    title: "Mi nodo E2E",
    iconKey: "heart",
    items: [{ kind: "block", pathId: created.value.id }],
  },
  userId: student,
  idempotencyKey: randomUUID(),
});
const app = await buildApp(
  {
    HOST: "127.0.0.1",
    PORT: 4100,
    NODE_ENV: "test",
    VIDEO_TEST_PROVIDER: "s3",
    WEB_ORIGINS: "http://localhost:3000",
    webOrigins: new Set(["http://localhost:3000"]),
    guidedLearningEnabled: true,
    guidedLearningMapEnabled: true,
  },
  {
    guidedLearningProvider: guided,
    learningMapProvider: map,
    identityProvider: {
      getUser: async (r) =>
        r.cookie?.includes("map_e2e=student")
          ? { id: student, email: "student.map@example.test" }
          : r.cookie?.includes("map_e2e=other")
            ? { id: other, email: "other.map@example.test" }
            : null,
      revokeSessions: async () => {},
    },
  },
);
await app.listen({ host: "127.0.0.1", port: 4100 });
console.log("Disposable map E2E API ready on 127.0.0.1:4100");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app
      .close()
      .then(close)
      .then(() => process.exit(0));
  });
