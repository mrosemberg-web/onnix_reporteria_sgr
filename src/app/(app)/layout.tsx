import Link from "next/link";
import { Suspense } from "react";
import { Nav } from "@/components/Nav";
import { requerirSesion } from "@/lib/auth";
import { salir } from "./acciones";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await requerirSesion();
  return (
    <div className="marco">
      <aside className="lateral">
        <div className="marca">
          <strong>Productividad</strong>
          <span>Servicio de desarrollo y testing</span>
        </div>
        <Suspense>
          <Nav esAdmin={s.rol === "admin"} />
        </Suspense>
        <div className="lateral-pie">
          <span>{s.nombre}</span>
          <Link href="/cuenta">Mi cuenta</Link>
          <form action={salir}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
