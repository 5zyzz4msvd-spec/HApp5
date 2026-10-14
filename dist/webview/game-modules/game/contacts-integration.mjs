import {phoneMessageFiles} from '../object-manager/phone-message-files.mjs';
import { ContactChatStore,parsePhoneMessages } from './contact-chat.mjs';
import { createAppUpgradeService,parseAppServiceReceipts } from './app-upgrade-services.mjs';
export const TWIN_CONTACT_ID='hacker-twins';
export const TWIN_CONTACT={id:TWIN_CONTACT_ID,name:'织田信长 & 明智光秀',subtitle:'双胞胎联络员',services:true};
// This adapter accepts an already-filtered list of acquired relationships. It never
// searches the character catalogue or reveals undiscovered dossiers itself.
export async function createContactIntegration({read,write,objectStore=null,stage,getContacts,isWritable=()=>true,services=null}={}){
 const files=objectStore?phoneMessageFiles(objectStore):{read,write};
 const store=await new ContactChatStore({...files,stage,getContacts,isWritable}).init();
 if(services)store.services=await createAppUpgradeService({...services,stage,isWritable,onChange:()=>{for(const fn of store.listeners)fn();}});
 let ingestionQueue=Promise.resolve();const serial=task=>{const job=ingestionQueue.then(task);ingestionQueue=job.catch(()=>{});return job;};
 return{
  store,services:store.services,
  async ingestFloor(floorId,text){return serial(async()=>{await store.ingest(String(floorId),parsePhoneMessages(text));const results=[];if(store.services)for(const receipt of parseAppServiceReceipts(text))results.push(await store.services.settle(receipt));return results;});},
  async ingestFloors(floors){return serial(async()=>{const results=[];for(const floor of floors){const text=String(floor.message?.swipes?.[floor.message.swipe_id??0]??floor.message?.mes??floor.message?.content??'');await store.ingest(String(floor.id),parsePhoneMessages(text));if(store.services)for(const receipt of parseAppServiceReceipts(text))results.push(await store.services.settle(receipt));}await store.retainFloors(floors.map(x=>x.id));return results;});},
  async markDispatched(actions){return serial(async()=>{await store.markDispatched(actions);await store.services?.markDispatched(actions);});},
  // Only authored first-floor/tutorial hooks call this method. Model replies go
  // exclusively through ingestFloor and remain constrained to known contacts.
  async authorizeTutorialMessage(contactId,text,id){if(!id||typeof id!=='string')throw Error('教程消息必须有稳定标识');return store.receive(contactId,text,{id:'tutorial:'+id});},
 };
}
