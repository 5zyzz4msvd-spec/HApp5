export const VERSION_NAME = process.env.HYPNOOS_VERSION_NAME || "v5.0";
export const CARD_DISPLAY_NAME = process.env.HYPNOOS_CARD_DISPLAY_NAME || `催眠app二改 ${VERSION_NAME}（louisHM 完全免费）`;
export const LOCAL_CARD_BASENAME = process.env.HYPNOOS_LOCAL_CARD_BASENAME || `${CARD_DISPLAY_NAME} 本地版.png`;
export const RELEASE_CARD_BASENAME = process.env.HYPNOOS_RELEASE_CARD_BASENAME || `${CARD_DISPLAY_NAME} 发布版.png`;
export const LOCAL_CARD_PATH = process.env.HYPNOOS_LOCAL_CARD_PATH || `public/cards/${LOCAL_CARD_BASENAME}`;
export const RELEASE_CARD_PATH = process.env.HYPNOOS_RELEASE_CARD_PATH || `public/cards/${RELEASE_CARD_BASENAME}`;
export const CARD_BASENAME = process.env.HYPNOOS_CARD_BASENAME || `${CARD_DISPLAY_NAME}.png`;
export const CARD_PATH = process.env.HYPNOOS_CARD_PATH || (process.env.HYPNOOS_RELEASE_CARD === "1" ? RELEASE_CARD_PATH : LOCAL_CARD_PATH);
export const CARD_COVER_PATH = "src/card-cover/classroom-three-mascots-five-v2.640x800.png";
export const DIST_REPO = "5zyzz4msvd-spec/HApp5";
export const DIST_REPO_URL = `https://github.com/${DIST_REPO}.git`;
export const SOURCE_DIR = "source";
export const DIST_WEBVIEW_DIR = "dist/webview";
export const DIST_PHONE_DIR = "dist/phone";

export function remoteFrontendUrl(commit) {
  return `https://cdn.jsdelivr.net/gh/${DIST_REPO}@${commit}/dist/webview/st-load-inline.html`;
}

export function remotePhoneFrontendUrl(commit) {
  return `https://cdn.jsdelivr.net/gh/${DIST_REPO}@${commit}/dist/phone/st-load-inline.html`;
}

export function remoteIdentityFrontendUrl(commit) {
  return `https://cdn.jsdelivr.net/gh/${DIST_REPO}@${commit}/dist/webview/identity.html`;
}

export function remoteAssetBase(commit) {
  return `https://cdn.jsdelivr.net/gh/${DIST_REPO}@${commit}/dist/webview/assets/`;
}
