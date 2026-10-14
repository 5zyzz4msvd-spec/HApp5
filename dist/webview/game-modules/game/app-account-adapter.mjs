const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Pre-cap journals owned money/energy/VIP only. Adding the real capacity to
// today's snapshot must not strand a completed legacy debit, or overwrite it.
const sameResources=(current,recorded)=>{if(!Object.hasOwn(recorded??{},'energyCap')&&Object.hasOwn(current??{},'energyCap')){const {energyCap,...legacy}=current;return same(legacy,recorded);}return same(current,recorded);};
// A durable journal coordinates the host resource CAS and the owned upgrade
// file. Failures either roll back the resource CAS or retain a recoverable log.
export function createAppAccountAdapter({store,readResources,compareAndSetResources,transaction=fn=>fn()}){
 const journalPath='ui/app-upgrade-transaction.json',upgradePath='ui/app-upgrades.json';
 async function recover(){const pending=await store.readJson(journalPath,null);if(!pending)return true;const resources=await readResources(),upgrades=await store.readJson(upgradePath,{});
  if(same(upgrades,pending.nextUpgrades)&&sameResources(resources,pending.nextResources)){await store.writeJson(journalPath,null);return true;}
  if(sameResources(resources,pending.expectedResources)&&same(upgrades,pending.expectedUpgrades)){await store.writeJson(journalPath,null);return true;}
  if(sameResources(resources,pending.nextResources)&&same(upgrades,pending.expectedUpgrades)){await store.writeJson(upgradePath,pending.nextUpgrades);await store.writeJson(journalPath,null);return true;}
  throw Error('升级结算记录与当前资源不一致，已停止重复结算');
 }
 return{recover:()=>transaction(recover),commit:request=>transaction(async()=>{await recover();const {validate,...packet}=request;const resources=await readResources(),upgrades=await store.readJson(upgradePath,{});if(!same(resources,packet.expectedResources)||!same(upgrades,packet.expectedUpgrades))return false;
  // The slot/effect qualification is rechecked under the object transaction.
  // Executable checks never enter the durable, replayable transaction journal.
  if(validate&&await validate()!==true)return false;
  await store.writeJson(journalPath,packet);if(!await compareAndSetResources(packet.expectedResources,packet.nextResources)){await store.writeJson(journalPath,null);return false;}
  try{await store.writeJson(upgradePath,packet.nextUpgrades);}catch(error){const rolledBack=await compareAndSetResources(packet.nextResources,packet.expectedResources);if(rolledBack)await store.writeJson(journalPath,null);throw Error(rolledBack?'升级保存失败，资源已恢复':'升级等待恢复，请勿重复申请');}try{await store.writeJson(journalPath,null);}catch{}return true;
 })};
}
