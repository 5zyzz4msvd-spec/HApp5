(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var config = {
    frontendUrl: String(script.dataset.frontendUrl || ""),
    assetBase: String(script.dataset.assetBase || ""),
    revision: String(script.dataset.revision || "local"),
    mode: String(script.dataset.mode || "stage"),
    galgameScriptId: String(script.dataset.galgameScriptId || "8f69fa0e-1a51-4f63-9dc0-1129ef0ab4d7"),
    galgameScriptName: String(script.dataset.galgameScriptName || "国王游戏·Galgame输出协议")
  };
  var token = "hypnoos-owner-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);

  function textId(value) {
    if (value === null || value === undefined) return "";
    var text = String(value).trim();
    return text === "undefined" || text === "null" ? "" : text;
  }

  function candidateWindows() {
    var list = [];
    [window, window.parent, window.top].forEach(function (view) {
      try {
        if (view && list.indexOf(view) < 0) list.push(view);
      } catch (_) {}
    });
    return list;
  }

  function messageIdFromWindow() {
    try {
      if (typeof window.getCurrentMessageId === "function") {
        var own = textId(window.getCurrentMessageId());
        if (own) return own;
      }
    } catch (_) {}
    try {
      var frameNode = window.frameElement;
      var messageNode = frameNode && frameNode.closest ? frameNode.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (messageNode) {
        var frameId = textId(messageNode.getAttribute("mesid") || messageNode.getAttribute("data-message-id") || messageNode.getAttribute("data-mes-id"));
        if (frameId) return frameId;
      }
    } catch (_) {}
    try {
      var node = script;
      while (node && node !== document.documentElement) {
        var attrs = ["mesid", "message_id", "data-message-id", "data-mes-id", "data-messageid", "data-index"];
        for (var j = 0; j < attrs.length; j += 1) {
          var value = textId(node.getAttribute && node.getAttribute(attrs[j]));
          if (value) return value;
        }
        node = node.parentElement;
      }
    } catch (_) {}
    var views = candidateWindows();
    for (var i = 0; i < views.length; i += 1) {
      var view = views[i];
      if (view === window) continue;
      try {
        if (typeof view.getCurrentMessageId === "function") {
          var direct = textId(view.getCurrentMessageId());
          if (direct) return direct;
        }
      } catch (_) {}
    }
    return "";
  }

  function findHostWindow() {
    var candidates = candidateWindows().slice().reverse();
    for (var i = 0; i < candidates.length; i += 1) {
      try {
        var view = candidates[i];
        var doc = view.document;
        if (!doc || !doc.body) continue;
        if (doc.querySelector("#chat,.mes[mesid],#send_textarea") || view.SillyTavern || typeof view.getContext === "function") return view;
      } catch (_) {}
    }
    return window;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createRegistry(host) {
    var hostDocument = host.document;
    var owners = new Map();
    var ownerOrder = [];
    var shell = null;
    var shadow = null;
    var frame = null;
    var launcher = null;
    var panel = null;
    var floorSelect = null;
    var modeButton = null;
    var stateBadge = null;
    var titleFloor = null;
    var galgameToggle = null;
    var galgameDialog = null;
    var resourcePanel = null;
    var variableFormatButton = null;
    var petCharacterButton = null;
    var variableFormatDialog = null;
    var encounterDetailHost = null;
    var encounterPossessionDecorHost = null;
    var profileNeighborHost = null;
    var profilePossessionHost = null;
    var timetableHost = null;
    var timetableFocus = "none";
    var mapExtraChainHost = null;
    var locationRuleRadarTimer = 0;
    var timetableRefreshTimer = 0;
    var timetableEditorCell = null;
    var galgameBusy = false;
    var selectedId = "";
    var selectionMode = "follow";
    var loadedForWritableId = "";
    var dragState = null;
    var launcherDragState = null;
    var suppressLauncherClick = false;
    var petSprite = null;
    var petMenu = null;
    var petMenuOpen = false;
    var petMenuLongPressTimer = 0;
    var petCharacterId = "alisa";
    var petPendingCharacterId = "";
    var petSwitching = false;
    var petImageCache = new Map();
    var petLoadPromises = new Map();
    var petLoadQueue = [];
    var petLoadsInFlight = 0;
    var petTimer = 0;
    var petActivityTimer = 0;
    var petMotionFrame = 0;
    var petMotionLast = 0;
    var petState = "idle";
    var petFrame = 0;
    var petLoops = 0;
    var petDirection = 1;
    var petOriginX = 0;
    var petOriginY = 0;
    var petSpinAngle = 0;
    var petSpinVelocity = 0;
    var petRoamX = 0;
    var petRoamY = 0;
    var petPointerHover = false;
    var petHasFocus = false;
    var petAssetsReady = false;
    var petReadyAssets = new Set();
    var petMotionQuery = null;
    var petMotionHandler = null;
    var petVisibilityHandler = null;
    var stageSubscribers = new Set();
    var shellOpen = false;
    var storageKey = "hypnoos.floatingPhone.ui.v1";
    var mountTimer = 0;
    var profileOpenTimer = 0;
    var pendingProfileRole = "";
    var fetchController = null;
    var hostClickHandler = null;
    var hostResizeHandler = null;
    var galgameObserver = null;
    var galgameRenderFrame = 0;
    var galgameHydrator = null;
    var galgameHydratorToken = "";
    var actionFoldObserver = null;
    var actionFoldRenderFrame = 0;
    var actionFoldObservedFrames = new WeakSet();
    var resourceRefreshToken = 0;
    var resourceEventStops = [];
    var resourceEventsSubscribed = false;
    var GALGAME_STYLE_ID = "st-galgame-narrative-bootstrap-style-v3";
    var GALGAME_STALE_STYLE_IDS = [
      "st-galgame-narrative-bootstrap-style-v1",
      "st-galgame-narrative-bootstrap-style-v2",
      "st-galgame-narrative-host-style-v1",
      "st-galgame-narrative-host-style-v2",
      "st-galgame-narrative-host-style-v3"
    ];
    var GALGAME_RUNTIME_KEY = "__ST_HYPNOOS_GALGAME_HOST_RUNTIME__";
    var GALGAME_MARKER_RE = /⟪人物演出总块⟫([\s\S]*?)⟪\/人物演出总块⟫/;
    var GALGAME_HISTORY_MARKER_RE = /⟪人物演出历史块⟫([\s\S]*?)⟪\/人物演出历史块⟫/;
    var GALGAME_RAW_BLOCK_RE = /<\s*人物演出\s*>([\s\S]*?)<\s*\/\s*人物演出\s*>/i;
    var GALGAME_SEGMENT_RE = /〔(动作|台词|思考)〕([\s\S]*?)(?=〔(?:动作|台词|思考)〕|$)/g;
    var ACTION_FOLD_OPEN = "⟪HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_CLOSE = "⟪/HYPNOOS_ACTION_FOLD_V3⟫";
    var ACTION_FOLD_MARKER_RE = /⟪HYPNOOS_ACTION_FOLD_V3⟫([\s\S]*?)⟪\/HYPNOOS_ACTION_FOLD_V3⟫/;

    function ensureGalgameStyle() {
      if (!hostDocument.head) return;
      GALGAME_STALE_STYLE_IDS.forEach(function removeStaleGalgameStyle(styleId) {
        var staleStyle = hostDocument.getElementById(styleId);
        if (staleStyle) staleStyle.remove();
      });
      var style = hostDocument.getElementById(GALGAME_STYLE_ID);
      if (!style) {
        style = hostDocument.createElement("style");
        style.id = GALGAME_STYLE_ID;
        hostDocument.head.appendChild(style);
      }
      style.textContent = [
        ".mes_text .st-galgame-card{--gg-hue:206;--gg-accent:hsl(var(--gg-hue) 88% 72%);position:relative;display:block;width:100%;box-sizing:border-box;margin:16px 0 14px;overflow:hidden;border:1px solid hsl(var(--gg-hue) 72% 68%/.34);border-radius:16px;background:linear-gradient(136deg,hsl(var(--gg-hue) 43% 10%/.98),hsl(calc(var(--gg-hue) + 22) 38% 15%/.97) 58%,hsl(var(--gg-hue) 42% 8%/.99));box-shadow:0 15px 34px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.07);color:hsl(var(--gg-hue) 70% 94%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif}",
        ".mes_text .st-galgame-card.is-joined-prev{margin-top:-10px;border-top-left-radius:6px;border-top-right-radius:6px}.mes_text .st-galgame-card.is-joined-next{margin-bottom:4px;border-bottom-left-radius:6px;border-bottom-right-radius:6px}",
        ".mes_text .st-galgame-card>summary{position:relative;display:grid;grid-template-columns:66px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:76px;padding:10px 13px;cursor:pointer;list-style:none;background:linear-gradient(90deg,hsl(var(--gg-hue) 75% 54%/.18),transparent);user-select:none}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 66px;background:linear-gradient(270deg,hsl(var(--gg-hue) 75% 54%/.18),transparent)}.mes_text .st-galgame-card>summary::marker{display:none}.mes_text .st-galgame-card>summary::-webkit-details-marker{display:none}",
        ".mes_text .st-galgame-card__portrait{position:relative;width:62px;height:62px;overflow:hidden;border:1px solid hsl(var(--gg-hue) 86% 78%/.52);border-radius:14px;background:linear-gradient(145deg,hsl(var(--gg-hue) 62% 31%/.68),rgba(15,23,42,.92));padding:0;color:inherit;font:inherit}.mes_text button.st-galgame-card__portrait{cursor:pointer}.mes_text .st-galgame-card.is-side-right .st-galgame-card__portrait{grid-column:3}.mes_text .st-galgame-card.is-side-right .st-galgame-card__identity{grid-column:2;grid-row:1;text-align:right}.mes_text .st-galgame-card.is-side-right .st-galgame-card__toggle{grid-column:1;grid-row:1}",
        ".mes_text .st-galgame-card__portrait img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top;opacity:0}.mes_text .st-galgame-card__portrait.is-loaded img{opacity:1}.mes_text .st-galgame-card__portrait-fallback{display:grid;width:100%;height:100%;place-items:center;color:var(--gg-accent);font:900 22px/1 ui-serif,Georgia,'Noto Serif SC',serif}.mes_text .st-galgame-card__portrait.is-loaded .st-galgame-card__portrait-fallback{display:none}",
        ".mes_text .st-galgame-card__identity{display:grid;gap:5px;min-width:0}.mes_text .st-galgame-card__name-row{display:flex;align-items:center;gap:9px;min-width:0}.mes_text .st-galgame-card.is-side-right .st-galgame-card__name-row{justify-content:flex-end}.mes_text .st-galgame-card__name{display:inline-flex;align-items:baseline;gap:8px;min-width:0;overflow:hidden;color:var(--gg-accent);font-size:18px;font-weight:950;letter-spacing:.045em;text-overflow:ellipsis;white-space:nowrap}.mes_text .st-galgame-card__name-original{text-decoration:line-through;opacity:.52;font-size:.76em}.mes_text .st-galgame-card__name-nickname{color:var(--gg-accent);font-family:'HanziPen SC','Kaiti SC','STKaiti',cursive}.mes_text .st-galgame-card__name-nickname.is-private{color:#ffb4a2}.mes_text .st-galgame-card__name-nickname.is-recognized{color:#86efcf}",
        ".mes_text .st-galgame-card__expression{flex:0 0 auto;border:1px solid hsl(var(--gg-hue) 76% 71%/.28);border-radius:999px;background:hsl(var(--gg-hue) 67% 44%/.16);padding:4px 8px;color:hsl(var(--gg-hue) 88% 82%);font:850 12px/1 ui-monospace,monospace}.mes_text .st-galgame-card__toggle{display:grid;place-items:center;width:26px;height:26px;border:1px solid hsl(var(--gg-hue) 80% 76%/.25);border-radius:50%;color:var(--gg-accent)}.mes_text .st-galgame-card[open] .st-galgame-card__toggle{transform:rotate(180deg)}",
        ".mes_text .st-galgame-card__body{position:relative;display:grid;gap:5px;padding:10px 16px 14px 91px;border-top:1px solid hsl(var(--gg-hue) 76% 67%/.17)}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:10px 91px 14px 16px;text-align:right}.mes_text .st-galgame-card__segment{display:block;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}.mes_text .st-galgame-card__segment--action{padding:3px 0;color:hsl(var(--gg-hue) 44% 83%/.72);font-family:ui-serif,Georgia,serif;font-size:12px;font-style:italic;line-height:1.58}.mes_text .st-galgame-card__segment--action::before{content:'＊';margin-right:6px;color:var(--gg-accent)}.mes_text .st-galgame-card__segment--speech{padding:5px 0;color:hsl(var(--gg-hue) 82% 92%);font-size:14px;font-weight:740;line-height:1.72}.mes_text .st-galgame-card__segment--speech::before{content:'“';color:var(--gg-accent)}.mes_text .st-galgame-card__segment--speech::after{content:'”';color:var(--gg-accent)}.mes_text .st-galgame-card__segment--thought{padding:5px 0;color:hsl(var(--gg-hue) 46% 88%/.76);font-family:ui-serif,Georgia,serif;font-size:13px;font-style:italic;line-height:1.72}",
        ".mes_text .st-galgame-card.is-user{--gg-hue:42!important;width:92%;border-color:rgba(253,230,138,.48)}.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{border-radius:50%}.mes_text .st-galgame-card.is-user .st-galgame-card__portrait img{display:none}.mes_text .st-galgame-card.is-user .st-galgame-card__name{color:#fde68a}",
        ".mes_text .st-galgame-card{--gg-red:#ed1831;--gg-black:#09090b;--gg-paper:#f4efe6;--gg-paper-2:#d8d2c8;--gg-muted:#c8c0b8;--gg-accent:var(--gg-red);border:3px solid var(--gg-black);border-radius:0;background:var(--gg-black);box-shadow:6px 6px 0 var(--gg-red),0 16px 34px rgba(0,0,0,.42);color:#fff;clip-path:polygon(1% 0,100% 2%,98% 100%,0 97%)}.mes_text .st-galgame-card.is-joined-prev,.mes_text .st-galgame-card.is-joined-next{border-radius:0}.mes_text .st-galgame-card>summary{background:linear-gradient(112deg,var(--gg-paper) 0 72%,var(--gg-red) 72% 78%,var(--gg-black) 78%);color:var(--gg-black)}.mes_text .st-galgame-card.is-side-right>summary{background:linear-gradient(248deg,var(--gg-paper) 0 72%,var(--gg-red) 72% 78%,var(--gg-black) 78%)}.mes_text .st-galgame-card__portrait,.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{border:3px solid var(--gg-black);border-radius:0;background:var(--gg-paper-2);box-shadow:4px 4px 0 var(--gg-red);color:var(--gg-black)}.mes_text .st-galgame-card__portrait-fallback{color:var(--gg-black);text-shadow:none}.mes_text .st-galgame-card__name,.mes_text .st-galgame-card.is-user .st-galgame-card__name{color:var(--gg-black);text-shadow:none;font-family:Impact,'Arial Black','Noto Sans SC',sans-serif}.mes_text .st-galgame-card__name-original{color:#615b56;text-decoration-color:var(--gg-red);opacity:.78}.mes_text .st-galgame-card__name-nickname,.mes_text .st-galgame-card__name-nickname.is-private,.mes_text .st-galgame-card__name-nickname.is-recognized{color:var(--gg-red)}.mes_text .st-galgame-card__expression{border:2px solid var(--gg-black);border-radius:0;background:var(--gg-black);color:#fff;box-shadow:2px 2px 0 var(--gg-red)}.mes_text .st-galgame-card__toggle{border:2px solid var(--gg-black);border-radius:0;background:#fff;color:var(--gg-black);box-shadow:2px 2px 0 var(--gg-red)}.mes_text .st-galgame-card__body,.mes_text .st-galgame-card.is-user .st-galgame-card__body{border-top:3px solid var(--gg-red);background:linear-gradient(112deg,#151418,#09090b);color:#fff}.mes_text .st-galgame-card__segment--action{color:var(--gg-muted)}.mes_text .st-galgame-card__segment--action::before,.mes_text .st-galgame-card.is-side-right .st-galgame-card__segment--action::after{color:var(--gg-red)}.mes_text .st-galgame-card__segment--speech,.mes_text .st-galgame-card.is-user .st-galgame-card__segment--speech{color:#fff}.mes_text .st-galgame-card__segment--speech::before,.mes_text .st-galgame-card__segment--speech::after,.mes_text .st-galgame-card.is-user .st-galgame-card__segment--speech::before,.mes_text .st-galgame-card.is-user .st-galgame-card__segment--speech::after{color:var(--gg-red)}.mes_text .st-galgame-card__segment--thought{color:#d8d2cc}.mes_text .st-galgame-card.is-user{border-color:var(--gg-black);background:var(--gg-black);box-shadow:6px 6px 0 var(--gg-red),0 16px 34px rgba(0,0,0,.42)}",
        ".mes_text .st-galgame-card{--gg-role:#ed1831;--gg-role-dark:#790817}.mes_text .st-galgame-card[data-galgame-tone='0']{--gg-role:#ed1831;--gg-role-dark:#790817}.mes_text .st-galgame-card[data-galgame-tone='1']{--gg-role:#00a9e8;--gg-role-dark:#064c70}.mes_text .st-galgame-card[data-galgame-tone='2']{--gg-role:#f5b700;--gg-role-dark:#7a4a00}.mes_text .st-galgame-card[data-galgame-tone='3']{--gg-role:#18b875;--gg-role-dark:#075f3c}.mes_text .st-galgame-card[data-galgame-tone='4']{--gg-role:#a968ff;--gg-role-dark:#4d217d}.mes_text .st-galgame-card[data-galgame-tone='5']{--gg-role:#ff6b28;--gg-role-dark:#862a08}.mes_text .st-galgame-card[data-galgame-tone='6']{--gg-role:#f5d547;--gg-role-dark:#725700}.mes_text .st-galgame-card__portrait,.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{box-shadow:4px 4px 0 var(--gg-role)}.mes_text .st-galgame-card__expression{box-shadow:2px 2px 0 var(--gg-role)}.mes_text .st-galgame-card__body,.mes_text .st-galgame-card.is-user .st-galgame-card__body{border-top-color:var(--gg-role);box-shadow:inset 6px 0 0 var(--gg-role-dark)}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{box-shadow:inset -6px 0 0 var(--gg-role-dark)}.mes_text .st-galgame-card__segment--action::before,.mes_text .st-galgame-card.is-side-right .st-galgame-card__segment--action::after,.mes_text .st-galgame-card__segment--speech::before,.mes_text .st-galgame-card__segment--speech::after{color:var(--gg-role)}.mes_text .st-galgame-card__index{position:absolute;z-index:3;right:50px;bottom:6px;display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:32px;height:18px;padding:0 5px;border:2px solid var(--gg-black);background:var(--gg-role);color:#fff;font:1000 10px/1 Impact,'Arial Black',sans-serif;letter-spacing:.12em;box-shadow:2px 2px 0 var(--gg-black);transform:rotate(-3deg)}.mes_text .st-galgame-card__index::before{content:'ACT';font-size:7px;opacity:.78}.mes_text .st-galgame-card.is-side-right .st-galgame-card__index{right:auto;left:50px;transform:rotate(3deg)}",
        "@media(max-width:520px){.mes_text .st-galgame-card{border-radius:0}.mes_text .st-galgame-card>summary{grid-template-columns:54px minmax(0,1fr) auto;gap:9px;min-height:66px;padding:8px 9px}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 54px}.mes_text .st-galgame-card__portrait{width:50px;height:50px;border-radius:0}.mes_text .st-galgame-card__name{font-size:15px}.mes_text .st-galgame-card__body{padding:9px 10px 11px 72px}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:9px 72px 11px 10px}}",
        String.raw`
.mes_text .st-galgame-card{--gg-role:#b34b57;--gg-ink:#151515;--gg-paper:#f6f3ed;--gg-paper-soft:#e9e5dc;position:relative;display:block;width:100%;box-sizing:border-box;margin:18px 0 16px;overflow:visible;border:0;border-radius:0;background:transparent;box-shadow:none;clip-path:none;color:var(--gg-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif}
.mes_text .st-galgame-card[data-galgame-tone="0"]{--gg-role:#b34b57}.mes_text .st-galgame-card[data-galgame-tone="1"]{--gg-role:#477594}.mes_text .st-galgame-card[data-galgame-tone="2"]{--gg-role:#9a742e}.mes_text .st-galgame-card[data-galgame-tone="3"]{--gg-role:#467561}.mes_text .st-galgame-card[data-galgame-tone="4"]{--gg-role:#745b91}.mes_text .st-galgame-card[data-galgame-tone="5"]{--gg-role:#9b5c3d}.mes_text .st-galgame-card[data-galgame-tone="6"]{--gg-role:#7d7242}
.mes_text .st-galgame-card.is-user{--gg-role:#786546!important;width:94%;margin-left:auto;border:0;background:transparent;box-shadow:none}
.mes_text .st-galgame-card.is-joined-prev{margin-top:-7px}.mes_text .st-galgame-card.is-joined-next{margin-bottom:7px}
.mes_text .st-galgame-card>summary{position:relative;display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:70px;padding:6px 10px;cursor:pointer;list-style:none;border:0;background:transparent;color:var(--gg-ink);user-select:none}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 62px;background:transparent}.mes_text .st-galgame-card>summary::marker{display:none}.mes_text .st-galgame-card>summary::-webkit-details-marker{display:none}
.mes_text .st-galgame-card__portrait,.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{position:relative;width:58px;height:58px;overflow:hidden;border:2px solid var(--gg-role);border-radius:16px;background:var(--gg-paper-soft);padding:0;color:var(--gg-ink);box-shadow:3px 3px 0 var(--gg-ink);font:inherit}.mes_text button.st-galgame-card__portrait{cursor:pointer}.mes_text button.st-galgame-card__portrait:hover{box-shadow:4px 4px 0 var(--gg-ink)}.mes_text .st-galgame-card.is-user .st-galgame-card__portrait{border-radius:50%}.mes_text .st-galgame-card.is-side-right .st-galgame-card__portrait{grid-column:3}.mes_text .st-galgame-card.is-side-right .st-galgame-card__identity{grid-column:2;grid-row:1;text-align:right}.mes_text .st-galgame-card.is-side-right .st-galgame-card__toggle{grid-column:1;grid-row:1}
.mes_text .st-galgame-card__portrait-fallback{color:var(--gg-ink);text-shadow:none;font-size:21px}.mes_text .st-galgame-card__identity{display:grid;gap:6px;min-width:0}.mes_text .st-galgame-card__name-row{display:flex;align-items:center;gap:9px;min-width:0}.mes_text .st-galgame-card.is-side-right .st-galgame-card__name-row{justify-content:flex-end}.mes_text .st-galgame-card__name,.mes_text .st-galgame-card.is-user .st-galgame-card__name{display:inline-flex;align-items:baseline;gap:8px;min-width:0;overflow:hidden;color:#f7f5f0;text-shadow:0 1px 2px #000;font:900 20px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;letter-spacing:.025em;text-overflow:ellipsis;white-space:nowrap}.mes_text .st-galgame-card__name-original{color:#cbc6bd;text-decoration-color:var(--gg-role);opacity:.72}.mes_text .st-galgame-card__name-nickname,.mes_text .st-galgame-card__name-nickname.is-private,.mes_text .st-galgame-card__name-nickname.is-recognized{color:#f7f5f0}
.mes_text .st-galgame-card__expression{max-width:150px;overflow:hidden;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(16,16,18,.78);padding:5px 9px;color:#e4e0d8;box-shadow:none;font:800 13px/1.15 ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.mes_text .st-galgame-card__toggle{display:grid;place-items:center;width:28px;height:28px;border:1px solid #3c3c3f;border-radius:50%;background:#171719;color:#f3efe7;box-shadow:none}.mes_text .st-galgame-card[open] .st-galgame-card__toggle{transform:rotate(180deg)}
.mes_text .st-galgame-card__body,.mes_text .st-galgame-card.is-user .st-galgame-card__body{position:relative;display:grid;gap:8px;margin-top:3px;padding:16px 20px 18px 24px;border:2px solid var(--gg-ink);border-top-color:var(--gg-ink);border-radius:7px 19px 19px 19px;background:var(--gg-paper);color:var(--gg-ink);box-shadow:4px 4px 0 var(--gg-ink),inset 6px 0 0 var(--gg-role);text-align:left}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:16px 24px 18px 20px;border-radius:19px 7px 19px 19px;box-shadow:4px 4px 0 var(--gg-ink),inset -6px 0 0 var(--gg-role);text-align:left}.mes_text .st-galgame-card__body::before{content:"";position:absolute;left:25px;top:-8px;width:13px;height:13px;border-left:2px solid var(--gg-ink);border-top:2px solid var(--gg-ink);background:var(--gg-paper);transform:rotate(45deg)}.mes_text .st-galgame-card.is-side-right .st-galgame-card__body::before{right:25px;left:auto}
.mes_text .st-galgame-card__segment{display:block;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}.mes_text .st-galgame-card__segment--speech,.mes_text .st-galgame-card.is-user .st-galgame-card__segment--speech{padding:2px 0;color:#121212;font-size:16px;font-weight:720;line-height:1.72}.mes_text .st-galgame-card__segment--speech::before,.mes_text .st-galgame-card__segment--speech::after{color:var(--gg-role)}.mes_text .st-galgame-card__segment--thought{padding:2px 0;color:#4b4844;font-family:ui-serif,Georgia,"Noto Serif SC",serif;font-size:15px;font-style:italic;line-height:1.7}.mes_text .st-galgame-card__segment--action{padding:2px 0;color:#5a5650;font-family:ui-serif,Georgia,"Noto Serif SC",serif;font-size:14px;font-style:italic;line-height:1.62}.mes_text .st-galgame-card__segment--action::before{color:var(--gg-role)}
.mes_text .st-galgame-card__index{position:absolute;z-index:3;right:16px;bottom:-7px;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:38px;height:21px;padding:0 7px;border:1px solid #f6f3ed;border-radius:999px;background:#171719;color:#fff;box-shadow:0 2px 5px rgba(0,0,0,.3);font:900 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;transform:none}.mes_text .st-galgame-card__index::before{content:"ACT";font-size:9px;opacity:.72}.mes_text .st-galgame-card.is-side-right .st-galgame-card__index{right:auto;left:16px;transform:none}
@media(max-width:520px){.mes_text .st-galgame-card{margin:16px 0 14px}.mes_text .st-galgame-card>summary{grid-template-columns:54px minmax(0,1fr) auto;gap:10px;min-height:64px;padding:5px 7px}.mes_text .st-galgame-card.is-side-right>summary{grid-template-columns:auto minmax(0,1fr) 54px}.mes_text .st-galgame-card__portrait{width:50px;height:50px;border-radius:14px}.mes_text .st-galgame-card__name{font-size:18px}.mes_text .st-galgame-card__expression{max-width:104px;font-size:12px}.mes_text .st-galgame-card__body,.mes_text .st-galgame-card.is-side-right .st-galgame-card__body{padding:15px 17px 17px 21px}.mes_text .st-galgame-card__segment--speech{font-size:16px}.mes_text .st-galgame-card__segment--thought{font-size:15px}.mes_text .st-galgame-card__segment--action{font-size:14px}}
`
      ].join("");
    }

    function galgameUserName() {
      try {
        var data = context();
        return textId(data && (data.name1 || data.userName)) || "user";
      } catch (_) { return "user"; }
    }

    function isGalgameUserRole(roleName) {
      var role = textId(roleName);
      if (role.toLowerCase() === "user" || role.toLowerCase() === "{{user}}") return true;
      var current = galgameUserName();
      return current !== "user" && role === current;
    }

    function parseGalgameSegments(content) {
      var source = String(content || "").trim();
      var segments = [];
      GALGAME_SEGMENT_RE.lastIndex = 0;
      var match;
      while ((match = GALGAME_SEGMENT_RE.exec(source))) {
        var value = String(match[2] || "").trim();
        if (value) segments.push({ kind: String(match[1] || "台词"), text: value });
      }
      if (!segments.length && source) segments.push({ kind: "动作", text: source });
      return segments;
    }

    function parseGalgameEntries(content) {
      var source = String(content || "")
        .replace(/\r\n?/g, "\n")
        .trim();
      if (!source) return [];
      var entries = [];
      var roleIndexes = new Map();
      var lines = source.split("\n");
      var current = null;
      lines.forEach(function (line) {
        var value = String(line || "").trim();
        if (!value) return;
        var legacy = value.match(/^【角色】\s*([^【】]+?)\s*【表情】\s*([^【】]*?)\s*【交互】([\s\S]+)$/);
        var direct = legacy ? null : value.match(/^【([^【】]+?)】\s*(.*?)\s*【交互】([\s\S]+)$/);
        var match = legacy || direct;
        if (!match) {
          if (current && !/^【[^【】]+】/.test(value)) current[2] += "\n" + value;
          return;
        }
        var role = textId(match[1]);
        var expression = textId(match[2]);
        var interaction = String(match[3] || "").trim();
        if (!role || !interaction) return;
        if (roleIndexes.has(role)) {
          var previous = entries[roleIndexes.get(role)];
          previous[2] += "\n" + interaction;
          if (!previous[1] && expression) previous[1] = expression;
          current = previous;
          return;
        }
        current = [role, expression, interaction];
        roleIndexes.set(role, entries.length);
        entries.push(current);
      });
      if (!entries.length) {
        var pattern = /【([^【】\r\n]+?)】\s*(.*?)\s*【交互】([\s\S]*?)(?=【[^【】\r\n]+?】[\s\S]*?【交互】|$)/g;
        var match;
        while ((match = pattern.exec(source))) {
          var role = textId(match[1]);
          var interaction = String(match[3] || "").trim();
          if (role && interaction) entries.push([role, textId(match[2]), interaction]);
        }
      }
      return entries.length ? entries : [["演出记录", "", source]];
    }

    function galgameMessageIdForContainer(container) {
      var messageNode = container && container.closest
        ? container.closest(".mes[mesid],.mes[data-message-id],.mes[data-mes-id]")
        : null;
      if (!messageNode) return "";
      return textId(
        messageNode.getAttribute("mesid")
        || messageNode.getAttribute("data-message-id")
        || messageNode.getAttribute("data-mes-id")
      );
    }

    function galgameRawMessageForContainer(container) {
      var targetId = galgameMessageIdForContainer(container);
      if (!targetId) return "";
      var messages = chatMessages();
      for (var index = 0; index < messages.length; index += 1) {
        var message = messages[index];
        if (messageId(message, index) !== targetId) continue;
        return String(
          message && (message.mes ?? message.message ?? message.content ?? message.text)
          || ""
        );
      }
      var numericIndex = Number(targetId);
      if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < messages.length) {
        var indexed = messages[numericIndex];
        return String(
          indexed && (indexed.mes ?? indexed.message ?? indexed.content ?? indexed.text)
          || ""
        );
      }
      return "";
    }

    function galgamePayloadForContainer(container, markerPayload) {
      var raw = galgameRawMessageForContainer(container);
      var rawMatch = raw.match(GALGAME_RAW_BLOCK_RE);
      return rawMatch ? String(rawMatch[1] || "") : String(markerPayload || "");
    }

    function hydrateGalgameCard(card) {
      if (!card || card.dataset.galgameUser === "true" || !galgameHydrator) return;
      try {
        galgameHydrator.hydrateCard(card, textId(card.dataset.galgameRole));
      } catch (_) {}
    }

    function galgameRoleTone(roleName) {
      var source = textId(roleName) || "user";
      var hash = 2166136261;
      for (var index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0) % 6;
    }

    function createGalgameCard(fields) {
      var protocolRole = textId(fields && fields[0]);
      var isUser = isGalgameUserRole(protocolRole);
      var roleName = isUser ? galgameUserName() : protocolRole;
      var expression = textId(fields && fields[1]);
      var card = hostDocument.createElement("details");
      card.className = "st-galgame-card";
      if (isUser) card.classList.add("is-user");
      card.open = true;
      card.dataset.galgameRole = isUser ? "user" : roleName;
      card.dataset.galgameUser = isUser ? "true" : "false";
      var summary = hostDocument.createElement("summary");
      var portrait = hostDocument.createElement(isUser ? "span" : "button");
      portrait.className = "st-galgame-card__portrait";
      if (!isUser) {
        portrait.type = "button";
        portrait.title = "打开" + roleName + "的人物档案";
        portrait.setAttribute("aria-label", portrait.title);
      }
      var image = hostDocument.createElement("img");
      image.alt = roleName;
      image.loading = "eager";
      image.decoding = "async";
      var fallback = hostDocument.createElement("span");
      fallback.className = "st-galgame-card__portrait-fallback";
      fallback.textContent = isUser ? "YOU" : roleName.slice(0, 1) || "人";
      portrait.append(image, fallback);
      var identity = hostDocument.createElement("span");
      identity.className = "st-galgame-card__identity";
      var nameRow = hostDocument.createElement("span");
      nameRow.className = "st-galgame-card__name-row";
      var name = hostDocument.createElement("strong");
      name.className = "st-galgame-card__name";
      name.textContent = roleName;
      nameRow.appendChild(name);
      if (expression) {
        var badge = hostDocument.createElement("span");
        badge.className = "st-galgame-card__expression";
        badge.textContent = expression;
        nameRow.appendChild(badge);
      }
      identity.appendChild(nameRow);
      var toggle = hostDocument.createElement("span");
      toggle.className = "st-galgame-card__toggle";
      toggle.textContent = "⌃";
      var sequence = hostDocument.createElement("span");
      sequence.className = "st-galgame-card__index";
      sequence.setAttribute("aria-hidden", "true");
      sequence.textContent = "01";
      summary.append(portrait, identity, sequence, toggle);
      var body = hostDocument.createElement("span");
      body.className = "st-galgame-card__body";
      parseGalgameSegments(fields && fields[2]).forEach(function (segment) {
        var line = hostDocument.createElement("span");
        var type = segment.kind === "动作" ? "action" : segment.kind === "思考" ? "thought" : "speech";
        line.className = "st-galgame-card__segment st-galgame-card__segment--" + type;
        line.textContent = segment.text;
        body.appendChild(line);
      });
      card.append(summary, body);
      hydrateGalgameCard(card);
      return card;
    }

    function decorateGalgameCards(container) {
      var cards = Array.prototype.slice.call(container.querySelectorAll(".st-galgame-card"));
      var tonesByRole = new Map();
      var usedTones = new Set();
      cards.forEach(function (card, index) {
        card.classList.remove("is-side-left", "is-side-right", "is-joined-prev", "is-joined-next");
        card.classList.add(index % 2 === 0 ? "is-side-left" : "is-side-right");
        card.dataset.galgameSequence = String(index + 1);
        var roleKey = textId(card.dataset.galgameRole) || "user";
        if (!tonesByRole.has(roleKey)) {
          var tone = card.dataset.galgameUser === "true" ? 6 : galgameRoleTone(roleKey);
          while (usedTones.has(tone) && usedTones.size < 6) tone = (tone + 1) % 6;
          tonesByRole.set(roleKey, tone);
          usedTones.add(tone);
        }
        card.dataset.galgameTone = String(tonesByRole.get(roleKey));
        var sequenceNode = card.querySelector(".st-galgame-card__index");
        if (sequenceNode) sequenceNode.textContent = String(index + 1).padStart(2, "0");
        card.style.setProperty("--gg-hue", String((206 + index * 137.508) % 360));
      });
      for (var index = 1; index < cards.length; index += 1) {
        if (cards[index].dataset.galgameJoinPrev !== "true") continue;
        cards[index - 1].classList.add("is-joined-next");
        cards[index].classList.add("is-joined-prev");
      }
    }

    function renderGalgameMarkers() {
      if (!hostDocument.body) return;
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".mes_text"), function (container) {
        var rendered = false;
        for (var historyPass = 0; historyPass < 8 && String(container.textContent || "").includes("⟪人物演出历史块⟫"); historyPass += 1) {
          var historyWalker = hostDocument.createTreeWalker(container, host.NodeFilter ? host.NodeFilter.SHOW_TEXT : 4);
          var historyNodes = [];
          var historySource = "";
          while (historyWalker.nextNode()) {
            var historyNode = historyWalker.currentNode;
            if (historyNode.parentElement && historyNode.parentElement.closest(".st-galgame-card,script,style")) continue;
            var historyValue = String(historyNode.nodeValue || "");
            if (!historyValue) continue;
            historyNodes.push({ node: historyNode, start: historySource.length, end: historySource.length + historyValue.length });
            historySource += historyValue;
          }
          var historyMatch = historySource.match(GALGAME_HISTORY_MARKER_RE);
          if (!historyMatch || historyMatch.index == null) break;
          var historyStartIndex = historyMatch.index;
          var historyEndIndex = historyStartIndex + historyMatch[0].length;
          var historyStart = historyNodes.find(function (item) { return historyStartIndex >= item.start && historyStartIndex <= item.end; });
          var historyEnd = historyNodes.slice().reverse().find(function (item) { return historyEndIndex >= item.start && historyEndIndex <= item.end; });
          if (!historyStart || !historyEnd) break;
          var historyRange = hostDocument.createRange();
          historyRange.setStart(historyStart.node, Math.max(0, historyStartIndex - historyStart.start));
          historyRange.setEnd(historyEnd.node, Math.max(0, historyEndIndex - historyEnd.start));
          historyRange.deleteContents();
          historyRange.insertNode(hostDocument.createTextNode(galgamePayloadForContainer(container, historyMatch[1])));
        }
        for (var pass = 0; pass < 8 && String(container.textContent || "").includes("⟪人物演出总块⟫"); pass += 1) {
          var walker = hostDocument.createTreeWalker(container, host.NodeFilter ? host.NodeFilter.SHOW_TEXT : 4);
          var textNodes = [];
          var source = "";
          while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.parentElement && node.parentElement.closest(".st-galgame-card,script,style")) continue;
            var value = String(node.nodeValue || "");
            if (!value) continue;
            textNodes.push({ node: node, start: source.length, end: source.length + value.length });
            source += value;
          }
          var match = source.match(GALGAME_MARKER_RE);
          if (!match || match.index == null) break;
          var entries = parseGalgameEntries(galgamePayloadForContainer(container, match[1]));
          if (!entries || !entries.length) break;
          var startIndex = match.index;
          var endIndex = startIndex + match[0].length;
          var start = textNodes.find(function (item) { return startIndex >= item.start && startIndex <= item.end; });
          var end = textNodes.slice().reverse().find(function (item) { return endIndex >= item.start && endIndex <= item.end; });
          if (!start || !end) break;
          var range = hostDocument.createRange();
          range.setStart(start.node, Math.max(0, startIndex - start.start));
          range.setEnd(end.node, Math.max(0, endIndex - end.start));
          var fragment = hostDocument.createDocumentFragment();
          entries.forEach(function (entry, index) {
            var card = createGalgameCard(entry);
            if (index > 0) card.dataset.galgameJoinPrev = "true";
            fragment.appendChild(card);
          });
          range.deleteContents();
          range.insertNode(fragment);
          rendered = true;
        }
        if (rendered || container.querySelector(".st-galgame-card")) decorateGalgameCards(container);
      });
    }

    function scheduleGalgameRender() {
      if (galgameRenderFrame || !hostDocument.body) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(callback, 0); };
      galgameRenderFrame = requestFrame.call(host, function () {
        galgameRenderFrame = 0;
        renderGalgameMarkers();
      });
    }

    function ensureGalgameRenderer() {
      ensureGalgameStyle();
      var previous = hostDocument[GALGAME_RUNTIME_KEY];
      if (previous && previous.registry !== null && previous.registry !== undefined && previous.registry !== registryApi) {
        try { previous.observer && previous.observer.disconnect(); } catch (_) {}
      }
      if (!galgameObserver) {
        var MutationObserverCtor = host.MutationObserver;
        if (MutationObserverCtor) {
          galgameObserver = new MutationObserverCtor(function (records) {
            for (var index = 0; index < records.length; index += 1) {
              var record = records[index];
              var target = record.type === "characterData" ? record.target.parentElement : record.target;
              var message = target && target.closest ? target.closest(".mes_text") : null;
              if (message && /⟪人物演出(?:总|历史)块⟫/.test(String(message.textContent || ""))) {
                scheduleGalgameRender();
                return;
              }
              var added = Array.prototype.slice.call(record.addedNodes || []);
              if (added.some(function (node) {
                return /⟪人物演出(?:总|历史)块⟫/.test(String(node && node.textContent || ""));
              })) {
                scheduleGalgameRender();
                return;
              }
            }
          });
          galgameObserver.observe(hostDocument.body, { childList: true, characterData: true, subtree: true });
        }
      }
      hostDocument[GALGAME_RUNTIME_KEY] = { version: 1, observer: galgameObserver, registry: registryApi };
      scheduleGalgameRender();
    }

    function actionFoldText(value) {
      return String(value || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]*>/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
        .trim();
    }

    function actionFoldPlain(targetDocument, value) {
      var block = targetDocument.createElement("div");
      block.style.cssText = "margin:7px 0;color:#dbeafe;white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere";
      block.textContent = actionFoldText(value);
      return block;
    }

    function actionFoldNotice(targetDocument, value) {
      var notice = targetDocument.createElement("aside");
      notice.setAttribute("data-hypnoos-action-notice", "v3");
      notice.style.cssText = "display:flex;align-items:flex-start;gap:9px;margin:10px 0;padding:9px 11px;border:1px solid rgba(250,204,21,.42);border-left:4px solid #fbbf24;border-radius:10px;background:linear-gradient(100deg,rgba(120,53,15,.38),rgba(67,20,7,.22));color:#fef3c7";
      var label = targetDocument.createElement("strong");
      label.style.cssText = "flex:0 0 auto;color:#fde68a;font:800 11px/1.4 ui-monospace,monospace";
      label.textContent = "✦ AI 提醒";
      var body = targetDocument.createElement("span");
      body.style.cssText = "min-width:0;white-space:pre-wrap;line-height:1.55";
      body.textContent = actionFoldText(value);
      notice.append(label, body);
      return notice;
    }

    function actionFoldPermission(targetDocument, value) {
      var card = targetDocument.createElement("aside");
      card.setAttribute("data-hypnoos-action-permission", "v3");
      card.style.cssText = "margin:9px 0;padding:9px 11px;border:1px solid rgba(96,165,250,.32);border-left:4px solid #60a5fa;border-radius:10px;background:rgba(30,64,175,.14);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      card.textContent = "变量权限\n" + actionFoldText(value);
      return card;
    }

    function actionFoldNested(targetDocument, kind, titleText, bodyText) {
      var details = targetDocument.createElement("details");
      details.setAttribute(kind === "item" ? "data-hypnoos-action-item" : "data-hypnoos-action-section", "v3");
      details.style.cssText = kind === "item"
        ? "display:block;margin:7px 0;border:1px solid rgba(165,180,252,.28);border-radius:9px;overflow:hidden;background:rgba(15,23,42,.32);color:#e2e8f0"
        : "display:block;margin:9px 0;border:1px solid rgba(129,140,248,.34);border-radius:12px;overflow:hidden;background:linear-gradient(120deg,rgba(49,46,129,.30),rgba(15,23,42,.28));color:#e2e8f0";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;list-style:none;font-weight:800;line-height:1.4";
      summary.textContent = (kind === "item" ? "◆ " : "◈ ") + (actionFoldText(titleText) || (kind === "item" ? "操作项" : "来源"));
      var body = targetDocument.createElement("div");
      body.style.cssText = "padding:9px 11px 11px;border-top:1px solid rgba(165,180,252,.22);color:#dbeafe;white-space:pre-wrap;line-height:1.62";
      if (kind === "section") appendActionFoldContent(targetDocument, body, bodyText);
      else body.textContent = actionFoldText(bodyText);
      details.append(summary, body);
      return details;
    }

    function nextActionFoldUnit(source, fromIndex) {
      var definitions = [
        { kind: "permission", regex: /<\s*变量权限\s*>\s*([\s\S]*?)\s*<\s*\/\s*变量权限\s*>/gi },
        { kind: "notice", regex: /<\s*AI提醒\s*>\s*([\s\S]*?)\s*<\s*\/\s*AI提醒\s*>/gi },
        { kind: "item", regex: /<\s*操作项\s*>\s*<\s*操作名\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作名\s*>\s*<\s*操作内容\s*>\s*([\s\S]*?)\s*<\s*\/\s*操作内容\s*>\s*<\s*\/\s*操作项\s*>/gi },
        { kind: "section", regex: /<\s*(相关变量|时钟|地图|学校|学校地图|催眠APP|催眠命令|催眠资源|催眠道具|成就和任务|成就|任务|规则|地点规则|邂逅|人物档案|库存|物品|子嗣|警视厅|综合医院|医院|旧校舍|灵异|性格特调|改造|附身|课程表|日历|系统|设置|场景|事件|地点|APP)\s*>\s*([\s\S]*?)\s*<\s*\/\s*\1\s*>/gi }
      ];
      var selected = null;
      definitions.forEach(function (definition) {
        definition.regex.lastIndex = fromIndex;
        var match = definition.regex.exec(source);
        if (!match || (selected && match.index >= selected.start)) return;
        selected = {
          kind: definition.kind,
          start: match.index,
          end: match.index + match[0].length,
          title: definition.kind === "section" || definition.kind === "item" ? match[1] : "",
          body: definition.kind === "section" || definition.kind === "item" ? match[2] : match[1]
        };
      });
      return selected;
    }

    function appendActionFoldContent(targetDocument, parent, value) {
      var source = String(value || "");
      var cursor = 0;
      var unit;
      while ((unit = nextActionFoldUnit(source, cursor))) {
        if (unit.start > cursor) {
          var plain = actionFoldPlain(targetDocument, source.slice(cursor, unit.start));
          if (plain.textContent) parent.appendChild(plain);
        }
        if (unit.kind === "notice") parent.appendChild(actionFoldNotice(targetDocument, unit.body));
        else if (unit.kind === "permission") parent.appendChild(actionFoldPermission(targetDocument, unit.body));
        else parent.appendChild(actionFoldNested(targetDocument, unit.kind, unit.title, unit.body));
        cursor = unit.end;
      }
      if (cursor < source.length) {
        var tail = actionFoldPlain(targetDocument, source.slice(cursor));
        if (tail.textContent) parent.appendChild(tail);
      }
    }

    function createActionFoldCard(targetDocument, value) {
      var details = targetDocument.createElement("details");
      details.setAttribute("data-hypnoos-action-fold", "v3");
      details.style.cssText = "display:block;margin:12px 0;border:1px solid rgba(129,140,248,.48);border-left:3px solid #818cf8;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,rgba(30,27,75,.88),rgba(15,23,42,.92));box-shadow:0 9px 22px rgba(0,0,0,.2);color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif";
      var summary = targetDocument.createElement("summary");
      summary.style.cssText = "cursor:pointer;display:flex;align-items:center;gap:10px;padding:11px 14px;color:#eef2ff;letter-spacing:.04em;list-style:none";
      var label = targetDocument.createElement("span");
      label.style.cssText = "font-size:11px;font-weight:800;color:#a5b4fc;letter-spacing:.16em";
      label.textContent = "前端操作";
      var title = targetDocument.createElement("strong");
      title.style.cssText = "font-size:14px;font-weight:650";
      title.textContent = "本轮操作";
      var hint = targetDocument.createElement("span");
      hint.style.cssText = "margin-left:auto;color:rgba(199,210,254,.78);font-size:12px";
      hint.textContent = "点击展开";
      summary.append(label, title, hint);
      var body = targetDocument.createElement("div");
      body.setAttribute("data-hypnoos-action-body", "v3");
      body.style.cssText = "padding:13px 17px 15px;border-top:1px solid rgba(129,140,248,.28);line-height:1.82;color:#dbeafe;overflow-wrap:anywhere";
      appendActionFoldContent(targetDocument, body, value);
      if (!body.childNodes.length) body.textContent = "本轮没有可展开的前端操作。";
      details.append(summary, body);
      return details;
    }

    function renderActionFoldRoot(targetDocument, root) {
      if (!root || !String(root.textContent || "").includes(ACTION_FOLD_OPEN)) return false;
      var walker = targetDocument.createTreeWalker(root, targetDocument.defaultView && targetDocument.defaultView.NodeFilter ? targetDocument.defaultView.NodeFilter.SHOW_TEXT : 4);
      var nodes = [];
      var source = "";
      while (walker.nextNode()) {
        var node = walker.currentNode;
        if (node.parentElement && node.parentElement.closest("[data-hypnoos-action-fold],script,style,textarea,template")) continue;
        var text = String(node.nodeValue || "");
        if (!text) continue;
        nodes.push({ node: node, start: source.length, end: source.length + text.length });
        source += text;
      }
      var rendered = false;
      for (var pass = 0; pass < 8; pass += 1) {
        var match = source.match(ACTION_FOLD_MARKER_RE);
        if (!match || match.index == null) break;
        var startIndex = match.index;
        var endIndex = startIndex + match[0].length;
        var start = nodes.find(function (item) { return startIndex >= item.start && startIndex <= item.end; });
        var end = nodes.slice().reverse().find(function (item) { return endIndex >= item.start && endIndex <= item.end; });
        if (!start || !end) break;
        var range = targetDocument.createRange();
        range.setStart(start.node, Math.max(0, startIndex - start.start));
        range.setEnd(end.node, Math.max(0, endIndex - end.start));
        range.deleteContents();
        range.insertNode(createActionFoldCard(targetDocument, match[1]));
        rendered = true;
        return renderActionFoldRoot(targetDocument, root) || rendered;
      }
      return rendered;
    }

    function actionFoldDocuments() {
      var documents = [hostDocument];
      Array.prototype.forEach.call(hostDocument.querySelectorAll("iframe"), function (iframe) {
        if (!actionFoldObservedFrames.has(iframe)) {
          actionFoldObservedFrames.add(iframe);
          try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
        }
        try {
          if (iframe.contentDocument && iframe.contentDocument.body && documents.indexOf(iframe.contentDocument) < 0) {
            documents.push(iframe.contentDocument);
          }
        } catch (_) {}
      });
      return documents;
    }

    function renderActionFoldMarkers() {
      actionFoldDocuments().forEach(function (targetDocument) {
        var roots = Array.prototype.slice.call(targetDocument.querySelectorAll(".mes_text,#userInputContent"));
        if (!roots.length && targetDocument.body) roots.push(targetDocument.body);
        roots.forEach(function (root) { renderActionFoldRoot(targetDocument, root); });
      });
    }

    function scheduleActionFoldRender() {
      if (actionFoldRenderFrame || !hostDocument.body) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(callback, 0); };
      actionFoldRenderFrame = requestFrame.call(host, function () {
        actionFoldRenderFrame = 0;
        renderActionFoldMarkers();
      });
    }

    function ensureActionFoldRenderer() {
      if (!actionFoldObserver && host.MutationObserver) {
        actionFoldObserver = new host.MutationObserver(function (records) {
          var shouldRender = records.some(function (record) {
            var targetText = record.type === "characterData" ? record.target.nodeValue : record.target && record.target.textContent;
            if (String(targetText || "").includes(ACTION_FOLD_OPEN)) return true;
            return Array.prototype.some.call(record.addedNodes || [], function (node) {
              if (String(node && node.tagName || "").toLowerCase() === "iframe" && !actionFoldObservedFrames.has(node)) {
                actionFoldObservedFrames.add(node);
                try { node.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
              }
              try {
                Array.prototype.forEach.call(node && node.querySelectorAll ? node.querySelectorAll("iframe") : [], function (iframe) {
                  if (actionFoldObservedFrames.has(iframe)) return;
                  actionFoldObservedFrames.add(iframe);
                  try { iframe.addEventListener("load", scheduleActionFoldRender); } catch (_) {}
                });
              } catch (_) {}
              return String(node && node.textContent || "").includes(ACTION_FOLD_OPEN);
            });
          });
          if (shouldRender) scheduleActionFoldRender();
        });
        actionFoldObserver.observe(hostDocument.body, { childList: true, characterData: true, subtree: true });
      }
      scheduleActionFoldRender();
    }

    function registerGalgameHydrator(provider, providerToken) {
      if (!provider || typeof provider.hydrateCard !== "function") return false;
      galgameHydrator = provider;
      galgameHydratorToken = textId(providerToken) || String(Date.now());
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".st-galgame-card[data-galgame-role]"), hydrateGalgameCard);
      return true;
    }

    function refreshGalgameRole(roleName) {
      var name = textId(roleName);
      Array.prototype.forEach.call(hostDocument.querySelectorAll(".st-galgame-card[data-galgame-role]"), function (card) {
        if (!name || textId(card.dataset.galgameRole) === name) hydrateGalgameCard(card);
      });
    }

    var registryApi = null;
    var chatTopologyKey = "";

    function ownerAlive(owner) {
      try {
        if (!owner || !owner.view || !owner.view.document || owner.view.closed) return false;
        var frameElement = owner.view.frameElement;
        return !frameElement || frameElement.isConnected;
      } catch (_) { return false; }
    }

    function pruneOwners() {
      ownerOrder = ownerOrder.filter(function (id) {
        var owner = owners.get(id);
        if (ownerAlive(owner)) return true;
        owners.delete(id);
        return false;
      });
    }

    function latestOwner() {
      pruneOwners();
	  var alive = ownerOrder.map(function (id) { return owners.get(id); }).filter(ownerAlive);
	  var numeric = alive.filter(function (owner) { return Number.isFinite(Number(owner.messageId)); });
	  if (numeric.length === alive.length && numeric.length) {
	    numeric.sort(function (a, b) { return Number(a.messageId) - Number(b.messageId); });
	    return numeric[numeric.length - 1];
	  }
      for (var i = ownerOrder.length - 1; i >= 0; i -= 1) {
        var owner = owners.get(ownerOrder[i]);
        if (ownerAlive(owner)) return owner;
      }
      return null;
    }

    function writableId() {
      var records = visibleAssistantRecords();
      if (records.length && records[records.length - 1].id) return records[records.length - 1].id;
      return textId(latestOwner() && latestOwner().messageId);
    }

    function sourceWindows() {
      var list = [];
      var owner = latestOwner();
      [owner && owner.view, host, host.parent, host.top].forEach(function (view) {
        try { if (view && list.indexOf(view) < 0) list.push(view); } catch (_) {}
      });
      return list;
    }

    function findFunction(name) {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          if (typeof views[i][name] === "function") return { view: views[i], fn: views[i][name] };
          if (views[i].TavernHelper && typeof views[i].TavernHelper[name] === "function") {
            return { view: views[i].TavernHelper, fn: views[i].TavernHelper[name] };
          }
        } catch (_) {}
      }
      return null;
    }

    function findMvu() {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try { if (views[i].Mvu) return views[i].Mvu; } catch (_) {}
      }
      return null;
    }

    function normalizeMessageOption(option) {
      if (option && typeof option === "object") {
        if (option.type && option.type !== "message") return option;
        var explicit = textId(option.message_id !== undefined ? option.message_id : option.mesid);
        if (explicit) return { type: "message", message_id: explicit };
      }
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function normalizeWriteMessageOption(option) {
      if (option && typeof option === "object") {
        if (option.type && option.type !== "message") return option;
        var explicit = textId(option.message_id !== undefined ? option.message_id : option.mesid);
        if (explicit) return { type: "message", message_id: explicit };
      }
      var id = selectedId || writableId();
      return id ? { type: "message", message_id: id } : option;
    }

    function callApi(name, args) {
      var found = findFunction(name);
      if (!found) return undefined;
      return found.fn.apply(found.view, Array.isArray(args) ? args : []);
    }

    function hasApi(name) {
      return Boolean(findFunction(name));
    }

    function callMvu(name, args) {
      var mvu = findMvu();
      if (!mvu || typeof mvu[name] !== "function") return undefined;
      return mvu[name].apply(mvu, Array.isArray(args) ? args : []);
    }

    function hasMvu(name) {
      var mvu = findMvu();
      return Boolean(mvu && typeof mvu[name] === "function");
    }

    async function importHostWorldInfoModule() {
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          if (typeof views[i].eval !== "function") continue;
          var mod = await Promise.resolve(views[i].eval("import('/scripts/world-info.js')"));
          if (mod && typeof mod.loadWorldInfo === "function" && typeof mod.saveWorldInfo === "function") return mod;
        } catch (_) {}
      }
      return null;
    }

    async function hostRequestHeaders() {
      var ctx = context();
      if (ctx && typeof ctx.getRequestHeaders === "function") {
        return ctx.getRequestHeaders();
      }
      var views = sourceWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          var api = views[i].SillyTavern
            || (views[i].TavernHelper && views[i].TavernHelper.SillyTavern);
          if (!api) continue;
          var apiContext = typeof api.getContext === "function" ? api.getContext() : api;
          if (apiContext && typeof apiContext.getRequestHeaders === "function") {
            return apiContext.getRequestHeaders();
          }
        } catch (_) {}
      }
      throw new Error("无法从 SillyTavern.getContext() 取得同源请求头。");
    }

    function rawWorldbookEntries(data) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== "object") return [];
      var container = data.entries || data.entry || data.world_info;
      if (Array.isArray(container)) return container;
      if (container && typeof container === "object") return Object.values(container);
      return [];
    }

    function rawOpeningEntry(entry, uid, displayIndex) {
      var strategy = entry && entry.strategy && typeof entry.strategy === "object" ? entry.strategy : {};
      var secondary = strategy.keys_secondary && typeof strategy.keys_secondary === "object" ? strategy.keys_secondary : {};
      var position = entry && entry.position && typeof entry.position === "object" ? entry.position : {};
      var recursion = entry && entry.recursion && typeof entry.recursion === "object" ? entry.recursion : {};
      var effect = entry && entry.effect && typeof entry.effect === "object" ? entry.effect : {};
      var positionCode = {
        before_character_definition: 0,
        after_character_definition: 1,
        before_author_note: 2,
        after_author_note: 3,
        at_depth: 4,
        before_example_messages: 5,
        after_example_messages: 6,
        outlet: 7
      };
      var roleCode = { system: 0, user: 1, assistant: 2 };
      var secondaryLogic = { and_any: 0, not_all: 1, not_any: 2, and_all: 3 };
      var strategyType = textId(strategy.type) || "constant";
      return {
        uid: uid,
        displayIndex: displayIndex,
        comment: textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment)),
        disable: entry && entry.enabled === false,
        constant: strategyType === "constant",
        selective: strategyType === "selective",
        key: Array.isArray(strategy.keys) ? strategy.keys.slice() : [],
        keysecondary: Array.isArray(secondary.keys) ? secondary.keys.slice() : [],
        selectiveLogic: secondaryLogic[textId(secondary.logic)] !== undefined ? secondaryLogic[textId(secondary.logic)] : 0,
        scanDepth: strategy.scan_depth === "same_as_global" ? null : (Number.isFinite(Number(strategy.scan_depth)) ? Number(strategy.scan_depth) : null),
        vectorized: strategyType === "vectorized",
        position: positionCode[textId(position.type)] !== undefined ? positionCode[textId(position.type)] : 0,
        role: roleCode[textId(position.role)] !== undefined ? roleCode[textId(position.role)] : 0,
        depth: Number.isFinite(Number(position.depth)) ? Number(position.depth) : 4,
        order: Number.isFinite(Number(position.order)) ? Number(position.order) : 100,
        content: String(entry && entry.content || ""),
        useProbability: true,
        probability: Number.isFinite(Number(entry && entry.probability)) ? Number(entry.probability) : 100,
        excludeRecursion: Boolean(recursion.prevent_incoming),
        preventRecursion: Boolean(recursion.prevent_outgoing),
        delayUntilRecursion: recursion.delay_until === null || recursion.delay_until === undefined ? false : recursion.delay_until,
        sticky: effect.sticky === undefined ? null : effect.sticky,
        cooldown: effect.cooldown === undefined ? null : effect.cooldown,
        delay: effect.delay === undefined ? null : effect.delay,
        extra: entry && entry.extra && typeof entry.extra === "object" ? Object.assign({}, entry.extra) : {}
      };
    }

    async function ensureOpeningWorldbooksRaw(mod, worldName, requested) {
      var data = await Promise.resolve(mod.loadWorldInfo(worldName));
      if (!data || typeof data !== "object") return null;
      var currentEntries = rawWorldbookEntries(data);
      var repairedKeyArrays = 0;
      currentEntries.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        if (!Array.isArray(item.key)) {
          item.key = Array.isArray(item.keys) ? item.keys.slice() : [];
          repairedKeyArrays += 1;
        }
        if (!Array.isArray(item.keysecondary)) {
          item.keysecondary = Array.isArray(item.secondary_keys) ? item.secondary_keys.slice() : [];
          repairedKeyArrays += 1;
        }
      });
      var pending = [];
      var existing = 0;
      for (var i = 0; i < requested.length; i += 1) {
        var entry = requested[i];
        var comment = textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment));
        var found = currentEntries.find(function (item) {
          return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment;
        });
        if (!found) {
          pending.push(entry);
          continue;
        }
        if (String(found.content || "") !== String(entry.content || "")) {
          return { ok: false, reason: "角色卡世界书已有同名但内容不同的条目：" + comment };
        }
        existing += 1;
      }
      if (!pending.length && !repairedKeyArrays) {
        return { ok: true, inserted: 0, existing: existing, targetWorldbook: worldName, method: "host-native-raw" };
      }
      var maxUid = currentEntries.reduce(function (max, item) {
        return Math.max(max, Number(item && item.uid) || 0);
      }, 0);
      var maxDisplayIndex = currentEntries.reduce(function (max, item) {
        return Math.max(max, Number(item && item.displayIndex) || 0);
      }, -1);
      var container = data.entries || data.entry || data.world_info;
      if (!container || typeof container !== "object") {
        data.entries = {};
        container = data.entries;
      }
      for (var p = 0; p < pending.length; p += 1) {
        maxUid += 1;
        maxDisplayIndex += 1;
        var raw = rawOpeningEntry(pending[p], maxUid, maxDisplayIndex);
        if (Array.isArray(container)) container.push(raw);
        else container[maxUid] = raw;
      }
      var saveError = null;
      try {
        await Promise.resolve(mod.saveWorldInfo(worldName, data, true));
      } catch (error) {
        saveError = error;
      }
      if (saveError) {
        var reloaded = await Promise.resolve(mod.loadWorldInfo(worldName));
        var savedEntries = rawWorldbookEntries(reloaded);
        var allSaved = savedEntries.every(function (item) {
          return Array.isArray(item && item.key) && Array.isArray(item && item.keysecondary);
        }) && pending.every(function (entry) {
          var comment = textId(entry && (entry.name || entry.comment || entry.extra && entry.extra.comment));
          return savedEntries.some(function (item) {
            return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment
              && String(item && item.content || "") === String(entry && entry.content || "");
          });
        });
        if (!allSaved) throw saveError;
      }
      try { await Promise.resolve(mod.updateWorldInfoList && mod.updateWorldInfoList()); } catch (_) {}
      return {
        ok: true,
        inserted: pending.length,
        existing: existing,
        repaired: repairedKeyArrays,
        targetWorldbook: worldName,
        method: "host-native-raw"
      };
    }

    async function ensureOpeningWorldbooks(entries, fallbackName) {
      var requested = Array.isArray(entries) ? entries.filter(function (entry) {
        return entry && typeof entry === "object" && String(entry.name || entry.comment || "").trim();
      }) : [];
      if (!requested.length) return { ok: true, skipped: true, inserted: 0, existing: 0 };
      try {
        var books = await Promise.resolve(callApi("getCharWorldbookNames", ["current"])) || {};
        var worldName = textId(books.primary || books.primary_world || books.world || books.name);
        if (!worldName) {
          worldName = textId(fallbackName) || "当前角色卡 邂逅世界书";
          var createWorldbook = findFunction("createWorldbook");
          var rebindWorldbooks = findFunction("rebindCharWorldbooks");
          if (!createWorldbook || !rebindWorldbooks) {
            return { ok: false, reason: "角色卡尚未绑定世界书，且宿主缺少绑定接口。" };
          }
          try {
            await Promise.resolve(createWorldbook.fn.call(createWorldbook.view, worldName, []));
          } catch (_) {}
          await Promise.resolve(rebindWorldbooks.fn.call(rebindWorldbooks.view, "current", {
            primary: worldName,
            additional: Array.isArray(books.additional) ? books.additional : []
          }));
        }
        var nativeWorldInfo = await importHostWorldInfoModule();
        if (nativeWorldInfo) {
          var rawResult = await ensureOpeningWorldbooksRaw(nativeWorldInfo, worldName, requested);
          if (rawResult) return rawResult;
        }
        var current = await Promise.resolve(callApi("getWorldbook", [worldName]));
        var currentEntries = Array.isArray(current)
          ? current
          : (current && typeof current === "object"
            ? (Array.isArray(current.entries) ? current.entries : Object.values(current.entries || current.entry || current.world_info || {}))
            : []);
        var existing = 0;
        var pending = [];
        for (var i = 0; i < requested.length; i += 1) {
          var entry = requested[i];
          var comment = textId(entry.name || entry.comment || entry.extra && entry.extra.comment);
          var found = currentEntries.find(function (item) {
            return textId(item && (item.comment || item.name || item.extra && item.extra.comment)) === comment;
          });
          if (!found) {
            pending.push(entry);
            continue;
          }
          if (String(found.content || "") !== String(entry.content || "")) {
            return { ok: false, reason: "角色卡世界书已有同名但内容不同的条目：" + comment };
          }
          existing += 1;
        }
        if (pending.length) {
          var createEntries = findFunction("createWorldbookEntries");
          if (!createEntries) return { ok: false, reason: "宿主缺少世界书条目写入接口。" };
          await Promise.resolve(createEntries.fn.call(createEntries.view, worldName, pending, { render: "immediate" }));
        }
        return { ok: true, inserted: pending.length, existing: existing, targetWorldbook: worldName, method: "host-bridge" };
      } catch (error) {
        return { ok: false, reason: String(error && error.message || error || "宿主写入世界书失败。") };
      }
    }

    function cloneSnapshot(value) {
      if (!value || typeof value !== "object") return value;
      try {
        if (typeof host.structuredClone === "function") return host.structuredClone(value);
      } catch (_) {}
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }

    function cloneReadResult(value) {
      if (value && typeof value.then === "function") return value.then(cloneSnapshot);
      return cloneSnapshot(value);
    }

    function findGalgameScript(items) {
      if (!Array.isArray(items)) return null;
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        if (!item || typeof item !== "object") continue;
        if (String(item.id || "") === config.galgameScriptId) return item;
        var nested = findGalgameScript(item.scripts);
        if (nested) return nested;
      }
      return null;
    }

    function updateGalgameToggle(enabled, status) {
      if (!galgameToggle) return;
      var known = typeof enabled === "boolean";
      galgameToggle.disabled = galgameBusy || !known;
      galgameToggle.classList.toggle("enabled", enabled === true);
      galgameToggle.classList.toggle("disabled", enabled === false);
      galgameToggle.classList.toggle("busy", galgameBusy);
      galgameToggle.setAttribute("aria-pressed", enabled === true ? "true" : "false");
      galgameToggle.textContent = galgameBusy ? "Galgame …" : known ? "Galgame " + (enabled ? "开" : "关") : "Galgame --";
      galgameToggle.title = status || (known
        ? "只切换“" + config.galgameScriptName + "”酒馆助手脚本；不修改显示正则"
        : "未找到酒馆助手脚本管理 API 或目标脚本");
    }

    function showGalgameDialog(options) {
      if (!galgameDialog) return;
      var source = options && typeof options === "object" ? options : {};
      var title = galgameDialog.querySelector("[data-galgame-dialog-title]");
      var body = galgameDialog.querySelector("[data-galgame-dialog-body]");
      if (title) title.textContent = String(source.title || "Galgame人物演出");
      if (body) body.textContent = String(source.message || "");
      galgameDialog.classList.toggle("is-error", source.error === true);
      galgameDialog.classList.add("open");
      galgameDialog.setAttribute("aria-hidden", "false");
    }

    function closeGalgameDialog() {
      if (!galgameDialog) return;
      galgameDialog.classList.remove("open", "is-error");
      galgameDialog.setAttribute("aria-hidden", "true");
    }

    async function readGalgameState() {
      var trees = await Promise.resolve(callApi("getScriptTrees", [{ type: "character" }]));
      if (!Array.isArray(trees)) return { enabled: null, trees: null };
      var target = findGalgameScript(trees);
      return { enabled: target ? target.enabled !== false : null, trees: trees };
    }

    async function syncGalgameState() {
      try {
        var state = await readGalgameState();
        updateGalgameToggle(state.enabled);
        return state.enabled;
      } catch (error) {
        updateGalgameToggle(null, "读取 Galgame 脚本状态失败：" + String(error && error.message || error));
        return null;
      }
    }

    async function syncGalgameRuntimeEnabled(enabled) {
      var views = candidateWindows();
      for (var i = 0; i < views.length; i += 1) {
        try {
          var runtime = views[i].__ST_HYPNOOS_GALGAME_INJECTION_RUNTIME__;
          if (runtime && typeof runtime.setEnabled === "function") {
            await Promise.resolve(runtime.setEnabled(Boolean(enabled)));
            return true;
          }
        } catch (_) {}
      }
      return false;
    }

    async function setGalgameEnabled(nextEnabled) {
      if (galgameBusy) return;
      galgameBusy = true;
      updateGalgameToggle(Boolean(nextEnabled));
      try {
        var state = await readGalgameState();
        if (!state.trees) throw new Error("酒馆助手脚本管理 API 不可用");
        var trees = cloneSnapshot(state.trees);
        var target = findGalgameScript(trees);
        if (!target) throw new Error("没有找到目标 Galgame 脚本");
        if (String(target.id || "") === "4ebce7e7-3a35-4fa1-9130-bf397905f236") {
          throw new Error("拒绝切换悬浮手机宿主脚本");
        }
        target.enabled = Boolean(nextEnabled);
        if (!findFunction("replaceScriptTrees")) throw new Error("酒馆助手脚本写入 API 不可用");
        var replaced = callApi("replaceScriptTrees", [trees, { type: "character" }]);
        await Promise.resolve(replaced);
        var runtimeSynced = await syncGalgameRuntimeEnabled(Boolean(nextEnabled));
        galgameBusy = false;
        var actual = await syncGalgameState();
        if (actual !== Boolean(nextEnabled)) throw new Error("脚本状态没有成功更新");
        showGalgameDialog({
          title: nextEnabled ? "Galgame人物演出已开启" : "Galgame人物演出已关闭",
          message: (nextEnabled
            ? "后续回复将要求输出人物演出。若在回复生成途中切换，当前轮可能因上下文已经组装而无法立即生效；从下一轮开始更可靠。"
            : "后续回复不再要求输出人物演出。若当前回复已经开始生成，本轮仍可能保留人物演出；从下一轮开始更可靠。")
            + (runtimeSynced ? "" : " 当前运行时未确认即时切换，但脚本开关已经保存。")
        });
      } catch (error) {
        galgameBusy = false;
        await syncGalgameState();
        if (galgameToggle) galgameToggle.title = "切换失败：" + String(error && error.message || error);
        showGalgameDialog({
          title: "Galgame切换失败",
          message: String(error && error.message || error || "没有成功更新脚本状态。"),
          error: true
        });
        console.warn("[HypnoOS] Galgame 脚本切换失败", error);
      }
    }

    function readApi(name, args) {
      return cloneReadResult(callApi(name, args));
    }

    function readMvu(name, args) {
      return cloneReadResult(callMvu(name, args));
    }

    function isWritable() {
      var selected = textId(selectedId || writableId());
      return Boolean(selected && selected === writableId());
    }

    function explicitMessageIds(value, depth) {
      if (!value || typeof value !== "object" || depth > 3) return [];
      if (Array.isArray(value)) {
        return value.reduce(function (ids, item) { return ids.concat(explicitMessageIds(item, depth + 1)); }, []);
      }
      var ids = [];
      if (value.message_id !== undefined || value.mesid !== undefined) {
        var direct = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (direct) ids.push(direct);
      }
      if (String(value.type || "").toLowerCase() === "message") {
        var optionId = textId(value.message_id !== undefined ? value.message_id : value.mesid);
        if (optionId) ids.push(optionId);
      }
      return ids;
    }

    function writeTargetsWritable(name, args) {
      var target = writableId();
      if (!target) return false;
      var ids = [];
      (Array.isArray(args) ? args : []).forEach(function (arg) {
        ids = ids.concat(explicitMessageIds(arg, 0));
      });
      if (!ids.length) return false;
      return ids.every(function (id) { return id === target; });
    }

    function guardedApi(name, args) {
      if (!isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callApi(name, args);
    }

    function guardedMvu(name, args) {
      var explicitIds = [];
      (Array.isArray(args) ? args : []).forEach(function (arg) {
        explicitIds = explicitIds.concat(explicitMessageIds(arg, 0));
      });
      if (!explicitIds.length || !isWritable() || !writeTargetsWritable(name, args)) {
        notifyReadOnly();
        return false;
      }
      return callMvu(name, args);
    }

    function context() {
      for (var i = 0; i < sourceWindows().length; i += 1) {
        var view = sourceWindows()[i];
        try {
          var result = view.SillyTavern && view.SillyTavern.getContext ? view.SillyTavern.getContext() : null;
          if (!result && typeof view.getContext === "function") result = view.getContext();
          if (result) return result;
        } catch (_) {}
      }
      return null;
    }

    function chatMessages() {
      var ctx = context();
      if (Array.isArray(ctx && ctx.chat)) return ctx.chat;
      for (var i = 0; i < sourceWindows().length; i += 1) {
        try { if (Array.isArray(sourceWindows()[i].chat)) return sourceWindows()[i].chat; } catch (_) {}
      }
      return [];
    }

    function messageId(message, index) {
      if (message && typeof message === "object") {
        var stable = textId(message.message_id !== undefined ? message.message_id : (message.mesid !== undefined ? message.mesid : message.id));
        if (stable) return stable;
      }
      return String(index);
    }

    function isUserMessage(message, index) {
      if (!message || typeof message !== "object") return false;
      if (message.is_user === true || message.isUser === true || message.from_user === true) return true;
      if (message.is_user === false || message.isUser === false || message.from_user === false) return false;
      var role = String(message.role || message.type || message.sender || "").toLowerCase();
      if (role === "user" || role === "human") return true;
      if (["assistant", "character", "bot", "model", "system"].indexOf(role) >= 0) return false;
      return Number.isInteger(Number(index)) ? Number(index) % 2 === 1 : false;
    }

    function isVisibleAssistantMessage(message, index) {
      if (!message || typeof message !== "object" || isUserMessage(message, index)) return false;
      if (
        message.is_system === true || message.isSystem === true || message.system === true
        || message.hidden === true || message.is_hidden === true || message.isHidden === true
        || message.internal === true || message.is_internal === true
        || message.extra_model === true || message.is_extra_model === true || message.extraModel === true
        || message.deleted === true || message.is_deleted === true
      ) return false;
      var role = String(message.role || message.type || message.sender || "").toLowerCase();
      if (["system", "model", "tool", "function", "analysis", "internal"].indexOf(role) >= 0) return false;
      return message.is_user === false || message.isUser === false || message.from_user === false
        || ["assistant", "character", "bot"].indexOf(role) >= 0;
    }

    function visibleAssistantRecords() {
      var records = [];
      chatMessages().forEach(function (message, index) {
        if (!isVisibleAssistantMessage(message, index)) return;
        records.push({
          message: message,
          index: index,
          id: messageId(message, index)
        });
      });
      return records;
    }

    function chatTopologySignature() {
      return visibleAssistantRecords().map(function (record) {
        var message = record.message || {};
        var swipe = Number(message.swipe_id !== undefined ? message.swipe_id : message.swipeId);
        var stamp = textId(message.send_date || message.gen_started || message.gen_finished || message.created_at);
        var body = String(message.mes || message.message || message.content || "");
        return record.id + ":" + (Number.isFinite(swipe) ? swipe : 0) + ":" + stamp + ":" + body.length;
      }).join("|");
    }

    function unwrapStat(value) {
      return value && typeof value === "object" && value.stat_data && typeof value.stat_data === "object" ? value.stat_data : value;
    }

    function usableSnapshot(value) {
      var root = unwrapStat(value);
      return Boolean(root && typeof root === "object" && !Array.isArray(root) &&
        ((root["系统"] && typeof root["系统"] === "object") || (root["角色"] && typeof root["角色"] === "object")));
    }

    function formatResourceValue(value) {
      if (value === undefined || value === null || value === "") return "--";
      var number = Number(value);
      if (Number.isFinite(number)) return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(number);
      return String(value);
    }

    function paintSidecarResources(system, loading) {
      if (!resourcePanel) return;
      resourcePanel.classList.toggle("loading", Boolean(loading));
      var values = {
        money: system && system["持有零花钱"],
        starlight: system && system["星光点"],
        energy: system && system["MC能量"]
      };
      Object.keys(values).forEach(function (key) {
        var target = resourcePanel.querySelector("[data-resource-" + key + "]");
        if (target) target.textContent = formatResourceValue(values[key]);
      });
    }

    async function refreshSidecarResources() {
      if (!resourcePanel) return;
      var token = ++resourceRefreshToken;
      var id = textId(selectedId || writableId());
      if (!id) {
        paintSidecarResources(null, false);
        return;
      }
      paintSidecarResources(null, true);
      var option = { type: "message", message_id: id };
      var snapshot = null;
      try { snapshot = await Promise.resolve(callMvu("getMvuData", [option])); } catch (_) {}
      if (!usableSnapshot(snapshot)) {
        try { snapshot = await Promise.resolve(callApi("getVariables", [option])); } catch (_) {}
      }
      if (token !== resourceRefreshToken || id !== textId(selectedId || writableId())) return;
      var root = usableSnapshot(snapshot) ? unwrapStat(snapshot) : null;
      paintSidecarResources(root && root["系统"], false);
    }

    function paintVariableFormatButton(report) {
      if (!variableFormatButton) return;
      var data = report && typeof report === "object" ? report : null;
      var extra = Math.max(0, Number(data && data.extraCount) || 0);
      var missing = Math.max(0, Number(data && data.missingCount) || 0);
      variableFormatButton.classList.toggle("warn", extra > 0);
      variableFormatButton.classList.toggle("missing", extra <= 0 && missing > 0);
      variableFormatButton.textContent = extra > 0
        ? "未知键 " + extra
        : missing > 0
          ? "缺少字段 " + missing
          : data && data.hasData
            ? "变量格式正常"
            : "变量格式检查";
      variableFormatButton.setAttribute("aria-label", extra > 0
        ? "变量格式发现 " + extra + " 个未知键"
        : missing > 0
          ? "变量格式缺少 " + missing + " 个字段"
          : "检查当前楼层变量格式");
    }

    function refreshVariableFormatCheck() {
      paintVariableFormatButton(phoneApi("__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__", [], true));
    }

    function closeVariableFormatDialog() {
      if (!variableFormatDialog) return;
      variableFormatDialog.classList.remove("open");
      variableFormatDialog.setAttribute("aria-hidden", "true");
    }

    function openVariableFormatDialog() {
      if (!variableFormatDialog) return;
      var report = phoneApi("__ST_HYPNOOS_VARIABLE_FORMAT_REPORT__", [], true);
      var title = variableFormatDialog.querySelector("[data-variable-format-title]");
      var body = variableFormatDialog.querySelector("[data-variable-format-body]");
      var repair = variableFormatDialog.querySelector("[data-variable-format-repair]");
      var card = variableFormatDialog.querySelector(".variable-format-dialog__card");
      var extra = Math.max(0, Number(report && report.extraCount) || 0);
      var missing = Math.max(0, Number(report && report.missingCount) || 0);
      var extraPaths = Array.isArray(report && report.extraPaths) ? report.extraPaths : [];
      var missingPaths = Array.isArray(report && report.missingPaths) ? report.missingPaths : [];
      if (title) title.textContent = extra > 0 ? "发现未知变量键" : missing > 0 ? "变量字段不完整" : "变量格式检查";
      if (card) card.classList.toggle("warn", extra > 0);
      if (body) {
        body.textContent = !report || !report.hasData
          ? "当前楼层没有读到可检查的 MVU 变量。"
          : "未知键：" + extra + " 项" +
            (extraPaths.length ? "\n" + extraPaths.join("\n") : "") +
            "\n\n缺少字段：" + missing + " 项" +
            (missingPaths.length ? "\n" + missingPaths.join("\n") : "") +
            (report.writable ? "\n\n可清理当前最新楼。合法的角色名、任务根键和物品名会保留。" : "\n\n历史楼层只读，只能查看报告。");
      }
      if (repair) {
        repair.disabled = !report || !report.hasData || !report.writable || (!extra && !missing);
        repair.textContent = extra > 0 ? "清理并补齐" : "补齐缺少字段";
      }
      variableFormatDialog.classList.add("open");
      variableFormatDialog.setAttribute("aria-hidden", "false");
    }

    function subscribeSidecarResourceEvents() {
      if (resourceEventsSubscribed) return;
      resourceEventsSubscribed = true;
      var found = findFunction("eventOn");
      if (!found) return;
      var events = [];
      var galgameFinalRenderEvents = new Set();
      var mvu = findMvu();
      try {
        events.push(mvu?.events?.VARIABLE_INITIALIZED, mvu?.events?.VARIABLE_UPDATE_ENDED);
      } catch (_) {}
      sourceWindows().forEach(function (view) {
        try {
          var characterMessageRendered = view.tavern_events?.CHARACTER_MESSAGE_RENDERED;
          events.push(
            view.tavern_events?.CHAT_CHANGED,
            view.tavern_events?.MESSAGE_SWIPED,
            characterMessageRendered
          );
          if (characterMessageRendered) galgameFinalRenderEvents.add(characterMessageRendered);
        } catch (_) {}
      });
      Array.from(new Set(events.filter(Boolean))).forEach(function (eventName) {
        var handler = function () {
          refreshSidecarResources();
          refreshVariableFormatCheck();
          if (galgameFinalRenderEvents.has(eventName)) scheduleGalgameRender();
        };
        try {
          resourceEventStops.push({
            eventName: eventName,
            handler: handler,
            handle: found.fn.call(found.view, eventName, handler)
          });
        } catch (_) {}
      });
    }

    function snapshotExists(id, message) {
      var option = { type: "message", message_id: id };
      try {
        var mvu = callMvu("getMvuData", [option]);
        if (mvu && typeof mvu.then !== "function" && usableSnapshot(mvu)) return true;
      } catch (_) {}
      try {
        var vars = callApi("getVariables", [option]);
        if (vars && typeof vars.then !== "function" && usableSnapshot(vars)) return true;
      } catch (_) {}
      try {
        var swipeIndex = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        var swipes = message && (message.swipes_data || message.swipe_data);
        if (Array.isArray(swipes) && usableSnapshot(swipes[Number.isFinite(swipeIndex) ? swipeIndex : 0])) return true;
        if (usableSnapshot(message && (message.variables || message.mvu || message.stat_data))) return true;
      } catch (_) {}
      return false;
    }

    function floorItems() {
      var result = [];
      visibleAssistantRecords().forEach(function (record) {
        var message = record.message;
        var index = record.index;
        var id = record.id;
        var swipe = Number(message && (message.swipe_id !== undefined ? message.swipe_id : message.swipeId));
        result.push({
          id: id,
          floor: index,
          swipe: Number.isFinite(swipe) ? swipe + 1 : 1,
          snapshot: snapshotExists(id, message)
        });
      });
      if (!result.length) {
        ownerOrder.forEach(function (id, index) {
          var owner = owners.get(id);
          if (ownerAlive(owner)) result.push({ id: id, floor: index, swipe: 1, snapshot: snapshotExists(id, null) });
        });
      }
      return result.slice(-4);
    }

    function reconcileChatState() {
      var nextKey = chatTopologySignature();
      var changed = nextKey !== chatTopologyKey;
      chatTopologyKey = nextKey;
      var allowed = floorItems().map(function (item) { return item.id; });
      if (selectedId && allowed.indexOf(selectedId) < 0) {
        selectedId = writableId();
        selectionMode = "follow";
        changed = true;
      }
      if (changed) {
        loadedForWritableId = "";
        try { if (frame) frame.dataset.loadedFor = ""; } catch (_) {}
        try { if (fetchController) fetchController.abort(); } catch (_) {}
      }
      return changed;
    }

    function mesIdFromElement(element) {
      var node = element && element.closest ? element.closest(".mes[mesid],[mesid],[data-message-id],[data-mes-id]") : null;
      if (!node) return "";
      return textId(node.getAttribute("mesid") || node.getAttribute("data-message-id") || node.getAttribute("data-mes-id"));
    }

    function nearestVisibleFloor() {
      var nodes = Array.prototype.slice.call(hostDocument.querySelectorAll(".mes[mesid],.mes[data-message-id],.mes[data-mes-id]"));
      if (!nodes.length) return "";
      var center = host.innerHeight / 2;
      var best = null;
      nodes.forEach(function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= host.innerHeight) return;
        var distance = Math.abs((rect.top + rect.bottom) / 2 - center);
        if (!best || distance < best.distance) best = { id: mesIdFromElement(node), distance: distance };
      });
      return best && best.id ? best.id : "";
    }

    function selectFloor(id, mode) {
      var next = textId(id) || writableId();
      if (!next) return;
      selectedId = next;
      if (mode) selectionMode = mode;
      saveUiState();
      updateChrome();
      refreshPhone();
      notifyStages();
    }

    function followVisibleFloor() {
      var visible = nearestVisibleFloor();
      var ids = floorItems().map(function (item) { return item.id; });
      selectFloor(ids.indexOf(visible) >= 0 ? visible : writableId(), "follow");
    }

    function readUiState() {
      try {
        return JSON.parse(host.localStorage.getItem(storageKey) || "{}") || {};
      } catch (_) { return {}; }
    }

    function loadUiState() {
      var saved = readUiState();
      selectionMode = saved && saved.mode === "manual" ? "manual" : "follow";
      if (saved && saved.selectedId) selectedId = textId(saved.selectedId);
      if (saved && ["alisa", "hyakka"].indexOf(saved.petCharacterId) >= 0) {
        petCharacterId = saved.petCharacterId;
      }
      return saved;
    }

    function saveUiState() {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: current.launcherX,
          launcherY: current.launcherY,
          petCharacterId: petCharacterId
        }));
      } catch (_) {}
    }

    function savePosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: Math.round(x),
          y: Math.round(y),
          launcherX: current.launcherX,
          launcherY: current.launcherY,
          petCharacterId: petCharacterId
        }));
      } catch (_) {}
    }

    function saveLauncherPosition(x, y) {
      try {
        var current = readUiState();
        host.localStorage.setItem(storageKey, JSON.stringify({
          mode: selectionMode,
          selectedId: selectedId,
          x: current.x,
          y: current.y,
          launcherX: Math.round(x),
          launcherY: Math.round(y),
          petCharacterId: petCharacterId
        }));
      } catch (_) {}
    }

    function hostViewportRect() {
      var viewport = host.visualViewport;
      return {
        left: Math.max(0, Number(viewport && viewport.offsetLeft) || 0),
        top: Math.max(0, Number(viewport && viewport.offsetTop) || 0),
        width: Math.max(1, Number(viewport && viewport.width) || Number(host.innerWidth) || 1),
        height: Math.max(1, Number(viewport && viewport.height) || Number(host.innerHeight) || 1)
      };
    }

    function panelSidecarReserve(width) {
      if (timetableFocus === "phone") return 0;
      var viewport = hostViewportRect();
      var available = Math.max(0, viewport.width - Number(width || 0) - 24);
      return Math.min(panel?.classList?.contains("profile-neighbors") ? 354 : 286, available);
    }

    function syncPanelSize() {
      if (!panel) return;
      var baseWidth = timetableFocus === "phone" ? 560 : timetableFocus === "timetable" ? 720 : 1160;
      var baseHeight = 812;
      var visibleLeft = timetableFocus === "phone" ? 350 : timetableFocus === "timetable" ? 215 : 0;
      var viewport = hostViewportRect();
      var viewportWidth = viewport.width;
      var viewportHeight = viewport.height;
      var widthAllowance = Math.max(1, viewportWidth - 20);
      var heightAllowance = Math.max(1, viewportHeight - 16);
      var scale = Math.min(1, widthAllowance / baseWidth, heightAllowance / baseHeight);
      panel.style.width = Math.max(1, Math.floor(baseWidth * scale)) + "px";
      panel.style.height = Math.max(1, Math.floor(baseHeight * scale)) + "px";
      panel.style.setProperty("--phone-scale", String(scale));
      panel.style.setProperty("--stage-scale", String(scale));
      panel.style.setProperty("--stage-offset-x", (-visibleLeft * scale) + "px");
      panel.style.setProperty("--phone-face-width", (430 * scale) + "px");
    }

    function clampPosition(x, y) {
      var viewport = hostViewportRect();
      var width = panel ? panel.offsetWidth : Math.min(760, viewport.width - 24);
      var height = panel ? panel.offsetHeight : Math.min(900, viewport.height - 24);
      var sidecar = panelSidecarReserve(width);
      var lowerBoundX = viewport.left + 8;
      var upperX = Math.max(lowerBoundX, viewport.left + viewport.width - width - sidecar - 8);
      var lowerX = panel?.classList?.contains("profile-neighbors") && upperX >= viewport.left + 82
        ? viewport.left + 82
        : lowerBoundX;
      var lowerY = viewport.top + 8;
      return {
        x: Math.max(lowerX, Math.min(Number(x) || lowerX, upperX)),
        y: Math.max(lowerY, Math.min(Number(y) || lowerY, Math.max(lowerY, viewport.top + viewport.height - height - 8)))
      };
    }

    function clampLauncherPosition(x, y) {
      var viewport = hostViewportRect();
      var width = launcher ? launcher.offsetWidth : 58;
      var height = launcher ? launcher.offsetHeight : 58;
      var lowerX = viewport.left + 8;
      var lowerY = viewport.top + 8;
      return {
        x: Math.max(lowerX, Math.min(Number(x) || lowerX, Math.max(lowerX, viewport.left + viewport.width - width - 8))),
        y: Math.max(lowerY, Math.min(Number(y) || lowerY, Math.max(lowerY, viewport.top + viewport.height - height - 8)))
      };
    }

    function applySavedPosition() {
      if (!panel) return;
      syncPanelSize();
      var viewport = hostViewportRect();
      var saved = readUiState();
      var fallbackX = Math.max(viewport.left + 8, viewport.left + viewport.width - panel.offsetWidth - panelSidecarReserve(panel.offsetWidth) - 28);
      var fallbackY = Math.max(viewport.top + 8, Math.min(viewport.top + 88, viewport.top + viewport.height - panel.offsetHeight - 8));
      var next = clampPosition(saved.x === undefined ? fallbackX : saved.x, saved.y === undefined ? fallbackY : saved.y);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function applySavedLauncherPosition() {
      if (!launcher) return;
      var viewport = hostViewportRect();
      var saved = readUiState();
      var fallbackX = Math.max(viewport.left + 8, viewport.left + viewport.width - launcher.offsetWidth - 22);
      var fallbackY = Math.max(viewport.top + 8, viewport.top + viewport.height - launcher.offsetHeight - 90);
      var next = clampLauncherPosition(
        saved.launcherX === undefined ? fallbackX : saved.launcherX,
        saved.launcherY === undefined ? fallbackY : saved.launcherY
      );
      launcher.style.left = next.x + "px";
      launcher.style.top = next.y + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      launcher.style.transform = "translate3d(0,0,0)";
      petOriginX = next.x;
      petOriginY = next.y;
      petRoamX = 0;
      petRoamY = 0;
    }

    function petAssetUrl(name) {
      return String(config.assetBase || "").replace(/\/?$/, "/") + "pet/" + name;
    }

    var PET_BASE_FACING = 1;
    var PET_RENDER_SIZE = 96;
    var PET_DRAG_GRIP_Y = 5;
    var PET_DRAG_COM_LENGTH = 56;
    var PET_DRAG_GRAVITY = 1650;
    var PET_DRAG_DAMPING = 3.25;
    var PET_DRAG_MAX_ANGULAR_SPEED = 15;
    var PET_CHARACTER_ORDER = ["alisa", "hyakka"];
    var PET_CHARACTER_NAMES = {
      alisa: "爱丽莎",
      hyakka: "千杀百花"
    };
    var MAX_DECODED_PET_SHEETS = 8;
    var MAX_PET_LOADS_IN_FLIGHT = 2;
    var petStates = {
      idle: { group: "idle", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      unique_a: { group: "unique-a", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      unique_b: { group: "unique-b", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      held_scared: { group: "drag", total: 8, start: 0, end: 7, fps: 6, loops: Infinity },
      landing: { group: "landing", total: 12, start: 0, end: 11, fps: 10, loops: 1 },
      enter: { group: "enter", total: 8, start: 0, end: 7, fps: 7, loops: 1 },
      exit: { group: "exit", total: 8, start: 0, end: 7, fps: 7, loops: 1 }
    };

    function petAssetName(group, characterId) {
      var role = PET_CHARACTER_ORDER.indexOf(characterId) >= 0 ? characterId : "alisa";
      return "v5/" + role + "/" + role + "-" + group + "-v5.png";
    }

    function petStateAsset(name, characterId) {
      return petAssetName(petStateMeta(name).group, characterId || petCharacterId);
    }

    function petStateMeta(name) {
      return petStates[name] || petStates.idle;
    }

    function petReducedMotion() {
      return Boolean(petMotionQuery && petMotionQuery.matches);
    }

    function clearPetFrameTimer() {
      if (petTimer) host.clearTimeout(petTimer);
      petTimer = 0;
    }

    function clearPetActivityTimer() {
      if (petActivityTimer) host.clearTimeout(petActivityTimer);
      petActivityTimer = 0;
    }

    function clearPetMotionFrame() {
      if (petMotionFrame) {
        if (host.cancelAnimationFrame) host.cancelAnimationFrame(petMotionFrame);
        else host.clearTimeout(petMotionFrame);
      }
      petMotionFrame = 0;
      petMotionLast = 0;
    }

    function setPetDragAngle(angle) {
      petSpinAngle = Number.isFinite(Number(angle)) ? Number(angle) : 0;
      if (petSprite) petSprite.style.setProperty("--pet-drag-angle", petSpinAngle.toFixed(3) + "rad");
    }

    function resetPetDragPhysics() {
      clearPetMotionFrame();
      petSpinVelocity = 0;
      setPetDragAngle(0);
    }

    function petPendulumStep(angle, angularVelocity, pivotAccelerationX, pivotAccelerationY, dt) {
      var step = Math.max(1 / 240, Math.min(Number(dt) || 0, 1 / 24));
      var accelerationX = Math.max(-9000, Math.min(9000, Number(pivotAccelerationX) || 0));
      var accelerationY = Math.max(-9000, Math.min(9000, Number(pivotAccelerationY) || 0));
      var theta = Number(angle) || 0;
      var omega = Number(angularVelocity) || 0;
      var tangential = -accelerationX * Math.cos(theta) - (PET_DRAG_GRAVITY - accelerationY) * Math.sin(theta);
      var angularAcceleration = tangential / PET_DRAG_COM_LENGTH - PET_DRAG_DAMPING * omega;
      omega = Math.max(-PET_DRAG_MAX_ANGULAR_SPEED, Math.min(PET_DRAG_MAX_ANGULAR_SPEED, omega + angularAcceleration * step));
      theta += omega * step;
      return { angle: theta, angularVelocity: omega };
    }

    function animateLauncherDragPhysics(timestamp) {
      petMotionFrame = 0;
      if (!launcherDragState || !launcherDragState.moved || petReducedMotion()) {
        petMotionLast = 0;
        return;
      }
      var now = Number(timestamp) || Date.now();
      var dt = petMotionLast ? (now - petMotionLast) / 1000 : 1 / 60;
      petMotionLast = now;
      var next = petPendulumStep(
        petSpinAngle,
        petSpinVelocity,
        launcherDragState.accelerationX,
        launcherDragState.accelerationY,
        dt
      );
      petSpinVelocity = next.angularVelocity;
      setPetDragAngle(next.angle);
      launcherDragState.accelerationX *= 0.82;
      launcherDragState.accelerationY *= 0.82;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(function () { callback(Date.now()); }, 16); };
      petMotionFrame = requestFrame(animateLauncherDragPhysics);
    }

    function startLauncherDragPhysics() {
      resetPetDragPhysics();
      if (petReducedMotion()) return;
      var requestFrame = host.requestAnimationFrame || function (callback) { return host.setTimeout(function () { callback(Date.now()); }, 16); };
      petMotionFrame = requestFrame(animateLauncherDragPhysics);
    }

    function setPetDirection(direction) {
      var next = Number(direction) < 0 ? -1 : 1;
      if (next === petDirection && petSprite) return;
      petDirection = next;
      if (!petSprite) return;
      var meta = petStateMeta(petState);
      var visualScale = meta.directional && petDirection !== PET_BASE_FACING ? -1 : 1;
      petSprite.style.setProperty("--pet-facing-scale", String(visualScale));
    }

    function applyPetStateAppearance() {
      if (!petSprite) return;
      var meta = petStateMeta(petState);
      petSprite.style.backgroundImage = "url('" + petAssetUrl(petStateAsset(petState)).replace(/'/g, "%27") + "')";
      petSprite.style.backgroundSize = (meta.total * PET_RENDER_SIZE) + "px " + PET_RENDER_SIZE + "px";
      petSprite.style.setProperty("--pet-lift", "0px");
      if (launcher) {
        launcher.dataset.petState = petState;
        launcher.dataset.petCharacter = petCharacterId;
      }
      var visualScale = meta.directional && petDirection !== PET_BASE_FACING ? -1 : 1;
      petSprite.style.setProperty("--pet-facing-scale", String(visualScale));
    }

    function applyPetFrame() {
      if (!petSprite) return;
      petSprite.style.backgroundPosition = (-petFrame * PET_RENDER_SIZE) + "px 0";
    }

    function petClampToHabitat(x, y) {
      var nextX = Math.max(petOriginX - 88, Math.min(Number(x) || petOriginX, petOriginX + 88));
      var nextY = Math.max(petOriginY - 48, Math.min(Number(y) || petOriginY, petOriginY + 48));
      return clampLauncherPosition(nextX, nextY);
    }

    function petMoveTo(x, y) {
      if (!launcher || launcherDragState) return;
      var next = petClampToHabitat(x, y);
      petRoamX = next.x - petOriginX;
      petRoamY = next.y - petOriginY;
      launcher.style.transform = "translate3d(" + petRoamX.toFixed(2) + "px," + petRoamY.toFixed(2) + "px,0)";
    }

    function commitPetRoamPosition() {
      if (!launcher || (!petRoamX && !petRoamY)) return;
      var rect = launcher.getBoundingClientRect();
      launcher.style.transform = "translate3d(0,0,0)";
      launcher.style.left = rect.left + "px";
      launcher.style.top = rect.top + "px";
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
      petOriginX = rect.left;
      petOriginY = rect.top;
      petRoamX = 0;
      petRoamY = 0;
    }

    function petCanRoam() {
      return Boolean(
        petAssetsReady &&
        launcher &&
        !shellOpen &&
        !petMenuOpen &&
        !petSwitching &&
        !launcherDragState &&
        !petPointerHover &&
        !petHasFocus &&
        !petReducedMotion() &&
        !hostDocument.hidden
      );
    }

    function schedulePetActivity() {
      clearPetActivityTimer();
    }

    function playPetShellAction(name, expectedOpen) {
      var characterAtRequest = petCharacterId;
      var group = petStateMeta(name).group;
      loadPetAsset(characterAtRequest, group).then(function () {
        if (
          petCharacterId === characterAtRequest &&
          shellOpen === expectedOpen &&
          !launcherDragState &&
          !petSwitching
        ) setPetState(name);
      }).catch(function () {});
    }

    function playPetLandingAfterDrag() {
      var landingAsset = petAssetName("landing", petCharacterId);
      if (petReadyAssets.has(landingAsset)) {
        setPetState("landing");
        return;
      }
      setPetState("idle");
    }

    function finishPetState() {
      if (petState === "exit" && petPendingCharacterId) return completePetSwitch();
      if (petState === "enter" || petState === "unique_a" || petState === "unique_b") return setPetState("idle");
      if (petState === "held_scared") return;
      if (petState === "idle") {
        petFrame = 0;
        applyPetFrame();
        schedulePetActivity();
        return;
      }
      setPetState("idle");
    }

    function advancePetFrame() {
      petTimer = 0;
      if (!petSprite || !launcher) return;
      var meta = petStateMeta(petState);
      petFrame += 1;
      if (petFrame > meta.end) {
        petLoops += 1;
        if (petLoops >= meta.loops) {
          finishPetState();
          return;
        }
        petFrame = meta.start;
      }
      applyPetFrame();
      petTimer = host.setTimeout(advancePetFrame, Math.round(1000 / Math.min(16, Math.max(1, meta.fps))));
    }

    function setPetState(name, options) {
      var nextName = String(name || "idle");
      var opts = options || {};
      if (petReducedMotion() && /^(unique_a|unique_b|landing)$/.test(nextName)) nextName = "idle";
      if (nextName !== "idle" && nextName !== "held_scared" && !petReadyAssets.has(petStateAsset(nextName))) nextName = "idle";
      clearPetFrameTimer();
      clearPetActivityTimer();
      clearPetMotionFrame();
      petState = nextName;
      petLoops = 0;
      if (nextName !== "held_scared") resetPetDragPhysics();
      var meta = petStateMeta(petState);
      petFrame = meta.start;
      applyPetStateAppearance();
      applyPetFrame();
      if (opts.static || (petReducedMotion() && petState !== "held_scared")) {
        if (petState === "idle") schedulePetActivity();
        return;
      }
      petTimer = host.setTimeout(advancePetFrame, Math.round(1000 / Math.min(16, Math.max(1, meta.fps))));
    }

    function pausePetAutonomy() {
      clearPetFrameTimer();
      clearPetActivityTimer();
      clearPetMotionFrame();
      if (!launcherDragState) setPetState("idle", { static: true });
    }

    function resumePetAutonomy() {
      if (!petAssetsReady || shellOpen || petMenuOpen || petSwitching || hostDocument.hidden || petPointerHover || petHasFocus || launcherDragState) return;
      setPetState("idle");
    }

    function trimPetImageCache() {
      while (petImageCache.size > MAX_DECODED_PET_SHEETS) {
        var removable = "";
        petImageCache.forEach(function (_image, key) {
          var currentPrefix = "v5/" + petCharacterId + "/";
          var pendingPrefix = petPendingCharacterId ? "v5/" + petPendingCharacterId + "/" : "";
          if (!removable && key.indexOf(currentPrefix) !== 0 && (!pendingPrefix || key.indexOf(pendingPrefix) !== 0)) removable = key;
        });
        if (!removable) {
          petImageCache.forEach(function (_image, key) {
            if (
              !removable &&
              key.indexOf("v5/" + petCharacterId + "/") === 0 &&
              key !== petAssetName("idle", petCharacterId) &&
              key !== petAssetName("enter", petCharacterId)
            ) removable = key;
          });
        }
        if (!removable) break;
        petImageCache.delete(removable);
      }
    }

    function startPetLoadTask(task) {
      petLoadsInFlight += 1;
      var image = new host.Image();
      image.decoding = "async";
      var finish = function (error) {
        petLoadsInFlight = Math.max(0, petLoadsInFlight - 1);
        petLoadPromises.delete(task.key);
        if (error) task.reject(error);
        else {
          petImageCache.set(task.key, image);
          if (task.characterId === petCharacterId) petReadyAssets.add(task.key);
          trimPetImageCache();
          task.resolve(image);
        }
        pumpPetLoadQueue();
      };
      image.onload = function () {
        var decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve();
        Promise.resolve(decoded).catch(function () {}).then(function () { finish(); });
      };
      image.onerror = function () { finish(new Error("pet asset failed: " + task.key)); };
      image.src = petAssetUrl(task.key);
    }

    function pumpPetLoadQueue() {
      while (petLoadsInFlight < MAX_PET_LOADS_IN_FLIGHT && petLoadQueue.length) {
        startPetLoadTask(petLoadQueue.shift());
      }
    }

    function loadPetAsset(characterId, group) {
      var key = petAssetName(group, characterId);
      if (petImageCache.has(key)) {
        if (characterId === petCharacterId) petReadyAssets.add(key);
        return Promise.resolve(petImageCache.get(key));
      }
      if (petLoadPromises.has(key)) return petLoadPromises.get(key);
      var promise = new Promise(function (resolve, reject) {
        petLoadQueue.push({ key: key, characterId: characterId, resolve: resolve, reject: reject });
        pumpPetLoadQueue();
      });
      petLoadPromises.set(key, promise);
      return promise;
    }

    function loadPetBackgroundAssets(characterId) {
      var start = function () {
        ["unique-a", "unique-b", "drag", "exit"].forEach(function (group) {
          loadPetAsset(characterId, group).catch(function () {});
        });
      };
      if (host.requestIdleCallback) host.requestIdleCallback(start, { timeout: 1400 });
      else host.setTimeout(start, 260);
    }

    function loadPetAssets() {
      if (!launcher || !petSprite || petAssetsReady) return;
      petReadyAssets.clear();
      Promise.all([
        loadPetAsset(petCharacterId, "idle"),
        loadPetAsset(petCharacterId, "enter"),
        loadPetAsset(petCharacterId, "landing")
      ]).then(function () {
        if (!launcher) return;
        petAssetsReady = true;
        launcher.classList.add("pet-ready");
        launcher.dataset.petCharacter = petCharacterId;
        launcher.setAttribute("aria-label", "打开悬浮手机 · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
        setPetState("enter");
        loadPetBackgroundAssets(petCharacterId);
      }).catch(function () {
        if (launcher) launcher.classList.remove("pet-ready");
      });
    }

    function nextPetCharacterId() {
      var index = PET_CHARACTER_ORDER.indexOf(petCharacterId);
      return PET_CHARACTER_ORDER[(Math.max(0, index) + 1) % PET_CHARACTER_ORDER.length];
    }

    function updatePetCharacterButton() {
      if (!petCharacterButton) return;
      var currentName = PET_CHARACTER_NAMES[petCharacterId] || PET_CHARACTER_NAMES.alisa;
      var nextName = PET_CHARACTER_NAMES[nextPetCharacterId()] || PET_CHARACTER_NAMES.hyakka;
      petCharacterButton.disabled = petSwitching;
      petCharacterButton.textContent = petSwitching ? "人物切换中…" : "人物 · " + currentName;
      petCharacterButton.title = petSwitching ? "正在载入桌宠" : "点击切换至" + nextName;
      petCharacterButton.setAttribute("aria-label", petSwitching
        ? "正在切换桌宠"
        : "当前桌宠" + currentName + "；点击切换至" + nextName);
    }

    function completePetSwitch() {
      var next = petPendingCharacterId;
      if (!next) {
        petSwitching = false;
        updatePetCharacterButton();
        return setPetState("idle");
      }
      petPendingCharacterId = "";
      petCharacterId = next;
      petReadyAssets.clear();
      ["idle", "enter", "landing", "exit"].forEach(function (group) {
        var key = petAssetName(group, petCharacterId);
        if (petImageCache.has(key)) petReadyAssets.add(key);
      });
      petAssetsReady = true;
      petSwitching = false;
      saveUiState();
      updatePetCharacterButton();
      if (launcher) {
        launcher.dataset.petCharacter = petCharacterId;
        launcher.setAttribute("aria-label", "打开悬浮手机 · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
      }
      setPetState("enter");
      loadPetBackgroundAssets(petCharacterId);
    }

    function switchPetCharacter() {
      if (petSwitching) return;
      var next = nextPetCharacterId();
      closePetMenu();
      pausePetAutonomy();
      petSwitching = true;
      petPendingCharacterId = next;
      updatePetCharacterButton();
      Promise.all([
        loadPetAsset(next, "idle"),
        loadPetAsset(next, "enter"),
        loadPetAsset(next, "landing")
      ]).then(function () {
        completePetSwitch();
      }).catch(function () {
        petSwitching = false;
        petPendingCharacterId = "";
        updatePetCharacterButton();
        resumePetAutonomy();
      });
    }

    function clearPetMenuLongPress() {
      if (petMenuLongPressTimer) host.clearTimeout(petMenuLongPressTimer);
      petMenuLongPressTimer = 0;
    }

    function positionPetMenu() {
      if (!petMenu || !launcher) return;
      var viewport = hostViewportRect();
      var rect = launcher.getBoundingClientRect();
      var left = Math.max(viewport.left + 6, Math.min(rect.left + rect.width / 2 - 28, viewport.left + viewport.width - 62));
      var top = Math.max(viewport.top + 6, Math.min(rect.top - 64, viewport.top + viewport.height - 62));
      petMenu.style.left = left + "px";
      petMenu.style.top = top + "px";
    }

    function openPetMenu(focusMenu) {
      if (!petMenu || !launcher || petSwitching) return;
      if (shellOpen) toggleShell(false);
      pausePetAutonomy();
      commitPetRoamPosition();
      var switchButton = petMenu.querySelector("[data-pet-action='switch']");
      if (switchButton) {
        var next = nextPetCharacterId();
        switchButton.title = "切换至" + PET_CHARACTER_NAMES[next];
        switchButton.setAttribute("aria-label", "切换至" + PET_CHARACTER_NAMES[next]);
      }
      positionPetMenu();
      petMenuOpen = true;
      petMenu.classList.add("open");
      petMenu.setAttribute("aria-hidden", "false");
      launcher.setAttribute("aria-expanded", "true");
      if (focusMenu) petMenu.querySelector("button")?.focus();
    }

    function closePetMenu(refocus) {
      clearPetMenuLongPress();
      if (!petMenu) return;
      petMenuOpen = false;
      petMenu.classList.remove("open");
      petMenu.setAttribute("aria-hidden", "true");
      if (launcher) launcher.setAttribute("aria-expanded", shellOpen ? "true" : "false");
      if (refocus && launcher) launcher.focus();
      else if (!launcherDragState && !shellOpen && !petSwitching) resumePetAutonomy();
    }

    function shellCss() {
      return [
        "*{box-sizing:border-box}",
        ".launcher{pointer-events:auto;position:fixed;right:22px;bottom:90px;width:96px;height:96px;border:0;padding:0;border-radius:28px;background:transparent;color:#fff;display:block;cursor:grab;touch-action:none;user-select:none;z-index:3;overflow:visible}",
        ".launcher:focus-visible{outline:3px solid rgba(125,211,252,.96);outline-offset:3px}.launcher.dragging{cursor:grabbing}.pet-sprite{position:absolute;inset:0;width:96px;height:96px;background-repeat:no-repeat;image-rendering:auto;filter:drop-shadow(0 7px 5px rgba(2,6,23,.58));transform:translateY(var(--pet-lift,0)) rotate(var(--pet-drag-angle,0rad)) scaleX(var(--pet-facing-scale,1));transform-origin:50% 100%;opacity:0;transition:filter .16s ease}.launcher.pet-ready .pet-sprite{opacity:1}.launcher:hover .pet-sprite,.launcher.active .pet-sprite{filter:drop-shadow(0 8px 5px rgba(30,64,175,.58)) drop-shadow(0 0 5px rgba(125,211,252,.34))}.launcher.dragging .pet-sprite{transition:none;transform-origin:50% " + PET_DRAG_GRIP_Y + "px;filter:drop-shadow(0 12px 7px rgba(2,6,23,.54));will-change:transform}",
        ".pet-fallback{position:absolute;left:15px;top:15px;width:66px;height:66px;border:1px solid rgba(196,116,255,.7);border-radius:24px;background:linear-gradient(145deg,#58115d,#19142d 62%,#0b1022);box-shadow:0 16px 44px rgba(20,0,35,.48),inset 0 1px rgba(255,255,255,.18);display:grid;place-items:center;transition:opacity .18s ease}.launcher.pet-ready .pet-fallback{opacity:0;pointer-events:none}.pet-fallback svg{width:30px;height:30px}",
        ".pet-menu{position:fixed;z-index:4;width:56px;height:56px;pointer-events:none;opacity:0;transform:translateY(8px) scale(.9);transform-origin:50% 100%;transition:opacity .14s ease,transform .14s ease}.pet-menu.open{pointer-events:auto;opacity:1;transform:none}.pet-menu button{position:absolute;inset:0;width:56px;height:56px;padding:0;border:1px solid rgba(226,232,240,.7);border-radius:50%;background:linear-gradient(145deg,rgba(30,41,59,.97),rgba(15,23,42,.98));box-shadow:0 8px 22px rgba(2,6,23,.48),inset 0 1px rgba(255,255,255,.14);color:#f8fafc;font:850 11px/1.1 system-ui;cursor:pointer;touch-action:manipulation}.pet-menu button:hover,.pet-menu button:focus-visible{border-color:#a5f3fc;background:linear-gradient(145deg,#155e75,#172554);outline:2px solid rgba(165,243,252,.72);outline-offset:2px}",
        ".launcher i{position:absolute;z-index:2;right:1px;top:1px;min-width:20px;height:20px;padding:0 5px;border:2px solid rgba(255,255,255,.88);border-radius:10px;background:#f25aa6;color:white;font:800 11px/16px system-ui;text-align:center;box-shadow:0 3px 8px rgba(15,23,42,.46)}@media(prefers-reduced-motion:reduce){.pet-sprite,.pet-fallback{transition:none!important}}",
        ".panel{pointer-events:auto;position:fixed;width:1160px;height:812px;border:0;background:transparent;box-shadow:none;overflow:visible;z-index:2;display:none;isolation:isolate;--floor-sidecar-width:270px;--phone-scale:1;--stage-scale:1;perspective:1800px}",
        ".panel.open{display:block}",
        ".dual-stage{position:absolute;left:0;top:0;width:1160px;height:812px;transform:translateX(var(--stage-offset-x,0px)) scale(var(--stage-scale));transform-origin:0 0;transform-style:preserve-3d}.surface{position:absolute;top:0;height:812px;transition:transform .62s cubic-bezier(.2,.82,.2,1),opacity .35s ease,filter .4s ease;transform-style:preserve-3d}.surface-cover{position:absolute;z-index:30;inset:0;border:0;background:transparent;cursor:pointer}.panel.focus-phone .phone-surface .surface-cover,.panel.focus-timetable .timetable-surface .surface-cover{display:none}.phone-surface{left:700px;width:430px;transform:translateX(-38px) rotateY(-18deg) scale(.88);transform-origin:left center}.timetable-surface{left:20px;width:720px;transform:translateX(22px) rotateY(15deg) scale(.9);transform-origin:right center}.panel.focus-phone .phone-surface{z-index:12;transform:translateX(-350px) rotateY(0) scale(1)}.panel.focus-phone .timetable-surface{z-index:5;transform:translateX(-70px) rotateY(35deg) scale(.72);opacity:.58;filter:saturate(.65)}.panel.focus-timetable .timetable-surface{z-index:12;transform:translateX(195px) rotateY(0) scale(1)}.panel.focus-timetable .phone-surface{z-index:5;transform:translateX(135px) rotateY(-38deg) scale(.72);opacity:.58;filter:saturate(.65)}.phone-wrap{position:absolute;z-index:4;left:0;top:0;width:430px;height:812px;border:1px solid rgba(221,184,255,.42);border-radius:38px;background:#05070f;box-shadow:0 32px 110px rgba(0,0,0,.72),0 0 0 6px rgba(17,12,30,.72);overflow:hidden;isolation:isolate}.phone-wrap:after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);pointer-events:none;z-index:8}.phone{display:block;width:430px;height:812px;border:0;background:transparent}.surface-switch{position:absolute;z-index:50;left:50%;bottom:14px;translate:-50% 0;border:3px solid #191713;border-radius:4px;background:#fffaf0;color:#1e1c18;box-shadow:5px 5px 0 #ef5d50;padding:10px 18px;font:900 14px/1.1 'Noto Sans SC',system-ui;cursor:pointer;transform:rotate(-1deg)}.surface-switch:hover{transform:rotate(1deg) translateY(-2px)}",
        ".timetable-wrap{position:absolute;inset:0;border:4px solid #24201a;border-radius:18px;background:#fffaf0;color:#29251f;box-shadow:12px 16px 0 rgba(23,20,16,.28);overflow:hidden;font-family:'Klee One','Hiragino Maru Gothic ProN','Noto Sans SC',cursive}.timetable-paper{height:100%;padding:20px 18px 16px;background-image:repeating-linear-gradient(0deg,transparent 0 29px,rgba(80,135,180,.12) 30px)}.tt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px}.tt-title{margin:0;font:900 30px/1 cursive;letter-spacing:.08em;transform:rotate(-1deg)}.tt-date{padding:6px 10px;border:2px dashed #225c91;background:#eef8ff;font-weight:800;transform:rotate(1deg)}.tt-rhythm{display:flex;gap:7px;overflow:auto;padding:3px 2px 10px}.tt-rhythm span{flex:0 0 auto;padding:5px 9px;border:2px solid #29251f;border-radius:50% 42% 48% 44%;background:#fff;box-shadow:2px 3px 0 #f2b24f;font-size:12px;font-weight:800}.tt-layout{display:grid;grid-template-columns:minmax(0,1fr) 150px 190px;gap:10px;height:660px}.tt-week,.tt-today,.tt-user{min-width:0;border:3px solid #29251f;background:rgba(255,255,255,.86);overflow:auto}.tt-week{display:grid;grid-template-columns:58px repeat(5,minmax(82px,1fr));grid-auto-rows:minmax(62px,auto)}.tt-cell{position:relative;border-right:1px dashed #6b6358;border-bottom:1px dashed #6b6358;padding:7px 6px;background:transparent;text-align:left;font:700 12px/1.3 inherit}.tt-cell.head{position:sticky;top:0;z-index:3;background:#fffaf0;text-align:center;font-weight:900}.tt-cell.today{background:#fff0a8}.tt-cell.period{background:#f1eee8;text-align:center;font-weight:900}.tt-cell.modified{background:#ffd9d2}.tt-cell button{width:100%;border:0;background:transparent;text-align:left;font:inherit;cursor:pointer}.tt-side-title{position:sticky;top:0;z-index:3;margin:0;padding:8px;background:#29251f;color:white;text-align:center;font:900 14px/1.2 inherit}.tt-today-list,.tt-action-list{display:grid;gap:7px;padding:8px}.tt-note{padding:8px;border:2px solid #29251f;background:#fffaf0;box-shadow:3px 3px 0 #7ab6d8;font-size:12px}.tt-slot{min-height:70px;padding:8px;border:2px dashed #29251f;background:#fff;box-shadow:3px 3px 0 #f2b24f}.tt-slot.locked{opacity:.5;background:#ddd8cf}.tt-slot.sent{background:#dcebd9}.tt-slot strong{display:block;font-size:12px}.tt-slot small{display:block;margin-top:4px;color:#645b50}.tt-free,.tt-hypnosis{margin:8px;padding:8px;border:2px solid #29251f;background:#eaf7ff;box-shadow:3px 3px 0 #6ea9cc}.tt-free small{display:block;margin-top:4px}.tt-free button{width:100%;margin-top:7px;border:2px solid #29251f;background:#fffaf0;box-shadow:2px 2px 0 #6ea9cc;padding:6px 4px;font:900 11px/1.2 inherit;cursor:pointer}.tt-hypnosis{background:#f7eaff;cursor:grab}.tt-actions{display:flex;gap:8px;align-items:center;padding:8px}.tt-actions button,.tt-actions select{border:2px solid #29251f;background:#fffaf0;padding:7px;font:800 12px/1 inherit}.tt-actions button{box-shadow:3px 3px 0 #ef5d50;cursor:pointer}.tt-empty{padding:14px;color:#6a6258;text-align:center;font-size:12px}@media(prefers-reduced-motion:reduce){.surface{transition:none!important}}",
        ".location-rule-radar{position:absolute;left:50%;top:-112px;width:min(230px,62%);height:160px;object-fit:contain;object-position:center bottom;pointer-events:none;user-select:none;-webkit-user-drag:none;opacity:0;transform:translate3d(-50%,-142px,0) rotate(-5deg) scale(.86);transform-origin:50% 86%;transition:transform .7s cubic-bezier(.16,.92,.2,1.12),opacity .24s ease;will-change:transform,opacity}.location-rule-radar.rear{z-index:3;filter:drop-shadow(0 19px 15px rgba(0,0,0,.64))}.location-rule-radar.front{z-index:6;clip-path:inset(70% 0 0 0);filter:drop-shadow(0 7px 5px rgba(0,0,0,.78))}.panel.location-rule-radar-visible .location-rule-radar{opacity:1;transform:translate3d(-50%,0,0) rotate(0) scale(1)}.panel.location-rule-radar-hiding .location-rule-radar{opacity:0;transform:translate3d(-50%,-154px,0) rotate(4deg) scale(.82);transition-duration:.52s,.2s}@media(max-width:760px){.location-rule-radar{top:-96px;width:min(202px,68%);height:140px}}",
        ".map-extra-chain-host{position:absolute;z-index:7;right:calc(100% - 18px);top:118px;width:176px;display:none;pointer-events:none;filter:drop-shadow(0 18px 16px rgba(0,0,0,.65));font-family:Impact,'Arial Black','Noto Sans SC',sans-serif;user-select:none}.panel.map-extra-chain-visible .map-extra-chain-host{display:block}.map-extra-chain{display:grid;gap:5px;pointer-events:auto}.map-extra-chain__head{justify-self:end;max-width:160px;padding:7px 9px 7px 12px;border:3px solid #080808;background:#f3eee4;color:#080808;box-shadow:5px 5px 0 #ed1831;font:950 12px/1.1 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.04em;transform:rotate(-2deg);clip-path:polygon(4% 0,100% 5%,94% 100%,0 88%);display:flex;align-items:center;gap:8px}.map-extra-chain__head strong{min-width:0}.map-extra-chain__head button{flex:0 0 27px;width:27px;height:27px;border:2px solid #080808;background:#ed1831;color:#fff;font:950 18px/1 Impact,sans-serif;cursor:pointer;box-shadow:2px 2px 0 #080808}.map-extra-chain__belt{display:grid;gap:2px}.map-extra-chain__row{position:relative;width:160px;margin-left:auto}.map-extra-chain__item{position:relative;width:160px;min-height:47px;border:3px solid #080808;background:#f3eee4;color:#080808;padding:7px 25px 7px 13px;text-align:left;cursor:pointer;pointer-events:auto;box-shadow:5px 4px 0 #ed1831;clip-path:polygon(0 8%,92% 0,100% 48%,92% 100%,0 92%,7% 50%);font:950 12px/1.2 'Arial Black','Noto Sans SC',sans-serif;white-space:normal;overflow-wrap:anywhere;transition:translate .16s ease,filter .16s ease}.map-extra-chain__item:before{content:'';position:absolute;right:9px;top:50%;width:9px;height:9px;border:3px solid #080808;border-radius:50%;background:#ed1831;transform:translateY(-50%)}.map-extra-chain__row:after{content:'';position:absolute;right:12px;top:calc(100% - 1px);width:3px;height:9px;background:#080808}.map-extra-chain__row:last-child:after{display:none}.map-extra-chain__item:hover,.map-extra-chain__item.active{translate:-9px 0;filter:brightness(1.08)}.map-extra-chain__item.active{background:#ed1831;color:#fff;box-shadow:5px 4px 0 #f3eee4}.map-extra-chain__item.favorite{padding-left:29px}.map-extra-chain__item.favorite span:before{content:'★';position:absolute;left:11px;color:#ed1831}.map-extra-chain__delete{position:absolute;z-index:3;right:7px;top:50%;width:25px;height:25px;border:2px solid #080808;background:#ed1831;color:#fff;box-shadow:2px 2px 0 #080808;font:950 17px/1 Impact,sans-serif;cursor:pointer;pointer-events:auto;transform:translateY(-50%) rotate(2deg)}.map-extra-chain__row.deletable .map-extra-chain__item{padding-right:37px}.map-extra-chain__row.deletable .map-extra-chain__item:before{display:none}.map-extra-chain__delete:hover{filter:brightness(1.1);transform:translateY(-50%) rotate(-3deg) scale(1.06)}.map-extra-chain__pager{justify-self:end;display:flex;align-items:center;gap:5px;margin-top:4px;pointer-events:auto}.map-extra-chain__pager button{width:34px;height:30px;border:3px solid #080808;background:#f3eee4;color:#080808;box-shadow:3px 3px 0 #ed1831;font:950 15px/1 Impact,sans-serif;cursor:pointer}.map-extra-chain__pager button:disabled{opacity:.32;cursor:default}.map-extra-chain__pager span{padding:5px 8px;background:#080808;color:#fff;font:950 10px/1 Impact,sans-serif;letter-spacing:.08em}@media(max-width:760px){.map-extra-chain-host{right:calc(100% - 14px);top:112px;width:148px}.map-extra-chain__head,.map-extra-chain__row,.map-extra-chain__item{max-width:136px}.map-extra-chain__item{font-size:10px;min-height:42px}}",
        ".hypnosis-judgement-perch{position:absolute;inset:0;display:none;pointer-events:none;user-select:none;-webkit-user-drag:none}.panel.hypnosis-perch-visible:not(.profile-possession-visible) .hypnosis-judgement-perch{display:block}.hypnosis-judgement-figure{position:absolute;top:76px;bottom:58px;width:152px;pointer-events:none}.hypnosis-judgement-figure.is-demon{right:calc(100% - 14px)}.hypnosis-judgement-figure.is-angel{left:calc(100% - 14px)}.hypnosis-judgement-figure img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}.hypnosis-judgement-figure.is-demon img{object-position:right center}.hypnosis-judgement-figure.is-angel img{object-position:left center}.hypnosis-judgement-figure__rear{z-index:3;filter:drop-shadow(0 18px 13px rgba(0,0,0,.66)) saturate(.86) contrast(1.08)}.hypnosis-judgement-figure__front{z-index:7;filter:drop-shadow(0 5px 3px rgba(0,0,0,.78)) saturate(.9) contrast(1.12)}.hypnosis-judgement-figure.is-demon .hypnosis-judgement-figure__front{clip-path:inset(0 0 0 79%)}.hypnosis-judgement-figure.is-angel .hypnosis-judgement-figure__front{clip-path:inset(0 79% 0 0)}@media(max-width:760px){.hypnosis-judgement-figure{top:92px;bottom:72px;width:118px}.hypnosis-judgement-figure.is-demon{right:calc(100% - 11px)}.hypnosis-judgement-figure.is-angel{left:calc(100% - 11px)}}",
        ".profile-neighbor-host{position:absolute;z-index:2;inset:0;pointer-events:none}.profile-neighbor-rail{--rail-red:#ed1831;position:absolute;top:25%;width:114px;height:48%;min-height:270px;padding:0;border:3px solid #080808;background:#f4efe6;color:#080808;box-shadow:7px 8px 0 var(--rail-red),0 20px 34px rgba(0,0,0,.5);overflow:hidden;cursor:pointer;pointer-events:auto;display:none;isolation:isolate;touch-action:manipulation;transition:transform .28s cubic-bezier(.2,.85,.25,1),filter .2s ease}.panel.profile-neighbors .profile-neighbor-rail{display:block}.profile-neighbor-rail.prev{right:calc(100% - 42px);transform:perspective(420px) rotateY(18deg) rotate(-2deg);clip-path:polygon(0 4%,100% 0,95% 100%,6% 95%)}.profile-neighbor-rail.next{left:calc(100% - 42px);transform:perspective(420px) rotateY(-18deg) rotate(2deg);clip-path:polygon(5% 0,100% 4%,94% 95%,0 100%)}.profile-neighbor-rail:before{content:attr(data-kicker);position:absolute;z-index:3;top:10px;padding:5px 9px;background:#080808;color:#fff;font:950 10px/1 Impact,'Arial Black',sans-serif;letter-spacing:.12em}.profile-neighbor-rail.prev:before{left:8px}.profile-neighbor-rail.next:before{right:8px}.profile-neighbor-rail img,.profile-neighbor-rail__empty{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center 18%;background:#d7d1c8;filter:saturate(.72) contrast(1.08)}.profile-neighbor-rail__empty{display:grid;place-items:center;font:950 38px/1 Impact,sans-serif}.profile-neighbor-rail strong{position:absolute;z-index:3;left:7px;right:7px;bottom:12px;padding:6px 5px;background:#080808;color:#fff;font:950 11px/1.2 'Arial Black','Noto Sans SC',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:3px 3px 0 var(--rail-red)}.profile-neighbor-rail:hover{filter:brightness(1.06)}.profile-neighbor-rail.prev:hover{transform:translateX(-8px) perspective(420px) rotateY(10deg) rotate(-1deg)}.profile-neighbor-rail.next:hover{transform:translateX(8px) perspective(420px) rotateY(-10deg) rotate(1deg)}.panel.profile-neighbors .sidecar{left:calc(100% + 88px)}.panel.profile-turning-prev .profile-neighbor-rail.prev{transform:translateX(26px) scale(1.08) perspective(420px) rotateY(-4deg) rotate(3deg)}.panel.profile-turning-prev .profile-neighbor-rail.next{transform:translateX(8px) scale(.96) perspective(420px) rotateY(-22deg) rotate(2deg)}.panel.profile-turning-next .profile-neighbor-rail.next{transform:translateX(-26px) scale(1.08) perspective(420px) rotateY(4deg) rotate(-3deg)}.panel.profile-turning-next .profile-neighbor-rail.prev{transform:translateX(-8px) scale(.96) perspective(420px) rotateY(22deg) rotate(-2deg)}",
        ".profile-possession-host,.encounter-possession-decor-host{position:absolute;z-index:9;left:50%;top:-88px;width:calc(100% + 34px);height:150px;transform:translateX(-50%) rotate(-.5deg);display:none;pointer-events:none;overflow:visible}.encounter-possession-decor-host[hidden]{display:none!important}.panel.profile-possession-visible .profile-possession-host{display:block}.panel.encounter-possession-decor-visible:not(.profile-possession-visible) .encounter-possession-decor-host:not([hidden]){display:block}.encounter-possession-decor-host img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;clip-path:inset(0 0 18% 0);filter:grayscale(.2) saturate(.82) blur(.55px) drop-shadow(0 8px 8px rgba(0,0,0,.5));opacity:.82;transform:translate(2px,-1px)}.encounter-possession-decor-host:after{content:'';position:absolute;inset:0;background:url('" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "') center/contain no-repeat;clip-path:inset(0 0 18% 0);opacity:.14;filter:blur(4px);transform:translate(-5px,-1px)}.profile-possession-grip{position:absolute;inset:0;border:0;padding:0;background:transparent;pointer-events:auto;cursor:pointer;touch-action:manipulation;clip-path:inset(0 0 18% 0);filter:grayscale(.24) saturate(.76) blur(.7px);opacity:.6;transform:translate(2px,-1px);transition:transform .25s cubic-bezier(.2,.85,.22,1),filter .25s ease,opacity .25s ease}.profile-possession-grip img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}.profile-possession-grip:after{content:'';position:absolute;inset:0;background:url('" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "') center/contain no-repeat;opacity:.2;filter:blur(4px);transform:translate(-6px,-1px);pointer-events:none}.profile-possession-grip:hover{opacity:.8;filter:grayscale(.1) saturate(.9) blur(.35px);transform:translateY(2px) rotate(.25deg)}.profile-possession-grip:active{transform:translateY(4px) scale(.992)}.profile-possession-grip.active{opacity:1;filter:saturate(1.06) contrast(1.04);transform:none}.profile-possession-grip.active:after{opacity:.07;filter:blur(2px);transform:translate(-2px,-1px)}",
        ".encounter-detail-host{--ed-red:#ef1b2d;position:absolute;z-index:18;right:calc(100% + 16px);top:20px;width:500px;max-height:calc(100% - 40px);display:none;overflow:auto;pointer-events:auto;color:#fff;font-family:Impact,'Arial Black','Noto Sans SC',system-ui;filter:drop-shadow(0 28px 45px rgba(0,0,0,.5));scrollbar-width:thin;scrollbar-color:#ef1b2d #080808}.encounter-detail-host.open{display:block}.encounter-detail-host__frame{position:relative;min-height:620px;overflow:hidden;border:5px solid #080808;background:#f3eee4;clip-path:polygon(3% 0,100% 3%,97% 94%,86% 91%,79% 100%,4% 96%,0 12%);isolation:isolate}.encounter-detail-host__frame:before{content:'';position:absolute;inset:-20%;z-index:-3;background:repeating-linear-gradient(113deg,transparent 0 22px,rgba(0,0,0,.08) 23px 25px),radial-gradient(circle at 18% 22%,#ef1b2d 0 3%,transparent 3.3%),linear-gradient(145deg,#eee7dc 0 38%,#d9d1c6 38% 45%,#f7f3ea 45% 100%)}.encounter-detail-host__frame:after{content:'';position:absolute;z-index:-2;left:-18%;right:16%;bottom:-22%;height:66%;background:#080808;transform:rotate(-8deg);clip-path:polygon(0 12%,100% 0,86% 100%,8% 84%)}.encounter-detail-host__close{position:absolute;z-index:8;right:18px;top:18px;width:46px;height:42px;border:4px solid #080808;background:#ef1b2d;color:#fff;font:950 24px/1 Impact,'Arial Black',sans-serif;transform:rotate(3deg);cursor:pointer;box-shadow:6px 6px 0 #080808}.encounter-detail-host__kicker{display:inline-block;margin:28px 0 0 26px;padding:5px 18px;background:#080808;color:#fff;font:950 14px/1 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.12em;transform:rotate(-3deg);clip-path:polygon(4% 0,100% 8%,94% 100%,0 84%)}.encounter-detail-host__name{position:relative;z-index:2;margin:10px 58px 0 24px;color:#080808;font:950 clamp(30px,4vw,54px)/.92 Impact,'Arial Black','Noto Sans SC',sans-serif;letter-spacing:.02em;text-transform:uppercase;transform:rotate(-2deg);text-shadow:3px 3px 0 #fff,6px 6px 0 #ef1b2d;overflow-wrap:anywhere}.encounter-detail-host__alias{display:inline-block;margin:10px 0 0 32px;padding:5px 13px;background:#ef1b2d;color:#fff;font:900 13px/1.2 system-ui;transform:rotate(1deg)}.encounter-detail-host__visual{position:relative;height:285px;margin:8px 18px 0;overflow:hidden;clip-path:polygon(3% 8%,94% 0,100% 88%,8% 100%,0 55%);background:#080808}.encounter-detail-host__visual img{width:100%;height:100%;display:block;object-fit:cover;object-position:center 18%;filter:saturate(.8) contrast(1.14)}.encounter-detail-host__visual:after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,rgba(239,27,45,.45),transparent 34%,transparent 70%,rgba(0,0,0,.5)),repeating-linear-gradient(0deg,transparent 0 4px,rgba(255,255,255,.07) 5px);mix-blend-mode:screen;pointer-events:none}.encounter-detail-host__source{position:absolute;z-index:4;right:16px;bottom:18px;max-width:70%;padding:7px 13px;background:#fff;color:#080808;border:3px solid #080808;font:950 12px/1.2 system-ui;transform:rotate(-2deg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.encounter-detail-host__body{position:relative;z-index:3;margin:-18px 26px 30px;padding:22px 18px 18px;background:#ef1b2d;color:#fff;clip-path:polygon(0 7%,100% 0,96% 100%,5% 94%);transform:rotate(.5deg)}.encounter-detail-host__intro{margin:0 0 13px;font:750 13px/1.65 system-ui;white-space:pre-wrap}.encounter-detail-host__facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.encounter-detail-host__fact{min-width:0;padding:8px 9px;background:#080808;color:#fff;transform:skew(-4deg)}.encounter-detail-host__fact span{display:block;color:#ff9aa4;font:850 9px/1.2 system-ui;letter-spacing:.08em}.encounter-detail-host__fact strong{display:block;margin-top:3px;font:850 12px/1.3 system-ui;overflow-wrap:anywhere}.encounter-detail-host__thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 27px 28px}.encounter-detail-host__thumbs img{width:100%;aspect-ratio:1/1;object-fit:cover;border:3px solid #080808;background:#ddd;transform:rotate(var(--thumb-tilt,0deg))}.encounter-detail-host__empty{display:grid;height:100%;place-items:center;color:#fff;font:950 54px/1 Impact,sans-serif;background:repeating-linear-gradient(135deg,#080808 0 18px,#ef1b2d 19px 34px)}",
        ".encounter-detail-host{padding:6px 0 16px;overscroll-behavior:contain}.encounter-detail-host__frame{clip-path:polygon(1% 0,100% 1%,99% 98%,87% 97%,82% 100%,1% 99%,0 4%);padding-bottom:30px}.encounter-detail-host__body{margin:-10px 24px 22px;padding:34px 20px 30px;clip-path:polygon(0 2%,100% 0,98% 100%,2% 98%);transform:none}.encounter-detail-host__thumbs{margin-bottom:8px;padding-bottom:8px}",
        ".sidecar{position:absolute;z-index:12;left:calc(100% + 14px);top:12px;width:var(--floor-sidecar-width);display:grid;grid-template-columns:minmax(0,1fr);justify-items:start;gap:8px;opacity:0;visibility:hidden;pointer-events:none;transform-origin:0 0;transition:opacity .24s ease}.panel.focus-phone .sidecar{left:calc(var(--phone-face-width) + 8px);opacity:1;visibility:visible;transform:scale(var(--stage-scale))}.panel:not(.focus-phone) .sidecar>*{pointer-events:none!important}",
        ".readonly{position:static;z-index:13;width:100%;padding:8px 10px;border-radius:13px;background:rgba(39,25,12,.72);border:1px solid rgba(251,191,36,.38);color:#fde68a;font:800 10px/1.35 system-ui;pointer-events:none;display:none;backdrop-filter:blur(10px)}.panel.history .readonly{display:block}",
        ".drag-edge{position:absolute;z-index:9;touch-action:none;user-select:none}.drag-edge.top{left:22px;right:22px;top:0;height:10px;cursor:grab}.drag-edge.bottom{left:22px;right:22px;bottom:0;height:10px;cursor:grab}.drag-edge.left{left:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge.right{right:0;top:22px;bottom:22px;width:10px;cursor:grab}.drag-edge:active,.drag-grip:active{cursor:grabbing}",
        ".drag-grip{position:absolute;z-index:10;left:50%;top:4px;width:72px;height:12px;transform:translateX(-50%);border-radius:999px;cursor:grab;touch-action:none;user-select:none}",
        ".floor-toggle,.galgame-toggle,.variable-format-toggle,.pet-character-toggle{position:static;z-index:14;width:128px;min-width:128px;height:36px;padding:0 12px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;pointer-events:auto;backdrop-filter:blur(12px);font:800 11px/1 system-ui;white-space:nowrap;word-break:keep-all;overflow-wrap:normal;writing-mode:horizontal-tb;text-align:center;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.18)}",
        ".floor-toggle{border:1px solid rgba(224,188,255,.38);background:rgba(11,8,26,.38);color:#f7eafe}",
        ".galgame-toggle{border:1px solid rgba(148,163,184,.34);background:rgba(11,8,26,.38);color:#cbd5e1}.galgame-toggle.enabled{border-color:rgba(52,211,153,.5);background:rgba(6,78,59,.34);color:#a7f3d0}.galgame-toggle.disabled{border-color:rgba(251,113,133,.36);background:rgba(76,5,25,.3);color:#fecdd3}.galgame-toggle.busy,.galgame-toggle:disabled{cursor:wait;opacity:.72}",
        ".variable-format-toggle{border:1px solid rgba(94,234,212,.34);background:rgba(4,47,46,.34);color:#99f6e4}.variable-format-toggle.warn{border-color:rgba(251,113,133,.68);background:rgba(127,29,29,.54);color:#ffe4e6;box-shadow:0 0 0 2px rgba(251,113,133,.14),0 8px 22px rgba(0,0,0,.22)}.variable-format-toggle.missing{border-color:rgba(251,191,36,.48);background:rgba(120,53,15,.42);color:#fde68a}",
        ".pet-character-toggle{border:1px solid rgba(192,132,252,.48);background:linear-gradient(135deg,rgba(88,28,135,.48),rgba(30,41,59,.56));color:#f3e8ff}.pet-character-toggle:hover{border-color:rgba(216,180,254,.72);background:linear-gradient(135deg,rgba(107,33,168,.62),rgba(30,41,59,.68))}.pet-character-toggle:disabled{cursor:wait;opacity:.62}",
        ".resource-panel{width:128px;display:grid;gap:5px;pointer-events:none}.resource-row{min-width:0;height:28px;padding:0 9px;border:1px solid rgba(148,163,184,.27);border-radius:10px;background:rgba(11,8,26,.42);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;gap:6px;color:#dbeafe;font:750 9px/1 system-ui;box-shadow:0 6px 18px rgba(0,0,0,.14)}.resource-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.resource-row strong{flex:0 0 auto;color:#fff;font:900 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.resource-row.money{border-color:rgba(251,191,36,.32);color:#fde68a}.resource-row.starlight{border-color:rgba(244,114,182,.32);color:#fbcfe8}.resource-row.energy{border-color:rgba(56,189,248,.32);color:#bae6fd}.resource-panel.loading .resource-row strong{opacity:.55}",
        ".variable-format-dialog{position:absolute;z-index:31;inset:0;display:none;place-items:center;padding:22px;background:rgba(2,3,10,.7);backdrop-filter:blur(8px);pointer-events:auto}.variable-format-dialog.open{display:grid}.variable-format-dialog__card{width:min(350px,calc(100% - 18px));max-height:calc(100% - 24px);overflow:auto;padding:19px;border:1px solid rgba(94,234,212,.38);border-radius:20px;background:linear-gradient(150deg,rgba(4,47,46,.98),rgba(10,14,31,.99) 66%);box-shadow:0 24px 70px rgba(0,0,0,.6);color:#ecfeff;font-family:system-ui}.variable-format-dialog__card.warn{border-color:rgba(251,113,133,.56);background:linear-gradient(150deg,rgba(76,5,25,.98),rgba(10,14,31,.99) 66%)}.variable-format-dialog__card strong{display:block;font:850 18px/1.3 system-ui}.variable-format-dialog__card p{margin:10px 0;color:rgba(236,254,255,.8);font:650 12px/1.6 system-ui;white-space:pre-wrap;overflow-wrap:anywhere}.variable-format-dialog__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.variable-format-dialog__actions button{height:40px;border:1px solid rgba(153,246,228,.34);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font:800 12px system-ui;cursor:pointer}.variable-format-dialog__actions button[data-variable-format-repair]{border-color:rgba(251,113,133,.48);background:rgba(159,18,57,.28)}.variable-format-dialog__actions button:disabled{opacity:.45;cursor:not-allowed}",
        ".galgame-dialog{position:absolute;z-index:30;inset:0;display:none;place-items:center;padding:22px;background:rgba(2,3,10,.64);backdrop-filter:blur(8px);pointer-events:auto}.galgame-dialog.open{display:grid}.galgame-dialog__card{width:min(340px,calc(100% - 20px));padding:20px;border:1px solid rgba(110,231,183,.36);border-radius:22px;background:linear-gradient(145deg,rgba(6,78,59,.96),rgba(10,14,31,.98) 68%);box-shadow:0 24px 70px rgba(0,0,0,.58);color:#ecfdf5;font-family:system-ui}.galgame-dialog.is-error .galgame-dialog__card{border-color:rgba(251,113,133,.46);background:linear-gradient(145deg,rgba(76,5,25,.96),rgba(10,14,31,.98) 68%)}.galgame-dialog__card strong{display:block;font:850 18px/1.3 system-ui}.galgame-dialog__card p{margin:12px 0 18px;color:rgba(236,253,245,.82);font:650 13px/1.65 system-ui;white-space:pre-wrap}.galgame-dialog__card button{width:100%;height:40px;border:1px solid rgba(167,243,208,.38);border-radius:13px;background:rgba(255,255,255,.1);color:#fff;font:800 13px system-ui;cursor:pointer}",
        ".floor-drawer{position:static;z-index:12;width:100%;display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:0;border:0;border-radius:17px;background:transparent;backdrop-filter:none;box-shadow:none;color:#f8efff;pointer-events:auto}",
        ".floor-drawer.open{display:grid}.floor-title{grid-column:1/2;align-self:center;overflow:hidden;color:#d9cbe4;font:750 11px/1.2 system-ui;text-overflow:ellipsis;white-space:nowrap}",
        ".select{grid-column:1/-1;width:100%;height:38px;border:1px solid rgba(201,155,232,.34);border-radius:11px;background:rgba(24,21,43,.72);backdrop-filter:blur(10px);color:#f7effc;padding:0 31px 0 10px;font:700 11px system-ui}",
        ".mode{height:32px;padding:0 10px;border:1px solid rgba(201,155,232,.34);border-radius:10px;background:rgba(24,21,43,.5);backdrop-filter:blur(10px);color:#efe4f8;font:750 10px system-ui;cursor:pointer}",
        ".badge{grid-column:1/-1;min-height:28px;padding:6px 9px;border-radius:9px;display:flex;align-items:center;background:rgba(19,78,59,.32);backdrop-filter:blur(10px);border:1px solid rgba(51,211,153,.32);color:#a7f3d0;font:800 10px/1.25 system-ui}.badge.history{background:rgba(76,48,13,.34);border-color:rgba(251,191,36,.3);color:#fde68a}",
        "@media(max-width:980px){.encounter-detail-host{position:fixed;left:8px;right:auto;top:8px;width:min(440px,calc(100vw - 16px));max-height:calc(100vh - 16px)}}",
        "@media(max-width:760px){.panel{--floor-sidecar-width:clamp(104px,28vw,220px);width:min(430px,calc(100vw - var(--floor-sidecar-width) - 30px))}.profile-neighbor-rail{width:84px;min-height:220px}.profile-neighbor-rail.prev{right:calc(100% - 34px)}.profile-neighbor-rail.next{left:calc(100% - 34px)}.panel.profile-neighbors .sidecar{left:calc(100% + 58px)}.sidecar{left:calc(100% + 10px)}.floor-toggle,.galgame-toggle,.variable-format-toggle,.pet-character-toggle,.resource-panel{width:min(128px,100%);min-width:0}.floor-toggle,.galgame-toggle,.variable-format-toggle,.pet-character-toggle{padding-inline:8px}.floor-drawer{grid-template-columns:minmax(0,1fr)}.floor-title,.mode,.select,.badge{grid-column:1/-1;width:100%}.encounter-detail-host__frame{min-height:560px}}"
      ].join("");
    }

    function hideEncounterDetail() {
      if (!encounterDetailHost) return;
      encounterDetailHost.classList.remove("open");
      encounterDetailHost.setAttribute("aria-hidden", "true");
      encounterDetailHost.innerHTML = "";
    }

    function updateProfileNeighbors(payload) {
      ensureShell();
      if (!panel || !profileNeighborHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var visible = Boolean(data && data.visible && data.prev && data.next);
      panel.classList.toggle("profile-neighbors", visible);
      ["prev", "next"].forEach(function (direction) {
        var button = profileNeighborHost.querySelector("[data-profile-neighbor='" + direction + "']");
        if (!button) return;
        var item = visible && data[direction] && typeof data[direction] === "object" ? data[direction] : {};
        var name = textId(item.name);
        var photo = textId(item.photo);
        var signature = name + "\u0001" + photo;
        button.setAttribute("aria-label", (direction === "prev" ? "上一个角色：" : "下一个角色：") + (name || "未命名角色"));
        if (button.dataset.signature === signature) return;
        button.dataset.signature = signature;
        button.innerHTML = (photo
          ? "<img alt='' decoding='async' src='" + escapeHtml(photo) + "'>"
          : "<span class='profile-neighbor-rail__empty' aria-hidden='true'>" + escapeHtml((name || "?").slice(0, 1)) + "</span>") +
          "<strong>" + escapeHtml(name || "未命名角色") + "</strong>";
      });
      if (visible) applySavedPosition();
      return visible;
    }

    function updateProfilePossession(payload) {
      ensureShell();
      if (!panel || !profilePossessionHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var roleName = textId(data && data.roleName);
      var visible = Boolean(data && data.visible && roleName);
      var active = Boolean(visible && data.active);
      var label = textId(data && data.label) || (active ? "解除附身" : "附身");
      panel.classList.toggle("profile-possession-visible", visible);
      var button = profilePossessionHost.querySelector("[data-profile-possession-host]");
      if (!button) return false;
      button.dataset.profilePossessionHost = visible ? roleName : "";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("aria-label", visible ? label + "：" + roleName : "附身");
      if (visible) applySavedPosition();
      return visible;
    }

    function updateEncounterPossessionDecor(payload) {
      ensureShell();
      if (!panel || !encounterPossessionDecorHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var roleName = textId(data && data.roleName);
      var visible = Boolean(data && data.visible && roleName);
      panel.classList.toggle("encounter-possession-decor-visible", visible);
      encounterPossessionDecorHost.hidden = !visible;
      encounterPossessionDecorHost.dataset.roleName = visible ? roleName : "";
      encounterPossessionDecorHost.setAttribute("aria-hidden", visible ? "false" : "true");
      if (visible) applySavedPosition();
      return visible;
    }

    function updateHypnosisPerch(payload) {
      ensureShell();
      if (!panel) return false;
      var visible = payload === true || Boolean(payload && typeof payload === "object" && payload.visible);
      panel.classList.toggle("hypnosis-perch-visible", visible);
      return visible;
    }

    function timetableSetFocus(next) {
      timetableFocus = next === "phone" || next === "timetable" ? next : "none";
      if (!panel) return;
      panel.classList.toggle("focus-phone", timetableFocus === "phone");
      panel.classList.toggle("focus-timetable", timetableFocus === "timetable");
      var button = panel.querySelector("[data-surface-switch]");
      if (button) button.textContent = timetableFocus === "phone" ? "⇄ 课程表" : timetableFocus === "timetable" ? "手机 ⇄" : "选择一面";
      applySavedPosition();
    }

    function timetableScheduleHtml(schedule) {
      var slots = Array.isArray(schedule && schedule.slots) ? schedule.slots : [];
      var free = Array.isArray(schedule && schedule.free) ? schedule.free : [];
      var looseHypnosis = (Array.isArray(schedule && schedule.hypnosis) ? schedule.hypnosis : []).filter(function (item) { return !item.slotId; });
      var freeCard = free.length ? "<div class='tt-free'><strong>免行动合并卡 · " + free.length + " 项</strong>" + free.map(function (item) { return "<small>• " + escapeHtml(item.title) + "</small>"; }).join("") + "<button type='button' data-execute-free>单独写入本轮（不占格）</button></div>" : "";
      var external = freeCard + looseHypnosis.map(function (item) {
        return "<div class='tt-hypnosis' draggable='true' data-hypnosis-id='" + escapeHtml(item.id) + "'>可拖拽附加 · " + escapeHtml(item.title) + "</div>";
      }).join("");
      var slotHtml = slots.map(function (slot) {
        var classes = ["tt-slot"];
        if (slot.locked) classes.push("locked");
        if (slot.sent) classes.push("sent");
        var entries = (slot.operations || []).map(function (item) { return "<small>• " + escapeHtml(item.title) + "</small>"; }).join("");
        var hypnosis = (slot.hypnosis || []).map(function (item) { return "<small>✦ " + escapeHtml(item.title) + "</small>"; }).join("");
        return "<div class='" + classes.join(" ") + "' data-schedule-slot='" + escapeHtml(slot.id) + "'><strong>" + escapeHtml(slot.label) + " · " + escapeHtml(slot.time) + "</strong>" + (entries || hypnosis ? entries + hypnosis : "<small>空白行动格</small>") + "</div>";
      }).join("");
      return external + "<div class='tt-action-list'>" + slotHtml + "</div><div class='tt-actions'><select data-advance-count>" + [1,2,3,4,5,6].map(function (n) { return "<option value='" + n + "'>推进 " + n + " 格</option>"; }).join("") + "</select><button type='button' data-advance>执行</button><button type='button' data-next-day>过日</button></div>";
    }

    function renderTimetableWindow() {
      if (!timetableHost) return false;
      var snapshot = phoneApi("__ST_HYPNOOS_TIMETABLE_SNAPSHOT__", [], true);
      if (!snapshot || typeof snapshot !== "object") {
        timetableHost.innerHTML = "<div class='timetable-paper'><p class='tt-empty'>课程表正在与当前楼同步……</p></div>";
        return false;
      }
      var days = Array.isArray(snapshot.days) ? snapshot.days : [];
      var cells = [];
      cells.push("<div class='tt-cell head'>時限</div>");
      days.forEach(function (day) { cells.push("<div class='tt-cell head" + (day.active ? " today" : "") + "'>" + escapeHtml(day.label) + "</div>"); });
      for (var period = 1; period <= 6; period += 1) {
        var reference = days[0] && days[0].cells && days[0].cells[period - 1];
        cells.push("<div class='tt-cell period'>" + period + "限<br><small>" + escapeHtml(reference && reference.time || "") + "</small></div>");
        days.forEach(function (day) {
          var cell = day.cells && day.cells[period - 1] || {};
          cells.push("<div class='tt-cell" + (day.active ? " today" : "") + (cell.modified ? " modified" : "") + "'><button type='button' data-course-day='" + day.day + "' data-course-period='" + period + "'" + (cell.editable ? "" : " disabled") + "><strong>" + escapeHtml(cell.subject || "自习") + "</strong><small>" + escapeHtml(cell.description || "") + "</small></button></div>");
        });
      }
      var today = days.find(function (day) { return day.active; });
      var todayList = snapshot.special && snapshot.special.blocksClass
        ? "<div class='tt-note'><strong>" + escapeHtml(snapshot.special.title || "休日") + "</strong><br>" + escapeHtml(snapshot.special.description || snapshot.special.detail || "今日无固定课程") + "</div>"
        : ((today && today.cells) || []).map(function (cell) { return "<div class='tt-note'><strong>" + escapeHtml(cell.label) + " · " + escapeHtml(cell.subject) + "</strong><br>" + escapeHtml(cell.time + "　" + (cell.description || "")) + "</div>"; }).join("");
      var editor = timetableEditorCell ? "<form class='tt-free' data-course-editor><strong>修改 " + escapeHtml(timetableEditorCell.label) + "</strong><input name='subject' value='" + escapeHtml(timetableEditorCell.subject) + "' aria-label='课程名'><textarea name='description' aria-label='课程描述'>" + escapeHtml(timetableEditorCell.description) + "</textarea><button type='submit'>写入课程表</button><button type='button' data-course-cancel>取消</button></form>" : "";
      timetableHost.innerHTML = "<div class='timetable-paper'><header class='tt-head'><h2 class='tt-title'>週間時間割</h2><span class='tt-date'>" + escapeHtml(snapshot.date + " · " + snapshot.weekday + " · " + snapshot.time) + "</span></header><div class='tt-rhythm'>" + (snapshot.rhythm || []).map(function (item) { return "<span>" + escapeHtml(item.label + " " + item.start + (item.end ? "–" + item.end : "")) + "</span>"; }).join("") + "</div>" + editor + "<div class='tt-layout'><div class='tt-week'>" + cells.join("") + "</div><section class='tt-today'><h3 class='tt-side-title'>本日</h3><div class='tt-today-list'>" + todayList + "</div></section><section class='tt-user'><h3 class='tt-side-title'>USER 日程 · " + escapeHtml(String(snapshot.actionSchedule && snapshot.actionSchedule.remaining || 0)) + " / 6</h3>" + timetableScheduleHtml(snapshot.actionSchedule || {}) + "</section></div></div>";
      return true;
    }

    function scheduleTimetableRefresh(delay) {
      if (timetableRefreshTimer) host.clearTimeout(timetableRefreshTimer);
      timetableRefreshTimer = host.setTimeout(function () { timetableRefreshTimer = 0; renderTimetableWindow(); }, Math.max(0, Number(delay) || 0));
    }

    function updateMapExtraChain(payload) {
      ensureShell();
      if (!panel || !mapExtraChainHost) return false;
      var data = payload && typeof payload === "object" ? payload : null;
      var visible = Boolean(data && data.visible);
      panel.classList.toggle("map-extra-chain-visible", visible);
      if (!visible) {
        mapExtraChainHost.innerHTML = "";
        mapExtraChainHost.setAttribute("aria-hidden", "true");
        return false;
      }
      var items = Array.isArray(data.items) ? data.items.slice(0, 6) : [];
      var page = Math.max(0, Number(data.page) || 0);
      var pageCount = Math.max(1, Number(data.pageCount) || 1);
      var itemHtml = items.map(function (item) {
        var id = textId(item && item.id);
        var label = textId(item && item.label) || id || "未命名地点";
        var classes = ["map-extra-chain__item"];
        if (item && item.active) classes.push("active");
        if (item && item.favorite) classes.push("favorite");
        var deletable = Boolean(item && item.deletable);
        return "<div class='map-extra-chain__row" + (deletable ? " deletable" : "") + "'>" +
          "<button type='button' class='" + classes.join(" ") + "' data-map-extra-id='" + escapeHtml(id) + "'><span>" + escapeHtml(label) + "</span></button>" +
          (deletable ? "<button type='button' class='map-extra-chain__delete' data-map-extra-delete='" + escapeHtml(id) + "' aria-label='删除新增地点'>×</button>" : "") +
        "</div>";
      }).join("");
      mapExtraChainHost.innerHTML =
        "<section class='map-extra-chain'>" +
          "<div class='map-extra-chain__head'><strong>" + escapeHtml(textId(data.title) || "更多区域") + "</strong>" + (data.canAdd ? "<button type='button' data-map-extra-add aria-label='新增地点'>＋</button>" : "") + "</div>" +
          "<div class='map-extra-chain__belt'>" + itemHtml + "</div>" +
          "<div class='map-extra-chain__pager'><button type='button' data-map-extra-page='prev' aria-label='上一页'" + (pageCount <= 1 ? " disabled" : "") + ">‹</button><span>" + (page + 1) + " / " + pageCount + "</span><button type='button' data-map-extra-page='next' aria-label='下一页'" + (pageCount <= 1 ? " disabled" : "") + ">›</button></div>" +
        "</section>";
      mapExtraChainHost.setAttribute("aria-hidden", "false");
      mapExtraChainHost.querySelectorAll("[data-map-extra-id]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_SELECT__", [button.getAttribute("data-map-extra-id") || ""], false);
        });
      });
      mapExtraChainHost.querySelectorAll("[data-map-extra-page]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_PAGE__", [button.getAttribute("data-map-extra-page") || "next"], false);
        });
      });
      mapExtraChainHost.querySelectorAll("[data-map-extra-delete]").forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          phoneApi("__ST_HYPNOOS_MAP_EXTRA_DELETE__", [button.getAttribute("data-map-extra-delete") || ""], false);
        });
      });
      mapExtraChainHost.querySelector("[data-map-extra-add]")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        phoneApi("__ST_HYPNOOS_MAP_EXTRA_ADD__", [], false);
      });
      applySavedPosition();
      return true;
    }

    function updateLocationRuleRadar(payload) {
      ensureShell();
      if (!panel) return false;
      var data = payload && typeof payload === "object" ? payload : {};
      var visible = Boolean(data.visible);
      var immediate = Boolean(data.immediate);
      if (locationRuleRadarTimer) {
        host.clearTimeout(locationRuleRadarTimer);
        locationRuleRadarTimer = 0;
      }
      if (visible) {
        panel.classList.remove("location-rule-radar-hiding");
        panel.classList.remove("location-rule-radar-visible");
        host.requestAnimationFrame(function () {
          if (panel) panel.classList.add("location-rule-radar-visible");
        });
        applySavedPosition();
        return true;
      }
      panel.classList.remove("location-rule-radar-visible");
      if (immediate) {
        panel.classList.remove("location-rule-radar-hiding");
        return false;
      }
      panel.classList.add("location-rule-radar-hiding");
      locationRuleRadarTimer = host.setTimeout(function () {
        locationRuleRadarTimer = 0;
        if (panel) panel.classList.remove("location-rule-radar-hiding");
      }, 560);
      return false;
    }

    function showEncounterDetail(payload) {
      ensureShell();
      if (!encounterDetailHost) return false;
      var data = payload && typeof payload === "object" ? payload : {};
      var name = textId(data.name) || "未命名角色";
      var alias = textId(data.alias);
      var source = textId(data.source) || "角色库";
      var intro = textId(data.intro) || "暂无角色介绍。";
      var images = Array.isArray(data.images) ? data.images.map(textId).filter(Boolean).slice(0, 4) : [];
      var facts = Array.isArray(data.facts) ? data.facts.filter(function (item) {
        return item && typeof item === "object" && textId(item.value);
      }).slice(0, 10) : [];
      var hero = images[0]
        ? "<img src='" + escapeHtml(images[0]) + "' alt='" + escapeHtml(name) + "'>"
        : "<span class='encounter-detail-host__empty'>" + escapeHtml(name.slice(0, 1)) + "</span>";
      var factHtml = facts.map(function (item) {
        return "<div class='encounter-detail-host__fact'><span>" + escapeHtml(textId(item.label) || "资料") + "</span><strong>" + escapeHtml(textId(item.value)) + "</strong></div>";
      }).join("");
      var thumbs = images.length > 1
        ? "<div class='encounter-detail-host__thumbs'>" + images.map(function (image, index) {
            return "<img src='" + escapeHtml(image) + "' alt='" + escapeHtml(name + " 图片" + (index + 1)) + "' style='--thumb-tilt:" + (index % 2 ? "2deg" : "-2deg") + "'>";
          }).join("") + "</div>"
        : "";
      encounterDetailHost.innerHTML =
        "<section class='encounter-detail-host__frame' role='dialog' aria-modal='false' aria-label='" + escapeHtml(name + " 详情") + "'>" +
          "<button class='encounter-detail-host__close' type='button' aria-label='关闭角色详情'>×</button>" +
          "<span class='encounter-detail-host__kicker'>PERSONA FILE</span>" +
          "<h2 class='encounter-detail-host__name'>" + escapeHtml(name) + "</h2>" +
          (alias ? "<span class='encounter-detail-host__alias'>" + escapeHtml(alias) + "</span>" : "") +
          "<div class='encounter-detail-host__visual'>" + hero + "<span class='encounter-detail-host__source'>" + escapeHtml(source) + "</span></div>" +
          "<div class='encounter-detail-host__body'><p class='encounter-detail-host__intro'>" + escapeHtml(intro) + "</p><div class='encounter-detail-host__facts'>" + factHtml + "</div></div>" +
          thumbs +
        "</section>";
      encounterDetailHost.scrollTop = 0;
      encounterDetailHost.querySelector(".encounter-detail-host__close")?.addEventListener("click", hideEncounterDetail);
      encounterDetailHost.classList.add("open");
      encounterDetailHost.setAttribute("aria-hidden", "false");
      if (panel && host.innerWidth > 980) {
        var desiredWidth = Math.max(320, Math.min(520, host.innerWidth - panel.offsetWidth - panelSidecarReserve(panel.offsetWidth) - 44));
        encounterDetailHost.style.width = desiredWidth + "px";
        var rect = panel.getBoundingClientRect();
        if (rect.left < desiredWidth + 24) {
          var next = clampPosition(desiredWidth + 24, rect.top);
          panel.style.left = next.x + "px";
          panel.style.top = next.y + "px";
        }
      } else {
        encounterDetailHost.style.removeProperty("width");
      }
      return true;
    }

    function bridgePrelude() {
      var asset = JSON.stringify(config.assetBase);
      return "<script>(function(){var r=parent.__ST_HYPNOOS_FLOATING_SINGLETON__;window.__ST_HYPNOOS_FLOATING_PHONE__=true;window.__ST_HYPNOOS_FLOATING_REGISTRY__=r;window.__ST_HYPNOOS_ASSET_BASE__=" + asset + ";" +
        "function option(o){return r.normalizeMessageOption(o)}function writeOption(o){return r.normalizeWriteMessageOption(o)}" +
        "globalThis.getCurrentMessageId=function(){return r.getSelectedId()};" +
        "globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__=function(){if(r.isWritable())return true;r.notifyReadOnly();return false};" +
        "if(r.hasApi('getVariables'))globalThis.getVariables=function(o){return r.readApi('getVariables',[option(o)])};" +
        "if(r.hasApi('updateVariablesWith'))globalThis.updateVariablesWith=function(fn,o){return r.guardedApi('updateVariablesWith',[fn,writeOption(o)])};" +
        "if(r.hasApi('getChatMessages'))globalThis.getChatMessages=function(){return r.callApi('getChatMessages',Array.prototype.slice.call(arguments))||[]};" +
        "if(r.hasApi('setChatMessages'))globalThis.setChatMessages=function(){return r.guardedApi('setChatMessages',Array.prototype.slice.call(arguments))};" +
        "globalThis.getContext=function(){return r.getContext()};" +
        "globalThis.__ST_HYPNOOS_HOST_REQUEST_HEADERS__=function(){return r.getRequestHeaders()};" +
        "globalThis.__ST_HYPNOOS_UPDATE_PROFILE_NEIGHBORS__=function(p){return r.updateProfileNeighbors(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_PROFILE_POSSESSION__=function(p){return r.updateProfilePossession(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_ENCOUNTER_POSSESSION_DECOR__=function(p){return r.updateEncounterPossessionDecor(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_HYPNOSIS_PERCH__=function(p){return r.updateHypnosisPerch(p)};" +
        "globalThis.__ST_HYPNOOS_NOTIFY_TIMETABLE__=function(){return r.refreshTimetable()};" +
        "globalThis.__ST_HYPNOOS_UPDATE_MAP_EXTRA_CHAIN__=function(p){return r.updateMapExtraChain(p)};" +
        "globalThis.__ST_HYPNOOS_UPDATE_LOCATION_RULE_RADAR__=function(p){return r.updateLocationRuleRadar(p)};" +
        "globalThis.SillyTavern={getContext:function(){return r.getContext()},getCurrentChatId:function(){return r.getCurrentChatId()}};" +
        "var sourceMvu=r.getMvu();globalThis.Mvu={events:sourceMvu&&sourceMvu.events||{}};" +
        "if(r.hasMvu('getMvuData'))globalThis.Mvu.getMvuData=function(o){return r.readMvu('getMvuData',[option(o)])};" +
        "if(r.hasMvu('replaceMvuData'))globalThis.Mvu.replaceMvuData=function(m,o){return r.guardedMvu('replaceMvuData',[m,writeOption(o)])};" +
        "if(r.hasMvu('setMvuVariable'))globalThis.Mvu.setMvuVariable=function(){return r.guardedMvu('setMvuVariable',Array.prototype.slice.call(arguments))};" +
        "['eventOn','getCharWorldbookNames','getWorldbook'].forEach(function(n){if(r.hasApi(n))globalThis[n]=function(){return r.callApi(n,Array.prototype.slice.call(arguments))}});" +
        "['createWorldbook','createWorldbookEntries','createWorldInfoEntry','replaceWorldbook','updateWorldbookWith','rebindCharWorldbooks','deleteWorldbook'].forEach(function(n){if(r.hasApi(n))globalThis[n]=function(){return r.guardedApi(n,Array.prototype.slice.call(arguments))}});" +
        "})();</scr" + "ipt>";
    }

    function mountPhone(force) {
      ensureShell();
      var currentWritable = writableId();
      if (!frame || (!force && frame.dataset.loadedFor === currentWritable)) return;
      if (!config.frontendUrl) return;
      updateProfileNeighbors(null);
      updateHypnosisPerch(null);
      updateMapExtraChain(null);
      updateLocationRuleRadar({ visible: false, immediate: true });
      frame.dataset.loadedFor = currentWritable;
      loadedForWritableId = currentWritable;
      try { fetchController?.abort?.(); } catch (_) {}
      fetchController = typeof host.AbortController === "function" ? new host.AbortController() : null;
      frame.removeAttribute("src");
      frame.srcdoc = "<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;min-height:100%;background:transparent}</style></head><body><main style='min-height:100vh;display:grid;place-items:center;background:#090b16;color:#dbc8e8;font:700 14px system-ui'>正在连接楼层变量…</main></body></html>";
      host.fetch(config.frontendUrl, { cache: "no-store", signal: fetchController && fetchController.signal }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).then(function (html) {
        if (loadedForWritableId !== currentWritable) return;
        var bridge = bridgePrelude();
        var next = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, "<head$1>" + bridge) : bridge + html;
        frame.srcdoc = next;
      }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        frame.srcdoc = "<!doctype html><html><body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#090b16;color:#fca5a5;font:700 14px/1.7 system-ui;padding:24px;text-align:center'>悬浮手机加载失败<br>" + escapeHtml(error && error.message) + "</body></html>";
      });
    }

    function scheduleMount(force) {
      if (mountTimer) host.clearTimeout(mountTimer);
      mountTimer = host.setTimeout(function () {
        mountTimer = 0;
        mountPhone(Boolean(force));
      }, 80);
    }

    function ensureShell() {
      if (shell && shell.isConnected) return;
      loadUiState();
      shell = hostDocument.createElement("div");
      shell.id = "hypnoos-floating-phone-host";
      shell.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147481900;";
      shadow = shell.attachShadow({ mode: "open" });
      shadow.innerHTML = "<style>" + shellCss() + "</style>" +
        "<button class='launcher' type='button' aria-label='打开悬浮手机' aria-haspopup='menu' aria-expanded='false'><span class='pet-sprite' aria-hidden='true'></span><span class='pet-fallback' aria-hidden='true'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><rect x='6' y='2.5' width='12' height='19' rx='3'/><path d='M10 5h4M11 18.5h2'/></svg></span><i>0</i></button>" +
        "<nav class='pet-menu' role='menu' aria-label='桌宠切换' aria-hidden='true'><button type='button' role='menuitem' data-pet-action='switch'>切换</button></nav>" +
        "<section class='panel' aria-label='HypnoOS 悬浮手机'><aside class='map-extra-chain-host' aria-label='更多地图区域' aria-hidden='true'></aside><aside class='hypnosis-judgement-perch' aria-hidden='true'><span class='hypnosis-judgement-figure is-demon'><img class='hypnosis-judgement-figure__rear' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-demon-side-v3.png") + "'><img class='hypnosis-judgement-figure__front' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-demon-side-v3.png") + "'></span><span class='hypnosis-judgement-figure is-angel'><img class='hypnosis-judgement-figure__rear' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-angel-side-v3.png") + "'><img class='hypnosis-judgement-figure__front' alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/hypnosis-angel-side-v3.png") + "'></span></aside><aside class='encounter-detail-host' aria-hidden='true'></aside><aside class='profile-neighbor-host' aria-label='相邻人物档案'><button class='profile-neighbor-rail prev' type='button' data-kicker='PREV' data-profile-neighbor='prev'></button><button class='profile-neighbor-rail next' type='button' data-kicker='NEXT' data-profile-neighbor='next'></button></aside><aside class='encounter-possession-decor-host' aria-hidden='true' hidden><img alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "'></aside><aside class='profile-possession-host' aria-label='附身控制'><button class='profile-possession-grip' type='button' data-profile-possession-host='' aria-pressed='false'><img alt='' draggable='false' src='" + escapeHtml(String(config.assetBase || "").replace(/\/?$/, "/") + "profile-ui/profile-possession-top-grip-v1.png") + "'></button></aside><div class='dual-stage'><section class='surface timetable-surface'><div class='timetable-wrap' aria-label='课程表'></div><button class='surface-cover' type='button' data-focus-surface='timetable' aria-label='聚焦课程表'></button></section><section class='surface phone-surface'><div class='phone-wrap'><iframe class='phone' title='HypnoOS 手机前端'></iframe><div class='galgame-dialog' role='dialog' aria-modal='true' aria-hidden='true' aria-labelledby='hypnoos-galgame-dialog-title'><section class='galgame-dialog__card'><strong id='hypnoos-galgame-dialog-title' data-galgame-dialog-title>Galgame人物演出</strong><p data-galgame-dialog-body></p><button type='button' data-galgame-dialog-close>知道了</button></section></div><div class='variable-format-dialog' role='dialog' aria-modal='true' aria-hidden='true'><section class='variable-format-dialog__card'><strong data-variable-format-title>变量格式检查</strong><p data-variable-format-body></p><div class='variable-format-dialog__actions'><button type='button' data-variable-format-close>关闭</button><button type='button' data-variable-format-repair>清理并补齐</button></div></section></div></div></section></div><button class='surface-switch' type='button' data-surface-switch>选择一面</button><span class='drag-edge top' data-phone-drag></span><span class='drag-edge right' data-phone-drag></span><span class='drag-edge bottom' data-phone-drag></span><span class='drag-edge left' data-phone-drag></span><span class='drag-grip' data-phone-drag aria-label='拖动手机'></span><aside class='sidecar'><button class='galgame-toggle' type='button' aria-pressed='false' disabled>Galgame --</button><section class='resource-panel loading' aria-label='当前楼层资源'><div class='resource-row money'><span>零花钱</span><strong data-resource-money>--</strong></div><div class='resource-row starlight'><span>星光点</span><strong data-resource-starlight>--</strong></div><div class='resource-row energy'><span>MC能量</span><strong data-resource-energy>--</strong></div></section><button class='variable-format-toggle' type='button'>变量格式检查</button><span class='readonly'>历史楼层 · 只读；切回当前楼后才能操作</span><button class='pet-character-toggle' type='button'>人物 · 爱丽莎</button><button class='floor-toggle' type='button' aria-expanded='false'>楼层</button><section class='floor-drawer'><span class='floor-title'></span><button class='mode' type='button'>跟随视口</button><select class='select' aria-label='选择变量楼层'></select><span class='badge'></span></section></aside></section>";
      hostDocument.body.appendChild(shell);
      launcher = shadow.querySelector(".launcher");
      petSprite = shadow.querySelector(".pet-sprite");
      petMenu = shadow.querySelector(".pet-menu");
      panel = shadow.querySelector(".panel");
      if (panel && !panel.querySelector(".location-rule-radar")) {
        ["rear", "front"].forEach(function (layer) {
          var radar = hostDocument.createElement("img");
          radar.className = "location-rule-radar " + layer;
          radar.alt = "";
          radar.draggable = false;
          radar.src = String(config.assetBase || "").replace(/\/?$/, "/") + "maps/location-rule-radar-v2.png";
          panel.insertBefore(radar, panel.querySelector(".phone-wrap"));
        });
      }
      frame = shadow.querySelector(".phone");
      floorSelect = shadow.querySelector(".select");
      modeButton = shadow.querySelector(".mode");
      stateBadge = shadow.querySelector(".badge");
      titleFloor = shadow.querySelector(".floor-title");
	      galgameToggle = shadow.querySelector(".galgame-toggle");
	      galgameDialog = shadow.querySelector(".galgame-dialog");
	      resourcePanel = shadow.querySelector(".resource-panel");
	      variableFormatButton = shadow.querySelector(".variable-format-toggle");
	      petCharacterButton = shadow.querySelector(".pet-character-toggle");
	      variableFormatDialog = shadow.querySelector(".variable-format-dialog");
      encounterDetailHost = shadow.querySelector(".encounter-detail-host");
      encounterPossessionDecorHost = shadow.querySelector(".encounter-possession-decor-host");
      profileNeighborHost = shadow.querySelector(".profile-neighbor-host");
      profilePossessionHost = shadow.querySelector(".profile-possession-host");
      timetableHost = shadow.querySelector(".timetable-wrap");
      mapExtraChainHost = shadow.querySelector(".map-extra-chain-host");
      panel.querySelectorAll("[data-focus-surface]").forEach(function (button) {
        button.addEventListener("click", function () { timetableSetFocus(button.dataset.focusSurface); });
      });
      panel.querySelector("[data-surface-switch]")?.addEventListener("click", function () {
        timetableSetFocus(timetableFocus === "phone" ? "timetable" : "phone");
      });
      timetableHost?.addEventListener("click", async function (event) {
        var course = event.target.closest("[data-course-day][data-course-period]");
        if (course) {
          var snapshot = phoneApi("__ST_HYPNOOS_TIMETABLE_SNAPSHOT__", [], true);
          var day = Number(course.dataset.courseDay);
          var period = Number(course.dataset.coursePeriod);
          var dayData = snapshot && snapshot.days && snapshot.days.find(function (item) { return item.day === day; });
          var cell = dayData && dayData.cells && dayData.cells[period - 1];
          if (cell && cell.editable) {
            timetableEditorCell = { day: day, period: period, label: dayData.label + " " + period + "限", subject: cell.subject || "", description: cell.description || "" };
            renderTimetableWindow();
          }
          return;
        }
        if (event.target.closest("[data-course-cancel]")) { timetableEditorCell = null; renderTimetableWindow(); return; }
        if (event.target.closest("[data-advance]")) {
          var count = Number(timetableHost.querySelector("[data-advance-count]")?.value) || 1;
          await Promise.resolve(phoneApi("__ST_HYPNOOS_TIMETABLE_ADVANCE__", [count], false));
          scheduleTimetableRefresh(80);
          return;
        }
        if (event.target.closest("[data-next-day]")) {
          await Promise.resolve(phoneApi("__ST_HYPNOOS_TIMETABLE_NEXT_DAY__", [], false));
          scheduleTimetableRefresh(80);
          return;
        }
        if (event.target.closest("[data-execute-free]")) {
          await Promise.resolve(phoneApi("__ST_HYPNOOS_TIMETABLE_EXECUTE_FREE__", [], false));
          scheduleTimetableRefresh(80);
        }
      });
      timetableHost?.addEventListener("submit", async function (event) {
        var form = event.target.closest("[data-course-editor]");
        if (!form || !timetableEditorCell) return;
        event.preventDefault();
        var result = await Promise.resolve(phoneApi("__ST_HYPNOOS_TIMETABLE_COMMIT__", [{ day: timetableEditorCell.day, period: timetableEditorCell.period, subject: form.elements.subject.value, description: form.elements.description.value }], false));
        if (result && result.ok) timetableEditorCell = null;
        else form.dataset.error = String(result && result.reason || "课程表写入失败");
        renderTimetableWindow();
      });
      timetableHost?.addEventListener("dragstart", function (event) {
        var card = event.target.closest("[data-hypnosis-id]");
        if (card && event.dataTransfer) event.dataTransfer.setData("text/hypnoos-hypnosis", card.dataset.hypnosisId || "");
      });
      timetableHost?.addEventListener("dragover", function (event) { if (event.target.closest("[data-schedule-slot]")) event.preventDefault(); });
      timetableHost?.addEventListener("drop", async function (event) {
        var slot = event.target.closest("[data-schedule-slot]");
        var id = event.dataTransfer && event.dataTransfer.getData("text/hypnoos-hypnosis");
        if (!slot || !id) return;
        event.preventDefault();
        await Promise.resolve(phoneApi("__ST_HYPNOOS_TIMETABLE_MOVE_HYPNOSIS__", [id, slot.dataset.scheduleSlot], false));
        renderTimetableWindow();
      });
      profileNeighborHost?.querySelectorAll("[data-profile-neighbor]")?.forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var direction = button.getAttribute("data-profile-neighbor") === "prev" ? "prev" : "next";
          panel.classList.remove("profile-turning-prev", "profile-turning-next");
          panel.classList.add("profile-turning-" + direction);
          phoneApi("__ST_HYPNOOS_PROFILE_NAV__", [direction], false);
          host.setTimeout(function () { panel?.classList?.remove("profile-turning-prev", "profile-turning-next"); }, 430);
        });
      });
      profilePossessionHost?.querySelector("[data-profile-possession-host]")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var button = event.currentTarget;
        var roleName = textId(button && button.dataset && button.dataset.profilePossessionHost);
        if (!roleName) return;
        phoneApi("__ST_HYPNOOS_PROFILE_POSSESSION__", [roleName], false);
      });
	      galgameDialog?.querySelector("[data-galgame-dialog-close]")?.addEventListener("click", closeGalgameDialog);
	      variableFormatDialog?.querySelector("[data-variable-format-close]")?.addEventListener("click", closeVariableFormatDialog);
	      variableFormatDialog?.querySelector("[data-variable-format-repair]")?.addEventListener("click", async function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        var button = event.currentTarget;
	        if (!isWritable()) {
	          openVariableFormatDialog();
	          return;
	        }
	        button.disabled = true;
	        button.textContent = "正在矫正…";
	        var result = await Promise.resolve(phoneApi("__ST_HYPNOOS_CORRECT_VARIABLE_FORMAT__", [], false));
	        refreshVariableFormatCheck();
	        openVariableFormatDialog();
	        var body = variableFormatDialog && variableFormatDialog.querySelector("[data-variable-format-body]");
	        if (body && result && result.ok) {
	          body.textContent = "变量格式已矫正：补齐 " + (result.missingCount || 0) + " 项，清理未知键 " + (result.removedExtraCount || 0) + " 项。";
	        } else if (body) {
	          body.textContent = "变量格式矫正失败：" + String(result && result.reason || "未能写回当前楼变量。");
	        }
	      });
	      variableFormatButton?.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        openVariableFormatDialog();
	      });
	      petCharacterButton?.addEventListener("click", function (event) {
	        event.preventDefault();
	        event.stopPropagation();
	        switchPetCharacter();
	      });
	      updatePetCharacterButton();
      launcher.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (suppressLauncherClick) {
          suppressLauncherClick = false;
          return;
        }
        if (petMenuOpen) {
          closePetMenu();
          return;
        }
        toggleShell(!shellOpen);
      });
      launcher.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openPetMenu(false);
      });
      launcher.addEventListener("keydown", function (event) {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          event.stopPropagation();
          openPetMenu(true);
        } else if (event.key === "Escape" && petMenuOpen) {
          event.preventDefault();
          closePetMenu(true);
        }
      });
      petMenu?.addEventListener("click", function (event) {
        var button = event.target.closest("button[data-pet-action]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        var action = button.getAttribute("data-pet-action");
        if (action === "switch") switchPetCharacter();
      });
      petMenu?.addEventListener("keydown", function (event) {
        var buttons = Array.from(petMenu.querySelectorAll("button"));
        var index = buttons.indexOf(shadow.activeElement);
        if (event.key === "Escape") {
          event.preventDefault();
          closePetMenu(true);
          return;
        }
        if (!/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") index = 0;
        else if (event.key === "End") index = buttons.length - 1;
        else index = (Math.max(0, index) + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
        buttons[index]?.focus();
      });
      launcher.addEventListener("pointerdown", beginLauncherDrag);
      launcher.addEventListener("pointermove", moveLauncherDrag);
      launcher.addEventListener("pointerup", endLauncherDrag);
      launcher.addEventListener("pointercancel", cancelLauncherDrag);
      launcher.addEventListener("lostpointercapture", function (event) {
        if (launcherDragState && event.pointerId === launcherDragState.pointerId) cancelLauncherDrag(event);
      });
      launcher.addEventListener("pointerenter", function () {
        petPointerHover = true;
        pausePetAutonomy();
      });
      launcher.addEventListener("pointerleave", function () {
        petPointerHover = false;
        if (!launcherDragState) resumePetAutonomy();
      });
      launcher.addEventListener("focus", function () {
        petHasFocus = true;
        pausePetAutonomy();
      });
      launcher.addEventListener("blur", function () {
        petHasFocus = false;
        if (!launcherDragState) resumePetAutonomy();
      });
      var floorToggle = shadow.querySelector(".floor-toggle");
      var floorDrawer = shadow.querySelector(".floor-drawer");
      floorToggle.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var nextOpen = !floorDrawer.classList.contains("open");
        floorDrawer.classList.toggle("open", nextOpen);
        floorToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      });
      galgameToggle.addEventListener("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        var enabled = galgameToggle.getAttribute("aria-pressed") === "true";
        await setGalgameEnabled(!enabled);
      });
      modeButton.addEventListener("click", function () {
        if (selectionMode === "follow") {
          selectionMode = "manual";
          saveUiState();
          updateChrome();
        } else {
          followVisibleFloor();
        }
      });
      floorSelect.addEventListener("change", function () { selectFloor(floorSelect.value, "manual"); });
      shadow.querySelectorAll("[data-phone-drag]").forEach(function (handle) {
        handle.addEventListener("pointerdown", beginDrag);
      });
      frame.addEventListener("load", function () {
        consumePendingProfileRole();
        scheduleTimetableRefresh(0);
        host.setTimeout(function () { notifyStages(); }, 0);
        host.setTimeout(function () { notifyStages(); }, 350);
      });
      applySavedLauncherPosition();
      applySavedPosition();
      try {
        petMotionQuery = host.matchMedia("(prefers-reduced-motion: reduce)");
        petMotionHandler = function () {
          if (petMotionQuery && petMotionQuery.matches) {
            resetPetDragPhysics();
            if (launcherDragState?.moved) setPetState("held_scared", { static: true });
            else pausePetAutonomy();
          }
          else resumePetAutonomy();
        };
        if (petMotionQuery.addEventListener) petMotionQuery.addEventListener("change", petMotionHandler);
        else petMotionQuery.addListener?.(petMotionHandler);
      } catch (_) {}
      petVisibilityHandler = function () {
        if (hostDocument.hidden) {
          resetPetDragPhysics();
          pausePetAutonomy();
        }
        else resumePetAutonomy();
      };
      hostDocument.addEventListener("visibilitychange", petVisibilityHandler);
      loadPetAssets();
      updateChrome();
      syncGalgameState();
    }

    function beginLauncherDrag(event) {
      if (!launcher || !petAssetsReady || petSwitching || (event.pointerType === "mouse" && event.button !== 0)) return;
      closePetMenu();
      pausePetAutonomy();
      commitPetRoamPosition();
      loadPetAsset(petCharacterId, "drag").catch(function () {});
      launcherDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        gripX: PET_RENDER_SIZE / 2,
        gripY: PET_DRAG_GRIP_Y,
        moved: false,
        sampleX: event.clientX,
        sampleY: event.clientY,
        sampleTime: Number(event.timeStamp) || Date.now(),
        velocityX: 0,
        velocityY: 0,
        accelerationX: 0,
        accelerationY: 0
      };
      suppressLauncherClick = false;
      launcher.classList.add("dragging");
      try { launcher.setPointerCapture(event.pointerId); } catch (_) {}
      clearPetMenuLongPress();
      if (event.pointerType !== "mouse") {
        var longPressPointerId = event.pointerId;
        petMenuLongPressTimer = host.setTimeout(function () {
          petMenuLongPressTimer = 0;
          if (!launcherDragState || launcherDragState.pointerId !== longPressPointerId || launcherDragState.moved) return;
          var held = launcherDragState;
          launcherDragState = null;
          launcher.classList.remove("dragging");
          try {
            if (launcher.hasPointerCapture && launcher.hasPointerCapture(held.pointerId)) launcher.releasePointerCapture(held.pointerId);
          } catch (_) {}
          suppressLauncherClick = true;
          openPetMenu(false);
        }, 500);
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function moveLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      var dx = event.clientX - launcherDragState.startX;
      var dy = event.clientY - launcherDragState.startY;
      if (!launcherDragState.moved && Math.hypot(dx, dy) >= 5) {
        clearPetMenuLongPress();
        launcherDragState.moved = true;
        setPetState("held_scared", { static: petReducedMotion() });
        startLauncherDragPhysics();
      }
      if (launcherDragState.moved) {
        var sampleTime = Number(event.timeStamp) || Date.now();
        var sampleDt = Math.max(1 / 240, Math.min((sampleTime - launcherDragState.sampleTime) / 1000 || 1 / 60, 0.08));
        var velocityX = (event.clientX - launcherDragState.sampleX) / sampleDt;
        var velocityY = (event.clientY - launcherDragState.sampleY) / sampleDt;
        launcherDragState.accelerationX = launcherDragState.accelerationX * 0.35 + ((velocityX - launcherDragState.velocityX) / sampleDt) * 0.65;
        launcherDragState.accelerationY = launcherDragState.accelerationY * 0.35 + ((velocityY - launcherDragState.velocityY) / sampleDt) * 0.65;
        petSpinVelocity += Math.max(-2.8, Math.min(2.8, -(velocityX - launcherDragState.velocityX) * 0.0022));
        launcherDragState.velocityX = velocityX;
        launcherDragState.velocityY = velocityY;
        launcherDragState.sampleX = event.clientX;
        launcherDragState.sampleY = event.clientY;
        launcherDragState.sampleTime = sampleTime;
        var viewport = hostViewportRect();
        var gripClientX = Math.max(viewport.left, Math.min(event.clientX, viewport.left + viewport.width));
        var gripClientY = Math.max(viewport.top, Math.min(event.clientY, viewport.top + viewport.height));
        launcher.style.left = (gripClientX - launcherDragState.gripX) + "px";
        launcher.style.top = (gripClientY - launcherDragState.gripY) + "px";
        launcher.style.right = "auto";
        launcher.style.bottom = "auto";
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function endLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      clearPetMenuLongPress();
      var ended = launcherDragState;
      resetPetDragPhysics();
      launcherDragState = null;
      launcher.classList.remove("dragging");
      try {
        if (launcher.hasPointerCapture && launcher.hasPointerCapture(ended.pointerId)) launcher.releasePointerCapture(ended.pointerId);
      } catch (_) {}
      if (ended.moved) {
        var rect = launcher.getBoundingClientRect();
        var settled = clampLauncherPosition(rect.left, rect.top);
        launcher.style.left = settled.x + "px";
        launcher.style.top = settled.y + "px";
        saveLauncherPosition(settled.x, settled.y);
        petOriginX = settled.x;
        petOriginY = settled.y;
        suppressLauncherClick = true;
        playPetLandingAfterDrag();
      } else if (!shellOpen) {
        resumePetAutonomy();
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function cancelLauncherDrag(event) {
      if (!launcherDragState || event.pointerId !== launcherDragState.pointerId) return;
      clearPetMenuLongPress();
      var cancelled = launcherDragState;
      resetPetDragPhysics();
      launcherDragState = null;
      launcher.classList.remove("dragging");
      try {
        if (launcher.hasPointerCapture && launcher.hasPointerCapture(cancelled.pointerId)) launcher.releasePointerCapture(cancelled.pointerId);
      } catch (_) {}
      if (cancelled.moved) {
        var rect = launcher.getBoundingClientRect();
        var settled = clampLauncherPosition(rect.left, rect.top);
        launcher.style.left = settled.x + "px";
        launcher.style.top = settled.y + "px";
        saveLauncherPosition(settled.x, settled.y);
        petOriginX = settled.x;
        petOriginY = settled.y;
        suppressLauncherClick = true;
        playPetLandingAfterDrag();
      } else if (!shellOpen) {
        resumePetAutonomy();
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function beginDrag(event) {
      if (!panel || (event.pointerType === "mouse" && event.button !== 0) || event.target.closest("button,select")) return;
      event.preventDefault();
      event.stopPropagation();
      var rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        handle: event.currentTarget,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top
      };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
      host.addEventListener("pointermove", moveDrag, true);
      host.addEventListener("pointerup", endDrag, true);
      host.addEventListener("pointercancel", endDrag, true);
    }

    function moveDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      event.preventDefault();
      var next = clampPosition(event.clientX - dragState.dx, event.clientY - dragState.dy);
      panel.style.left = next.x + "px";
      panel.style.top = next.y + "px";
    }

    function endDrag(event) {
      if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
      var ended = dragState;
      host.removeEventListener("pointermove", moveDrag, true);
      host.removeEventListener("pointerup", endDrag, true);
      host.removeEventListener("pointercancel", endDrag, true);
      try {
        if (ended.handle && ended.handle.hasPointerCapture && ended.handle.hasPointerCapture(ended.pointerId)) {
          ended.handle.releasePointerCapture(ended.pointerId);
        }
      } catch (_) {}
      var rect = panel.getBoundingClientRect();
      savePosition(rect.left, rect.top);
      dragState = null;
    }

    function toggleShell(open) {
      ensureShell();
      shellOpen = Boolean(open);
      if (shellOpen && petMenuOpen) closePetMenu();
      panel.classList.toggle("open", shellOpen);
      launcher.setAttribute("aria-expanded", shellOpen || petMenuOpen ? "true" : "false");
      launcher.setAttribute("aria-label", (shellOpen ? "关闭悬浮手机" : "打开悬浮手机") + " · 当前桌宠" + PET_CHARACTER_NAMES[petCharacterId]);
      launcher.classList.toggle("active", shellOpen);
      if (shellOpen) {
        timetableSetFocus("none");
        pausePetAutonomy();
        if (selectionMode === "follow") followVisibleFloor();
        else updateChrome();
        applySavedPosition();
        mountPhone(false);
        scheduleTimetableRefresh(80);
        syncGalgameState();
        playPetShellAction("unique_a", true);
      } else {
        hideEncounterDetail();
        updateProfileNeighbors(null);
        var drawer = shadow.querySelector(".floor-drawer");
        var toggle = shadow.querySelector(".floor-toggle");
        if (drawer) drawer.classList.remove("open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        resumePetAutonomy();
        playPetShellAction("unique_b", false);
      }
    }

    function consumePendingProfileRole() {
      var name = textId(pendingProfileRole);
      if (!name) return true;
      try {
        var phoneWindow = frame && frame.contentWindow;
        var openProfile = phoneWindow && phoneWindow.__ST_OPEN_PROFILE_APP__;
        if (typeof openProfile !== "function") return false;
        pendingProfileRole = "";
        // Galgame 头像只指定角色，不覆盖人物档案最近记住的常规/深层
        // 分组与具体页面。首次使用仍由人物档案自身回退到“衣着”。
        openProfile("", name);
        return true;
      } catch (_) { return false; }
    }

    function schedulePendingProfileOpen(attempts) {
      if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
      profileOpenTimer = 0;
      if (consumePendingProfileRole() || attempts <= 0) return;
      profileOpenTimer = host.setTimeout(function () {
        profileOpenTimer = 0;
        schedulePendingProfileOpen(attempts - 1);
      }, 100);
    }

    function openProfileRole(roleName) {
      pendingProfileRole = textId(roleName);
      if (!pendingProfileRole) return false;
      toggleShell(true);
      schedulePendingProfileOpen(20);
      return true;
    }

    function updateChrome() {
      ensureShell();
      var floors = floorItems();
      var ids = floors.map(function (item) { return item.id; });
      if (!selectedId || ids.indexOf(selectedId) < 0) selectedId = writableId() || (floors.length ? floors[floors.length - 1].id : "");
      floorSelect.innerHTML = floors.map(function (item) {
        var suffix = item.snapshot ? "有变量" : "无快照";
        var current = item.id === writableId() ? "当前" : "历史";
        return "<option value='" + escapeHtml(item.id) + "'>第 " + escapeHtml(item.floor) + " 楼 · 滑动" + escapeHtml(item.swipe) + " · " + current + " · " + suffix + "</option>";
      }).join("");
      floorSelect.value = selectedId;
      modeButton.textContent = selectionMode === "follow" ? "跟随视口" : "手动选楼";
      var writable = isWritable();
      stateBadge.textContent = writable ? "当前楼 · 可操作" : "历史楼 · 只读";
      stateBadge.classList.toggle("history", !writable);
      panel.classList.toggle("history", !writable);
      titleFloor.textContent = selectedId ? "楼层 " + selectedId : "等待楼层";
      var count = phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
      var note = phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
      var total = (Array.isArray(count) ? count.length : 0) + (String(note || "").trim() ? 1 : 0);
      var launcherBadge = shadow.querySelector(".launcher i");
	      if (launcherBadge) launcherBadge.textContent = String(total);
	      refreshSidecarResources();
	      refreshVariableFormatCheck();
	    }

    function refreshPhone() {
      if (!frame || !frame.contentWindow) return;
      try {
        frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent("HYPNOOS_FLOATING_FLOOR_CHANGED", { detail: { messageId: selectedId, writable: isWritable() } }));
        frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__ && frame.contentWindow.__ST_HYPNOOS_REFRESH_FRONTEND__();
      } catch (_) {}
    }

    function notifyReadOnly() {
      updateChrome();
      if (!panel || !shadow) return;
      var badge = shadow.querySelector(".readonly");
      if (!badge) return;
      badge.textContent = "历史楼层 · 只读；切回当前楼后才能操作";
      badge.animate([{ transform: "translateY(-3px)", opacity: .65 }, { transform: "translateY(0)", opacity: 1 }], { duration: 220 });
    }

    function phoneApi(name, args, quiet) {
      try {
        var phoneWindow = frame && frame.contentWindow;
        var fn = phoneWindow && phoneWindow[name];
        if (typeof fn === "function") return fn.apply(phoneWindow, Array.isArray(args) ? args : []);
      } catch (error) {
        if (!quiet) console.warn("[HypnoOS] 悬浮手机 API 调用失败", name, error);
      }
      return undefined;
    }

    function notifyStages() {
      updateChrome();
      stageSubscribers.forEach(function (subscriber) {
        try { subscriber(); } catch (_) {}
      });
    }

    function register(owner) {
      var id = textId(owner.messageId) || "unknown-" + token;
      var previousWritable = writableId();
      var existing = owners.get(id);
      owners.set(id, owner);
      if (!existing) ownerOrder.push(id);
	  else if (existing.token !== owner.token && ownerOrder.indexOf(id) < 0) ownerOrder.push(id);
      var nextWritable = writableId();
      if (!selectedId || selectionMode === "follow" || selectedId === previousWritable) selectedId = nextWritable;
      ensureShell();
      if (loadedForWritableId && previousWritable !== nextWritable) scheduleMount(true);
      else scheduleMount(false);
      updateChrome();
      notifyStages();
      // StatusPlaceHolder 的 stage iframe 只会在本楼最终正则 DOM 已经落地后注册。
      // 以这里作为确定性的正文最终化钩子，避免较早的 mutation/rAF 渲染
      // 又被酒馆随后一次 markdown/regex 整块重建覆盖。
      scheduleGalgameRender();
      scheduleActionFoldRender();
    }

    function unregister(id, ownerToken) {
      var current = owners.get(id);
      if (!current || current.token !== ownerToken) return;
      owners.delete(id);
      ownerOrder = ownerOrder.filter(function (item) { return item !== id; });
      if (selectionMode === "follow" || selectedId === id) selectedId = writableId();
      updateChrome();
      notifyStages();
    }

    hostClickHandler = function (event) {
      var path = [];
      try { path = typeof event.composedPath === "function" ? event.composedPath() : []; } catch (_) {}
      var portrait = path.find(function (node) {
        return node && node.nodeType === 1 && node.classList
          && node.classList.contains("st-galgame-card__portrait");
      });
      if (!portrait) {
        try { portrait = event.target && event.target.closest ? event.target.closest(".st-galgame-card__portrait") : null; } catch (_) {}
      }
      var card = portrait && portrait.closest
        ? portrait.closest(".st-galgame-card[data-galgame-role]")
        : null;
      var roleName = card
        && card.dataset.galgameUser !== "true"
        ? textId(card.dataset.galgameRole)
        : "";
      var id = mesIdFromElement(event.target);
      if (selectionMode === "follow" && id && floorItems().map(function (item) { return item.id; }).indexOf(id) >= 0) {
        selectFloor(id, "follow");
      }
      if (!roleName) return;
      event.preventDefault();
      event.stopPropagation();
      openProfileRole(roleName);
    };
    hostResizeHandler = function () {
      if (launcher && !launcherDragState) applySavedLauncherPosition();
      if (panel) applySavedPosition();
    };
    hostDocument.addEventListener("click", hostClickHandler, true);
    host.addEventListener("resize", hostResizeHandler, { passive: true });
    try {
      host.visualViewport?.addEventListener?.("resize", hostResizeHandler, { passive: true });
      host.visualViewport?.addEventListener?.("scroll", hostResizeHandler, { passive: true });
    } catch (_) {}

    registryApi = {
      revision: config.revision,
      start: function () {
        var topologyChanged = reconcileChatState();
        ensureGalgameRenderer();
        ensureActionFoldRenderer();
        ensureShell();
        subscribeSidecarResourceEvents();
        if (!selectedId || selectionMode === "follow") selectedId = writableId();
        scheduleMount(topologyChanged);
        updateChrome();
        notifyStages();
        syncGalgameState();
      },
      register: register,
      unregister: unregister,
      getSelectedId: function () { return selectedId || writableId(); },
      getWritableId: writableId,
      isWritable: isWritable,
      selectFloor: selectFloor,
      normalizeMessageOption: normalizeMessageOption,
      normalizeWriteMessageOption: normalizeWriteMessageOption,
      hasApi: hasApi,
      callApi: callApi,
      readApi: readApi,
      guardedApi: guardedApi,
      callMvu: callMvu,
      hasMvu: hasMvu,
      readMvu: readMvu,
      guardedMvu: guardedMvu,
      notifyReadOnly: notifyReadOnly,
      getMvu: findMvu,
      getContext: context,
      getCurrentChatId: function () {
        for (var i = 0; i < sourceWindows().length; i += 1) {
          try {
            var fn = sourceWindows()[i].SillyTavern && sourceWindows()[i].SillyTavern.getCurrentChatId;
            if (typeof fn === "function") return fn.call(sourceWindows()[i].SillyTavern);
          } catch (_) {}
        }
        return "";
      },
      getRequestHeaders: hostRequestHeaders,
      phoneApi: phoneApi,
      notifyStages: notifyStages,
      registerGalgameHydrator: registerGalgameHydrator,
      refreshGalgameRole: refreshGalgameRole,
      renderGalgameMarkers: scheduleGalgameRender,
      renderActionFoldMarkers: scheduleActionFoldRender,
      subscribeStage: function (fn) { stageSubscribers.add(fn); return function () { stageSubscribers.delete(fn); }; },
      openPhone: function () { toggleShell(true); },
      openProfileRole: openProfileRole,
      showEncounterDetail: showEncounterDetail,
      hideEncounterDetail: hideEncounterDetail,
      updateEncounterPossessionDecor: updateEncounterPossessionDecor,
      updateProfileNeighbors: updateProfileNeighbors,
      updateProfilePossession: updateProfilePossession,
      updateHypnosisPerch: updateHypnosisPerch,
      refreshTimetable: function () { scheduleTimetableRefresh(0); return true; },
      notifySchedule: function () { scheduleTimetableRefresh(0); return true; },
      updateMapExtraChain: updateMapExtraChain,
      updateLocationRuleRadar: updateLocationRuleRadar,
      ensureOpeningWorldbooks: ensureOpeningWorldbooks,
      updateChrome: updateChrome,
      destroy: function () {
        if (mountTimer) host.clearTimeout(mountTimer);
        mountTimer = 0;
        clearPetFrameTimer();
        clearPetActivityTimer();
        clearPetMotionFrame();
        resetPetDragPhysics();
        clearPetMenuLongPress();
        if (launcherDragState && launcher) {
          try {
            if (launcher.hasPointerCapture && launcher.hasPointerCapture(launcherDragState.pointerId)) launcher.releasePointerCapture(launcherDragState.pointerId);
          } catch (_) {}
        }
        launcherDragState = null;
        try {
          if (petMotionQuery && petMotionHandler) {
            if (petMotionQuery.removeEventListener) petMotionQuery.removeEventListener("change", petMotionHandler);
            else petMotionQuery.removeListener?.(petMotionHandler);
          }
        } catch (_) {}
        try {
          if (petVisibilityHandler) hostDocument.removeEventListener("visibilitychange", petVisibilityHandler);
        } catch (_) {}
        petMotionQuery = null;
        petMotionHandler = null;
        petVisibilityHandler = null;
        petAssetsReady = false;
        petReadyAssets.clear();
        petImageCache.clear();
        petLoadPromises.clear();
        petLoadQueue.length = 0;
        petLoadsInFlight = 0;
        petMenu = null;
        petMenuOpen = false;
        petSprite = null;
        if (profileOpenTimer) host.clearTimeout(profileOpenTimer);
        profileOpenTimer = 0;
        pendingProfileRole = "";
        resourceRefreshToken += 1;
        resourceEventStops.splice(0).forEach(function (item) {
          try {
            if (typeof item.handle === "function") item.handle();
            else item.handle?.stop?.() || item.handle?.unsubscribe?.() || item.handle?.off?.();
            var off = findFunction("eventOff");
            if (off) off.fn.call(off.view, item.eventName, item.handler);
          } catch (_) {}
        });
        resourceEventsSubscribed = false;
        try { fetchController?.abort?.(); } catch (_) {}
        fetchController = null;
        try { galgameObserver && galgameObserver.disconnect(); } catch (_) {}
        galgameObserver = null;
        try { actionFoldObserver && actionFoldObserver.disconnect(); } catch (_) {}
        actionFoldObserver = null;
        if (galgameRenderFrame) {
          try {
            if (host.cancelAnimationFrame) host.cancelAnimationFrame(galgameRenderFrame);
            else host.clearTimeout(galgameRenderFrame);
          } catch (_) {}
        }
        galgameRenderFrame = 0;
        if (actionFoldRenderFrame) {
          try {
            if (host.cancelAnimationFrame) host.cancelAnimationFrame(actionFoldRenderFrame);
            else host.clearTimeout(actionFoldRenderFrame);
          } catch (_) {}
        }
        actionFoldRenderFrame = 0;
        galgameHydrator = null;
        galgameHydratorToken = "";
        hideEncounterDetail();
        updateEncounterPossessionDecor(null);
        updateProfileNeighbors(null);
        updateProfilePossession(null);
        updateHypnosisPerch(null);
        updateMapExtraChain(null);
        updateLocationRuleRadar({ visible: false, immediate: true });
        if (locationRuleRadarTimer) host.clearTimeout(locationRuleRadarTimer);
        locationRuleRadarTimer = 0;
        encounterDetailHost = null;
        encounterPossessionDecorHost = null;
        profileNeighborHost = null;
        profilePossessionHost = null;
        if (timetableRefreshTimer) host.clearTimeout(timetableRefreshTimer);
        timetableRefreshTimer = 0;
        timetableHost = null;
	        mapExtraChainHost = null;
	        resourcePanel = null;
	        variableFormatButton = null;
	        variableFormatDialog = null;
        try {
          if (hostDocument[GALGAME_RUNTIME_KEY] && hostDocument[GALGAME_RUNTIME_KEY].registry === registryApi) {
            delete hostDocument[GALGAME_RUNTIME_KEY];
          }
        } catch (_) {}
        try { hostDocument.removeEventListener("click", hostClickHandler, true); } catch (_) {}
        try { host.removeEventListener("resize", hostResizeHandler); } catch (_) {}
        try { host.visualViewport?.removeEventListener?.("resize", hostResizeHandler); } catch (_) {}
        try { host.visualViewport?.removeEventListener?.("scroll", hostResizeHandler); } catch (_) {}
        try { host.removeEventListener("pointermove", moveDrag, true); } catch (_) {}
        try { host.removeEventListener("pointerup", endDrag, true); } catch (_) {}
        try { host.removeEventListener("pointercancel", endDrag, true); } catch (_) {}
        try { host.removeEventListener("message", openingWorldbookMessageHandler); } catch (_) {}
        try { shell?.remove?.(); } catch (_) {}
        stageSubscribers.clear();
        owners.clear();
        ownerOrder = [];
      }
    };
    var openingWorldbookMessageHandler = function (event) {
      var payload = event && event.data;
      if (!payload || payload.type !== "ST_HYPNOOS_OPENING_WORLDINFO_REQUEST" || !payload.requestId) return;
      Promise.resolve(ensureOpeningWorldbooks(payload.entries, payload.fallbackName)).then(function (result) {
        try {
          event.source?.postMessage?.({
            type: "ST_HYPNOOS_OPENING_WORLDINFO_RESPONSE",
            requestId: payload.requestId,
            result: result
          }, "*");
        } catch (_) {}
      });
    };
    try { host.addEventListener("message", openingWorldbookMessageHandler); } catch (_) {}
    return registryApi;
  }

  function ensureRegistry(host) {
    try {
      var existing = host.__ST_HYPNOOS_FLOATING_SINGLETON__;
      if (existing && existing.revision === config.revision) return existing;
      if (existing && existing.destroy) existing.destroy();
      var created = createRegistry(host);
      host.__ST_HYPNOOS_FLOATING_SINGLETON__ = created;
      return created;
    } catch (error) {
      console.error("[HypnoOS] 无法创建悬浮手机", error);
      return null;
    }
  }

  function stageCss() {
    return [
      "html,body{margin:0;background:transparent!important;color:inherit}body{padding:0!important}",
      ".stage{--dq-night:#070b18;--dq-panel:#111c39;--dq-ink:#f7f1dc;--dq-muted:#b8c0d4;--dq-gold:#e7c46a;--dq-gold2:#80652f;position:relative;margin:10px 0;border:3px double var(--dq-gold);border-radius:7px;background:radial-gradient(circle at 50% -15%,rgba(68,112,190,.28),transparent 40%),repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px),linear-gradient(180deg,var(--dq-panel),var(--dq-night));box-shadow:0 0 0 2px #03050c,0 16px 38px rgba(2,6,23,.42),inset 0 0 26px rgba(0,0,0,.38);color:var(--dq-ink);font-family:'Palatino Linotype','Noto Serif SC','Songti SC',serif;overflow:hidden}.stage:before,.stage:after{content:'◆';position:absolute;z-index:3;top:5px;color:var(--dq-gold);font-size:9px;pointer-events:none}.stage:before{left:7px}.stage:after{right:7px}",
      ".head{display:flex;align-items:center;gap:9px;padding:15px 14px 11px;border-bottom:3px double var(--dq-gold2);background:linear-gradient(180deg,rgba(69,120,201,.16),rgba(4,8,22,.14))}.head-title{display:grid;gap:3px}.head-title strong{font-size:15px;letter-spacing:.08em;text-shadow:0 2px #000}.head-title small{color:#dfcf9c;font-size:10px;font-weight:800}.grow{flex:1}",
      ".open{border:2px solid #7182a8;border-radius:3px;background:linear-gradient(#273c69,#111d3c);box-shadow:inset 0 0 0 1px #080d1c,0 2px #02040a;color:#f7f1dc;font:800 11px inherit;padding:7px 10px;cursor:pointer}.status{padding:4px 8px;border:1px solid #648d7a;border-radius:3px;background:#10271f;color:#bfe2c8;font:850 9px inherit}.status.history{border-color:#8b7135;background:#27200f;color:#f0d783}",
      ".body{padding:11px 12px 12px}.empty{padding:18px;border:3px double var(--dq-gold2);border-radius:4px;text-align:center;color:var(--dq-muted);font-size:11px;line-height:1.6;background:rgba(5,10,27,.72)}.empty.waiting{animation:stagePulse 1.6s ease-in-out infinite}@keyframes stagePulse{50%{border-color:#7ea1d5;color:#d7e6ff}}",
      ".list{display:grid;gap:9px;max-height:300px;overflow:auto;scrollbar-width:thin;scrollbar-color:#80652f #070b18}.item{--accent:#9ca8c3;--soft:rgba(93,108,143,.16);position:relative;display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;padding:10px;border:2px solid color-mix(in srgb,var(--accent) 54%,#1c2541);border-radius:4px;background:linear-gradient(180deg,color-mix(in srgb,var(--soft) 72%,#162344),#0a1129 88%);box-shadow:inset 0 0 0 1px rgba(231,196,106,.16),0 5px 0 rgba(0,0,0,.2);overflow:hidden}.item:before{content:'';position:absolute;inset:4px auto 4px 4px;width:2px;background:var(--accent)}.item:after{content:'';position:absolute;right:3px;bottom:3px;width:7px;height:7px;border-right:1px solid var(--dq-gold2);border-bottom:1px solid var(--dq-gold2)}.item.tone-hypnosis{--accent:#b98bd4;--soft:rgba(120,66,144,.22)}.item.tone-reward{--accent:#e7c46a;--soft:rgba(148,111,35,.22)}.item.tone-schedule{--accent:#7da9df;--soft:rgba(53,91,139,.22)}.item.tone-location{--accent:#65c7c1;--soft:rgba(39,111,112,.2)}.item.tone-profile{--accent:#cf8ba9;--soft:rgba(130,60,92,.2)}.item.tone-activity{--accent:#83be80;--soft:rgba(57,111,63,.2)}.item.tone-inventory{--accent:#d59a64;--soft:rgba(127,76,38,.22)}.item.is-locked{--accent:#f0cf76;--soft:rgba(115,88,31,.2);border-color:#a9873d}",
      ".item-icon{width:32px;height:32px;border:2px solid color-mix(in srgb,var(--accent) 64%,#202a45);border-radius:50%;background:radial-gradient(circle,#1d2d54,#080e22 70%);color:var(--accent);display:grid;place-items:center;font-weight:950;box-shadow:inset 0 0 0 2px rgba(0,0,0,.32)}.item-content{min-width:0;display:grid;gap:5px}.item-top{display:flex;align-items:center;gap:6px}.item-source{min-width:0;padding:2px 6px;border:1px solid color-mix(in srgb,var(--accent) 48%,#202a45);border-radius:3px;background:#080e20;color:color-mix(in srgb,var(--accent) 78%,white);font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item-state{margin-left:auto;color:#abb4c9;font-size:9px;font-weight:850;white-space:nowrap}.item.is-locked .item-state{color:#f0cf76}.item h3{margin:0;color:var(--dq-ink);font-size:12px;line-height:1.35;text-shadow:0 1px #000}.item p{margin:0;color:#d2d8e7;font-size:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.item-remove{position:absolute;right:8px;bottom:8px;width:24px;height:24px;border:1px solid #8c4750;border-radius:2px;background:#37141e;color:#f2b5bb;font-size:15px;cursor:pointer}.item-remove:disabled{border-color:#8b7135;background:#211b10;color:#f0cf76;font-size:11px;cursor:not-allowed}",
      ".item-detail{border-top:1px solid #3b4665;padding-top:5px;margin-right:30px}.item-detail summary{cursor:pointer;list-style:none;color:#c7ccda;font-size:9px;font-weight:900}.item-detail summary::-webkit-details-marker{display:none}.detail-list{margin-top:6px;display:grid;gap:4px}.detail-row{display:grid;grid-template-columns:minmax(62px,.38fr) minmax(0,1fr);gap:7px;padding:5px 6px;border:1px solid #2d3858;border-radius:2px;background:#070d20;font-size:9px;line-height:1.4}.detail-row b{color:var(--accent);overflow-wrap:anywhere}.detail-row span{color:#d3d8e7;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".note{box-sizing:border-box;width:100%;min-height:68px;margin-top:10px;padding:9px 10px;resize:vertical;border:1px solid #536082;border-radius:3px;background:#050a19;color:#f0f2f8;font:11px/1.55 'Noto Serif SC','Songti SC',serif;outline:none}.note:focus{border-color:var(--dq-gold);box-shadow:0 0 0 2px rgba(231,196,106,.14)}.actions{display:flex;align-items:center;gap:7px;margin-top:9px}.actions label{margin-right:auto;color:#c2c9d9;font-size:10px}.actions button{border:2px solid #7884a5;border-radius:3px;background:linear-gradient(#273860,#111b38);box-shadow:inset 0 0 0 1px #080c19,0 2px #02040a;color:#f5f1e4;font:850 10px inherit;padding:8px 10px;cursor:pointer}.actions .send{border-color:var(--dq-gold);background:linear-gradient(#315a9e,#183364);color:#fff8db}.actions button:disabled,.note:disabled{opacity:.45;cursor:not-allowed}",
      ".modal{position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:rgba(2,4,12,.78);backdrop-filter:blur(7px);padding:14px}.modal-card{max-width:360px;border:3px double var(--dq-gold);border-radius:5px;background:linear-gradient(#172548,#080d20);color:var(--dq-ink);padding:18px;box-shadow:0 22px 64px rgba(0,0,0,.54)}.modal-card p{font-size:12px;line-height:1.65;color:#c1c8d8}.modal-card div{display:flex;justify-content:flex-end;gap:8px}.modal-card button{border:2px solid #7884a5;border-radius:3px;background:linear-gradient(#273860,#111b38);color:#f5f1e4;padding:8px 11px;font-weight:800}.modal-card .danger{border-color:#a75a62;background:linear-gradient(#682634,#35131c);color:#ffd6d8}"
    ].join("");
  }

  function stageVisual(item) {
    var allowed = ["hypnosis", "reward", "schedule", "location", "profile", "activity", "inventory", "system"];
    var tone = allowed.indexOf(String(item && item.tone || "")) >= 0 ? String(item.tone) : "system";
    return {
      tone: tone,
      icon: String(item && item.icon || "◆"),
      state: item && item.locked ? "🔒 已锁定" : "可撤销"
    };
  }

  function stageDetailsHtml(item) {
    var details = Array.isArray(item && item.details) ? item.details.filter(function (entry) {
      return entry && entry.label && entry.value;
    }) : [];
    if (!details.length) return "";
    var rows = details.map(function (entry) {
      return "<div class='detail-row'><b>" + escapeHtml(entry.label) + "</b><span>" + escapeHtml(entry.value) + "</span></div>";
    }).join("");
    return "<details class='item-detail'><summary>查看完整内容 · " + details.length + " 项</summary><div class='detail-list'>" + rows + "</div></details>";
  }

  function renderStage(registry, root, messageId) {
    var writable = registry.getWritableId() === messageId;
    var selectedWritable = registry.isWritable();
    var views = registry.phoneApi("__ST_GET_PENDING_OPERATION_VIEW__", [], true);
    var note = registry.phoneApi("__ST_GET_PENDING_OPERATION_NOTE__", [], true);
    var keep = registry.phoneApi("__ST_READ_OPERATION_KEEP_AFTER_FLUSH__", [], true);
    var ready = Array.isArray(views);
    views = ready ? views : [];
    var body = "";
    if (!writable) {
      body = "<div class='empty'>此楼只保留历史占位。可打开悬浮手机查看该楼变量；暂存操作只在当前楼编辑。</div>";
    } else if (!ready) {
      body = "<div class='empty'>悬浮手机正在连接暂存队列…</div>";
    } else {
      var list = views.length ? "<div class='list'>" + views.map(function (item) {
        var visual = stageVisual(item);
        return "<article class='item tone-" + visual.tone + (item.locked ? " is-locked" : "") + "'>" +
          "<span class='item-icon' aria-hidden='true'>" + escapeHtml(visual.icon) + "</span>" +
          "<div class='item-content'><div class='item-top'><span class='item-source'>" + escapeHtml(item.source || "APP") + "</span><span class='item-state'>" + escapeHtml(visual.state) + "</span></div>" +
          "<h3>" + escapeHtml(item.action || "操作") + "</h3><p>" + escapeHtml(item.summary || "无附加信息") + "</p>" + stageDetailsHtml(item) + "</div>" +
          "<button class='item-remove' type='button' data-remove='" + escapeHtml(item.id || item.key) + "' " + (item.locked ? "disabled title='锁定操作'" : "title='移除'") + ">" + (item.locked ? "🔒" : "×") + "</button></article>";
      }).join("") + "</div>" : "<div class='empty'>还没有本轮操作。手机中的命令、任务与购买会先暂存在这里。</div>";
      body = list + "<textarea class='note' placeholder='写给 AI 的普通备注，不会替代前端操作。'>" + escapeHtml(note || "") + "</textarea>" +
        "<div class='actions'><label><input class='keep' type='checkbox' " + (keep ? "checked" : "") + "> 确认后保留</label><button type='button' data-clear>清空</button><button class='send' type='button' data-flush>写入输入框</button></div>";
    }
    var lockedCount = views.filter(function (item) { return Boolean(item && item.locked); }).length;
    root.innerHTML = "<section class='stage'><header class='head'><div class='head-title'><strong>本轮操作暂存</strong><small>共 " + views.length + " 条" + (lockedCount ? " · " + lockedCount + " 条已锁定" : "") + "</small></div><span class='grow'></span><span class='status " + (writable && selectedWritable ? "" : "history") + "'>" + (writable ? (selectedWritable ? "当前楼" : "手机正查看历史") : "历史楼") + "</span><button class='open' type='button'>打开手机</button></header><div class='body'>" + body + "</div></section>";
    root.querySelector(".open").addEventListener("click", function () { registry.openPhone(); });
    var noteInput = root.querySelector(".note");
    if (noteInput) {
      noteInput.addEventListener("input", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value, { emit: false }]); });
      noteInput.addEventListener("change", function () { registry.phoneApi("__ST_SET_PENDING_OPERATION_NOTE__", [noteInput.value]); });
    }
    var keepInput = root.querySelector(".keep");
    if (keepInput) keepInput.addEventListener("change", function () { registry.phoneApi("__ST_WRITE_OPERATION_KEEP_AFTER_FLUSH__", [keepInput.checked]); registry.notifyStages(); });
    root.querySelectorAll("[data-remove]").forEach(function (button) {
      button.addEventListener("click", function () { registry.phoneApi("__ST_REMOVE_PENDING_OPERATION__", [button.dataset.remove]); registry.notifyStages(); });
    });
    var flush = root.querySelector("[data-flush]");
    if (flush) flush.addEventListener("click", function () { registry.phoneApi("__ST_FLUSH_OPERATION_TO_INPUT__", []); });
    var clear = root.querySelector("[data-clear]");
    if (clear) clear.addEventListener("click", function () {
      showStageConfirm(root, "清空未锁定的暂存内容？", "锁定操作仍会保留；普通操作和备注将不会写入本轮输入。", function () {
        registry.phoneApi("__ST_CLEAR_OPERATION_INPUT_LOG__", []);
        registry.notifyStages();
      });
    });
  }

  function showStageConfirm(root, title, message, confirm) {
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = "<section class='modal-card'><strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(message) + "</p><div><button type='button' data-cancel>取消</button><button class='danger' type='button' data-confirm>确认</button></div></section>";
    modal.addEventListener("click", function (event) { if (event.target === modal || event.target.closest("[data-cancel]")) modal.remove(); });
    modal.querySelector("[data-confirm]").addEventListener("click", function () { modal.remove(); confirm(); });
    root.appendChild(modal);
  }

  var host = findHostWindow();
  if (config.mode === "host") {
    var hostRegistry = ensureRegistry(host);
    if (!hostRegistry) return;
    hostRegistry.start();
    try {
      host.dispatchEvent(new host.CustomEvent("HYPNOOS_FLOATING_REGISTRY_READY", { detail: { revision: config.revision } }));
    } catch (_) {}
    return;
  }

  document.documentElement.dataset.hypnoosStagingOnly = "true";
  var style = document.createElement("style");
  style.textContent = stageCss();
  document.head.appendChild(style);
  var root = document.createElement("div");
  root.id = "hypnoos-operation-placeholder";
  document.body.replaceChildren(root, script);

  var stageAttached = false;
  var unsubscribe = function () {};
  var ownMessageId = "";
  function attachStage(registry) {
    if (stageAttached || !registry) return;
    stageAttached = true;
    ownMessageId = messageIdFromWindow() || registry.getWritableId() || "current";
    registry.register({ token: token, messageId: ownMessageId, view: window, config: config });
    unsubscribe = registry.subscribeStage(function () { renderStage(registry, root, ownMessageId); });
    renderStage(registry, root, ownMessageId);
  }
  function registryReady() {
    try {
      var registry = host.__ST_HYPNOOS_FLOATING_SINGLETON__;
      if (registry && registry.revision === config.revision) attachStage(registry);
    } catch (_) {}
  }
  registryReady();
  if (!stageAttached) {
    root.innerHTML = "<section class='stage'><div class='empty waiting'>酒馆助手正在启动悬浮手机与暂存队列…</div></section>";
    try { host.addEventListener("HYPNOOS_FLOATING_REGISTRY_READY", registryReady); } catch (_) {}
  }

  window.addEventListener("pagehide", function () {
    try { host.removeEventListener("HYPNOOS_FLOATING_REGISTRY_READY", registryReady); } catch (_) {}
    try { unsubscribe(); } catch (_) {}
    try { host.__ST_HYPNOOS_FLOATING_SINGLETON__?.unregister?.(ownMessageId, token); } catch (_) {}
  }, { once: true });
})();
