// Gráficos SVG livianos, renderizados en el servidor (sin librerías de terceros).
import { horas, num, pct } from "@/lib/formato";

/** Máximo del eje: 4 divisiones con paso "redondo" (1, 2, 2,5 o 5 × 10^k; nunca fracciones en conteos chicos). */
function maxRedondo(v: number, div = 4) {
  if (v <= 0) return div;
  const crudo = v / div;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const pasos = p >= 10 ? [1, 1.5, 2, 2.5, 3, 4, 5, 10] : [1, 2, 3, 5, 10];
  const paso = (pasos.find((m) => m * p >= crudo) ?? 10) * p;
  return Math.max(paso, 1) * div;
}
const marcas = (max: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => (max / n) * i);

// ---------------------------------------------------------------------------
// Barras mensuales + línea de acumulado
// ---------------------------------------------------------------------------
export function BarrasAcumulado({
  datos, color = "var(--desa)", resaltarUltimo = false, unidad = "SGR",
}: {
  datos: { etiqueta: string; valor: number; acumulado: number }[];
  color?: string; resaltarUltimo?: boolean; unidad?: string;
}) {
  const W = 720, H = 290, L = 34, R = 46, T = 26, B = 30;
  const ancho = W - L - R, alto = H - T - B;
  const maxV = maxRedondo(Math.max(1, ...datos.map((d) => d.valor)) * 1.1);
  const maxA = maxRedondo(Math.max(1, ...datos.map((d) => d.acumulado)));
  const banda = ancho / Math.max(datos.length, 1);
  const xb = (i: number) => L + i * banda + banda / 2;
  const yv = (v: number) => T + alto - (v / maxV) * alto;
  const ya = (v: number) => T + alto - (v / maxA) * alto;
  const linea = datos.map((d, i) => `${i ? "L" : "M"}${xb(i).toFixed(1)},${ya(d.acumulado).toFixed(1)}`).join(" ");
  const ult = datos.length - 1;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Entregas por mes y acumulado. Total acumulado: ${datos[ult]?.acumulado ?? 0} ${unidad}.`}>
        {marcas(maxV).map((m) => (
          <g key={m}>
            <line className="eje" x1={L} x2={W - R} y1={yv(m)} y2={yv(m)} strokeDasharray={m ? "2 4" : undefined} />
            <text x={L - 8} y={yv(m) + 4} textAnchor="end">{num(m)}</text>
          </g>
        ))}
        {marcas(maxA).map((m) => (
          <text key={m} x={W - R + 8} y={ya(m) + 4} style={{ fill: "var(--tinta-3)" }}>{num(m)}</text>
        ))}
        {datos.map((d, i) => {
          const bw = Math.min(banda * 0.58, 40);
          const tenue = resaltarUltimo && i === ult;
          return (
            <g key={i}>
              <rect x={xb(i) - bw / 2} y={yv(d.valor)} width={bw} height={Math.max(0, T + alto - yv(d.valor))} rx={3}
                fill={color} opacity={tenue ? 0.45 : 0.9}>
                <title>{`${d.etiqueta}: ${d.valor} ${unidad} (acumulado ${d.acumulado})`}</title>
              </rect>
              {d.valor > 0 && (T + alto - yv(d.valor) > 22
                ? <text x={xb(i)} y={yv(d.valor) + 15} textAnchor="middle" style={{ fill: "var(--superficie)", fontWeight: 650 }}>{d.valor}</text>
                : <text x={xb(i)} y={yv(d.valor) - 6} textAnchor="middle" style={{ fill: "var(--tinta)", fontWeight: 600 }}>{d.valor}</text>)}
              <text x={xb(i)} y={H - 10} textAnchor="middle">{d.etiqueta}</text>
            </g>
          );
        })}
        <path d={linea} fill="none" stroke="var(--tinta)" strokeWidth={2} />
        {datos.map((d, i) => (
          <circle key={i} cx={xb(i)} cy={ya(d.acumulado)} r={3.5} fill="var(--superficie)" stroke="var(--tinta)" strokeWidth={2}>
            <title>{`Acumulado a ${d.etiqueta}: ${d.acumulado}`}</title>
          </circle>
        ))}
      </svg>
      <div className="leyenda">
        <span><i style={{ background: color }} />{unidad} entregados en el mes</span>
        <span><i style={{ background: "var(--tinta)", height: 2, verticalAlign: 3 }} />Acumulado del año (eje derecho)</span>
        {resaltarUltimo && <span>El último mes está en curso.</span>}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Presupuestado (contorno) vs trabajado (relleno) por mes
// ---------------------------------------------------------------------------
export function BarrasPresuReal({
  datos, color,
}: { datos: { etiqueta: string; presu: number; real: number }[]; color: string }) {
  const W = 720, H = 260, L = 46, R = 12, T = 18, B = 30;
  const ancho = W - L - R, alto = H - T - B;
  const max = maxRedondo(Math.max(1, ...datos.flatMap((d) => [d.presu, d.real])) * 1.05);
  const banda = ancho / Math.max(datos.length, 1);
  const x = (i: number) => L + i * banda + banda / 2;
  const y = (v: number) => T + alto - (v / max) * alto;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horas presupuestadas y trabajadas por mes">
        {marcas(max).map((m) => (
          <g key={m}>
            <line className="eje" x1={L} x2={W - R} y1={y(m)} y2={y(m)} strokeDasharray={m ? "2 4" : undefined} />
            <text x={L - 8} y={y(m) + 4} textAnchor="end">{num(m)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const bp = Math.min(banda * 0.62, 44), br = bp * 0.5;
          const exceso = d.real > d.presu;
          return (
            <g key={i}>
              <title>{`${d.etiqueta}: ${horas(d.real)} trabajadas, ${horas(d.presu)} presupuestadas`}</title>
              <rect x={x(i) - bp / 2} y={y(d.presu)} width={bp} height={T + alto - y(d.presu)} rx={2}
                fill="none" stroke="var(--tinta-2)" strokeDasharray="3 2" />
              <rect x={x(i) - br / 2} y={y(d.real)} width={br} height={T + alto - y(d.real)} rx={2}
                fill={exceso ? "var(--mal)" : color} opacity={0.9} />
              <text x={x(i)} y={H - 10} textAnchor="middle">{d.etiqueta}</text>
            </g>
          );
        })}
      </svg>
      <div className="leyenda">
        <span><i style={{ border: "1px dashed var(--tinta-2)" }} />Presupuestadas</span>
        <span><i style={{ background: color }} />Trabajadas, dentro del presupuesto</span>
        <span><i style={{ background: "var(--mal)" }} />Trabajadas, sobre el presupuesto</span>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Barra de libro: trabajadas vs presupuestadas en una fila de tabla
// ---------------------------------------------------------------------------
export function BarraLibro({ real, presu, max, color }: { real: number; presu: number; max: number; color: string }) {
  const W = 150, H = 14;
  const k = max > 0 ? W / max : 0;
  const base = Math.min(real, presu) * k;
  const exceso = Math.max(real - presu, 0) * k;
  return (
    <svg className="libro" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${horas(real)} trabajadas de ${horas(presu)} presupuestadas`}>
      <rect x={0} y={3} width={W} height={8} rx={2} fill="var(--superficie-2)" />
      <rect x={0} y={3} width={base} height={8} rx={2} fill={color} />
      {exceso > 0 && <rect x={base} y={3} width={exceso} height={8} fill="var(--mal)" />}
      {presu > 0 && <rect x={Math.min(presu * k, W - 2)} y={0} width={2} height={H} fill="var(--tinta)" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Distribución de SGR según desvío
// ---------------------------------------------------------------------------
export function Distribucion({ dentro, leve, sobre, sinRegistro }: { dentro: number; leve: number; sobre: number; sinRegistro: number }) {
  const total = dentro + leve + sobre + sinRegistro;
  const seg = [
    { v: dentro, c: "var(--bien)", t: "Dentro del presupuesto" },
    { v: leve, c: "var(--leve)", t: "Desvío hasta 10 %" },
    { v: sobre, c: "var(--mal)", t: "Desvío mayor a 10 %" },
    { v: sinRegistro, c: "var(--tinta-3)", t: "Sin horas cargadas" },
  ];
  let acc = 0;
  return (
    <div>
      <svg className="grafico" viewBox="0 0 600 22" preserveAspectRatio="none" role="img" style={{ height: 22 }}
        aria-label={seg.map((s) => `${s.t}: ${s.v}`).join(", ")}>
        {seg.map((s) => {
          const w = total ? (s.v / total) * 600 : 0;
          const r = <rect key={s.t} x={acc} y={0} width={w} height={22} fill={s.c}><title>{`${s.t}: ${s.v}`}</title></rect>;
          acc += w;
          return r;
        })}
      </svg>
      <div className="leyenda">
        {seg.map((s) => (
          <span key={s.t}><i style={{ background: s.c }} />{s.t}: <strong>{num(s.v)}</strong> ({pct(total ? s.v / total : 0)})</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dispersión presupuestado vs trabajado por SGR (escala raíz cuadrada)
// ---------------------------------------------------------------------------
export function Dispersion({ puntos, color }: {
  puntos: { id_req: string; responsable: string; horas_presu: number; horas_real: number }[]; color: string;
}) {
  const W = 560, H = 380, L = 44, R = 14, T = 14, B = 40;
  const ancho = W - L - R, alto = H - T - B;
  const max = maxRedondo(Math.max(10, ...puntos.flatMap((p) => [p.horas_presu, p.horas_real])));
  const s = (v: number) => Math.sqrt(Math.max(v, 0) / max);
  const x = (v: number) => L + s(v) * ancho;
  const y = (v: number) => T + alto - s(v) * alto;
  const ticks = [0, 10, 25, 50, 100, 200, 400, 800, 1600, 3200].filter((t) => t <= max);
  const diag = Array.from({ length: 41 }, (_, i) => (max * i) / 40);
  const camino = (f: number) => diag.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(Math.min(v * f, max)).toFixed(1)}`).join(" ");
  return (
    <figure style={{ margin: 0 }}>
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horas presupuestadas contra horas trabajadas por SGR">
        {ticks.map((t) => (
          <g key={t}>
            <line className="eje" x1={x(t)} x2={x(t)} y1={T} y2={T + alto} strokeDasharray="2 4" />
            <line className="eje" x1={L} x2={L + ancho} y1={y(t)} y2={y(t)} strokeDasharray="2 4" />
            <text x={x(t)} y={T + alto + 16} textAnchor="middle">{t}</text>
            <text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <path d={camino(1)} stroke="var(--tinta)" strokeWidth={1.5} fill="none" />
        <path d={camino(1 + 0.1)} stroke="var(--tinta-3)" strokeWidth={1} strokeDasharray="4 3" fill="none" />
        {puntos.map((p) => {
          const c = p.horas_real === 0 ? "var(--tinta-3)" : p.horas_real <= p.horas_presu ? color
            : p.horas_real <= p.horas_presu * 1.1 ? "var(--leve)" : "var(--mal)";
          return (
            <circle key={p.id_req} cx={x(p.horas_presu)} cy={y(p.horas_real)} r={4} fill={c} fillOpacity={0.75} stroke="var(--superficie)">
              <title>{`SGR ${p.id_req} (${p.responsable}): ${horas(p.horas_real)} trabajadas, ${horas(p.horas_presu)} presupuestadas`}</title>
            </circle>
          );
        })}
        <text x={L + ancho / 2} y={H - 4} textAnchor="middle">Horas presupuestadas</text>
        <text transform={`translate(12 ${T + alto / 2}) rotate(-90)`} textAnchor="middle">Horas trabajadas</text>
      </svg>
      <div className="leyenda">
        <span>Debajo de la diagonal: se usaron menos horas de las presupuestadas.</span>
        <span><i style={{ background: "var(--tinta-3)", height: 2, verticalAlign: 3 }} />Línea punteada: +10 %</span>
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontales simples
// ---------------------------------------------------------------------------
export function BarrasH({ datos, color = "var(--desa)", formato = (v: number) => num(v) }: {
  datos: { etiqueta: string; valor: number }[]; color?: string; formato?: (v: number) => string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const fila = 30, W = 480, L = 120, R = 50;
  return (
    <svg className="grafico" viewBox={`0 0 ${W} ${datos.length * fila}`} role="img"
      aria-label={datos.map((d) => `${d.etiqueta}: ${formato(d.valor)}`).join(", ")}>
      {datos.map((d, i) => (
        <g key={d.etiqueta} transform={`translate(0 ${i * fila})`}>
          <text x={L - 10} y={19} textAnchor="end" style={{ fill: "var(--tinta)" }}>{d.etiqueta}</text>
          <rect x={L} y={7} width={((W - L - R) * d.valor) / max} height={16} rx={3} fill={color} />
          <text x={L + ((W - L - R) * d.valor) / max + 8} y={19} style={{ fontWeight: 600, fill: "var(--tinta)" }}>{formato(d.valor)}</text>
        </g>
      ))}
    </svg>
  );
}
