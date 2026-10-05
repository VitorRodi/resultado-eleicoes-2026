import { canonical } from "./config";
import type { CityResults } from "./city-results";
import type { Municipality } from "../types/election";

function matches(text: string, query: string) {
  const normalized = canonical(text);
  return canonical(query).split(" ").filter(Boolean).every(word => normalized.includes(word));
}

export function findCities(cities: Municipality[], query: string) {
  const exact = canonical(query);
  return cities.filter(city => matches(city.name, query)).sort((a, b) =>
    Number(canonical(b.name) === exact) - Number(canonical(a.name) === exact) ||
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

export function findCityCandidates(candidates: CityResults["candidates"], query: string, order: "votes" | "name") {
  return candidates.filter(candidate => matches(`${candidate.name} ${candidate.number} ${candidate.party}`, query))
    .sort((a, b) => (order === "votes" ? (b.votes ?? -1) - (a.votes ?? -1) : 0) ||
      a.name.localeCompare(b.name, "pt-BR"));
}
