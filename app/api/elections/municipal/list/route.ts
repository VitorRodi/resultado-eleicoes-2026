import {
  getCityCandidateList,
  UnknownMunicipalityError,
} from "@/services/tse/service";
import { cityWorkbook } from "@/lib/city-workbook";
import { OFFICES, type Office } from "@/types/election";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    uf = params.get("uf")?.toLowerCase(),
    office = params.get("office"),
    city = params.get("city");
  if (!uf || !OFFICES.includes(office as Office) || !city)
    return Response.json(
      { error: "Selecione cidade e cargo." },
      { status: 400 },
    );
  try {
    const data = await getCityCandidateList(uf, office as Office, city);
    if (!data.verifiedSignatures)
      return Response.json(
        {
          error: "Os votos desta cidade estão indisponíveis. Tente novamente.",
        },
        { status: 503 },
      );
    if (params.get("format") === "xlsx") {
      if (!["counting", "finished"].includes(data.status))
        return Response.json(
          { error: "A votação ainda não foi divulgada." },
          { status: 409 },
        );
      return new Response(await cityWorkbook(data), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="votos-${uf}-${city}-${office}-2026.xlsx"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof UnknownMunicipalityError
            ? error.message
            : "Não foi possível consultar os votos desta cidade.",
      },
      { status: error instanceof UnknownMunicipalityError ? 400 : 503 },
    );
  }
}
