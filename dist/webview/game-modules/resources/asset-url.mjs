const maps=new Map();
export function registerResourceMap(base,entries){maps.set(String(base),new Map(entries));}
export function resourceUrl(value){
 const url=String(value??'');
 for(const [base,entries]of maps)if(url.startsWith(base))return entries.get(url.slice(base.length))??url;
 return url;
}
export function assetUrl(base,file){return resourceUrl(String(base??'')+String(file??''));}
