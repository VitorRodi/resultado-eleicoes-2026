import { cityResultsSchema } from "./city-results";
import type { Office } from "../types/election";

export async function requestCityVotes(selection: { uf: string; office: Office; city: string }, signal: AbortSignal, format?: "xlsx") {
  const params = new URLSearchParams({ ...selection, ...(format ? { format } : {}) });
  const response = await fetch(`/api/elections/municipal/list?${params}`, { cache: "no-store", signal });
  signal.throwIfAborted();
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    signal.throwIfAborted();
    throw new Error(data?.error || "Não foi possível consultar a cidade. Tente novamente.");
  }
  if (format) {
    if (!response.headers.get("Content-Type")?.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      throw new Error("O arquivo Excel não foi recebido. Tente baixar novamente.");
    const blob = await response.blob();
    signal.throwIfAborted();
    return blob;
  }
  const data = cityResultsSchema.parse(await response.json());
  signal.throwIfAborted();
  if (data.uf !== selection.uf || data.office !== selection.office || data.municipality.code !== selection.city)
    throw new Error("Resultado de outra cidade ou cargo rejeitado. Consulte novamente.");
  if (!data.verifiedSignatures) throw new Error("Os votos desta cidade estão indisponíveis. Tente novamente.");
  return data;
}
