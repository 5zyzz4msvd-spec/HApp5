export function notebookBookSwitcher(root, { reduced = () => false } = {}) {
  const win = root.ownerDocument.defaultView;
  let revision = 0, animation = null, destroyed = false, active = null;
  function cancel() {
    revision++; animation?.cancel(); animation = null;
    if(active){const visible=active.phase==='entering'?active.incoming:active.outgoing;for(const unit of new Set([active.outgoing,active.incoming])){unit.inert=false;unit.hidden=unit!==visible;unit.style.visibility=unit===visible?'visible':'hidden';}}
    active=null;delete root.dataset.bookChanging;delete root.dataset.bookPhase;
  }
  async function swap({ outgoing, incoming = outgoing, prepare = async () => {} }) {
    if(destroyed)return false;
    cancel();
    const token = ++revision;
    active={outgoing,incoming,phase:'leaving'};
    root.dataset.bookChanging = 'true';
    root.dataset.bookPhase='leaving';
    outgoing.inert = incoming.inert = true;
    if (incoming !== outgoing) {incoming.hidden=true;incoming.style.visibility = 'hidden';}
    outgoing.hidden=false;outgoing.style.visibility = 'visible';
    try {
      if (!reduced()) {
        animation = outgoing.animate([{ transform: 'translateX(0) rotate(0)', opacity: 1 }, { transform: 'translateX(-130px) rotate(-2deg)', opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'both' });
        try { await animation.finished; } catch {}
      }
      if (destroyed || token !== revision) return false;
      outgoing.hidden=true;outgoing.style.visibility = 'hidden'; animation?.cancel(); animation = null;
      active.phase='preparing';root.dataset.bookPhase='preparing';
      await prepare();
      if (destroyed || token !== revision) return false;
      active.phase='entering';root.dataset.bookPhase='entering';
      incoming.hidden=false;incoming.style.visibility = 'visible';
      if (!reduced()) {
        animation = incoming.animate([{ transform: 'translateX(130px) rotate(2deg)', opacity: 0 }, { transform: 'translateX(0) rotate(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
        try { await animation.finished; } catch {}
      }
      return !destroyed && token === revision;
    } finally {
      if (token === revision) {
        animation?.cancel(); animation = null; incoming.inert = false;
        incoming.hidden=false;incoming.style.visibility = 'visible'; active=null;delete root.dataset.bookChanging;delete root.dataset.bookPhase;
      }
    }
  }
  return { swap, cancel, isBusy:()=>Boolean(active), destroy() { destroyed = true; cancel(); } };
}
