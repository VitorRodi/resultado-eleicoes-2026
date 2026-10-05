import {getCandidateMunicipalVotes,UnknownMunicipalityError} from '@/services/tse/service';
import {BRAZIL_STATES} from '@/lib/brazil-states';
import {OFFICES,type Office} from '@/types/election';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,uf=params.get('uf')?.toLowerCase(),office=params.get('office'),candidate=params.get('candidate'),cities=params.get('cities')?.split(',')||[];
  if(!uf||!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf)||!OFFICES.includes(office as Office)||!candidate||!/^\d{1,20}$/.test(candidate)||!cities.length||cities.length>20||cities.some(c=>!/^\d{5}$/.test(c)))return Response.json({error:'Selecione um candidato, cargo e até 20 cidades do estado por consulta.'},{status:400});
  try{return Response.json(await getCandidateMunicipalVotes(uf,office as Office,candidate,cities),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return Response.json({error:e instanceof UnknownMunicipalityError?e.message:'Não foi possível consultar os votos municipais no TSE. Tente novamente.'},{status:e instanceof UnknownMunicipalityError?400:503});}
}
