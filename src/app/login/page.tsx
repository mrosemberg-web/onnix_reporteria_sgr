import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { FormIngreso } from "./FormIngreso";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "Ingresar" };

export default async function Login() {
  if (await obtenerSesion()) redirect("/");
  return (
    <main className="acceso">
      <div className="acceso-caja">
        <header>
          <strong>Productividad del servicio</strong>
          <span>Reportes de desarrollo y testing</span>
        </header>
        <section className="panel">
          <FormIngreso />
        </section>
        <p className="debil" style={{ fontSize: "0.85rem" }}>¿No tenés usuario? Pedile a un administrador un enlace de invitación.</p>
      </div>
    </main>
  );
}
