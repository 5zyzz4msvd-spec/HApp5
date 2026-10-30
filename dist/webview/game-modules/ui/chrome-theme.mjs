import{DUAL_SKY_STYLE as t}from"./dual-sky-theme.mjs";const n=`
:root,:host{--hypno-chrome-ink:#e2dcd4;--hypno-chrome-muted:#b4aaa5;--hypno-chrome-line:#c4ab803d;--hypno-chrome-panel:#211d22;--hypno-chrome-accent:#c9b88e;--hypno-chrome-fill:radial-gradient(ellipse at 8% 0%,#d3a07826,transparent 48%),radial-gradient(ellipse at 86% 100%,#b1799c24,transparent 55%),linear-gradient(105deg,#362836,#211e2c 60%,#302534);--hypno-chrome-size:cover,cover,cover}
.routine-scene.routine-scene{background:var(--hypno-chrome-fill);background-size:var(--hypno-chrome-size);background-repeat:no-repeat}
.routine-scene>.scene-topbar,.routine-scene>.scene-workspace{background:var(--hypno-chrome-fill);background-size:var(--hypno-chrome-size);background-repeat:no-repeat;color:var(--hypno-chrome-ink);border-color:var(--hypno-chrome-line)}
.routine-scene>.scene-topbar{position:relative;isolation:isolate;background-position:center;box-shadow:inset 0 -1px #c4ab8024,0 3px 14px #08070c40}
.routine-scene>.routine-viewport{isolation:isolate;background:radial-gradient(ellipse at 4% 82%,#bd789438,transparent 52%),radial-gradient(ellipse at 97% 12%,#d2ad7830,transparent 54%),#292231}
.routine-scene>.scene-workspace{position:relative;isolation:isolate;background-position:center;box-shadow:inset 0 1px #c4ab8017}
.routine-scene .scene-topbar>:is(button[aria-label="\u6253\u5F00\u672C\u5730\u5185\u5BB9\u5DE5\u574A"],button[aria-label="\u6253\u5F00\u8FD0\u884C\u8BBE\u7F6E"]){flex:none;align-self:center;width:auto;min-height:30px;padding:5px 10px;border:1px solid #c3b59055;border-radius:8px;background:#211b2466;color:#dbd2c6;font:11px system-ui;cursor:pointer}

.routine-scene .routine-context,.routine-scene .routine-caption{color:var(--hypno-chrome-muted)}
.routine-scene .routine-place,.routine-scene .routine-caption strong{color:#e0d8c8}
.routine-scene .routine-time{color:#b8aea7}
.routine-scene .scene-topbar [data-scene-toolbar]{color:var(--hypno-chrome-ink)}
.routine-scene .scene-topbar [data-scene-toolbar] button{color:var(--hypno-chrome-ink);border-color:#a8b5c033;background:#ffffff04}
.routine-scene .scene-topbar [data-scene-toolbar] [aria-pressed=true]{background:#b8ab881c;border-color:#c9b88e55;color:#eee1c6}
.routine-scene .scene-topbar [data-scene-toolbar] input{background:#e5dfd5;color:#484049;border:1px solid #d3cbb980}
.routine-scene .player-schedule .schedule-cell{background:#18141b42;border-color:#baaca226;color:#b9b0aa}
.routine-scene .player-schedule .schedule-cell[aria-pressed=true]{background:#ad9d7320;border-color:#c6b58a99;color:#ece4d3;box-shadow:inset 0 0 0 1px #d1bc8910}
.routine-scene .schedule-actions,.routine-scene .gal-composer{border-color:#b7a79326;color:#b8aea7}
.routine-scene .schedule-actions button,.routine-scene .gal-hud button{background:#ffffff04;border-color:#a8b5c02b;color:#e2dcd4}
.routine-scene .schedule-actions [data-advance]{background:#a59c8017;border-color:#c9b88e40;color:#e2dbc9}
.routine-scene[data-location-mode=true]>.scene-workspace.scene-workspace{background:var(--hypno-chrome-fill)!important;background-size:var(--hypno-chrome-size)!important;border-top-color:var(--hypno-chrome-line)}
.routine-scene .location-navigation-bar{color:var(--hypno-chrome-ink)}
.routine-scene .location-mode-copy p{color:#b8aea7}
.routine-scene .location-mode-path button{color:#b5c7d3}
.routine-scene .location-mode-choice{background:#ffffff06!important;color:#c8beb5;border:1px solid #a8b5c01b!important}
.routine-scene .location-mode-choice[aria-pressed=true]{background:#b8ab881a!important;color:#e4dbc7;border-color:#c9b88e50!important}
.routine-scene :is(.location-mode-path,.location-mode-choices){scrollbar-color:#78838e55 transparent}
.routine-scene :is(.location-mode-path,.location-mode-choices)::-webkit-scrollbar-thumb{background:#78838e55}
.floating-surface:is(.gal-note,.gal-history)>:is(header,footer),.routine-scene .location-hypnosis-sheet>header{background:var(--hypno-chrome-fill);background-size:var(--hypno-chrome-size);color:var(--hypno-chrome-ink);border-color:var(--hypno-chrome-line)}
.routine-scene .location-hypnosis-sheet>header{border-radius:10px;padding:8px}
.routine-scene .routine-world{z-index:1}
.chrome-atmosphere{position:absolute;pointer-events:none!important;overflow:hidden;contain:layout paint;user-select:none}
.chrome-side{top:0;bottom:0;z-index:0}.chrome-side-left{left:0;width:var(--chrome-side-left,0px)}.chrome-side-right{right:0;width:var(--chrome-side-right,0px)}
.chrome-bar{inset:0;z-index:-1}
.chrome-particle{position:absolute;display:block;pointer-events:none!important;animation-duration:var(--chrome-time);animation-delay:var(--chrome-delay);animation-iteration-count:infinite;animation-timing-function:ease-in-out;transition:translate .6s cubic-bezier(.2,.65,.25,1),scale .6s cubic-bezier(.2,.65,.25,1)}
.chrome-heart{width:var(--chrome-size);height:var(--chrome-size);background:linear-gradient(150deg,#f6c7d5,#d99eb8);opacity:.36;animation-name:chrome-heartbeat;filter:drop-shadow(0 0 4px #d88da84d);mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21S1 14 1 7.5C1 .8 9 .2 12 5.3C15 .2 23 .8 23 7.5C23 14 12 21 12 21Z' fill='none' stroke='white' stroke-width='1.4' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}
.chrome-firefly{width:var(--chrome-size);height:var(--chrome-size);border-radius:50%;background:#f1d7a7;box-shadow:0 0 8px 2px #e3bd7459;opacity:.4;animation-name:chrome-float}
.chrome-meteor{width:var(--chrome-size);height:1.5px;border-radius:100%;background:linear-gradient(90deg,transparent,#f0d2a982 70%,#fff0d5);box-shadow:3px 0 7px #f3d5b040;opacity:0;transform-origin:right center;animation-name:chrome-meteor;animation-timing-function:linear}
.chrome-meteor::after{content:"";position:absolute;right:0;top:-1px;width:3px;height:3px;background:#fff1db;border-radius:50%;box-shadow:0 0 5px #f3d5b0}
.chrome-cursor-glow{position:absolute;left:0;top:0;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,#edb3c522, #edc8910b 38%,transparent 70%);opacity:0;transition:opacity .45s,transform .5s cubic-bezier(.2,.65,.25,1);pointer-events:none}
.chrome-atmosphere[data-cursor-inside=true] .chrome-cursor-glow{opacity:1}
.routine-scene[data-chrome-paused=true] .chrome-particle{animation-play-state:paused}
@keyframes chrome-heartbeat{0%,28%,60%,100%{transform:scale(.9);opacity:.3}35%{transform:scale(1.12);opacity:.68}42%{transform:scale(.97);opacity:.44}49%{transform:scale(1.06);opacity:.58}}
@keyframes chrome-float{0%,100%{transform:translate3d(0,4px,0);opacity:.25}38%{opacity:.8}62%{transform:translate3d(var(--chrome-dx),var(--chrome-dy),0);opacity:.5}}
@keyframes chrome-meteor{0%{transform:translate3d(-20px,-35px,0) rotate(65deg);opacity:0}1%{opacity:.75}6%{transform:translate3d(48px,142px,0) rotate(65deg);opacity:0}7%,100%{transform:translate3d(48px,142px,0) rotate(65deg);opacity:0}}
@media(prefers-reduced-motion:reduce){.chrome-particle{animation:none!important;transition:none!important;opacity:.4}.chrome-meteor,.chrome-cursor-glow{display:none}}
@media(max-width:700px){.routine-scene:not([data-window-toolbar])>.scene-topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:22px 50px;gap:4px 10px}.routine-scene:not([data-window-toolbar]) .routine-context{grid-area:1/1/2/2;width:100%}.routine-scene:not([data-window-toolbar]) .routine-wheel{grid-area:2/1/3/-1;max-width:none}.routine-scene:not([data-window-toolbar]) .scene-topbar>:is(button[aria-label="\u6253\u5F00\u672C\u5730\u5185\u5BB9\u5DE5\u574A"],button[aria-label="\u6253\u5F00\u8FD0\u884C\u8BBE\u7F6E"]){grid-area:1/2/2/3;min-height:25px;padding:3px 9px}}
`;function c(o,a=o){for(const e of new Set([o,a])){if(e.querySelector("style[data-hypno-chrome]"))continue;const r=o.createElement("style");r.dataset.hypnoChrome="soft-atmosphere-v3",r.textContent=n+t,(e.nodeType===9?e.head:e).append(r)}}export{n as SCENE_CHROME_STYLE,c as installSceneChrome};
