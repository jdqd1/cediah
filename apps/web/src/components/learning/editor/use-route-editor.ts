"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type {
  LearningPathDetail,
  LearningPathStatus,
  LearningPathValidationResponse,
} from "@cediah/contracts";
import {
  editorApi,
  type EditorApi,
  type EditorApiFailure,
  type EditorApiResult,
} from "./editor-api";
import {
  createEditorStateFromDetail,
  createNewEditorState,
  editorDraftFromDetail,
  makeSlug,
  type RouteEditorState,
  type ValidationStamp,
} from "./editor-model";
import {
  serializeCreateRequest,
  serializeUpdateRequest,
  type EditorSerializationError,
} from "./editor-serialization";
import {
  applyEditorRecovery,
  createEditorRecovery,
  editorRecoveryKey,
  parseEditorRecovery,
  recoveryMatchesBase,
  serializeEditorRecovery,
  type EditorRecovery,
} from "./editor-recovery";

export type EditorMutationTransport = Pick<EditorApi, "create" | "createVersion" | "save" | "transition" | "validate">;

export type EditorCommandFailure = {
  apiFailure?: EditorApiFailure;
  errors?: EditorSerializationError[];
  ok: false;
  reason: "busy" | "local_validation" | "not_ready" | "outdated_validation" | "request";
  requestStage?: "validate";
};
export type EditorCommandResult<T> = { ok: true; value: T } | EditorCommandFailure;

type SaveThenValidateValue = {
  confirmed: LearningPathDetail;
  validation: LearningPathValidationResponse & { validatedEditVersion: number };
};

export function editorFailureMessage(failure: EditorApiFailure, operation: "save" | "transition" | "validate" = "save") {
  if (failure.status === 400) return "Revisa los campos marcados antes de continuar.";
  if (failure.status === 401) return "Tu sesión terminó. Inicia sesión para guardar.";
  if (failure.status === 403) return "Tu cuenta no puede realizar esta acción.";
  if (failure.status === 404) return "La ruta ya no está disponible.";
  if (failure.status === 409) return "La ruta cambió en otra sesión. Conserva tus cambios y abre la versión guardada antes de continuar.";
  if (failure.status === 422) return "Hay puntos que debes resolver antes de continuar.";
  if (failure.status === 429) return "Hay demasiadas solicitudes. Espera un momento y vuelve a intentar.";
  return operation === "save"
    ? "No pudimos confirmar el guardado. Tus cambios siguen aquí. Vuelve a intentar."
    : "No pudimos completar la acción. Tus cambios siguen aquí. Vuelve a intentar.";
}

export function prepareEditorSave(state: RouteEditorState) {
  if (state.savedPath) {
    const serialized = serializeUpdateRequest(state.draft, state.savedPath.version.editVersion);
    return serialized.ok
      ? { mode: "update" as const, ok: true as const, pathId: state.savedPath.id, request: serialized.value, state }
      : { errors: serialized.errors, ok: false as const };
  }
  const frozenSlug = state.frozenSlug ?? makeSlug(state.draft.title, state.creationId);
  const preparedState = state.draft.slug === frozenSlug && state.frozenSlug === frozenSlug
    ? state
    : { ...state, draft: { ...state.draft, slug: frozenSlug }, frozenSlug };
  const serialized = serializeCreateRequest(preparedState.draft);
  return serialized.ok
    ? { mode: "create" as const, ok: true as const, request: serialized.value, state: preparedState }
    : { errors: serialized.errors, ok: false as const };
}

export async function executeSaveThenValidate(input: {
  onValidating?: () => void;
  persist: () => Promise<EditorCommandResult<LearningPathDetail>>;
  validate: (pathId: string, expectedVersion: number) => Promise<EditorApiResult<LearningPathValidationResponse>>;
}): Promise<EditorCommandResult<SaveThenValidateValue>> {
  const persisted = await input.persist();
  if (!persisted.ok) return persisted;
  input.onValidating?.();
  const confirmed = persisted.value;
  const validated = await input.validate(confirmed.id, confirmed.version.editVersion);
  if (!validated.ok) return { apiFailure: validated, ok: false, reason: "request", requestStage: "validate" };
  if (validated.value.validatedEditVersion !== confirmed.version.editVersion) {
    return { ok: false, reason: "outdated_validation" };
  }
  return {
    ok: true,
    value: {
      confirmed,
      validation: {
        ...validated.value,
        validatedEditVersion: validated.value.validatedEditVersion,
      },
    },
  };
}

