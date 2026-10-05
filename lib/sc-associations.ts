import catalog from "../data/sc-associations.json";
import { canonical } from "./config";
import type { Municipality } from "../types/election";

export const SC_ASSOCIATIONS = [...catalog.associations].sort((a, b) => a.id.localeCompare(b.id));
export const ASSOCIATIONS_SOURCE = catalog.source;
const normalize = (name: string) => canonical(name).replace(/[^a-z0-9]/g, "");
const byName = new Map(Object.values(catalog.municipalities).map(city => [normalize(city.name), city.association]));
const byIbge: Record<string, { name: string; association: string }> = catalog.municipalities;
export function municipalityAssociation(city: { name: string; ibgeCode?: string }): string | null {
  return (city.ibgeCode ? byIbge[city.ibgeCode]?.association : undefined) || byName.get(normalize(city.name)) || null;
}
export function associationCities(cities: Municipality[], region: string): Municipality[] {
  if (region === "all") return [...cities];
  if (!SC_ASSOCIATIONS.some(association => association.id === region)) return [];
  return cities.filter(city => municipalityAssociation(city) === region);
}
