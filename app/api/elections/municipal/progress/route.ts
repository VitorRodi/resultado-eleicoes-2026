import {getMunicipalProgress} from '@/services/tse/service';
import {BRAZIL_STATES} from '@/lib/brazil-states';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
  const uf=new URL(request.url).searchParams.get('uf')?.toLowerCase();
  if(!uf||!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf))return Response.json({error:'UF inválida.'},{status:400});
  const data=await getMunicipalProgress(uf);
  return Response.json(data,{headers:{'Cache-Control':data.stale?'no-store':'public, s-maxage=20, stale-while-revalidate=10','X-Content-Type-Options':'nosniff'}});
}
