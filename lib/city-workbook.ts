import ExcelJS from "exceljs";
import { cityResultsSchema, type CityResults } from "./city-results";
import { officeLabel } from "./config";
export async function cityWorkbook(input: CityResults) {
  const data = cityResultsSchema.parse(input);
  if (
    !data.verifiedSignatures ||
    !["counting", "finished"].includes(data.status)
  )
    throw new Error("Ainda não há votação divulgada para exportar.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vitor Rodi";
  const sheet = workbook.addWorksheet("Votos na cidade", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });
  sheet.getColumn(1).width = 48;
  sheet.getColumn(2).width = 24;
  for (const n of [1, 2, 3]) sheet.mergeCells(n, 1, n, 2);
  sheet.getCell("A1").value =
    `${data.municipality.name} · ${data.uf.toUpperCase()}`;
  sheet.getCell("A1").font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: "FF17655C" },
  };
  sheet.getRow(1).height = 32;
  sheet.getCell("A2").value =
    `${officeLabel(data.office, data.uf)} · Eleições 2026 · 1º turno`;
  sheet.getRow(2).height = 25;
  sheet.getCell("A3").value = data.stale
    ? "Último resultado disponível; a atualização falhou."
    : data.status === "finished"
      ? "Totalização final deste cargo no município."
      : "Votos até o momento; apuração parcial.";
  sheet.getRow(5).values = ["Candidato", "Votos"];
  sheet.getRow(5).font = {
    name: "Arial",
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(5).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17655C" },
  };
  sheet.getRow(5).height = 28;
  const candidates = [...data.candidates].sort(
    (a, b) =>
      (b.votes ?? -1) - (a.votes ?? -1) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  candidates.forEach((c, i) => {
    const row = sheet.getRow(i + 6);
    row.values = [c.name, c.votes];
    row.height = 26;
    row.getCell(2).numFmt = "#,##0";
    if (i % 2)
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F5F2" },
      };
  });
  sheet.autoFilter = { from: "A5", to: `B${5 + candidates.length}` };
  const footer = 8 + candidates.length;
  sheet.mergeCells(footer, 1, footer, 2);
  sheet.getCell(footer, 1).value = {
    text: "Feito por Vitor Rodi · LinkedIn: linkedin.com/in/vitor-rodi",
    hyperlink: "https://br.linkedin.com/in/vitor-rodi",
  };
  sheet.getCell(footer, 1).font = {
    color: { argb: "FF17655C" },
    underline: true,
  };
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
