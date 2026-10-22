import { PaginaSeguimientoFase } from "@/components/PaginaSeguimientoFase";
import type { SearchParams } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testing en curso" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <PaginaSeguimientoFase fz="test" searchParams={searchParams} />;
}
