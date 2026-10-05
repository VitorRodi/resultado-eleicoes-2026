import {getMunicipalLeaders,UnknownMunicipalityError} from '@/services/tse/service';
import {BRAZIL_STATES} from '@/lib/brazil-states';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,uf=params.get('uf')?.toLowerCase(),codes=params.get('cities')?.split(',')||[];
  if(!uf||!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf))return Response.json({error:'UF inválida.'},{status:400});
  if(!codes.length||codes.length>30||codes.some(c=>!/^\d{5}$/.test(c)))return Response.json({error:'Selecione de 1 a 30 municípios.'},{status:400});
  try{return Response.json(await getMunicipalLeaders(uf,codes),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){if(e instanceof UnknownMunicipalityError)return Response.json({error:e.message},{status:400});return Response.json({error:'A fonte municipal não pôde ser consultada. Tente novamente.'},{status:503});}
}
