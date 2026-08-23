import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_INLINE = join(ROOT, "public/frontends/hypnosis-app/st-load-inline.html");
const PHONE_DIR = join(ROOT, "public/frontends/hypnosis-app-phone");
const OUTPUT_INLINE = join(PHONE_DIR, "st-load-inline.html");

const PHONE_PORT_STYLE = `<style id="st-hypnoos-phone-port-style">
html.st-hypnoos-phone-port {
  --st-phone-design-width: 430px;
  --st-phone-design-height: 812px;
  --st-phone-port-scale: 1;
  --st-phone-port-vh: 812px;
  --st-phone-port-width: 430px;
}
html.st-hypnoos-phone-port,
html.st-hypnoos-phone-port body {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: var(--st-phone-port-vh, 760px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-port-vh, 760px) !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #05070f;
}
html.st-hypnoos-phone-port body {
  position: relative !important;
  touch-action: manipulation;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  overscroll-behavior: none;
}
html.st-hypnoos-phone-port *,
html.st-hypnoos-phone-port *::before,
html.st-hypnoos-phone-port *::after {
  box-sizing: border-box;
}
html.st-hypnoos-phone-port input,
html.st-hypnoos-phone-port select,
html.st-hypnoos-phone-port textarea,
html.st-hypnoos-phone-port button {
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}
html.st-hypnoos-phone-port textarea {
  resize: none !important;
}
html.st-hypnoos-phone-port label,
html.st-hypnoos-phone-port .st-encounter-field,
html.st-hypnoos-phone-port .st-person-tools,
html.st-hypnoos-phone-port .st-person-picker,
html.st-hypnoos-phone-port .st-hypnosis-command-card,
html.st-hypnoos-phone-port .st-hypnosis-command-grid {
  min-width: 0 !important;
  max-width: 100% !important;
}
html.st-hypnoos-phone-port #st-operation-workspace {
  position: relative !important;
  width: var(--st-phone-port-width, 430px) !important;
  max-width: 100vw !important;
  min-width: 0 !important;
  height: var(--st-phone-port-vh, 760px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-port-vh, 760px) !important;
  margin: 0 !important;
  padding: 0 !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: minmax(0, 1fr) !important;
  gap: 0 !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  overflow: hidden !important;
  contain: layout paint size !important;
}
html.st-hypnoos-phone-port [data-st-phone-port-workspace="true"] {
  height: var(--st-phone-port-vh, 760px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-port-vh, 760px) !important;
  overflow: hidden !important;
}
html.st-hypnoos-phone-port #st-operation-workspace > #app,
html.st-hypnoos-phone-port #app {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: var(--st-phone-design-width, 430px) !important;
  max-width: var(--st-phone-design-width, 430px) !important;
  min-width: 0 !important;
  height: var(--st-phone-design-height, 812px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-design-height, 812px) !important;
  transform: scale(var(--st-phone-port-scale, 1)) !important;
  transform-origin: top left !important;
  overflow: hidden !important;
}
html.st-hypnoos-phone-port #app {
  contain: layout paint size !important;
}
html.st-hypnoos-phone-port #st-operation-workspace > #app > div:first-child {
  width: var(--st-phone-design-width, 430px) !important;
  max-width: var(--st-phone-design-width, 430px) !important;
  min-width: 0 !important;
  height: var(--st-phone-design-height, 812px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-design-height, 812px) !important;
  padding: 0 !important;
  align-items: stretch !important;
  justify-content: flex-start !important;
  overflow: hidden !important;
}
html.st-hypnoos-phone-port #st-operation-workspace > #app > div:first-child > div:first-child,
html.st-hypnoos-phone-port [data-st-phone-port-shell="true"] {
  width: var(--st-phone-design-width, 430px) !important;
  max-width: var(--st-phone-design-width, 430px) !important;
  min-width: 0 !important;
  height: var(--st-phone-design-height, 812px) !important;
  min-height: 0 !important;
  max-height: var(--st-phone-design-height, 812px) !important;
  aspect-ratio: auto !important;
  margin: 0 auto !important;
  border-width: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: hidden !important;
  flex: 0 0 auto !important;
  contain: layout paint size !important;
}
html.st-hypnoos-phone-port #app .w-full.h-full.bg-black.overflow-hidden.relative,
html.st-hypnoos-phone-port [data-st-phone-port-root="true"] {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  min-height: 0 !important;
  border-radius: 0 !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain !important;
}
html.st-hypnoos-phone-port #app .w-full.h-full.bg-black.overflow-hidden.relative > div,
html.st-hypnoos-phone-port [data-st-phone-port-root="true"] > div {
  min-width: 0 !important;
  max-width: 100% !important;
}
html.st-hypnoos-phone-port #app [class*="w-["],
html.st-hypnoos-phone-port #app [class*="min-w-"],
html.st-hypnoos-phone-port #app [class*="max-w-"] {
  max-width: 100% !important;
}
html.st-hypnoos-phone-port #app button,
html.st-hypnoos-phone-port #app input,
html.st-hypnoos-phone-port #app select,
html.st-hypnoos-phone-port #app textarea,
html.st-hypnoos-phone-port #st-operation-side-panel button {
  min-width: 0 !important;
  max-width: 100% !important;
}
html.st-hypnoos-phone-port .st-react-app-island-layer,
html.st-hypnoos-phone-port .st-react-clean-chrome {
  left: max(8px, env(safe-area-inset-left)) !important;
  right: max(8px, env(safe-area-inset-right)) !important;
  max-width: calc(100vw - 16px) !important;
}
html.st-hypnoos-phone-port .st-hypnosis-redrawer,
html.st-hypnoos-phone-port .st-operation-warning-card,
html.st-hypnoos-phone-port .st-encounter-confirm-card,
html.st-hypnoos-phone-port .st-profile-modal-card {
  width: min(100%, calc(100vw - 24px)) !important;
  max-width: calc(100vw - 24px) !important;
}
html.st-hypnoos-phone-port .st-hypnosis-redrawer {
  max-height: calc(var(--st-phone-port-vh, 760px) - 74px) !important;
}
html.st-hypnoos-phone-port #st-operation-side-panel {
  --st-phone-side-panel-width: min(374px, calc(var(--st-phone-design-width, 430px) - 54px));
  position: absolute !important;
  left: auto !important;
  right: calc(-1 * var(--st-phone-side-panel-width) - 14px) !important;
  top: 12px !important;
  bottom: auto !important;
  z-index: 2147482500 !important;
  width: var(--st-phone-side-panel-width) !important;
  max-width: var(--st-phone-side-panel-width) !important;
  min-width: 0 !important;
  height: calc(var(--st-phone-design-height, 812px) - 24px) !important;
  max-height: calc(var(--st-phone-design-height, 812px) - 24px) !important;
  margin: 0 !important;
  border-left: 0 !important;
  border-right: 1px solid rgba(148, 163, 184, .24) !important;
  border-bottom: 1px solid rgba(148, 163, 184, .2) !important;
  border-radius: 18px 0 0 18px !important;
  overflow: hidden !important;
  transform: scale(var(--st-phone-port-scale, 1)) !important;
  transform-origin: top right !important;
  opacity: 0 !important;
  pointer-events: none !important;
  transition: right 180ms ease, opacity 160ms ease !important;
  contain: layout paint style !important;
}
html.st-hypnoos-phone-port #st-operation-side-panel.is-phone-open {
  right: 0 !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
html.st-hypnoos-phone-port #st-operation-side-panel .st-operation-panel-head {
  min-height: 54px !important;
  cursor: pointer !important;
}
html.st-hypnoos-phone-port #st-phone-operation-toggle {
  position: absolute !important;
  left: var(--st-phone-toggle-left, calc(var(--st-phone-port-width, 430px) - 62px)) !important;
  top: var(--st-phone-toggle-top, calc(var(--st-phone-port-vh, 812px) * .62)) !important;
  right: auto !important;
  z-index: 2147482600 !important;
  width: 52px !important;
  min-width: 52px !important;
  height: 52px !important;
  transform: none !important;
  border: 1px solid rgba(94, 234, 212, .42) !important;
  border-radius: 999px !important;
  background: linear-gradient(180deg, rgba(15, 23, 42, .96), rgba(17, 34, 64, .96)) !important;
  color: #dff7ff !important;
  box-shadow: 0 12px 28px rgba(0, 0, 0, .34), inset 0 0 0 1px rgba(255, 255, 255, .08) !important;
  display: grid !important;
  grid-template-rows: auto auto !important;
  align-items: center !important;
  justify-items: center !important;
  align-content: center !important;
  gap: 1px !important;
  padding: 5px !important;
  font: 850 10px/1.05 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  letter-spacing: 0 !important;
  cursor: pointer !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
html.st-hypnoos-phone-port #st-phone-operation-toggle .st-phone-operation-toggle-label {
  display: block !important;
  color: rgba(223, 247, 255, .82) !important;
  font-size: 9px !important;
  font-weight: 900 !important;
}
html.st-hypnoos-phone-port #st-phone-operation-toggle .st-phone-operation-toggle-count {
  min-width: 24px !important;
  height: 20px !important;
  border-radius: 999px !important;
  display: grid !important;
  place-items: center !important;
  background: rgba(34, 211, 238, .2) !important;
  color: #a5f3fc !important;
  font-size: 13px !important;
  font-weight: 950 !important;
  line-height: 1 !important;
}
html.st-hypnoos-phone-port #st-phone-operation-toggle.is-dragging {
  transition: none !important;
  box-shadow: 0 16px 34px rgba(0, 0, 0, .42), 0 0 0 4px rgba(34, 211, 238, .12), inset 0 0 0 1px rgba(255, 255, 255, .1) !important;
}
html.st-hypnoos-phone-port #st-phone-operation-toggle.is-open {
  background: linear-gradient(180deg, rgba(30, 41, 59, .98), rgba(8, 47, 73, .98)) !important;
  border-color: rgba(125, 211, 252, .72) !important;
}
html.st-hypnoos-phone-port .st-operation-panel-head {
  padding-left: max(12px, env(safe-area-inset-left)) !important;
  padding-right: max(12px, env(safe-area-inset-right)) !important;
}
html.st-hypnoos-phone-port .st-operation-panel-actions {
  padding-left: max(9px, env(safe-area-inset-left)) !important;
  padding-right: max(9px, env(safe-area-inset-right)) !important;
  padding-bottom: max(9px, env(safe-area-inset-bottom)) !important;
  grid-template-columns: 1fr 1fr !important;
}
html.st-hypnoos-phone-port .st-operation-panel-preview pre {
  max-height: 72px !important;
}
@media (min-width: 700px) {
  html.st-hypnoos-phone-port body {
    display: grid;
    justify-items: center;
  }
  html.st-hypnoos-phone-port #st-operation-workspace {
    width: var(--st-phone-port-width, 430px) !important;
    box-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 24px 80px rgba(0,0,0,.35);
  }
  html.st-hypnoos-phone-port #st-operation-side-panel {
    left: auto !important;
    transform: scale(var(--st-phone-port-scale, 1)) !important;
  }
  html.st-hypnoos-phone-port #st-operation-side-panel.is-phone-open {
    right: 0 !important;
  }
}
</style>`;

