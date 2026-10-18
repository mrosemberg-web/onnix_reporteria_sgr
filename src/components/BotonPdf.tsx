"use client";

/**
 * Exporta la pantalla actual a PDF con el diálogo de impresión del navegador
 * («Guardar como PDF»). El título del documento se usa como nombre del archivo.
 */
export function BotonPdf({ nombreArchivo }: { nombreArchivo: string }) {
  function exportar() {
    const original = document.title;
    document.title = nombreArchivo;
    const restaurar = () => {
      document.title = original;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    window.print();
  }
  return (
    <button type="button" className="boton sec no-imprimir" onClick={exportar} title="Abre el diálogo de impresión: elegí «Guardar como PDF»">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 1h6l3 3v11H4z M10 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 9.5h5M6 12h5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      Exportar PDF
    </button>
  );
}
