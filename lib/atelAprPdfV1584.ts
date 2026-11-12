/** ATEL V158.4 — gerador PDF server-side sem dependencias adicionais.
 * A fonte Helvetica/WinAnsi documenta os registros operacionais, e JPG/PNG
 * sao incorporados diretamente. WebP mantem referencia textual no PDF.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type EvidenciaAprPdfV1584 = { nome: string; mime: string; dados: Uint8Array | null };
export type RegistroAprPdfV1584 = {
  os: number; registradoEm: string; resultado: string; versao: number;
  riscos: string[]; medidas: string[]; observacao: string;
  riscosOutros: string; medidasOutros: string; nenhumRisco: boolean;
  acompanhamentoSupervisor:boolean; acompanhamentoSesmt:boolean; profissionais:{nome:string;funcao:string}[];
  evidencias: EvidenciaAprPdfV1584[];
};
type Imagem = { dados:Buffer; largura:number; altura:number; filtro:"/DCTDecode"|"/FlateDecode" };
const LATIN:Record<string,string> = {"–":"-","—":"-","→":"->","•":"-","“":"\"","”":"\"","‘":"'","’":"'","…":"...","✓":"OK","№":"N°"};
function textoSeguro(s:string){return String(s).replace(/[–—→•“”‘’…✓№]/g,c=>LATIN[c]||"-").replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g,"?");}
function pdfString(s:string){return textoSeguro(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[\r\n]/g," ");}
function jpeg(data:Buffer):Imagem|null{
 if(data.length<20||data[0]!==255||data[1]!==216)return null;
 for(let p=2;p<data.length-10;){
  if(data[p]!==255){p++;continue;} const marca=data[p+1];p+=2;
  if(marca===216||marca===217||marca===1||marca>=208&&marca<=215)continue;
  if(p+2>data.length)return null;const n=data.readUInt16BE(p);if(n<2||p+n>data.length)return null;
  if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marca)){
    const h=data.readUInt16BE(p+3),w=data.readUInt16BE(p+5),channels=data[p+7];
    if(w>0&&h>0&&channels===3)return{dados:data,largura:w,altura:h,filtro:"/DCTDecode"};return null;
  }p+=n;
 }
 return null;
}
function png(data:Buffer):Imagem|null{
 if(data.length<33||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return null;
 let width=0,height=0,type=0,depth=0,interlace=0;const parts:Buffer[]=[];
 for(let p=8;p+12<=data.length;){const length=data.readUInt32BE(p),tag=data.toString("ascii",p+4,p+8),start=p+8;
   if(length>data.length-start-4)return null;
   if(tag==="IHDR"){width=data.readUInt32BE(start);height=data.readUInt32BE(start+4);depth=data[start+8];type=data[start+9];interlace=data[start+12];}
   if(tag==="IDAT")parts.push(data.subarray(start,start+length));
   p=start+length+4;if(tag==="IEND")break;
 }
 if(width<1||height<1||width*height>12_000_000||depth!==8||![2,6].includes(type)||interlace!==0)return null;
 const bpp=type===6?4:3,row=width*bpp;
 let raw:Buffer;try{raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(row+1)*height+1024});}catch{return null;}
 const rgb=Buffer.alloc(width*height*3);let src=0,dst=0,prev=Buffer.alloc(row);
 for(let y=0;y<height;y++){
   if(src+row+1>raw.length)return null;const mode=raw[src++];const curr=Buffer.from(raw.subarray(src,src+row));src+=row;
   if(mode>4)return null;
   for(let x=0;x<row;x++){
    const a=x>=bpp?curr[x-bpp]:0,b=prev[x],c=x>=bpp?prev[x-bpp]:0;
    const pa=a+b-c,da=Math.abs(pa-a),db=Math.abs(pa-b),dc=Math.abs(pa-c);
    const predictor=mode===0?0:mode===1?a:mode===2?b:mode===3?Math.floor((a+b)/2):da<=db&&da<=dc?a:db<=dc?b:c;
    curr[x]=(curr[x]+predictor)&255;
   }
   for(let x=0;x<width;x++){
    const i=x*bpp,alpha=bpp===4?curr[i+3]/255:1;
    rgb[dst++]=Math.round(curr[i]*alpha+255*(1-alpha));
    rgb[dst++]=Math.round(curr[i+1]*alpha+255*(1-alpha));
    rgb[dst++]=Math.round(curr[i+2]*alpha+255*(1-alpha));
   }
   prev=curr;
 }
 return{dados:deflateSync(rgb),largura:width,altura:height,filtro:"/FlateDecode"};
}
function parseImage(f:EvidenciaAprPdfV1584){if(!f.dados)return null;const b=Buffer.from(f.dados);return f.mime==="image/jpeg"?jpeg(b):f.mime==="image/png"?png(b):null;}
class Documento{
 private obj:(Buffer|null)[]=[null];private paginas:{content:string;photos:{nome:string;img:Imagem}[]}[]=[];
 addObject(value:Buffer|string){this.obj.push(typeof value==="string"?Buffer.from(value,"latin1"):value);return this.obj.length-1;}
 setObject(index:number,value:string){this.obj[index]=Buffer.from(value,"latin1");}
 addStream(header:string,data:Buffer){return this.addObject(Buffer.concat([Buffer.from(`${header} /Length ${data.length} >>\nstream\n`,"latin1"),data,Buffer.from("\nendstream","latin1")]));}
 addPage(content:string,photos:{nome:string;img:Imagem}[]=[]){this.paginas.push({content,photos});}
 draw():Uint8Array{
  const catalogId=this.addObject(""),pagesId=this.addObject("");const f1=this.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");const f2=this.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const ids:number[]=[];
  this.paginas.forEach(p=>{
    const resources:string[]=[];
    p.photos.forEach((f,i)=>{const im=f.img;const id=this.addStream(`<< /Type /XObject /Subtype /Image /Width ${im.largura} /Height ${im.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${im.filtro}`,im.dados);resources.push(`/Im${i+1} ${id} 0 R`);});
    const stream=this.addStream("<<",Buffer.from(p.content,"latin1"));
    const page=this.addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << ${resources.join(" ")} >> >> /Contents ${stream} 0 R >>`);ids.push(page);
  });
  this.setObject(pagesId,`<< /Type /Pages /Kids [${ids.map(i=>`${i} 0 R`).join(" ")}] /Count ${ids.length} >>`);
  this.setObject(catalogId,`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const blobs:Buffer[]=[Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n","latin1")];let offset=blobs[0].length;const xref:number[]=[0];
  for(let i=1;i<this.obj.length;i++){xref.push(offset);const blob=Buffer.concat([Buffer.from(`${i} 0 obj\n`,"latin1"),this.obj[i]||Buffer.alloc(0),Buffer.from("\nendobj\n","latin1")]);blobs.push(blob);offset+=blob.length;}
  const xrefOffset=offset;
  let cross=`xref\n0 ${xref.length}\n0000000000 65535 f \n`;for(let i=1;i<xref.length;i++)cross+=`${String(xref[i]).padStart(10,"0")} 00000 n \n`;
  cross+=`trailer\n<< /Size ${xref.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  blobs.push(Buffer.from(cross,"latin1"));return new Uint8Array(Buffer.concat(blobs));
 }
}
const rgb=(hex:string)=>{const n=parseInt(hex,16);return `${((n>>16)&255)/255} ${((n>>8)&255)/255} ${(n&255)/255}`;};
function box(x:number,y:number,w:number,h:number,color:string){return `${rgb(color)} rg ${x} ${y} ${w} ${h} re f\n`;}
function line(x1:number,y1:number,x2:number,y2:number,color:string,width=1){return `${rgb(color)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;}
function text(x:number,y:number,value:string,size:number,color:string,bold=false){return `BT /${bold?"F2":"F1"} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x} ${y} Tm (${pdfString(value)}) Tj ET\n`;}
const wrap=(input:string,limit:number)=>{const s=textoSeguro(input).replace(/\r/g,"");const out:string[]=[];for(const para of s.split("\n")){let row="";for(const word of para.split(/\s+/)){if((row+" "+word).trim().length>limit&&row){out.push(row);row=word;}else row=(row+" "+word).trim();}out.push(row);}return out;};
export function gerarAprPdfV1584(r:RegistroAprPdfV1584):Uint8Array{
 const pdf=new Documento();const head=(index:number,subtitle:string)=>{
  let s=box(0,762,595,80,"0B536D")+box(0,759,595,4,"159EBD");
  s+=text(42,814,"WMS EXPERT  /  SEGURANCA OPERACIONAL",11,"FFFFFF",true);
  s+=text(42,786,subtitle,19,"FFFFFF",true);
  s+=text(42,740,`ORDEM DE SERVICO  ${r.os}     |     APR V${r.versao}`,10,"164E67",true);
  s+=text(42,724,`Registrada em: ${r.registradoEm}     |     Resultado: ${r.resultado}`,10,r.resultado==="APTO"?"127B62":"A64027",true);
  s+=line(42,714,553,714,"CDDFE8");s+=text(42,26,"Documento gerado a partir do registro armazenado no ATEL. Modelo em homologacao.",8,"688190");
  s+=text(530,26,`Pg ${index}`,9,"688190",true);return s;
 };
 let index=1,content=head(index,"ANALISE PRELIMINAR DE RISCO"),y=685;
 const headline=(value:string)=>{if(y<110){pdf.addPage(content);index++;content=head(index,"CONTINUACAO DA APR");y=685;}content+=box(42,y-8,511,26,"EAF5F9")+text(52,y,value,12,"0A5F7B",true);y-=42;};
 const writeParagraph=(val:string)=>{for(const paragraph of wrap(val,94)){if(y<68){pdf.addPage(content);index++;content=head(index,"CONTINUACAO DA APR");y=685;}content+=text(49,y,paragraph||" ",10,"274C5D");y-=16;}};
 headline("RISCOS POTENCIAIS");if(r.nenhumRisco)writeParagraph("Nenhum risco potencial identificado.");else r.riscos.forEach(x=>writeParagraph("[X] "+x));
 if(r.riscosOutros)writeParagraph("Outros riscos: "+r.riscosOutros);
 y-=6;headline("MEDIDAS DE CONTROLE / EPI / EPC");
 if(!r.medidas.length)writeParagraph("Nenhuma medida selecionada.");else r.medidas.forEach(x=>writeParagraph("[X] "+x));
 if(r.medidasOutros)writeParagraph("Outras medidas: "+r.medidasOutros);
 y-=6;headline("ACOMPANHAMENTO DA ATIVIDADE");
 writeParagraph(`${r.acompanhamentoSupervisor?"[X]":"[ ]"} Acompanhamento do Supervisor`);
 writeParagraph(`${r.acompanhamentoSesmt?"[X]":"[ ]"} Acompanhamento do SESMT`);
 y-=6;headline("PROFISSIONAIS ENVOLVIDOS NA ATIVIDADE");
 if(!r.profissionais.length)writeParagraph("Nenhum profissional informado.");
 else r.profissionais.forEach((p,i)=>writeParagraph(`${i+1}. ${p.nome} | Funcao: ${p.funcao}`));
 y-=6;headline("OBSERVACAO DO MODELO DO CLIENTE");
 writeParagraph("Em conformidade com a alinea 35.4.5 da NR-35 (trabalho em altura), deve ser preenchida sempre que iniciar as atividades, buscando garantir padronizacao das atividades de risco em altura e nas proximidades de redes eletricas, tambem em conformidade com a NR-10 (Seguranca em Instalacoes e Servicos com Eletricidade). E vedada toda atividade sem a previa analise deste procedimento (AR).");
 y-=6;headline("OBSERVACOES DO TECNICO");writeParagraph(r.observacao||"Nenhuma observacao informada.");
 y-=10;headline("EVIDENCIAS FOTOGRAFICAS");writeParagraph(`${r.evidencias.length} foto(s) associada(s) ao registro.`);
 pdf.addPage(content);
 for(const [idx,foto] of r.evidencias.entries()){
  const im=parseImage(foto);let page=head(++index,`EVIDENCIA ${idx+1} DE ${r.evidencias.length}`);page+=text(42,682,foto.nome.slice(0,74),11,"164E67",true);
  if(im){const maxW=510,maxH=530,scale=Math.min(maxW/im.largura,maxH/im.altura,1.7);const w=Math.round(im.largura*scale),h=Math.round(im.altura*scale);const x=42+Math.round((510-w)/2),yImg=120+Math.round((530-h)/2);
   page+=box(42,100,510,550,"E8F0F3")+`q ${w} 0 0 ${h} ${x} ${yImg} cm /Im1 Do Q\n`;
   pdf.addPage(page,[{nome:foto.nome,img:im}]);
  }else{page+=box(42,165,511,350,"F1F5F8")+text(55,460,"Evidencia armazenada no ATEL; visualizacao nao embutida neste PDF.",11,"476B7F");pdf.addPage(page);}
 }
 return pdf.draw();
}
