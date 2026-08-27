import { CediahLogo } from "./cediah-logo";

export function RouteLoadingScreen() {
  return (
    <main className="route-loading route-loading-screen" aria-busy="true" aria-live="polite">
      <div className="route-loading-lockup">
        <CediahLogo variant="dark" priority />
        <p>Preparando tu espacio de estudio</p>
        <span className="route-loading-progress" aria-hidden="true">
          <span />
        </span>
      </div>
    </main>
  );
}