const PHONE_PORT_SCRIPT = `<script>
(function () {
  "use strict";
  var html = document.documentElement;
  html.classList.add("st-hypnoos-phone-port");
  var lastViewportKey = "";
  var operationToggleDrag = null;
  var phoneDomObserver = null;
  var operationCountObserver = null;
  var operationCountObserverTarget = null;
  var domRefreshFrame = 0;
  var layoutRefreshFrame = 0;
  var runtimeDisposed = false;

  function ensurePhonePortRuntimeStyle() {
    var style = document.getElementById("st-hypnoos-phone-port-runtime-lock-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "st-hypnoos-phone-port-runtime-lock-style";
      document.head.appendChild(style);
    } else if (style.parentElement !== document.head) {
      document.head.appendChild(style);
    }
    style.textContent = [
      "html.st-hypnoos-phone-port{--st-phone-design-width:430px;--st-phone-design-height:812px;--st-phone-port-scale:1;--st-phone-port-vh:812px;--st-phone-port-width:430px;}",
      "html.st-hypnoos-phone-port,html.st-hypnoos-phone-port body{width:100%!important;max-width:100%!important;height:var(--st-phone-port-vh,760px)!important;min-height:0!important;max-height:var(--st-phone-port-vh,760px)!important;overflow:hidden!important;background:#05070f!important;}",
      "html.st-hypnoos-phone-port body{position:relative!important;margin:0!important;padding:0!important;}",
      "html.st-hypnoos-phone-port #st-operation-workspace{position:relative!important;display:block!important;width:var(--st-phone-port-width,430px)!important;max-width:100vw!important;height:var(--st-phone-port-vh,812px)!important;min-height:0!important;max-height:var(--st-phone-port-vh,812px)!important;margin:0 auto!important;padding:0!important;overflow:hidden!important;contain:layout paint size style!important;}",
      "html.st-hypnoos-phone-port #st-operation-workspace>#app,html.st-hypnoos-phone-port #app{position:absolute!important;left:0!important;top:0!important;display:block!important;width:var(--st-phone-design-width,430px)!important;max-width:var(--st-phone-design-width,430px)!important;height:var(--st-phone-design-height,812px)!important;min-height:0!important;max-height:var(--st-phone-design-height,812px)!important;overflow:hidden!important;contain:layout paint size!important;transform:scale(var(--st-phone-port-scale,1))!important;transform-origin:top left!important;}",
      "html.st-hypnoos-phone-port #app>div,html.st-hypnoos-phone-port #app>div:first-child,html.st-hypnoos-phone-port #app>div:first-child>div:first-child,html.st-hypnoos-phone-port [data-st-phone-port-shell='true']{width:var(--st-phone-design-width,430px)!important;max-width:var(--st-phone-design-width,430px)!important;height:var(--st-phone-design-height,812px)!important;min-height:0!important;max-height:var(--st-phone-design-height,812px)!important;overflow:hidden!important;}",
      "html.st-hypnoos-phone-port #app .w-full.h-full.bg-black.overflow-hidden.relative,html.st-hypnoos-phone-port [data-st-phone-port-root='true']{position:relative!important;width:100%!important;max-width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important;border-radius:0!important;}",
      "html.st-hypnoos-phone-port #app [class~='min-h-screen'],html.st-hypnoos-phone-port #app [class*='min-h-[100vh]']{min-height:0!important;}",
      "html.st-hypnoos-phone-port #app [class~='h-screen'],html.st-hypnoos-phone-port #app [class*='h-[100vh]']{height:100%!important;max-height:100%!important;}",
      "html.st-hypnoos-phone-port .st-mchan-internal-app,html.st-hypnoos-phone-port .st-lite-app,html.st-hypnoos-phone-port .st-calendar-lite-app,html.st-hypnoos-phone-port .st-timetable-app,html.st-hypnoos-phone-port .st-clock-app,html.st-hypnoos-phone-port .st-profile-app,html.st-hypnoos-phone-port .st-map-app,html.st-hypnoos-phone-port .st-city-map-app,html.st-hypnoos-phone-port .st-school-app,html.st-hypnoos-phone-port .st-special-location-app,html.st-hypnoos-phone-port .st-encounter-app,html.st-hypnoos-phone-port .st-inventory-app,html.st-hypnoos-phone-port .st-reward-app,html.st-hypnoos-phone-port .st-hypnosis-lite-app,html.st-hypnoos-phone-port .st-help-app,html.st-hypnoos-phone-port .st-placeholder-app{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important;}",
      "html.st-hypnoos-phone-port .st-lite-body,html.st-hypnoos-phone-port .st-mchan-content,html.st-hypnoos-phone-port .st-profile-body{min-height:0!important;max-height:100%!important;overflow:auto!important;-webkit-overflow-scrolling:touch;}",
      "html.st-hypnoos-phone-port #st-operation-side-panel{--st-phone-side-panel-width:min(374px,calc(var(--st-phone-design-width,430px) - 54px));position:absolute!important;left:auto!important;right:calc(-1 * var(--st-phone-side-panel-width) - 14px)!important;top:12px!important;bottom:auto!important;width:var(--st-phone-side-panel-width)!important;max-width:var(--st-phone-side-panel-width)!important;height:calc(var(--st-phone-design-height,812px) - 24px)!important;min-height:0!important;max-height:calc(var(--st-phone-design-height,812px) - 24px)!important;margin:0!important;overflow:hidden!important;transform:scale(var(--st-phone-port-scale,1))!important;transform-origin:top right!important;opacity:0!important;pointer-events:none!important;contain:layout paint style!important;}",
      "html.st-hypnoos-phone-port #st-operation-side-panel.is-phone-open{right:0!important;opacity:1!important;pointer-events:auto!important;}",
      "html.st-hypnoos-phone-port #st-operation-side-panel .st-operation-panel-list{min-height:0!important;overflow:auto!important;}",
      "html.st-hypnoos-phone-port #st-phone-operation-toggle{position:absolute!important;left:var(--st-phone-toggle-left,calc(var(--st-phone-port-width,430px) - 62px))!important;top:var(--st-phone-toggle-top,calc(var(--st-phone-port-vh,812px) * .62))!important;right:auto!important;z-index:2147482600!important;width:52px!important;min-width:52px!important;height:52px!important;transform:none!important;border:1px solid rgba(94,234,212,.42)!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(17,34,64,.96))!important;color:#dff7ff!important;display:grid!important;grid-template-rows:auto auto!important;align-items:center!important;justify-items:center!important;align-content:center!important;gap:1px!important;padding:5px!important;font:850 10px/1.05 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:0!important;cursor:pointer!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;}",
      "html.st-hypnoos-phone-port #st-phone-operation-toggle .st-phone-operation-toggle-label{display:block!important;color:rgba(223,247,255,.82)!important;font-size:9px!important;font-weight:900!important;}",
      "html.st-hypnoos-phone-port #st-phone-operation-toggle .st-phone-operation-toggle-count{min-width:24px!important;height:20px!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:rgba(34,211,238,.2)!important;color:#a5f3fc!important;font-size:13px!important;font-weight:950!important;line-height:1!important;}",
      "html.st-hypnoos-phone-port #st-phone-operation-toggle.is-dragging{transition:none!important;box-shadow:0 16px 34px rgba(0,0,0,.42),0 0 0 4px rgba(34,211,238,.12),inset 0 0 0 1px rgba(255,255,255,.1)!important;}",
      "html.st-hypnoos-phone-port #st-phone-operation-toggle.is-open{background:linear-gradient(180deg,rgba(30,41,59,.98),rgba(8,47,73,.98))!important;border-color:rgba(125,211,252,.72)!important;}"
    ].join("\\n");
  }

  function readViewportSize() {
    var designWidth = 430;
    var designHeight = 812;
    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    if (window.visualViewport && window.visualViewport.width) {
      width = window.visualViewport.width || width;
    }
    var workspace = document.getElementById("st-operation-workspace");
    var candidates = [];
    if (workspace) {
      candidates.push(workspace.parentElement);
      if (workspace.closest) {
        candidates.push(workspace.closest(".mes_text"));
        candidates.push(workspace.closest(".mes_block"));
        candidates.push(workspace.closest(".mes"));
      }
    }
    candidates.push(document.body);
    candidates.forEach(function (node) {
      if (!node || node === workspace) return;
      var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      var candidateWidth = rect && rect.width ? rect.width : node.clientWidth;
      if (!candidateWidth || candidateWidth <= 0) return;
      var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
      var paddingLeft = style ? phonePortNumber(style.paddingLeft, 0) : 0;
      var paddingRight = style ? phonePortNumber(style.paddingRight, 0) : 0;
      var innerWidth = Math.floor(candidateWidth - paddingLeft - paddingRight);
      if (innerWidth > 0) width = Math.min(width || innerWidth, innerWidth);
    });
    width = Math.max(260, width - 2);
    width = Math.max(260, Math.min(designWidth, Math.round(width || designWidth)));
    var scale = Math.min(1, width / designWidth);
    return {
      width: Math.round(designWidth * scale),
      height: Math.round(designHeight * scale),
      scale: scale
    };
  }

  function syncViewportHeight() {
    var size = readViewportSize();
    var key = size.width + "x" + size.height + "@" + size.scale.toFixed(4);
    if (key === lastViewportKey) {
      clampOperationTogglePosition();
      return;
    }
    lastViewportKey = key;
    html.style.setProperty("--st-phone-port-vh", size.height + "px");
    html.style.setProperty("--st-phone-port-width", size.width + "px");
    html.style.setProperty("--st-phone-port-scale", String(size.scale));
    clampOperationTogglePosition();
  }

  function getPhoneAppRoot() {
    try {
      var own = window.__ST_HYPNOOS_GET_OWN_APP_ROOT__ && window.__ST_HYPNOOS_GET_OWN_APP_ROOT__();
      if (own) return own;
    } catch (error) {}
    var workspaceApp = document.querySelector("#st-operation-workspace > #app");
    if (workspaceApp) return workspaceApp;
    return document.documentElement.classList.contains("st-hypnoos-phone-port") ? document.getElementById("app") : null;
  }

  function markPhoneRoot() {
    var app = getPhoneAppRoot();
    var root = app ? app.querySelector(".w-full.h-full.bg-black.overflow-hidden.relative") : null;
    if (root) {
      root.setAttribute("data-st-phone-port-root", "true");
    }
    var shell = app ? app.querySelector(":scope > div:first-child > div:first-child") : null;
    if (shell) {
      shell.setAttribute("data-st-phone-port-shell", "true");
    }
    var workspace = document.getElementById("st-operation-workspace");
    if (workspace) {
      workspace.setAttribute("data-st-phone-port-workspace", "true");
    }
  }

  function lockPhonePortLayout() {
    var workspace = document.getElementById("st-operation-workspace");
    var app = getPhoneAppRoot();
    var panel = document.getElementById("st-operation-side-panel");
    if (workspace) {
      workspace.style.setProperty("--st-phone-panel-height", "var(--st-phone-port-vh, 760px)");
      workspace.setAttribute("data-st-phone-port-workspace", "true");
      workspace.style.setProperty("width", "var(--st-phone-port-width, 430px)", "important");
      workspace.style.setProperty("height", "var(--st-phone-port-vh, 812px)", "important");
      workspace.style.setProperty("min-height", "0", "important");
      workspace.style.setProperty("max-height", "var(--st-phone-port-vh, 812px)", "important");
      workspace.style.setProperty("overflow", "hidden", "important");
    }
    if (panel) {
      panel.style.removeProperty("height");
      panel.style.removeProperty("max-height");
      panel.style.removeProperty("min-height");
      panel.style.removeProperty("left");
      panel.style.removeProperty("right");
      panel.style.removeProperty("bottom");
    }
    [app, app && app.firstElementChild].filter(Boolean).forEach(function (node) {
      node.style.setProperty("width", "var(--st-phone-design-width, 430px)", "important");
      node.style.setProperty("height", "var(--st-phone-design-height, 812px)", "important");
      node.style.setProperty("min-height", "0", "important");
      node.style.setProperty("max-height", "var(--st-phone-design-height, 812px)", "important");
      node.style.setProperty("overflow", "hidden", "important");
    });
    if (app) {
      app.style.setProperty("position", "absolute", "important");
      app.style.setProperty("left", "0", "important");
      app.style.setProperty("top", "0", "important");
      app.style.setProperty("transform", "scale(var(--st-phone-port-scale, 1))", "important");
      app.style.setProperty("transform-origin", "top left", "important");
    }
  }

  function ensureOperationPanelToggleButton() {
    var workspace = document.getElementById("st-operation-workspace");
    if (!workspace) return null;
    var button = document.getElementById("st-phone-operation-toggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "st-phone-operation-toggle";
      button.type = "button";
      button.innerHTML = '<span class="st-phone-operation-toggle-label">本轮</span><span class="st-phone-operation-toggle-count">0</span>';
      workspace.appendChild(button);
    } else if (button.parentElement !== workspace) {
      workspace.appendChild(button);
    }
    clampOperationTogglePosition();
    return button;
  }

  function phonePortNumber(value, fallback) {
    var parsed = Number.parseFloat(String(value || "").replace("px", ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function phonePortClamp(value, min, max) {
    if (max < min) return min;
    return Math.max(min, Math.min(max, value));
  }

  function toggleWorkspaceSize(workspace) {
    var fallbackWidth = phonePortNumber(getComputedStyle(html).getPropertyValue("--st-phone-port-width"), window.innerWidth || 430);
    var fallbackHeight = phonePortNumber(getComputedStyle(html).getPropertyValue("--st-phone-port-vh"), window.innerHeight || 812);
    return {
      width: Math.max(1, Math.round(workspace.clientWidth || fallbackWidth || 430)),
      height: Math.max(1, Math.round(workspace.clientHeight || fallbackHeight || 812))
    };
  }

  function setOperationTogglePosition(left, top) {
    var workspace = document.getElementById("st-operation-workspace");
    var button = document.getElementById("st-phone-operation-toggle");
    if (!workspace || !button) return;
    var size = toggleWorkspaceSize(workspace);
    var buttonWidth = Math.max(44, Math.round(button.offsetWidth || 52));
    var buttonHeight = Math.max(44, Math.round(button.offsetHeight || 52));
    var edge = 8;
    var clampedLeft = phonePortClamp(Math.round(left), edge, size.width - buttonWidth - edge);
    var clampedTop = phonePortClamp(Math.round(top), edge, size.height - buttonHeight - edge);
    workspace.style.setProperty("--st-phone-toggle-left", clampedLeft + "px");
    workspace.style.setProperty("--st-phone-toggle-top", clampedTop + "px");
  }

  function clampOperationTogglePosition() {
    var workspace = document.getElementById("st-operation-workspace");
    var button = document.getElementById("st-phone-operation-toggle");
    if (!workspace || !button) return;
    var size = toggleWorkspaceSize(workspace);
    var currentLeft = phonePortNumber(workspace.style.getPropertyValue("--st-phone-toggle-left"), NaN);
    var currentTop = phonePortNumber(workspace.style.getPropertyValue("--st-phone-toggle-top"), NaN);
    if (!Number.isFinite(currentLeft)) currentLeft = size.width - Math.max(44, button.offsetWidth || 52) - 10;
    if (!Number.isFinite(currentTop)) currentTop = Math.round(size.height * 0.62);
    setOperationTogglePosition(currentLeft, currentTop);
  }

  function setOperationPanelOpen(open) {
    var panel = document.getElementById("st-operation-side-panel");
    if (!panel) return;
    panel.classList.toggle("is-phone-open", !!open);
    syncOperationPanelToggleButton();
  }

  function finishOperationToggleDrag(button) {
    if (button) button.classList.remove("is-dragging");
    operationToggleDrag = null;
    clampOperationTogglePosition();
  }

  function syncOperationPanelToggleButton() {
    var panel = document.getElementById("st-operation-side-panel");
    var button = ensureOperationPanelToggleButton();
    if (!button) return;
    var count = "0";
    var countNode = panel && panel.querySelector ? panel.querySelector(".st-operation-count-pill") : null;
    if (countNode) count = String(countNode.textContent || "0").trim() || "0";
    var badge = button.querySelector(".st-phone-operation-toggle-count");
    if (badge) badge.textContent = count;
    var opened = !!(panel && panel.classList && panel.classList.contains("is-phone-open"));
    button.classList.toggle("is-open", opened);
    button.setAttribute("aria-expanded", opened ? "true" : "false");
    button.setAttribute("aria-label", "本轮操作暂存区，当前 " + count + " 条");
  }

  function bindOperationPanelDrawer() {
    var panel = document.getElementById("st-operation-side-panel");
    var button = ensureOperationPanelToggleButton();
    if (button && button.getAttribute("data-st-phone-port-toggle-bound") !== "true") {
      button.setAttribute("data-st-phone-port-toggle-bound", "true");
      button.addEventListener("pointerdown", function (event) {
        var workspace = document.getElementById("st-operation-workspace");
        if (!workspace) return;
        var currentLeft = phonePortNumber(workspace.style.getPropertyValue("--st-phone-toggle-left"), button.offsetLeft || 0);
        var currentTop = phonePortNumber(workspace.style.getPropertyValue("--st-phone-toggle-top"), button.offsetTop || 0);
        operationToggleDrag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startLeft: currentLeft,
          startTop: currentTop,
          moved: false
        };
        button.classList.add("is-dragging");
        try { button.setPointerCapture(event.pointerId); } catch (error) {}
        event.preventDefault();
      }, true);
      button.addEventListener("pointermove", function (event) {
        if (!operationToggleDrag || operationToggleDrag.pointerId !== event.pointerId) return;
        var dx = event.clientX - operationToggleDrag.startX;
        var dy = event.clientY - operationToggleDrag.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) operationToggleDrag.moved = true;
        setOperationTogglePosition(operationToggleDrag.startLeft + dx, operationToggleDrag.startTop + dy);
        event.preventDefault();
      }, true);
      button.addEventListener("pointerup", function (event) {
        if (!operationToggleDrag || operationToggleDrag.pointerId !== event.pointerId) return;
        var moved = !!operationToggleDrag.moved;
        finishOperationToggleDrag(button);
        try { button.releasePointerCapture(event.pointerId); } catch (error) {}
        if (!moved) {
          var currentPanel = document.getElementById("st-operation-side-panel");
          setOperationPanelOpen(!(currentPanel && currentPanel.classList.contains("is-phone-open")));
        }
        event.preventDefault();
      }, true);
      button.addEventListener("pointercancel", function (event) {
        if (!operationToggleDrag || operationToggleDrag.pointerId !== event.pointerId) return;
        finishOperationToggleDrag(button);
      }, true);
      button.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        var currentPanel = document.getElementById("st-operation-side-panel");
        setOperationPanelOpen(!(currentPanel && currentPanel.classList.contains("is-phone-open")));
        event.preventDefault();
      }, true);
    }
    if (!panel) {
      if (operationCountObserver) operationCountObserver.disconnect();
      operationCountObserver = null;
      operationCountObserverTarget = null;
      syncOperationPanelToggleButton();
      return;
    }
    if (panel.getAttribute("data-st-phone-port-drawer-bound") !== "true") {
      panel.setAttribute("data-st-phone-port-drawer-bound", "true");
      panel.addEventListener("click", function (event) {
        var head = event.target && event.target.closest ? event.target.closest(".st-operation-panel-head") : null;
        if (!head || !panel.contains(head)) return;
        setOperationPanelOpen(!panel.classList.contains("is-phone-open"));
      }, true);
    }
    if (operationCountObserverTarget !== panel) {
      if (operationCountObserver) operationCountObserver.disconnect();
      operationCountObserver = null;
      operationCountObserverTarget = panel;
    }
    if (!operationCountObserver) {
      panel.setAttribute("data-st-phone-port-count-observer-bound", "true");
      try {
        operationCountObserver = new MutationObserver(syncOperationPanelToggleButton);
        operationCountObserver.observe(panel, { childList: true, subtree: true, characterData: true });
      } catch (error) {}
    }
    syncOperationPanelToggleButton();
  }

  function refreshLayout() {
    ensurePhonePortRuntimeStyle();
    syncViewportHeight();
    markPhoneRoot();
    bindOperationPanelDrawer();
    lockPhonePortLayout();
  }

  function refreshDomOnly() {
    ensurePhonePortRuntimeStyle();
    markPhoneRoot();
    bindOperationPanelDrawer();
    lockPhonePortLayout();
  }

  function scheduleDomRefresh() {
    if (runtimeDisposed || domRefreshFrame) return;
    domRefreshFrame = window.requestAnimationFrame(function () {
      domRefreshFrame = 0;
      if (!runtimeDisposed) refreshDomOnly();
    });
  }

  function scheduleLayoutRefresh() {
    if (runtimeDisposed || layoutRefreshFrame) return;
    layoutRefreshFrame = window.requestAnimationFrame(function () {
      layoutRefreshFrame = 0;
      if (!runtimeDisposed) refreshLayout();
    });
  }

  function boot() {
    refreshLayout();
    var observerTarget = getPhoneAppRoot() || document.body;
    try {
      phoneDomObserver = new MutationObserver(scheduleDomRefresh);
      phoneDomObserver.observe(observerTarget, { childList: true, subtree: true });
    } catch (error) {}
  }

  function disposePhonePortRuntime() {
    if (runtimeDisposed) return;
    runtimeDisposed = true;
    if (phoneDomObserver) phoneDomObserver.disconnect();
    if (operationCountObserver) operationCountObserver.disconnect();
    if (domRefreshFrame) window.cancelAnimationFrame(domRefreshFrame);
    if (layoutRefreshFrame) window.cancelAnimationFrame(layoutRefreshFrame);
    window.removeEventListener("resize", scheduleLayoutRefresh);
    window.removeEventListener("pagehide", disposePhonePortRuntime);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", scheduleLayoutRefresh);
      window.visualViewport.removeEventListener("scroll", scheduleDomRefresh);
    }
  }

  window.addEventListener("resize", scheduleLayoutRefresh);
  window.addEventListener("pagehide", disposePhonePortRuntime, { once: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleLayoutRefresh);
    window.visualViewport.addEventListener("scroll", scheduleDomRefresh);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}());
</script>`;

