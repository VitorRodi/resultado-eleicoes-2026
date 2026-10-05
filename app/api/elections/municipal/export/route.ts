import { municipalExportSchema } from "@/lib/municipal-export";
import {
  municipalWorkbook,
  municipalWorkbookName,
} from "@/lib/municipal-workbook";
import { historicalCandidate } from "@/services/tse/historical";
import { UnknownMunicipalityError } from "@/services/tse/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  let data;
  try {
    const text = await request.text();
    if (text.length > 700_000)
      return Response.json(
        { error: "A planilha excedeu o limite de tamanho." },
        { status: 413 },
      );
    data = municipalExportSchema.parse(JSON.parse(text));
  } catch {
    return Response.json(
      { error: "Os dados municipais são inválidos. Consulte novamente." },
      { status: 400 },
    );
  }
  try {
    const history = data.historyCandidateId
      ? await historicalCandidate(data.uf, data.historyCandidateId)
      : undefined;
    return new Response(await municipalWorkbook(data, new Date(), history), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${municipalWorkbookName(data)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof UnknownMunicipalityError
            ? error.message
            : "Não foi possível gerar o Excel. Tente baixar novamente.",
      },
      { status: error instanceof UnknownMunicipalityError ? 400 : 500 },
    );
  }
}
