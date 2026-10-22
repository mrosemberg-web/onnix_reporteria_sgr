import { PaginaSeguimientoFase } from "@/components/PaginaSeguimientoFase";
import type { SearchParams } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const metadata = { title: "Desarrollo en curso" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <PaginaSeguimientoFase fz="desa" searchParams={searchParams} />;
}
