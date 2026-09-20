"use client";

import type { LearningEditorMaterialItem, LearningObjective } from "@cediah/contracts";
import type { EditorOption } from "./editor-model";
import styles from "./route-editor.module.css";

export function ObjectiveMappingEditor({
  disabled,
  items,
  objectives,
  onChange,
  option,
}: {
  disabled: boolean;
  items: LearningEditorMaterialItem[];
  objectives: LearningObjective[];
  onChange: (input: Pick<EditorOption["config"], "objectiveMappings" | "selectedItemIds">) => void;
  option: EditorOption;
}) {
  const selected = new Set(option.config.selectedItemIds);
  const mappingByItem = new Map(option.config.objectiveMappings.map((mapping) => [mapping.itemId, mapping]));

  function toggleItem(itemId: string, checked: boolean) {
    const selectedItemIds = checked
      ? [...new Set([...option.config.selectedItemIds, itemId])]
      : option.config.selectedItemIds.filter((id) => id !== itemId);
    const objectiveMappings = checked
      ? mappingByItem.has(itemId)
        ? option.config.objectiveMappings
        : [...option.config.objectiveMappings, { itemId, objectiveIds: [] }]
      : option.config.objectiveMappings.filter((mapping) => mapping.itemId !== itemId);
    onChange({ objectiveMappings, selectedItemIds });
  }

  function toggleObjective(itemId: string, objectiveId: string, checked: boolean) {
    if (!selected.has(itemId)) return;
    const current = mappingByItem.get(itemId) ?? { itemId, objectiveIds: [] };
    const objectiveIds = checked
      ? [...new Set([...current.objectiveIds, objectiveId])]
      : current.objectiveIds.filter((id) => id !== objectiveId);
    const objectiveMappings = [
      ...option.config.objectiveMappings.filter((mapping) => mapping.itemId !== itemId),
      { itemId, objectiveIds },
    ];
    onChange({ objectiveMappings, selectedItemIds: option.config.selectedItemIds });
  }

  return (
    <div className={styles.mappingEditor}>
      <p>Preguntas y objetivos</p>
      <ul>
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          const mapping = mappingByItem.get(item.id);
          return (
            <li key={item.id}>
              <label className={styles.mappingItem}>
                <input checked={isSelected} disabled={disabled} onChange={(event) => toggleItem(item.id, event.target.checked)} type="checkbox" />
                <span>{item.prompt}</span>
              </label>
              {isSelected ? (
                <div className={styles.mappingObjectives}>
                  {objectives.map((objective) => <label key={objective.id}><input checked={mapping?.objectiveIds.includes(objective.id) ?? false} disabled={disabled} onChange={(event) => toggleObjective(item.id, objective.id, event.target.checked)} type="checkbox" /><span>{objective.title}</span></label>)}
                  {!mapping || mapping.objectiveIds.length === 0 ? <small>Selecciona al menos un objetivo para este ítem.</small> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
