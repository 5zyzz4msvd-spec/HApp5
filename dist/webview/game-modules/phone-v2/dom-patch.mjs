// Reconcile rendered markup without remounting the app, input controls or photos.
// Stable keys let filtered lists keep their surviving rows and focus.
function key(node){
 if(node.nodeType!==1)return null;
 for(const name of ['data-photo','data-album','data-photo-tab','data-photo-filter','data-case-slot','data-case-item','data-source-command','data-tier','data-command-cost','data-option','data-detail','data-open','data-route','data-app-scope','data-app-lifetime','data-records'])if(node.hasAttribute(name))return name+':'+node.getAttribute(name);
 for(const name of ['data-picker','data-field','data-feature'])if(node.hasAttribute(name))return name+':'+node.getAttribute(name)+':'+(node.getAttribute('data-command-id')??'');
 for(const name of ['data-photo-search','data-picker-search','data-batch-cost','data-stage','data-modal-cancel','data-modal-confirm'])if(node.hasAttribute(name))return name;
 if(node.id)return 'id:'+node.id;
 for(const name of ['ip-home','ip-app-page','ip-source-heading','ip-category-tabs','ip-source-controls','ip-source-scroll','ip-source-submit','ip-footer-tabs','ip-picker-backdrop','ip-picker-sheet','ip-picker-list','ip-source-params'])if(node.classList.contains(name))return 'region:'+name;
 return null;
}
function compatible(a,b){return a.nodeType===b.nodeType&&(a.nodeType!==1||a.tagName===b.tagName)&&key(a)===key(b);}
function patchNode(current,next){
 if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
 for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of next.attributes)if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 if(current.tagName==='INPUT'){
   if(current.value!==next.value)current.value=next.value;
   if(current.checked!==next.checked)current.checked=next.checked;
   return;
 }
 if(current.tagName==='TEXTAREA'){
   // Updating text children would reset the live value/caret even when unchanged.
   if(current.value!==next.value)current.value=next.value;
   return;
 }
 patchChildren(current,next);
}
function patchChildren(parent,next){
 const old=[...parent.childNodes],used=new Set();let cursor=parent.firstChild;
 for(const desired of [...next.childNodes]){
   const wanted=key(desired);
   let current=wanted?old.find(node=>!used.has(node)&&compatible(node,desired)):cursor&&!used.has(cursor)&&compatible(cursor,desired)?cursor:old.find(node=>!used.has(node)&&key(node)===null&&compatible(node,desired));
   if(!current)current=desired.cloneNode(true);
   if(current!==cursor)parent.insertBefore(current,cursor);
   used.add(current);patchNode(current,desired);cursor=current.nextSibling;
 }
 for(const node of old)if(!used.has(node))node.remove();
}
export function patchHtml(container,markup){
 const template=container.ownerDocument.createElement('template');template.innerHTML=markup;
 patchChildren(container,template.content);
}
