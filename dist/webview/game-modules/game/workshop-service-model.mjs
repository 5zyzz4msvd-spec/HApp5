const clone=structuredClone;
export const WORKSHOP_SERVICE_IDS=Object.freeze({vip:'vip-next',energy:'energy-refill',benefit:'energy-cap-benefit'});
// View state contains choices, never account writes or hypnosis qualification.
// The business service re-reads actual slots and supplies every payable quote.
export class WorkshopServiceForm{
 constructor({service,mode='vip',readResources,isWritable=()=>true,onChange=()=>{}}){Object.assign(this,{service,mode,readResources,isWritable,onChange});this.balances={};this.menu=[];this.candidates=[];this.options={};this.drafts={};this.quote=null;this.error='';this.notice='';this.busy=false;this.destroyed=false;this.epoch=0;}
 get item(){return this.menu.find(item=>item.id===WORKSHOP_SERVICE_IDS[this.mode]);}
 async refresh(){const epoch=++this.epoch;await this.service.refresh();const balances=await this.readResources();if(this.destroyed||epoch!==this.epoch)return;this.balances=balances;this.menu=clone(this.service.menu??[]);this.candidates=clone(this.service.candidates??[]);if(!Object.keys(this.options).length)this.options=this.defaultOptions(this.mode);await this.updateQuote(epoch);}
 async updateQuote(epoch=++this.epoch){this.quote=null;this.error='';this.onChange();try{const quote=await this.service.quote(WORKSHOP_SERVICE_IDS[this.mode],clone(this.options));if(this.destroyed||epoch!==this.epoch)return;this.quote=quote;}catch(error){if(this.destroyed||epoch!==this.epoch)return;this.error=error.message;}this.onChange();}
 defaultOptions(mode){return mode==='vip'?{targetRank:Math.min(6,Number(this.balances.vipRank??0)+1)}:mode==='energy'?{amount:1000}:{tier:'A',characterIds:[]};}
 async switchMode(mode){if(!WORKSHOP_SERVICE_IDS[mode])throw Error('无效的应用服务');if(this.busy||this.destroyed||mode===this.mode)return false;this.drafts[this.mode]=clone(this.options);this.mode=mode;this.options=clone(this.drafts[mode]??this.defaultOptions(mode));this.notice='';this.quote=null;this.error='';this.onChange();try{await this.refresh();}catch(error){if(!this.destroyed&&this.mode===mode){this.error=error.message;this.onChange();}return false;}return true;}
 choose(options){if(this.busy||this.destroyed)return;this.options=clone(options);this.notice='';return this.updateQuote();}
 get canSubmit(){return !this.destroyed&&!this.busy&&this.isWritable()&&Boolean(this.quote?.available)&&!this.quote?.claimed&&!this.quote?.scheduled&&Number(this.balances.money??0)>=Number(this.quote?.price?.amount??Infinity);}
 async submit(){if(!this.canSubmit)return false;this.busy=true;this.notice='';this.error='';this.onChange();try{const action=await this.service.request(WORKSHOP_SERVICE_IDS[this.mode],clone(this.options));if(this.destroyed)return action;this.notice='已加入当前日程格，可继续选择其他服务。';await this.refresh();return action;}catch(error){if(!this.destroyed)this.error=error.message;return false;}finally{this.busy=false;if(!this.destroyed)this.onChange();}}
 destroy(){this.destroyed=true;this.epoch++;}
}
