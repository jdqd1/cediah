"use client";

type QueuedLearningMutation = {
  body: unknown;
  createdAt: number;
  idempotencyKey: string;
  method: "PATCH" | "POST";
  queueKey: string;
  url: string;
  userId: string;
};

const databaseName = "cediah-guided-learning";
const storeName = "pending-mutations-v2";

export function learningMutationQueueKey(userId: string, idempotencyKey: string) {
  return `${userId}:${idempotencyKey}`;
}

function openQueue() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "queueKey" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function canPersistQueue() {
  return typeof indexedDB !== "undefined";
}

async function writeMutation(value: QueuedLearningMutation) {
  const database = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function deleteMutation(queueKey: string) {
  const database = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(queueKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function queuedForUser(userId: string) {
  const database = await openQueue();
  const values = await new Promise<QueuedLearningMutation[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("userId").getAll(userId);
    request.onsuccess = () => resolve(request.result as QueuedLearningMutation[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return values.sort((left, right) => left.createdAt - right.createdAt).slice(0, 100);
}

export function isRetryableLearningStatus(status: number) {
  return status === 401 || status === 429 || status >= 500;
}

async function deliver(mutation: QueuedLearningMutation) {
  const response = await fetch(mutation.url, {
    body: JSON.stringify(mutation.body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": mutation.idempotencyKey,
    },
    method: mutation.method,
  });
  const body: unknown = await response.json().catch(() => ({ error: "learning_unavailable" }));
  let removedFromQueue = false;
  if (!isRetryableLearningStatus(response.status) && canPersistQueue()) {
    try {
      await deleteMutation(mutation.queueKey);
      removedFromQueue = true;
    } catch {
      // The server response remains authoritative. A later retry uses the same
      // idempotency key, so a local cleanup failure cannot duplicate the write.
    }
  }
  return { body, removedFromQueue, response };
}

export async function sendQueuedLearningMutation(input: Omit<QueuedLearningMutation, "createdAt" | "idempotencyKey" | "queueKey"> & {
  idempotencyKey?: string;
}) {
  const generatedIdempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
  const mutation: QueuedLearningMutation = {
    ...input,
    createdAt: Date.now(),
    idempotencyKey: generatedIdempotencyKey,
    queueKey: learningMutationQueueKey(input.userId, generatedIdempotencyKey),
  };
  let persisted = false;
  if (canPersistQueue()) {
    try {
      await writeMutation(mutation);
      persisted = true;
    } catch {
      // Private browsing and storage quotas can disable IndexedDB. We still
      // attempt the request, but never claim it is queued when it is not.
    }
  }
  try {
    const delivered = await deliver(mutation);
    if (isRetryableLearningStatus(delivered.response.status)) {
      return persisted
        ? { idempotencyKey: mutation.idempotencyKey, state: "pending" as const }
        : { ...delivered, idempotencyKey: mutation.idempotencyKey, state: "failed" as const };
    }
    return { ...delivered, idempotencyKey: mutation.idempotencyKey, state: "confirmed" as const };
  } catch {
    return persisted
      ? { idempotencyKey: mutation.idempotencyKey, state: "pending" as const }
      : { idempotencyKey: mutation.idempotencyKey, state: "failed" as const };
  }
}

export async function flushQueuedLearningMutations(userId: string) {
  if (!canPersistQueue() || !navigator.onLine) return 0;
  let confirmed = 0;
  let mutations: QueuedLearningMutation[];
  try {
    mutations = await queuedForUser(userId);
  } catch {
    return 0;
  }
  for (const mutation of mutations) {
    try {
      const { removedFromQueue, response } = await deliver(mutation);
      if (isRetryableLearningStatus(response.status)) break;
      if (removedFromQueue) confirmed += 1;
    } catch {
      break;
    }
  }
  return confirmed;
}
