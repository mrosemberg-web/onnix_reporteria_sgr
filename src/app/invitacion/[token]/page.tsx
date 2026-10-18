import Link from "next/link";
import { hashToken } from "@/lib/auth";
import { asegurarConexion, sql } from "@/lib/db";
import { fechaHora } from "@/lib/formato";
import { FormInvitacion } from "./FormInvitacion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Invitación" };

export default async function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await asegurarConexion();
  const [inv] = await sql<{ rol: string; expira_en: Date }[]>`
    select rol, expira_en from invitaciones
    where token_hash = ${hashToken(token)} and usada_en is null and not revocada and expira_en > now()`;
  return (
    <main className="acceso">
      <div className="acceso-caja">
        <header>
          <strong>Crear tu usuario</strong>
          <span>Productividad del servicio</span>
        </header>
        <section className="panel">
          {inv ? (
            <>
              <p style={{ marginBottom: 16, color: "var(--tinta-2)" }}>
                Vas a ingresar con perfil {inv.rol === "admin" ? "administrador" : "de consulta"}. El enlace vence el {fechaHora(inv.expira_en)}.
              </p>
              <FormInvitacion token={token} />
            </>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <p className="aviso error">Esta invitación ya se usó, venció o fue revocada.</p>
              <p>Pedile a un administrador que te genere un enlace nuevo.</p>
              <Link href="/login">Ir al ingreso</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
