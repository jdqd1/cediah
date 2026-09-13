import Image from "next/image";

type BrandPlatformPreviewProps = {
  className?: string;
};

export function BrandPlatformPreview({ className = "" }: BrandPlatformPreviewProps) {
  return (
    <div className={`brand-platform-preview ${className}`.trim()} aria-hidden="true">
      <div className="brand-preview-window">
        <div className="brand-preview-sidebar">
          <Image src="/brand/koras-mark-dark.png" alt="" width={1254} height={1254} />
          <span className="is-active"><i /> Inicio</span>
          <span><i /> Materias</span>
          <span><i /> Videos</span>
          <span><i /> Guías</span>
        </div>

        <div className="brand-preview-content">
          <div className="brand-preview-toolbar">
            <span />
            <i />
          </div>
          <small>Tu espacio de estudio</small>
          <h3>Continúa aprendiendo</h3>
          <div className="brand-preview-cards">
            <div>
              <span className="brand-preview-card-icon">A</span>
              <strong>Anatomía humana</strong>
              <small>12 lecciones</small>
              <i><b style={{ width: "72%" }} /></i>
            </div>
            <div>
              <span className="brand-preview-card-icon">F</span>
              <strong>Fisiología</strong>
              <small>8 lecciones</small>
              <i><b style={{ width: "54%" }} /></i>
            </div>
            <div>
              <span className="brand-preview-card-icon">H</span>
              <strong>Histología</strong>
              <small>10 lecciones</small>
              <i><b style={{ width: "38%" }} /></i>
            </div>
          </div>
          <div className="brand-preview-progress">
            <div>
              <small>Progreso general</small>
              <strong>38%</strong>
            </div>
            <span><i style={{ width: "38%" }} /></span>
            <small>12 de 32 lecciones completadas</small>
          </div>
        </div>
      </div>

      <div className="brand-preview-phone">
        <span className="brand-preview-phone-speaker" />
        <Image src="/brand/koras-mark-light.png" alt="" width={1254} height={1254} />
        <small>Próxima actividad</small>
        <strong>Intercambio alveolar</strong>
        <span className="brand-preview-phone-progress"><i /></span>
        <span className="brand-preview-phone-button">Continuar <span>→</span></span>
      </div>
    </div>
  );
}
