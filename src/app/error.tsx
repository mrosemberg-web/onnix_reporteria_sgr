"use client";

export default function ErrorGeneral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="acceso">
      <div className="acceso-caja">
        <section className="panel" style={{ display: "grid", gap: 12 }}>
          <h2>Algo salió mal</h2>
          <p>No se pudo completar la operación. Suele deberse a la conexión con la base de datos.</p>
          <p className="debil" style={{ fontSize: "0.85rem" }}>
            Diagnóstico: <a href="/api/salud">/api/salud</a>.{error.digest && <> Referencia: {error.digest}</>}
          </p>
          <div><button className="boton" onClick={reset}>Reintentar</button></div>
        </section>
      </div>
    </main>
  );
}
