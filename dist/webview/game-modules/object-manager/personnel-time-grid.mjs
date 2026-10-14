export const PERSONNEL_TIME_SLOTS=Object.freeze([
{id:'night-early',start:'00:00',end:'07:00',name:'夜间'},
{id:'morning',start:'07:00',end:'08:40',name:'课前'},
{id:'slot-1',start:'08:40',end:'09:40',name:'一限'},
{id:'slot-2',start:'09:40',end:'10:40',name:'二限'},
{id:'slot-3',start:'10:40',end:'11:40',name:'三限'},
{id:'slot-4',start:'11:40',end:'13:20',name:'四限'},
{id:'slot-5',start:'13:20',end:'14:20',name:'五限'},
{id:'slot-6',start:'14:20',end:'15:20',name:'六限'},
{id:'afternoon',start:'15:20',end:'18:00',name:'放课后'},
{id:'evening',start:'18:00',end:'21:00',name:'晚间'},
{id:'night-late',start:'21:00',end:'24:00',name:'夜间'}
]);
const minute=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
export function fixedPersonnelRows(day,{defaultLocation=null,name='',overrides={}}={}){
  return PERSONNEL_TIME_SLOTS.map(slot=>{
    const available=(day.entries??[]).filter(x=>x.enabled!==false&&minute(x.start)<minute(slot.end)&&minute(x.end)>minute(slot.start));
    available.sort((a,b)=>Math.min(minute(b.end),minute(slot.end))-Math.max(minute(b.start),minute(slot.start))-(Math.min(minute(a.end),minute(slot.end))-Math.max(minute(a.start),minute(slot.start))));
    const row=overrides[slot.id]??available[0];
    return{...slot,enabled:true,note:row?.note??'空闲，回住宅',location:row?.location??day.defaultLocation??defaultLocation,event:row?.event??null,details:available};
  });
}
