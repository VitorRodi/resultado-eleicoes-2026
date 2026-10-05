import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import catalog from "../data/sc-associations.json";
import { SC_ASSOCIATIONS, associationCities, municipalityAssociation, groupAssociationRows } from "../lib/sc-associations";
import { initialExportRows, type MunicipalExport } from "../lib/municipal-export";
import { municipalWorkbook } from "../lib/municipal-workbook";

test("21 associações cobrem os 295 municípios uma vez, com siglas atuais e seleção por código IBGE", () => {
  assert.equal(SC_ASSOCIATIONS.length, 21);
  const codes = SC_ASSOCIATIONS.flatMap(region => region.municipalities);
  assert.equal(codes.length, 295);
  assert.equal(new Set(codes).size, 295);
  const cities = Object.entries(catalog.municipalities).map(([ibgeCode, city], i) => ({ name: city.name, ibgeCode, code: String(80000 + i) }));
  assert.equal(associationCities(cities, "all").length, 295);
  assert.equal(associationCities(cities, "AMERIOS").length, 17);
  assert.equal(associationCities(cities, "AMUREL").length, 18);
  assert.equal(associationCities(cities, "AMVE").length, 14);
  assert.deepEqual(associationCities(cities, ""), []);
  assert.equal(municipalityAssociation({ name: "CUNHATAI" }), "AMERIOS");
  assert.equal(municipalityAssociation({ name: "Mondaí" }), "AMEOSC");
  assert.equal(municipalityAssociation({ name: "Herval d'Oeste" }), "AMMOC");
  assert.equal(municipalityAssociation({ name: "São Paulo" }), null);
});

test("Excel separado cria uma aba por associação com apenas suas cidades e fórmulas locais", async () => {
  const cities = Object.values(catalog.municipalities).map((city, i) => ({ name: city.name, code: String(80000 + i) }));
  const rows = initialExportRows(cities).map(row => ({ ...row, votes: 130, verifiedSignatures: true, status: "finished" as const }));
  const input: MunicipalExport = { uf: "sc", candidate: { id: "123", name: "Teste", number: "2210", party: "PL", office: "federalDeputy" }, separateAssociations: true, historyCandidateId: "456", rows };
  const historical = { id: "456", name: "Teste", fullName: "Teste", number: "2210", party: "PL", office: "federalDeputy" as const, votes: Object.fromEntries(cities.map(city => [city.code, 100])) };
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await municipalWorkbook(input, new Date(), historical)).buffer as ArrayBuffer);
  assert.equal(book.worksheets.length, 23);
  let count = 0;
  for (const region of SC_ASSOCIATIONS) {
    const sheet = book.getWorksheet(region.id)!;
    assert.ok(sheet);
    assert.deepEqual(sheet.getCell(region.municipalities.length + 10, 1).value, { text: "Relatório feito por Vitor Rodi · Conheça o projeto e acompanhe meu trabalho no LinkedIn", hyperlink: "https://br.linkedin.com/in/vitor-rodi" });
    assert.equal(sheet.getCell("F7").value, "Região");
    assert.equal(sheet.getCell(region.municipalities.length + 8, 2).result, region.municipalities.length * 130);
    assert.equal(sheet.getCell(region.municipalities.length + 8, 4).result, region.municipalities.length * 30);
    for (let row = 8; row < region.municipalities.length + 8; row++) {
      assert.equal(municipalityAssociation({ name: String(sheet.getCell(row, 1).value) }), region.id);
      assert.equal(sheet.getCell(row, 4).result, 30);
      assert.equal(sheet.getCell(row, 5).result, 0.3);
      assert.equal(sheet.getCell(row, 6).value, region.id);
      count++;
    }
  }
  assert.equal(count, 295);
  assert.deepEqual(groupAssociationRows([{ name: "Cidade não cadastrada" }]).map(group => group.id), ["SEM REGIÃO"]);
  const single = new ExcelJS.Workbook();
  await single.xlsx.load((await municipalWorkbook({ ...input, rows: rows.filter(row => municipalityAssociation(row) === "AMERIOS"), historyCandidateId: undefined })).buffer as ArrayBuffer);
  assert.deepEqual(single.worksheets.map(sheet => sheet.name), ["Votos por cidade", "Regiões", "AMERIOS"]);
});

test("Excel regional conserva comparação, soma só a seleção e mantém ausência e base zero", async () => {
  const cities = [{ name: "Caibi", code: "80594" }, { name: "Cunhataí", code: "81620" }, { name: "Mondaí", code: "81910" }];
  const rows = initialExportRows(cities).map((row, i) => ({ ...row, votes: [130, 0, null][i], verifiedSignatures: i !== 2, status: i === 2 ? "unavailable" as const : "finished" as const }));
  const input: MunicipalExport = { uf: "sc", candidate: { id: "123", name: "Teste", number: "2210", party: "PL", office: "federalDeputy" }, includeAssociations: true, historyCandidateId: "456", rows };
  const bytes = await municipalWorkbook(input, new Date(), { id: "456", name: "Teste", fullName: "Teste", number: "2210", party: "PL", office: "federalDeputy", votes: { "80594": 100, "81620": 0 } });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer as ArrayBuffer);
  const citySheet = book.getWorksheet("Votos por cidade")!;
  assert.equal(citySheet.getCell("F7").value, "Região");
  assert.equal(citySheet.getCell("F8").value, "AMERIOS");
  assert.equal(citySheet.getCell("D8").result, 30);
  const sheet = book.getWorksheet("Regiões")!;
  assert.equal(sheet.getCell("A8").value, "AMEOSC");
  assert.equal(sheet.getCell("C8").value, null);
  assert.equal(sheet.getCell("D8").value, null);
  assert.equal(sheet.getCell("A9").value, "AMERIOS");
  assert.equal(sheet.getCell("B9").value, 2);
  assert.equal(sheet.getCell("C9").value, 130);
  assert.equal(sheet.getCell("D9").value, 100);
  assert.equal(sheet.getCell("E9").result, 30);
  assert.equal(sheet.getCell("F9").result, 0.3);
  const noHistory = new ExcelJS.Workbook();
  await noHistory.xlsx.load((await municipalWorkbook({ ...input, historyCandidateId: undefined })).buffer as ArrayBuffer);
  assert.equal(noHistory.getWorksheet("Votos por cidade")!.getCell("C7").value, "Região");
  assert.equal(noHistory.getWorksheet("Regiões")!.columnCount, 3);
});
