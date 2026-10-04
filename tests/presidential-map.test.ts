import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presidentialMapTone,PRESIDENTIAL_MAP_COLORS} from '../lib/presidential-map';
import {emptySnapshot} from '../services/tse/service';
import type {Candidate,StatePresidentResult} from '../types/election';
const candidate=(number:string,party:string,votes:number):Candidate=>({id:number,name:party,fullName:party,number,party,votes,percentage:50,rank:1,office:'president',officialStatus:null,officialElected:false,photoUrl:null,destination:null});
const result=(candidates:Candidate[]):StatePresidentResult=>({uf:'SC',name:'Santa Catarina',candidates,meta:{...emptySnapshot().offices.president,status:'counting'},stale:false,verifiedSignatures:true,source:''});
test('mapa usa votos estaduais para vermelho de Lula e azul de Flávio, mesmo com lista invertida',()=>{
  const lula=candidate('13','PT',100),flavio=candidate('22','PL',90);
  assert.equal(presidentialMapTone(result([flavio,lula])).color,PRESIDENTIAL_MAP_COLORS.lula);
  assert.equal(presidentialMapTone(result([lula,{...flavio,votes:110}])).color,PRESIDENTIAL_MAP_COLORS.flavio);
});
test('empate, ausência, zerésima e fonte não verificada não recebem cor de candidato',()=>{
  const tie=result([candidate('13','PT',100),candidate('22','PL',100)]);
  assert.equal(presidentialMapTone(tie).kind,'tie');assert.equal(presidentialMapTone(tie).leader,null);
  assert.equal(presidentialMapTone(undefined).kind,'unavailable');
  assert.equal(presidentialMapTone({...tie,verifiedSignatures:false}).kind,'unavailable');
  assert.equal(presidentialMapTone({...tie,meta:{...tie.meta,status:'waiting'}}).kind,'unavailable');
  assert.equal(presidentialMapTone(result([candidate('13','PT',0)])).kind,'unavailable');
});
test('outra liderança fica distinta e última liderança válida pode ser preservada com aviso',()=>{
  assert.equal(presidentialMapTone(result([candidate('70','AVANTE',100)])).kind,'other');
  const last={...result([candidate('22','PL',100)]),stale:true};assert.equal(presidentialMapTone(last).kind,'flavio');
});
