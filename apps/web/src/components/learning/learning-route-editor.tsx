"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Eye,
  FloppyDisk,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import type {
  LearningEditorResource,
  LearningEditorResourceCatalogResponse,
  LearningPathCreateRequest,
  LearningPathDetail,
  LearningPathOptionDraft,
  LearningPathStatus,
  LearningPathValidationIssue,
} from "@cediah/contracts";

type EditorTab = "structure" | "materials" | "preview" | "publication";
type EditableDraft = LearningPathCreateRequest;
type EditableUnit = EditableDraft["definition"]["units"][number];
type EditableStep = EditableUnit["steps"][number];

const coverOptions = [
  ["lungs", "Pulmones"], ["heart", "Corazón"], ["skull", "Cráneo"],
  ["neck-muscles", "Cuello"], ["intestines", "Abdomen"], ["pelvis", "Pelvis"],
  ["thigh", "Muslo"], ["back-muscles", "Espalda"],
] as const;
const statusLabels: Record<LearningPathStatus, string> = {
  approved: "Aprobada", archived: "Archivada", changes_requested: "Cambios solicitados",
  draft: "Borrador", in_review: "En revisión", published: "Publicada",
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

function materialItemIds(item: LearningEditorResource, projection: LearningPathOptionDraft["projection"]) {
  return item.projections.find((entry) => entry.projection === projection)?.itemIds ?? [];
}

function supportedProjections(item: LearningEditorResource | undefined) {
  return item?.projections.map((entry) => entry.projection) ?? [];
}

function fromDetail(path: LearningPathDetail): EditableDraft {
  return {
    coverKey: path.coverKey,
    definition: {
      evidenceLevel: path.version.evidenceLevel,
      policyVersion: path.version.policyVersion,
      releaseNotes: path.version.releaseNotes,
      units: path.version.units.map((unit) => ({
        id: unit.id,
        objectives: unit.objectives,
        pedagogyVersion: unit.pedagogyVersion,
        stableKey: unit.stableKey,
        steps: unit.steps.map((step) => ({
          id: step.id,
          isEssential: step.isEssential,
          objectiveIds: step.objectiveIds,
          options: step.options.map((option) => ({
            completionRule: option.completionRule,
            config: option.config,
            estimatedMinutes: option.estimatedMinutes,
            id: option.id,
            isDefault: option.isDefault,
            label: option.label,
            projection: option.projection,
            rewardIdentity: option.rewardIdentity,
            rewardVersion: option.rewardVersion,
            sourceContentId: option.sourceContentId,
          })),
          pedagogyVersion: step.pedagogyVersion,
          purpose: step.purpose,
          recommendedAfter: step.recommendedAfter,
          stableKey: step.stableKey,
          title: step.title,
        })),
        title: unit.title,
      })),
    },
    slug: path.slug,
    summary: path.summary,
    title: path.title,
    topicContentId: path.topic.id,
  };
}

function emptyDraft(topics: Array<{ id: string; title: string }>): EditableDraft {
  return {
    coverKey: "lungs",
    definition: { evidenceLevel: "standard", policyVersion: "guided-v1", releaseNotes: "", units: [] },
    slug: "",
    summary: "",
    title: "",
    topicContentId: topics[0]?.id ?? "",
  };
}

export function LearningRouteEditor({
  canPublish,
  canReview,
  initialPath,
  initialResources,
  paths,
  resourceNextCursor,
  resourceTopics,
  routeTopics,
}: {
  canPublish: boolean;
  canReview: boolean;
  initialPath?: LearningPathDetail;
  initialResources: LearningEditorResource[];
  paths: LearningPathDetail[];
  resourceNextCursor: string | null;
  resourceTopics: string[];
  routeTopics: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [resources, setResources] = useState(initialResources);
  const [nextResourceCursor, setNextResourceCursor] = useState(resourceNextCursor);
  const [resourceQuery, setResourceQuery] = useState("");
  const [resourceProjection, setResourceProjection] = useState<"" | LearningPathOptionDraft["projection"]>("");
  const [resourceTopic, setResourceTopic] = useState("");
  const [appliedResourceQuery, setAppliedResourceQuery] = useState("");
  const [appliedResourceProjection, setAppliedResourceProjection] = useState<"" | LearningPathOptionDraft["projection"]>("");
  const [appliedResourceTopic, setAppliedResourceTopic] = useState("");
  const [resourceMessage, setResourceMessage] = useState("");
  const [isResourcePending, startResourceTransition] = useTransition();
  const resourceById = useMemo(() => new Map(resources.map((item) => [item.id, item])), [resources]);
  const [savedPath, setSavedPath] = useState(initialPath);
  const [draft, setDraft] = useState<EditableDraft>(() => initialPath ? fromDetail(initialPath) : emptyDraft(routeTopics));
  const [tab, setTab] = useState<EditorTab>("structure");
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<LearningPathValidationIssue[]>([]);
  const [message, setMessage] = useState("");

  function change(next: EditableDraft) { setDraft(next); setDirty(true); setMessage(""); }
  function updateUnit(index: number, next: EditableUnit) {
    const units = [...draft.definition.units]; units[index] = next;
    change({ ...draft, definition: { ...draft.definition, units } });
  }
  function addUnit() {
    const number = draft.definition.units.length + 1;
    const objectiveId = crypto.randomUUID();
    change({ ...draft, definition: { ...draft.definition, units: [...draft.definition.units, {
      id: crypto.randomUUID(), objectives: [{ id: objectiveId, importance: 3, title: "" }],
      pedagogyVersion: 1, stableKey: `unidad-${number}`, steps: [], title: `Unidad ${number}`,
    }] } });
  }
  function addStep(unitIndex: number) {
    const unit = draft.definition.units[unitIndex];
    if (!unit) return;
    const number = unit.steps.length + 1;
    updateUnit(unitIndex, { ...unit, steps: [...unit.steps, {
      id: crypto.randomUUID(), isEssential: true,
      objectiveIds: unit.objectives[0] ? [unit.objectives[0].id] : [], options: [],
      pedagogyVersion: 1, purpose: "understand", recommendedAfter: [],
      stableKey: `${unit.stableKey}-paso-${number}`, title: `Actividad ${number}`,
    }] });
  }
  function updateStep(unitIndex: number, stepIndex: number, next: EditableStep) {
    const unit = draft.definition.units[unitIndex]; if (!unit) return;
    const steps = [...unit.steps]; steps[stepIndex] = next; updateUnit(unitIndex, { ...unit, steps });
  }
  function moveStep(unitIndex: number, stepIndex: number, direction: -1 | 1) {
    const unit = draft.definition.units[unitIndex]; if (!unit) return;
    const target = stepIndex + direction; if (target < 0 || target >= unit.steps.length) return;
    const steps = [...unit.steps]; [steps[stepIndex], steps[target]] = [steps[target]!, steps[stepIndex]!];
    updateUnit(unitIndex, { ...unit, steps });
  }
  function buildOption(step: EditableStep): LearningPathOptionDraft | null {
    const material = resources[0]; if (!material) return null;
    const projection = supportedProjections(material)[0]; if (!projection) return null;
    const ids = materialItemIds(material, projection);
    return {
      config: { objectiveMappings: ids.map((itemId) => ({ itemId, objectiveIds: step.objectiveIds })), selectedItemIds: ids },
      estimatedMinutes: material.estimatedMinutes && material.estimatedMinutes > 0 ? material.estimatedMinutes : 5,
      id: crypto.randomUUID(), isDefault: step.options.length === 0,
      label: projection === "video" ? "Ver video" : projection === "guide" ? "Leer guía" : projection === "quiz" ? "Responder cuestionario" : "Repasar tarjetas",
      projection, rewardIdentity: step.options[0]?.rewardIdentity ?? crypto.randomUUID(), rewardVersion: 1,
      sourceContentId: material.id,
    };
  }
  function addOption(unitIndex: number, stepIndex: number) {
    const unit = draft.definition.units[unitIndex]; const step = unit?.steps[stepIndex];
    if (!unit || !step) return; const next = buildOption(step); if (!next) return;
    updateStep(unitIndex, stepIndex, { ...step, options: [...step.options, next] });
  }
  function updateOption(unitIndex: number, stepIndex: number, optionIndex: number, patch: Partial<LearningPathOptionDraft>) {
    const unit = draft.definition.units[unitIndex]; const step = unit?.steps[stepIndex]; const current = step?.options[optionIndex];
    if (!unit || !step || !current) return;
    const material = resourceById.get(patch.sourceContentId ?? current.sourceContentId);
    const allowed = supportedProjections(material);
    const projection = allowed.includes((patch.projection ?? current.projection) as never)
      ? (patch.projection ?? current.projection) : allowed[0] ?? current.projection;
    const ids = material ? materialItemIds(material, projection) : [];
    const options = step.options.map((option, index) => index === optionIndex ? {
      ...option, ...patch, completionRule: undefined, projection,
      config: { objectiveMappings: ids.map((itemId) => ({ itemId, objectiveIds: step.objectiveIds })), selectedItemIds: ids },
    } : patch.isDefault ? { ...option, isDefault: false } : option);
    updateStep(unitIndex, stepIndex, { ...step, options });
  }

  function loadResources(reset: boolean) {
    const q = reset ? resourceQuery.trim() : appliedResourceQuery;
    const projection = reset ? resourceProjection : appliedResourceProjection;
    const topic = reset ? resourceTopic : appliedResourceTopic;
    const cursor = reset ? null : nextResourceCursor;
    if (!reset && !cursor) return;
    if (reset) {
      setAppliedResourceQuery(q);
      setAppliedResourceProjection(projection);
      setAppliedResourceTopic(topic);
    }
    setResourceMessage("");
    startResourceTransition(async () => {
      const query = new URLSearchParams({ limit: "24" });
      if (q) query.set("q", q);
      if (projection) query.set("projection", projection);
      if (topic) query.set("topic", topic);
      if (cursor) query.set("cursor", cursor);
      try {
        const response = await fetch(`/api/editor/learning-resources?${query.toString()}`);
        const result = await response.json() as LearningEditorResourceCatalogResponse & { error?: string };
        if (!response.ok) {
          setResourceMessage("No pudimos actualizar el catálogo de materiales.");
          return;
        }
        setResources((current) => {
          const selectedIds = new Set(draft.definition.units.flatMap((unit) => (
            unit.steps.flatMap((step) => step.options.map((option) => option.sourceContentId))
          )));
          const retained = reset ? current.filter((item) => selectedIds.has(item.id)) : current;
          return [...new Map([...retained, ...result.items].map((item) => [item.id, item])).values()];
        });
        setNextResourceCursor(result.nextCursor);
        setResourceMessage(result.items.length === 0 ? "No encontramos materiales con esos filtros." : "Catálogo actualizado.");
      } catch {
        setResourceMessage("No hay conexión para consultar más materiales.");
      }
    });
  }

  async function save() {
    if (!draft.title.trim() || !draft.slug || !draft.summary.trim() || !draft.topicContentId) {
      setMessage("Completa título, slug, resumen y tema antes de guardar."); return;
    }
    setBusy("save"); setMessage("");
    const updating = Boolean(savedPath);
    const body = updating ? { ...draft, expectedVersion: savedPath!.version.editVersion } : draft;
    try {
      const response = await fetch(updating ? `/api/editor/learning-paths/${savedPath!.id}` : "/api/editor/learning-paths", {
        body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: updating ? "PATCH" : "POST",
      });
      const result = await response.json() as LearningPathDetail & { error?: string };
      if (!response.ok || !result.id) {
        setMessage(result.error === "version_conflict" ? "Otra edición cambió esta ruta. Recarga antes de guardar." : "No pudimos guardar el borrador. Revisa los campos y recursos."); return;
      }
      setSavedPath(result); setDraft(fromDetail(result)); setDirty(false); setMessage("Borrador guardado en PostgreSQL.");
      if (!updating) router.push(`/panel/rutas/${result.id}`); else router.refresh();
    } catch { setMessage("No hay conexión para confirmar el guardado."); }
    finally { setBusy(""); }
  }

  async function validate() {
    if (!savedPath) { setMessage("Guarda primero el borrador para validarlo."); return; }
    setBusy("validate"); setMessage("");
    try {
      const response = await fetch(`/api/editor/learning-paths/${savedPath.id}/validate`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      const result = await response.json() as { issues?: LearningPathValidationIssue[]; ready?: boolean };
      setIssues(result.issues ?? []); setMessage(result.ready ? "La ruta cumple los controles automáticos." : "Hay brechas que debes resolver antes de revisión.");
    } catch { setMessage("No pudimos ejecutar la validación."); }
    finally { setBusy(""); }
  }

  async function transition(status: "in_review" | "changes_requested" | "approved" | "published" | "archived") {
    if (!savedPath) return; setBusy(status); setMessage("");
    if (status === "published" && !window.confirm("¿Publicar esta versión? La versión quedará inmutable y solo usará materiales ya revisados.")) {
      setBusy("");
      return;
    }
    try {
      const response = await fetch(`/api/editor/learning-paths/${savedPath.id}/transition`, {
        body: JSON.stringify({ expectedVersion: savedPath.version.editVersion, status }), headers: { "Content-Type": "application/json" }, method: "POST",
      });
      const result = await response.json() as LearningPathDetail & { error?: string; issues?: LearningPathValidationIssue[] };
      if (!response.ok || !result.id) { setIssues(result.issues ?? []); setMessage(response.status === 422 ? "La ruta aún no está lista para avanzar." : "No pudimos cambiar el estado editorial."); return; }
      setSavedPath(result); setDraft(fromDetail(result)); setDirty(false); setMessage(`Estado confirmado: ${statusLabels[result.version.status]}.`); router.refresh();
    } catch { setMessage("No hay conexión para confirmar el cambio editorial."); }
    finally { setBusy(""); }
  }

  async function createVersion() {
    if (!savedPath || savedPath.version.status !== "published") return;
    setBusy("version"); setMessage("");
    try {
      const response = await fetch(`/api/editor/learning-paths/${savedPath.id}/versions`, {
        body: JSON.stringify({ releaseNotes: "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json() as LearningPathDetail & { error?: string };
      if (!response.ok || !result.id) {
        setMessage(result.error === "conflict" ? "Ya existe un borrador activo para esta ruta." : "No pudimos crear la nueva versión.");
        return;
      }
      setSavedPath(result);
      setDraft(fromDetail(result));
      setDirty(false);
      setIssues([]);
      setMessage(`Versión ${result.version.number} creada como borrador. El alumnado sigue en su versión actual.`);
      setTab("structure");
      router.refresh();
    } catch {
      setMessage("No hay conexión para crear la nueva versión.");
    } finally {
      setBusy("");
    }
  }

  const editable = !savedPath || ["draft", "changes_requested"].includes(savedPath.version.status);
  return (
    <main className="learning-editor-main">
      <header className="learning-editor-header">
        <div><span>Panel editorial</span><h1>{savedPath ? savedPath.title : "Nueva ruta de aprendizaje"}</h1><p>Construye con publicaciones existentes y fija sus revisiones antes de solicitar revisión.</p></div>
        <div className="learning-editor-status"><span>{savedPath ? statusLabels[savedPath.version.status] : "Sin guardar"}</span>{dirty ? <small>Hay cambios sin guardar</small> : <small>Estado confirmado</small>}</div>
      </header>

      {!initialPath && paths.length > 0 ? <section className="learning-editor-existing"><h2>Rutas del espacio editorial</h2><div>{paths.map((path) => <Link href={`/panel/rutas/${path.id}`} key={path.id}><strong>{path.title}</strong><span>{statusLabels[path.version.status]} · v{path.version.number}</span></Link>)}</div></section> : null}

      <nav aria-label="Secciones del constructor" className="learning-editor-tabs">
        {([ ["structure", "Estructura"], ["materials", "Materiales"], ["preview", "Vista previa"], ["publication", "Publicación"] ] as const).map(([id, label]) => <button aria-pressed={tab === id} className={tab === id ? "is-active" : ""} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}
      </nav>

      {tab === "structure" || tab === "materials" ? (
        <form className="learning-editor-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={!editable || Boolean(busy)}><legend>Identidad de la ruta</legend><div className="learning-editor-field-grid">
            <label><span>Título</span><input required value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value, slug: draft.slug || slugify(event.target.value) })} /></label>
            <label><span>Slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => change({ ...draft, slug: slugify(event.target.value) })} /></label>
            <label><span>Tema publicado</span><select required value={draft.topicContentId} onChange={(event) => change({ ...draft, topicContentId: event.target.value })}><option value="">Selecciona un tema</option>{routeTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select><small>No se crean temas automáticamente.</small></label>
            <label><span>Portada</span><select value={draft.coverKey} onChange={(event) => change({ ...draft, coverKey: event.target.value as EditableDraft["coverKey"] })}>{coverOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="is-wide"><span>Resumen</span><textarea required maxLength={2000} rows={3} value={draft.summary} onChange={(event) => change({ ...draft, summary: event.target.value })} /></label>
            <label><span>Nivel de evidencia</span><select value={draft.definition.evidenceLevel} onChange={(event) => change({ ...draft, definition: { ...draft.definition, evidenceLevel: event.target.value as "standard" | "limited" } })}><option value="standard">Estándar (5 ítems por objetivo)</option><option value="limited">Introductoria, evidencia limitada</option></select></label>
            <label className="is-wide"><span>Notas de esta versión</span><textarea maxLength={4000} rows={2} value={draft.definition.releaseNotes} onChange={(event) => change({ ...draft, definition: { ...draft.definition, releaseNotes: event.target.value } })} /></label>
          </div></fieldset>

          {tab === "materials" ? <section className="learning-editor-resource-browser" aria-labelledby="resource-browser-title">
            <div className="learning-editor-section-title"><div><span>Biblioteca publicada</span><h2 id="resource-browser-title">Buscar materiales</h2></div><span>{resources.length} cargados</span></div>
            <div className="learning-editor-resource-filters">
              <label><span>Título</span><input onChange={(event) => setResourceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); loadResources(true); } }} placeholder="Ej. anatomía del corazón" type="search" value={resourceQuery} /></label>
              <label><span>Proyección</span><select onChange={(event) => setResourceProjection(event.target.value as typeof resourceProjection)} value={resourceProjection}><option value="">Todas</option><option value="video">Video</option><option value="guide">Guía</option><option value="quiz">Cuestionario</option><option value="flashcards">Flashcards</option></select></label>
              <label><span>Tema del material</span><select onChange={(event) => setResourceTopic(event.target.value)} value={resourceTopic}><option value="">Todos</option>{resourceTopics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label>
              <button className="learning-secondary-button" disabled={isResourcePending} onClick={() => loadResources(true)} type="button">{isResourcePending ? "Buscando…" : "Aplicar filtros"}</button>
            </div>
            <p aria-live="polite" className="learning-editor-resource-message">{resourceMessage || "Los indicadores muestran cobertura y brechas antes de fijar una revisión."}</p>
            {nextResourceCursor ? <button className="learning-editor-load-more" disabled={isResourcePending} onClick={() => loadResources(false)} type="button">{isResourcePending ? "Cargando…" : "Cargar más materiales"}</button> : null}
          </section> : null}

          <section className="learning-editor-units"><div className="learning-editor-section-title"><div><span>Estructura</span><h2>Unidades y actividades</h2></div>{editable ? <button className="learning-secondary-button" onClick={addUnit} type="button"><Plus size={18} />Agregar unidad</button> : null}</div>
            {draft.definition.units.length === 0 ? <div className="learning-editor-empty"><WarningCircle size={24} /><p>Agrega una unidad, un objetivo y actividades con materiales reales.</p></div> : null}
            {draft.definition.units.map((unit, unitIndex) => <fieldset className="learning-editor-unit" disabled={!editable || Boolean(busy)} key={unit.id ?? unit.stableKey}><legend>Unidad {unitIndex + 1}</legend>
              <div className="learning-editor-field-grid"><label><span>Título de unidad</span><input value={unit.title} onChange={(event) => updateUnit(unitIndex, { ...unit, title: event.target.value })} /></label><label><span>Clave estable</span><input value={unit.stableKey} onChange={(event) => updateUnit(unitIndex, { ...unit, stableKey: slugify(event.target.value) })} /></label><label className="is-wide"><span>Objetivo observable</span><input value={unit.objectives[0]?.title ?? ""} onChange={(event) => { const first = unit.objectives[0]; if (first) updateUnit(unitIndex, { ...unit, objectives: [{ ...first, title: event.target.value }, ...unit.objectives.slice(1)] }); }} /></label></div>
              <div className="learning-editor-steps">{unit.steps.map((step, stepIndex) => <article key={step.id ?? step.stableKey} className="learning-editor-step"><header><strong>Paso {stepIndex + 1}</strong><div><button aria-label="Subir paso" disabled={stepIndex === 0} onClick={() => moveStep(unitIndex, stepIndex, -1)} type="button"><ArrowUp size={18} /></button><button aria-label="Bajar paso" disabled={stepIndex === unit.steps.length - 1} onClick={() => moveStep(unitIndex, stepIndex, 1)} type="button"><ArrowDown size={18} /></button><button aria-label="Eliminar paso" onClick={() => updateUnit(unitIndex, { ...unit, steps: unit.steps.filter((_, index) => index !== stepIndex) })} type="button"><Trash size={18} /></button></div></header>
                <div className="learning-editor-field-grid"><label><span>Título</span><input value={step.title} onChange={(event) => updateStep(unitIndex, stepIndex, { ...step, title: event.target.value })} /></label><label><span>Propósito</span><select value={step.purpose} onChange={(event) => updateStep(unitIndex, stepIndex, { ...step, purpose: event.target.value as EditableStep["purpose"] })}><option value="understand">Comprender</option><option value="recall">Recordar</option><option value="check">Comprobar</option><option value="integrate">Integrar</option><option value="diagnostic">Diagnóstico</option></select></label><label className="learning-editor-check"><input checked={step.isEssential} onChange={(event) => updateStep(unitIndex, stepIndex, { ...step, isEssential: event.target.checked })} type="checkbox" /><span>Cuenta para el avance esencial</span></label></div>
                <div className="learning-editor-options">{step.options.map((option, optionIndex) => {
                  const material = resourceById.get(option.sourceContentId);
                  const projection = material?.projections.find((entry) => entry.projection === option.projection);
                  return <div className="learning-editor-option" key={option.id ?? `${option.sourceContentId}-${optionIndex}`}>
                    <label><span>Publicación fuente</span><select value={option.sourceContentId} onChange={(event) => updateOption(unitIndex, stepIndex, optionIndex, { sourceContentId: event.target.value })}>{material ? null : <option value={option.sourceContentId}>Material fijado · {option.sourceContentId.slice(0, 8)}</option>}{resources.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.kind} · v{item.version}</option>)}</select></label>
                    <label><span>Proyección</span><select value={option.projection} onChange={(event) => updateOption(unitIndex, stepIndex, optionIndex, { projection: event.target.value as LearningPathOptionDraft["projection"] })}>{material ? supportedProjections(material).map((value) => <option key={value} value={value}>{value}</option>) : <option value={option.projection}>{option.projection}</option>}</select></label>
                    <label><span>Etiqueta para estudiante</span><input value={option.label} onChange={(event) => updateOption(unitIndex, stepIndex, optionIndex, { label: event.target.value })} /></label>
                    <label className="learning-editor-check"><input checked={option.isDefault} name={`default-${step.id}`} onChange={() => updateOption(unitIndex, stepIndex, optionIndex, { isDefault: true })} type="radio" /><span>Opción recomendada</span></label>
                    {material ? <div className="learning-editor-resource-quality"><span>{material.topic || "Sin tema"} · revisión v{material.version}</span><strong>{projection ? `${projection.itemCount} ítems · ${projection.explanationCoverage === "complete" ? "explicaciones completas" : projection.explanationCoverage === "partial" ? "explicaciones parciales" : projection.explanationCoverage === "missing" ? "sin explicaciones" : "sin explicación requerida"}` : "Proyección no disponible"}</strong>{material.issues.map((issue) => <small key={issue}>{issue}</small>)}</div> : <p className="learning-editor-warning">Este material no está en la página cargada; su revisión fijada se conserva.</p>}
                    <button aria-label="Eliminar opción" className="learning-editor-remove" onClick={() => updateStep(unitIndex, stepIndex, { ...step, options: step.options.filter((_, index) => index !== optionIndex) })} type="button"><Trash size={18} />Quitar</button>
                  </div>;
                })}</div>
                {resources.length > 0 ? <button className="learning-editor-add-option" onClick={() => addOption(unitIndex, stepIndex)} type="button"><Plus size={18} />Añadir opción de material</button> : <p className="learning-editor-warning">No hay publicaciones evaluables disponibles en el espacio editorial.</p>}
              </article>)}</div>
              <button className="learning-editor-add-step" onClick={() => addStep(unitIndex)} type="button"><Plus size={18} />Agregar actividad</button>
            </fieldset>)}
          </section>
          <div className="learning-editor-savebar"><p aria-live="polite">{message || (dirty ? "Cambios pendientes de guardar en el servidor." : "Sin cambios pendientes.")}</p><button className="learning-primary-button" disabled={!editable || Boolean(busy)} type="submit"><FloppyDisk size={19} />{busy === "save" ? "Guardando…" : "Guardar borrador"}</button></div>
        </form>
      ) : tab === "preview" ? (
        <section className="learning-editor-preview"><div className="learning-editor-section-title"><div><span>Sin tracking</span><h2>Vista previa estructural</h2></div>{savedPath ? <Link className="learning-secondary-button" href={`/api/editor/learning-paths/${savedPath.id}/preview`} target="_blank"><Eye size={18} />DTO confirmado</Link> : null}</div><h3>{draft.title || "Ruta sin título"}</h3><p>{draft.summary || "Añade un resumen para el estudiante."}</p>{draft.definition.units.map((unit) => <article key={unit.id ?? unit.stableKey}><strong>{unit.title}</strong><span>{unit.steps.length} actividades · {unit.objectives.length} objetivos</span><ul>{unit.steps.map((step) => <li key={step.id ?? step.stableKey}>{step.title} — {step.options.map((option) => option.projection).join(" / ") || "sin material"}</li>)}</ul></article>)}</section>
      ) : (
        <section className="learning-editor-publication">
          <div><span>Workflow académico</span><h2>Validación y publicación</h2><p>La publicación no crea contenido académico ni corrige brechas: solo fija referencias ya revisadas.</p></div>
          {savedPath?.version.status === "published" ? <div className="learning-editor-version-callout"><strong>La versión {savedPath.version.number} es inmutable</strong><p>Para reorganizar o actualizar materiales, crea un borrador nuevo. Las matrículas existentes no cambian hasta que cada estudiante revise y acepte la actualización.</p><button className="learning-primary-button" disabled={Boolean(busy)} onClick={() => void createVersion()} type="button"><Plus size={19} />{busy === "version" ? "Creando…" : `Crear borrador v${savedPath.version.number + 1}`}</button></div> : null}
          <button className="learning-secondary-button" disabled={!savedPath || Boolean(busy)} onClick={() => void validate()} type="button"><CheckCircle size={19} />{busy === "validate" ? "Validando…" : "Validar ruta"}</button>
          {savedPath?.version.status === "draft" || savedPath?.version.status === "changes_requested" ? <button className="learning-primary-button" disabled={dirty || Boolean(busy)} onClick={() => void transition("in_review")} type="button">Enviar a revisión</button> : null}
          {savedPath?.version.status === "in_review" && canReview ? <><button className="learning-secondary-button" disabled={Boolean(busy)} onClick={() => void transition("changes_requested")} type="button">Solicitar cambios</button><button className="learning-primary-button" disabled={Boolean(busy)} onClick={() => void transition("approved")} type="button">Aprobar</button></> : null}
          {savedPath?.version.status === "approved" && canPublish ? <button className="learning-primary-button" disabled={Boolean(busy)} onClick={() => void transition("published")} type="button">Publicar versión</button> : null}
          <p aria-live="polite" className="learning-editor-message">{message}</p>
          {issues.length > 0 ? <ul className="learning-editor-issues">{issues.map((issue, index) => <li data-severity={issue.severity} key={`${issue.code}-${index}`}><strong>{issue.message}</strong><span>{issue.path}</span></li>)}</ul> : null}
        </section>
      )}
    </main>
  );
}
