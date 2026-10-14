// Opt-in DOM identity/animation audit for the local preview, never chat code.
export function watchPhoneInteractions(host){
 const selectors=['.ip-source-app','.ip-source-command','.ip-picker-backdrop','.ip-picker-sheet','.ip-picker-list','[data-picker-search]'],seen=new WeakSet(),mounts={},animations={};
 const scan=()=>{for(const selector of selectors)for(const node of host.querySelectorAll(selector))if(!seen.has(node)){seen.add(node);mounts[selector]=(mounts[selector]??0)+1;}host.dataset.interactionAudit=JSON.stringify({mounts,animations});};
 new MutationObserver(scan).observe(host,{childList:true,subtree:true});
 host.addEventListener('animationstart',event=>{animations[event.animationName]=(animations[event.animationName]??0)+1;scan();});scan();
}
