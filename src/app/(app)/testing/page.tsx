import { PaginaFase } from "@/components/PaginaFase";
import type { SearchParams } from "@/lib/filtros";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testing" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <PaginaFase fz="test" searchParams={searchParams} />;
}
