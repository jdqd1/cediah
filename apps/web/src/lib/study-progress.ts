export function studyProgress(completed: number, total: number) {
  const value = Math.max(0, Math.min(completed, total));
  return {
    value,
    tone: value === 0 ? "start" : value >= total ? "complete" : "progress",
  } as const;
}

export function quizPerformance(correct: number, total: number) {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  if (percentage >= 80) {
    return { percentage, tone: "excellent", title: "¡Muy buen trabajo!", message: "Tienes una base sólida. Sigue conectando lo que aprendes." } as const;
  }
  if (percentage >= 50) {
    return { percentage, tone: "developing", title: "Vas por buen camino", message: "Repasa los puntos que faltan y vuelve a intentarlo." } as const;
  }
  return { percentage, tone: "review", title: "Cada intento cuenta", message: "Vuelve a la guía, repasa con calma y prueba de nuevo." } as const;
}