function nextConfirmedState(current: RouteEditorState, confirmed: LearningPathDetail): RouteEditorState {
  const unitIds = new Set(confirmed.version.units.map((unit) => unit.id));
  const activityIds = new Set(confirmed.version.units.flatMap((unit) => unit.steps.map((activity) => activity.id)));
  return {
    ...current,
    dirty: false,
    draft: editorDraftFromDetail(confirmed),
    expandedActivityId: current.expandedActivityId && activityIds.has(current.expandedActivityId) ? current.expandedActivityId : null,
    expandedUnitId: current.expandedUnitId && unitIds.has(current.expandedUnitId) ? current.expandedUnitId : confirmed.version.units[0]?.id ?? null,
    frozenSlug: confirmed.slug,
    savedPath: confirmed,
    validation: null,
  };
}

function routeBasicsErrors(errors: EditorSerializationError[], draft: RouteEditorState["draft"]) {
  const result: Partial<Record<"summary" | "title" | "topicContentId", string>> = {};
  for (const error of errors) {
    if (error.target.entity !== "route") continue;
    if (error.target.field === "title") result.title = draft.title.trim() ? "Revisa el título de la ruta." : "Escribe un título para la ruta.";
    if (error.target.field === "summary") result.summary = draft.summary.trim() ? "Revisa la descripción de la ruta." : "Escribe una descripción breve.";
    if (error.target.field === "topicContentId") result.topicContentId = "Selecciona un tema publicado.";
  }
  return result;
}

type RecoveryCandidate = { conflict: boolean; recovery: EditorRecovery };

export type RouteEditorController = ReturnType<typeof useRouteEditor>;

