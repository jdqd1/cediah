"use client";

import type { PresentedIssue } from "./editor-issues";
import styles from "./route-editor.module.css";

export function IssueCard({ disabled = false, issue, onResolve }: { disabled?: boolean; issue: PresentedIssue; onResolve: () => void }) {
  return (
    <li className={styles.issue} data-severity={issue.severity}>
      <div>
        <span className={styles.issueKind}>{issue.severity === "error" ? "Por resolver" : "Sugerencia"}</span>
        <h3>{issue.title}</h3>
        <p className={styles.location}>{issue.location}</p>
        <p>{issue.resolution}</p>
      </div>
      <button className={styles.secondaryButton} disabled={disabled} onClick={onResolve} type="button">{issue.actionLabel}</button>
    </li>
  );
}
