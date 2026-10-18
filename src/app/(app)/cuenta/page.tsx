import { requerirSesion } from "@/lib/auth";
import { FormClave } from "./FormClave";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const s = await requerirSesion();
  return (
    <>
      <header className="encabezado">
        <div>
          <h1>Mi cuenta</h1>
          <p>{s.nombre}, usuario «{s.usuario}», perfil {s.rol === "admin" ? "administrador" : "de consulta"}.</p>
        </div>
      </header>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2>Cambiar clave</h2>
        <FormClave />
      </section>
    </>
  );
}