export function useRouteEditor(input: {
  actorUserId: string;
  initialPath?: LearningPathDetail;
  replaceUrl?: (href: string) => void;
  routeTopics: Array<{ id: string; title: string }>;
  transport?: EditorMutationTransport;
}) {
  const router = useRouter();
  const transport = input.transport ?? editorApi;
  const replaceUrl = input.replaceUrl ?? router.replace;
  const [state, setReactState] = useState<RouteEditorState>(() => input.initialPath
    ? createEditorStateFromDetail(input.initialPath)
    : createNewEditorState({ topics: input.routeTopics }));
  const stateRef = useRef(state);
  const operationRef = useRef(state.operation);
  const [serializationErrors, setSerializationErrors] = useState<EditorSerializationError[]>([]);
  const [notice, setNotice] = useState("");
  const [lastFailure, setLastFailure] = useState<EditorApiFailure | null>(null);
  const [recoveryCandidate, setRecoveryCandidate] = useState<RecoveryCandidate | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const loadedRecoveryKeys = useRef(new Set<string>());

  const commitInternal = useCallback((next: SetStateAction<RouteEditorState>) => {
    const resolved = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = resolved;
    operationRef.current = resolved.operation;
    setReactState(resolved);
    return resolved;
  }, []);

  const setState: Dispatch<SetStateAction<RouteEditorState>> = useCallback((next) => {
    const current = stateRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved.draft !== current.draft) {
      setSerializationErrors([]);
      setLastFailure(null);
      setNotice("Hay cambios nuevos. Comprueba la ruta para actualizar los resultados.");
    }
    commitInternal(resolved);
  }, [commitInternal]);

  const setOperation = useCallback((operation: RouteEditorState["operation"]) => {
    operationRef.current = operation;
    commitInternal((current) => current.operation === operation ? current : { ...current, operation });
  }, [commitInternal]);

  const beginOperation = useCallback((operation: RouteEditorState["operation"]) => {
    if (operationRef.current !== "idle") return false;
    setOperation(operation);
    return true;
  }, [setOperation]);

  const removeRecoveryKeys = useCallback((confirmed?: LearningPathDetail) => {
    try {
      sessionStorage.removeItem(editorRecoveryKey(input.actorUserId));
      const pathId = confirmed?.id ?? stateRef.current.savedPath?.id;
      if (pathId) sessionStorage.removeItem(editorRecoveryKey(input.actorUserId, pathId));
    } catch {
      setRecoveryAvailable(false);
    }
  }, [input.actorUserId]);

  const handleFailure = useCallback((failure: EditorApiFailure, operation: "save" | "transition" | "validate") => {
    setLastFailure(failure);
    setNotice(editorFailureMessage(failure, operation));
    if (failure.status === 422 && failure.issues && stateRef.current.savedPath) {
      const current = stateRef.current;
      const savedPath = current.savedPath;
      if (!savedPath) return;
      commitInternal({
        ...current,
        validation: {
          editVersion: savedPath.version.editVersion,
          issues: failure.issues,
          localRevision: current.localRevision,
          ready: false,
        },
      });
    }
  }, [commitInternal]);

  const persistWithinLock = useCallback(async (): Promise<EditorCommandResult<LearningPathDetail>> => {
    const current = stateRef.current;
    if (current.savedPath && !current.dirty) return { ok: true, value: current.savedPath };
    const prepared = prepareEditorSave(current);
    if (!prepared.ok) {
      setSerializationErrors(prepared.errors);
      setNotice("Revisa los campos marcados antes de guardar.");
      return { errors: prepared.errors, ok: false, reason: "local_validation" };
    }
    if (prepared.state !== current) commitInternal(prepared.state);
    const wasNew = prepared.mode === "create";
    const result = prepared.mode === "create"
      ? await transport.create(prepared.request)
      : await transport.save(prepared.pathId, prepared.request);
    if (!result.ok) {
      handleFailure(result, "save");
      return { apiFailure: result, ok: false, reason: "request" };
    }
    const confirmed = result.value;
    commitInternal((latest) => nextConfirmedState(latest, confirmed));
    setSerializationErrors([]);
    setLastFailure(null);
    setNotice("Borrador guardado.");
    removeRecoveryKeys(confirmed);
    setRecoveryCandidate(null);
    if (wasNew) replaceUrl(`/panel/rutas/${encodeURIComponent(confirmed.id)}`);
    return { ok: true, value: confirmed };
  }, [commitInternal, handleFailure, removeRecoveryKeys, replaceUrl, transport]);

  const saveDraft = useCallback(async (): Promise<EditorCommandResult<LearningPathDetail>> => {
    if (!beginOperation("saving")) return { ok: false, reason: "busy" };
    try {
      return await persistWithinLock();
    } finally {
      setOperation("idle");
    }
  }, [beginOperation, persistWithinLock, setOperation]);

  const saveThenValidate = useCallback(async (): Promise<EditorCommandResult<SaveThenValidateValue>> => {
    if (!beginOperation("saving")) return { ok: false, reason: "busy" };
    try {
      const result = await executeSaveThenValidate({
        onValidating: () => setOperation("validating"),
        persist: persistWithinLock,
        validate: transport.validate,
      });
      if (!result.ok) {
        if (result.reason === "outdated_validation") {
          setNotice("Actualiza el editor para completar la comprobación.");
          commitInternal((current) => ({ ...current, validation: null }));
        } else if (result.apiFailure && result.requestStage === "validate") handleFailure(result.apiFailure, "validate");
        return result;
      }
      const { confirmed, validation } = result.value;
      const current = stateRef.current;
      const stamp: ValidationStamp = {
        editVersion: confirmed.version.editVersion,
        issues: validation.issues,
        localRevision: current.localRevision,
        ready: validation.ready && !validation.issues.some((issue) => issue.severity === "error"),
      };
      commitInternal({ ...current, savedPath: confirmed, validation: stamp });
      setLastFailure(null);
      setNotice(stamp.ready ? "La comprobación está actualizada." : "Revisa los puntos indicados antes de continuar.");
      return result;
    } finally {
      setOperation("idle");
    }
  }, [beginOperation, commitInternal, handleFailure, persistWithinLock, setOperation, transport.validate]);

  const transition = useCallback(async (
    status: Exclude<LearningPathStatus, "draft">,
  ): Promise<EditorCommandResult<LearningPathDetail>> => {
    if (!beginOperation(status === "in_review" ? "saving" : "transitioning")) return { ok: false, reason: "busy" };
    try {
      let confirmed = stateRef.current.savedPath;
      if (status === "in_review") {
        const current = stateRef.current;
        const validationIsCurrent = confirmed && !current.dirty && current.validation?.ready
          && current.validation.editVersion === confirmed.version.editVersion
          && current.validation.localRevision === current.localRevision;
        if (!validationIsCurrent) {
          const checked = await executeSaveThenValidate({
            onValidating: () => setOperation("validating"),
            persist: persistWithinLock,
            validate: transport.validate,
          });
          if (!checked.ok) {
            if (checked.reason === "outdated_validation") setNotice("Actualiza el editor para completar la comprobación.");
            else if (checked.apiFailure && checked.requestStage === "validate") handleFailure(checked.apiFailure, "validate");
            return checked;
          }
          const stamp: ValidationStamp = {
            editVersion: checked.value.confirmed.version.editVersion,
            issues: checked.value.validation.issues,
            localRevision: stateRef.current.localRevision,
            ready: checked.value.validation.ready && !checked.value.validation.issues.some((issue) => issue.severity === "error"),
          };
          commitInternal((latest) => ({ ...latest, savedPath: checked.value.confirmed, validation: stamp }));
          confirmed = checked.value.confirmed;
          if (!stamp.ready) {
            setNotice("Resuelve los puntos indicados antes de enviar la ruta a revisión.");
            return { ok: false, reason: "not_ready" };
          }
        }
      }
      if (!confirmed) {
        setNotice("Guarda el borrador antes de continuar.");
        return { ok: false, reason: "local_validation" };
      }
      setOperation("transitioning");
      const result = await transport.transition(confirmed.id, confirmed.version.editVersion, status);
      if (!result.ok) {
        handleFailure(result, "transition");
        return { apiFailure: result, ok: false, reason: "request" };
      }
      commitInternal((latest) => nextConfirmedState(latest, result.value));
      setLastFailure(null);
      setNotice("El estado editorial se actualizó.");
      return { ok: true, value: result.value };
    } finally {
      setOperation("idle");
    }
  }, [beginOperation, commitInternal, handleFailure, persistWithinLock, setOperation, transport]);

  const createVersion = useCallback(async (releaseNotes: string): Promise<EditorCommandResult<LearningPathDetail>> => {
    if (!beginOperation("creating-version")) return { ok: false, reason: "busy" };
    try {
      const current = stateRef.current.savedPath;
      if (!current) return { ok: false, reason: "local_validation" };
      const result = await transport.createVersion(current.id, releaseNotes);
      if (!result.ok) {
        handleFailure(result, "transition");
        return { apiFailure: result, ok: false, reason: "request" };
      }
      commitInternal((latest) => nextConfirmedState(latest, result.value));
      setLastFailure(null);
      setNotice("La nueva versión está lista para editar.");
      return { ok: true, value: result.value };
    } finally {
      setOperation("idle");
    }
  }, [beginOperation, commitInternal, handleFailure, setOperation, transport]);

  const writeRecoveryNow = useCallback(() => {
    const current = stateRef.current;
    if (!current.dirty) return;
    try {
      const key = editorRecoveryKey(input.actorUserId, current.savedPath?.id);
      sessionStorage.setItem(key, serializeEditorRecovery(createEditorRecovery(current)));
      setRecoveryAvailable(true);
    } catch {
      setRecoveryAvailable(false);
    }
  }, [input.actorUserId]);

  useEffect(() => {
    const key = editorRecoveryKey(input.actorUserId, state.savedPath?.id);
    if (loadedRecoveryKeys.current.has(key)) return;
    const timeout = window.setTimeout(() => {
      if (loadedRecoveryKeys.current.has(key)) return;
      loadedRecoveryKeys.current.add(key);
      try {
        const parsed = parseEditorRecovery(sessionStorage.getItem(key));
        if (parsed.status === "available") {
          setRecoveryCandidate({
            conflict: !recoveryMatchesBase(parsed.recovery, state.savedPath?.version.editVersion ?? null),
            recovery: parsed.recovery,
          });
        } else if (parsed.status === "expired" || parsed.status === "invalid") {
          sessionStorage.removeItem(key);
        }
      } catch {
        setRecoveryAvailable(false);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [input.actorUserId, state.savedPath?.id, state.savedPath?.version.editVersion]);

  useEffect(() => {
    if (!state.dirty) return;
    const timeout = window.setTimeout(writeRecoveryNow, 400);
    return () => window.clearTimeout(timeout);
  }, [state.dirty, state.draft, state.localRevision, writeRecoveryNow]);

  useEffect(() => {
    const flush = () => writeRecoveryNow();
    window.addEventListener("pagehide", flush);
    window.addEventListener("popstate", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("popstate", flush);
    };
  }, [writeRecoveryNow]);

  useEffect(() => {
    if (!state.dirty && state.operation === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty, state.operation]);

  useEffect(() => {
    if (!state.dirty) return;
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || anchor.target === "_blank") return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      event.preventDefault();
      writeRecoveryNow();
      setPendingNavigation(destination.href);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [state.dirty, writeRecoveryNow]);

  const discardRecovery = useCallback(() => {
    const current = stateRef.current;
    try {
      sessionStorage.removeItem(editorRecoveryKey(input.actorUserId, current.savedPath?.id));
    } catch {
      setRecoveryAvailable(false);
    }
    setRecoveryCandidate(null);
  }, [input.actorUserId]);

  const recover = useCallback(() => {
    if (!recoveryCandidate) return false;
    if (operationRef.current !== "idle") return false;
    if (recoveryCandidate.conflict) {
      setNotice("La ruta cambió desde este borrador. Descarga tus cambios y abre la versión guardada antes de continuar.");
      return false;
    }
    commitInternal((current) => applyEditorRecovery(current, recoveryCandidate.recovery));
    setRecoveryCandidate(null);
    setNotice("Recuperamos los cambios locales. Revísalos y guarda cuando estés listo.");
    return true;
  }, [commitInternal, recoveryCandidate]);

  const downloadDraft = useCallback((recovery = recoveryCandidate?.recovery ?? createEditorRecovery(stateRef.current)) => {
    const blob = new Blob([serializeEditorRecovery(recovery)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = "borrador-ruta.json";
    anchor.href = href;
    anchor.click();
    URL.revokeObjectURL(href);
  }, [recoveryCandidate]);

  const openSavedVersion = useCallback(() => {
    const pathId = stateRef.current.savedPath?.id;
    if (pathId) window.open(`/panel/rutas/${encodeURIComponent(pathId)}`, "_blank", "noopener,noreferrer");
  }, []);

  const saveAndLeave = useCallback(async () => {
    const destination = pendingNavigation;
    if (!destination) return;
    writeRecoveryNow();
    const result = await saveDraft();
    if (result.ok) window.location.assign(destination);
  }, [pendingNavigation, saveDraft, writeRecoveryNow]);

  const leaveWithoutSaving = useCallback(() => {
    if (!pendingNavigation) return;
    writeRecoveryNow();
    window.location.assign(pendingNavigation);
  }, [pendingNavigation, writeRecoveryNow]);

  return {
    basicsErrors: useMemo(() => routeBasicsErrors(serializationErrors, state.draft), [serializationErrors, state.draft]),
    conflict: lastFailure?.status === 409,
    createVersion,
    discardRecovery,
    downloadDraft,
    lastFailure,
    leaveWithoutSaving,
    notice,
    openSavedVersion,
    pendingNavigation,
    recover,
    recoveryAvailable,
    recoveryCandidate,
    saveAndLeave,
    saveDraft,
    saveThenValidate,
    serializationErrors,
    setPendingNavigation,
    setState,
    state,
    transition,
    writeRecoveryNow,
  };
}
