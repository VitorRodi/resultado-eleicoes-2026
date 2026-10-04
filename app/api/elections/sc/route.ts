import { getElectionSnapshot, UnknownMunicipalityError } from '@/services/tse/service';
import { parseRegionalQuery } from '@/lib/preferences';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  let regional;
  try { regional = parseRegionalQuery(new URL(request.url).searchParams.get('regional')); }
  catch (error) { return Response.json({error:error instanceof Error?error.message:'Consulta inválida.'},{status:400}); }
  let snapshot;
  try { snapshot = await getElectionSnapshot(regional); }
  catch (error) {
    if (error instanceof UnknownMunicipalityError) return Response.json({error:error.message},{status:400});
    throw error;
  }
  return Response.json(snapshot, { headers: {
    'Cache-Control': snapshot.stale || regional.length ? 'no-store' : 'public, s-maxage=10, stale-while-revalidate=5, stale-if-error=120',
    'X-Content-Type-Options': 'nosniff',
  } });
}
