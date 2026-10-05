type MunicipalFileSelection = {
  uf: string;
  candidate: { name: string };
  historyCandidateId?: string;
};

export function municipalDownloadName(
  selection: MunicipalFileSelection,
  format: "pdf" | "xlsx",
) {
  const name =
    selection.candidate.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100)
      .replace(/-+$/g, "") || "candidato";
  const uf = selection.uf
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 2);
  const years =
    format === "xlsx" && selection.historyCandidateId ? "2022-2026" : "2026";
  return `votos-por-municipio-de-${name}-${uf}-${years}.${format}`;
}
