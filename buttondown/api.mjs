/**
 * The Buttondown API as the `buttondown` command reaches it: the key, a
 * client pinned to the one newsletter, and the guards that refuse a call
 * writing to another newsletter or sending an email.
 */
import {readFile} from "node:fs/promises";
import os from "node:os";

const API = "https://api.buttondown.com/v1";

/** The API's own path prefix, which every request path sits under. */
const API_PATH = new URL(API).pathname;

/** The status of an email not yet sent. */
export const DRAFT = "draft";

/**
 * The api routes that can mail someone, judged on a `requestPath`. A write
 * to the emails collection or to one email may carry a status that sends
 * it, so it passes only as a draft; any action on an email (publish,
 * send-draft and whatever Buttondown adds) or on a subscriber (a reminder,
 * an email to one reader) is refused outright, so a new route fails closed.
 * Creating an unactivated subscriber also mails a confirmation, and stays
 * allowed: it is how a manual test stands in for a reader signing up, to an
 * address the tester owns.
 */
const EMAIL_WRITE = new RegExp(`^${API_PATH}/emails(/[^/]+)?/?$`);
const SENDING_ACTION = new RegExp(`^${API_PATH}/(emails|subscribers)/[^/]+/.`);

/** The API key, from the file `BUTTONDOWN_KEY_FILE` names: a path can be
 *  passed around freely, while a key on a command line sits in the shell
 *  history and in `ps`. */
export async function readKey(env = process.env) {
  const file = env.BUTTONDOWN_KEY_FILE;
  if (!file) {
    throw new Error("set BUTTONDOWN_KEY_FILE to the file holding the key");
  }
  const key = (await readFile(file.replace(/^~(?=\/)/, os.homedir()),
    "utf8")).trim();
  if (!key) throw new Error(`${file} is empty`);
  return key;
}

/**
 * A client for the one newsletter. The key reaches every newsletter on the
 * account, so each request carries Buttondown-Context with this id, and
 * Buttondown refuses an unknown id rather than falling back to the
 * account's default newsletter.
 */
export function client(settings, key) {
  const {newsletter} = settings;
  async function call(method, url, body, {form} = {}) {
    const res = await fetch(requestUrl(url), {
      method,
      headers: {
        Authorization: `Token ${key}`,
        "Buttondown-Context": newsletter.id,
        ...(form ? {} : {"Content-Type": "application/json"}),
      },
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Reported as the detail, so a non-JSON refusal still says why.
      data = {detail: text};
    }
    return {ok: res.ok, status: res.status, data};
  }

  /** Writing to the wrong newsletter must not happen, so the newsletter
   *  read before a write and the one a write returns are both checked.
   *  Buttondown names a newsletter by its UUID and, on some endpoints, a
   *  prefixed `publicId`; only those two are accepted. */
  function assertNewsletter(got, when) {
    const ids = [newsletter.id, newsletter.publicId].filter(Boolean);
    if (!ids.includes(got?.id) || got?.username !== newsletter.username) {
      throw new Error(`${when}: got ${got?.username} (${got?.id}), `
        + `expected ${newsletter.username} (${newsletter.id})`);
    }
  }

  async function live() {
    const res = await call("GET", newsletterPath(newsletter));
    if (!res.ok) throw new Error(`GET newsletter: ${detail(res)}`);
    assertNewsletter(res.data, "before writing");
    return res.data;
  }

  /** Every page of a list endpoint. A failed page throws: an empty list
   *  would read as "none on the account" and skip what is there. */
  async function list(url) {
    const items = [];
    for (let next = url; next;) {
      const res = await call("GET", next);
      if (!res.ok) throw new Error(`GET ${next}: ${detail(res)}`);
      items.push(...res.data.results);
      const more = res.data.next && new URL(res.data.next);
      next = more ? more.pathname.slice(API_PATH.length) + more.search : null;
    }
    return items;
  }

  return {call, assertNewsletter, live, list};
}

/**
 * Refuses an `api` call that writes newsletter settings anywhere but this
 * newsletter, judged on the path the server routes (`requestPath`).
 */
export function assertApiPath(settings, method, url) {
  if (method.toUpperCase() === "GET") return;
  const pathname = requestPath(url);
  const own = (API_PATH + newsletterPath(settings.newsletter)).toLowerCase();
  if (pathname.startsWith(`${API_PATH}/newsletters`)
    && pathname !== own && !pathname.startsWith(`${own}/`)) {
    throw new Error(`api writes under /newsletters only to ${own}`);
  }
}

/**
 * Throws if an api call could send or schedule an email (`EMAIL_WRITE`,
 * `SENDING_ACTION`). Sending reaches real inboxes and cannot be recalled, so
 * the caller lets a call through only on a person's explicit say-so.
 */
export function assertNotSending(method, url, body) {
  const cannotSend = ["GET", "DELETE"].includes(method.toUpperCase());
  if (cannotSend) return;
  const pathname = requestPath(url);
  const status = body && typeof body === "object" ? body.status : undefined;
  const creates = pathname.replace(/\/$/, "") === `${API_PATH}/emails`;
  const draftOnly = status === DRAFT || (status === undefined && !creates);
  if (SENDING_ACTION.test(pathname)
    || (EMAIL_WRITE.test(pathname) && !draftOnly)) {
    throw new Error(`api refuses a call that could send an email: `
      + `${method.toUpperCase()} ${url}`);
  }
}

/** Why a call failed: Buttondown's `detail`, else its whole body, which
 *  names the fields it refused, else the status. */
export function detail(res) {
  return JSON.stringify(res.data?.detail ?? res.data ?? res.status);
}

/** The api path of the one newsletter, by its id. */
export function newsletterPath(newsletter) {
  return `/newsletters/${newsletter.id}`;
}

/** The URL `call` fetches for an api path, and the one the guards judge. */
function requestUrl(url) {
  return new URL(API + url);
}

/**
 * The path the server routes for an `api` url, from `requestUrl`,
 * then percent-decoded, slash-collapsed and normalised, so
 * `/%6eewsletters/<other>`, `//emails/<id>/publish`, `/./newsletters/<other>`
 * and `<own>/../<other>` are seen for what they are. A path still encoded
 * after one decoding is refused outright rather than guessed at.
 */
function requestPath(url) {
  const decoded = decodeURIComponent(requestUrl(url).pathname);
  if (decoded.includes("%")) {
    throw new Error(`api refuses an encoded path: ${url}`);
  }
  return new URL(decoded.replace(/\/{2,}/g, "/"), API).pathname.toLowerCase();
}