function injectBeforeClosingTag(html, tagName, payload) {
  const source = String(html || "");
  const needle = `</${tagName}>`;
  let index = source.toLowerCase().lastIndexOf(needle);
  if (index < 0) return `${source}\n${payload}\n`;
  if (source[index] !== "<" && source[index - 1] === "<") index -= 1;
  return `${source.slice(0, index)}${payload}\n${source.slice(index)}`;
}

function patchPhoneOnlyRuntime(html) {
  return String(html || "").replace(
    /  function syncOperationSidePanelSize\(panel\) \{[\s\S]*?  \}\n\n  function updateOperationSidePanel\(\) \{/,
    `  function syncOperationSidePanelSize(panel) {
    const workspace = document.getElementById("st-operation-workspace");
    if (workspace) workspace.style.setProperty("--st-phone-panel-height", "var(--st-phone-port-vh, 812px)");
    if (panel) {
      panel.style.removeProperty("height");
      panel.style.removeProperty("maxHeight");
      panel.style.removeProperty("max-height");
      panel.style.removeProperty("minHeight");
      panel.style.removeProperty("min-height");
    }
  }

  function updateOperationSidePanel() {`
  );
}

const source = await readFile(SOURCE_INLINE, "utf8");
let output = source
  .replace(/<style id="st-hypnoos-phone-port-style">[\s\S]*?<\/style>\s*/g, "")
  .replace(/<script>\s*\(function \(\) \{\s*"use strict";\s*var html = document\.documentElement;[\s\S]*?data-st-phone-port-root[\s\S]*?<\/script>\s*/g, "");
output = patchPhoneOnlyRuntime(output);
output = injectBeforeClosingTag(output, "head", PHONE_PORT_STYLE);
output = injectBeforeClosingTag(output, "body", PHONE_PORT_SCRIPT);

await mkdir(dirname(OUTPUT_INLINE), { recursive: true });
await writeFile(OUTPUT_INLINE, output);
console.log(`Phone port frontend: ${OUTPUT_INLINE}`);
console.log(`Source: ${SOURCE_INLINE}`);
console.log(`Size: ${Math.round(output.length / 1024)} KB`);
