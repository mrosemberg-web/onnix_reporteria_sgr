"use client";

export default function ErrorReporte({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 640, display: "grid", gap: 12 }}>
      <h2>No se pudo cargar esta pantalla</h2>
      <p>Puede ser un problema momentáneo de conexión con la base de datos.</p>
      <p className="debil" style={{ fontSize: "0.85rem" }}>
        Si se repite, un administrador puede abrir <a href="/api/salud">/api/salud</a> para ver el diagnóstico.
        {error.digest && <> Referencia: {error.digest}</>}
      </p>
      <div><button className="boton" onClick={reset}>Reintentar</button></div>
    </div>
  );
}
