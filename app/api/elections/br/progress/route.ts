import { getBrazilProgress } from '@/services/tse/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function GET(){const result=await getBrazilProgress();return Response.json(result,{headers:{'Cache-Control':result.stale?'no-store':'public, s-maxage=10, stale-while-revalidate=5','X-Content-Type-Options':'nosniff'}});}
