// Crea el primer usuario administrador.
// Uso: npm run crear-admin -- <usuario> "<Nombre Apellido>" <clave>
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { requireEnv } from "./_env.mjs";

const [usuario, nombre, clave] = process.argv.slice(2);
if (!usuario || !nombre || !clave) {
  console.error('Uso: npm run crear-admin -- <usuario> "<Nombre Apellido>" <clave>');
  process.exit(1);
}
if (!/^[a-zA-Z0-9._-]{3,40}$/.test(usuario)) {
  console.error("El usuario debe tener 3 a 40 caracteres: letras, números, punto, guion o guion bajo.");
  process.exit(1);
}
if (clave.length < 10) {
  console.error("La clave debe tener al menos 10 caracteres.");
  process.exit(1);
}

const sql = postgres(requireEnv("DATABASE_URL"), { prepare: false, max: 1 });
try {
  const hash = await bcrypt.hash(clave, 12);
  await sql`insert into usuarios (usuario, nombre, clave_hash, rol) values (${usuario}, ${nombre}, ${hash}, 'admin')`;
  console.log(`Administrador "${usuario}" creado.`);
} catch (e) {
  console.error(e.code === "23505" ? "Ese usuario ya existe." : `Error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
