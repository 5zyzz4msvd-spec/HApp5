import { saveObjectImage, readObjectImage } from './assets.mjs';
import { sha256 } from '../workshop/task-package.mjs';
export const ROLE_MEDIA_SLOTS=8;
export class SharedRoleMedia {
  constructor(driver){this.driver=driver;this.root='hypnoos-shared-role-media/v1';this.queue=Promise.resolve();this.urls=new Map();this.assetStore={driver,path:relative=>this.root+'/'+relative};}
  async key(actor){return 'media-'+(await sha256(actor.ui?.mediaKey??actor.name)).slice(0,32);}
  async album(actor){const key=await this.key(actor),text=await this.driver.readText(this.root+'/albums/'+key+'.json');return text?JSON.parse(text):{schema:1,key,portrait:Array(ROLE_MEDIA_SLOTS).fill(null),standee:Array(ROLE_MEDIA_SLOTS).fill(null)};}
  async put(actor,blob,{usage='portrait',slot=0,name=blob.name??'图片'}={}){
    if(!['portrait','standee','head'].includes(usage)||!Number.isInteger(slot)||slot<0||slot>=ROLE_MEDIA_SLOTS)throw Error('图片存储位无效');
    const work=this.queue.then(async()=>{const album=await this.album(actor);album[usage]??=Array(ROLE_MEDIA_SLOTS).fill(null);const ref=await saveObjectImage(this.assetStore,{kind:'character',id:album.key},blob,{name,usage:usage==='head'?'gallery':usage});album[usage][slot]={...ref,usage,scope:'shared'};await this.driver.writeTextAtomic(this.root+'/albums/'+album.key+'.json',JSON.stringify(album));return album[usage][slot];});this.queue=work.catch(()=>{});return work;
  }
  read(ref){return readObjectImage(this.assetStore,ref);}
  async url(ref){if(!this.urls.has(ref.path)){const blob=await this.read(ref);if(!blob)return null;this.urls.set(ref.path,URL.createObjectURL(blob));}return this.urls.get(ref.path);}
}
