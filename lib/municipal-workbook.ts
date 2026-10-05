import ExcelJS from 'exceljs';
import {officeLabel} from './config';
import {exportRowStatus,municipalExportSchema,type MunicipalExport} from './municipal-export';

export async function municipalWorkbook(input:MunicipalExport,generatedAt=new Date()){
  const data=municipalExportSchema.parse(input),rows=[...data.rows].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const workbook=new ExcelJS.Workbook();workbook.creator='Painel Eleições 2026 · Vitor Rodi';workbook.created=generatedAt;workbook.calcProperties.fullCalcOnLoad=true;
  const sheet=workbook.addWorksheet('Votos por cidade',{views:[{state:'frozen',ySplit:7,xSplit:1,showGridLines:false}],properties:{tabColor:{argb:'FF213C57'}}});
  [38,16,49,16,26,16,3,95].forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
  sheet.getCell('A2').value='Votos por município';sheet.getCell('A2').font={name:'Arial',size:16,bold:true,color:{argb:'FF213C57'}};
  sheet.getCell('A3').value=`${data.candidate.name} (${data.candidate.number} · ${data.candidate.party}) · ${officeLabel(data.candidate.office,data.uf)} · ${data.uf.toUpperCase()}`;
  sheet.getCell('A4').value='Células de votos vazias indicam resultado indisponível. Cada cidade tem seu próprio horário (Brasília).';
  sheet.getCell('A5').value='Votos disponíveis';sheet.getCell('B5').value={formula:`SUM(B8:B${7+rows.length})`,result:rows.reduce((sum,row)=>sum+(row.votes??0),0)};
  sheet.getCell('C5').value=`${rows.filter(row=>row.votes!==null).length} de ${rows.length} cidades com votos disponíveis`;
  sheet.getCell('E5').value=new Date(generatedAt.getTime()-3*60*60*1000);sheet.getCell('E5').numFmt='dd/mm/yyyy hh:mm:ss';sheet.getCell('F5').value='Gerado (Brasília)';
  const headers=['Município','Votos do candidato','Situação','Seções apuradas (%)','Dados TSE (Brasília)','Código TSE','','Fonte TSE'];
  sheet.getRow(7).values=headers;sheet.getRow(7).height=34;
  for(const i of [1,2,3,4,5,6,8]){const cell=sheet.getRow(7).getCell(i);cell.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF213C57'}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};}
  for(const [i,row] of rows.entries()){
    const line=sheet.getRow(i+8);line.values=[row.name,row.votes,exportRowStatus(row),row.percentage===null?null:row.percentage/100,row.updatedAt?new Date(new Date(row.updatedAt).getTime()-3*60*60*1000):null,row.code,null,row.source];line.height=23;
    line.eachCell(cell=>{cell.font={name:'Arial',size:11};cell.alignment={vertical:'middle'};});
    for(const j of [1,2,3,4,5,6])if(i%2===1)line.getCell(j).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F4F8'}};
    if(row.votes===null){line.getCell(3).font={name:'Arial',size:11,color:{argb:'FF8A5B11'}};}
    line.getCell(2).numFmt='#,##0';line.getCell(4).numFmt='0.00%';line.getCell(5).numFmt='dd/mm/yyyy hh:mm:ss';
    for(const j of [2,4,5])line.getCell(j).alignment={horizontal:'right',vertical:'middle'};
    line.getCell(3).alignment={horizontal:'left',vertical:'middle',indent:1};
  }
  for(const cell of ['A3','A4','A5','C5','F5'])sheet.getCell(cell).font={name:'Arial',size:11};
  sheet.getCell('A4').font={name:'Arial',size:11,italic:true,color:{argb:'FF586778'}};sheet.getCell('B5').numFmt='#,##0';
  sheet.autoFilter={from:'A7',to:`F${7+rows.length}`};
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export function municipalWorkbookName(data:MunicipalExport){return `votos-por-cidade-${data.uf}-${data.candidate.number}-${data.candidate.id}.xlsx`;}
