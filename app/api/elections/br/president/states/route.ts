import { getPresidentsByState } from '@/services/tse/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
  const snapshot=await getPresidentsByState();
  return Response.json(snapshot,{headers:{
    'Cache-Control':snapshot.stale?'no-store':'public, s-maxage=30, stale-while-revalidate=10, stale-if-error=120',
    'X-Content-Type-Options':'nosniff',
  }});
}
