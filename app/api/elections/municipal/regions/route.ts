import data from "@/data/municipal-regions.json";
import { BRAZIL_STATES } from "@/lib/brazil-states";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get("uf")?.toLowerCase();
  if (!BRAZIL_STATES.some((state) => state.uf.toLowerCase() === uf))
    return Response.json({ error: "UF inválida." }, { status: 400 });
  return Response.json(
    {
      uf,
      definition: data.definition,
      source: data.source,
      municipalities: Object.fromEntries(
        Object.entries(data.municipalities).filter(
          ([, city]) => city.uf === uf,
        ),
      ),
    },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
