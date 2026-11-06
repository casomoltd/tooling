#!/usr/bin/env node
/**
 * Keep a Buttondown newsletter as code: apply it, gate it, and work with
 * its drafts. Settings are under `buttondown` in the repo's
 * casomo.config.mjs (see buttondown/engine.mjs); the API key is read from
 * the file `BUTTONDOWN_KEY_FILE` names.
 *
 *   buttondown [diff]              what live differs in: fields and tags
 *   buttondown apply               patch what differs
 *   buttondown check               gate the skins and settings (no key)
 *   buttondown check <file.md>     gate one post's copy (no key)
 *   buttondown tokens              rewrite the web skin's TOKENS block
 *   buttondown emit <dir>          write each long field out as rendered
 *   buttondown draft <file.md>     gate the post, then create or replace
 *                                  its draft
 *   buttondown upload <image>      upload an image, print its URL
 *   buttondown api <METHOD> <path> [json] [--send]
 *                                  any call, for setting up a manual test;
 *                                  one that sends or schedules an email
 *                                  is refused without --send
 *
 * `diff`, `apply` and `check` exit 1 on drift, a refusal or a problem, so a
 * script can gate on them.
 */
import {
  assertApiPath, assertNotSending, client, readKey,
} from "../buttondown/api.mjs";
import {
  apply, draft, drift, emit, loadSettings, runCheck, upload, writeTokens,
} from "../buttondown/engine.mjs";
import {checkPost} from "../buttondown/post-check.mjs";

/** The one flag: without it, `api` refuses any call that could send an
 *  email, and no other command takes it. */
const SEND_FLAG = "--send";

const USAGE = "usage: buttondown [diff|apply|check [file.md]|tokens|emit <dir>|"
  + `draft <file.md>|upload <image>|api <METHOD> <path> [json] [${SEND_FLAG}]]`;

/** The exit status for a command line that can't be run as written,
 *  apart from 1, which every command uses for a refusal or a problem. */
const EXIT_USAGE = 2;

/** The indent `api` prints a response body with. */
const JSON_INDENT = 2;

/** `api` takes a method and a path, and optionally a JSON body. */
const API_ARGS = ["method", "path", "json"];

/** Each command with the fewest and most arguments it takes. */
const ARGS = {
  diff: [0, 0], apply: [0, 0], check: [0, 1], tokens: [0, 0],
  emit: [1, 1], draft: [1, 1], upload: [1, 1],
  api: [API_ARGS.length - 1, API_ARGS.length],
};

/** Print a post's warnings and problems; true when it may go. */
async function postPasses(file) {
  const {problems, warnings} = await checkPost(file, {root: process.cwd()});
  for (const w of warnings) console.warn(`buttondown check: warning: ${w}`);
  if (problems.length) {
    console.error(`buttondown check: ${file}:\n  ${problems.join("\n  ")}`);
    return false;
  }
  console.log(`buttondown check: ${file} clean`);
  return true;
}

/** `node` and this script come first in `process.argv`. */
const OWN_ARGS_FROM = 2;

const argv = process.argv.slice(OWN_ARGS_FROM);
const send = argv.includes(SEND_FLAG);
const [command = "diff", ...args] = argv.filter((a) => a !== SEND_FLAG);
const [fewest, most] = ARGS[command] ?? [];
const badUsage = fewest === undefined || args.length < fewest
  || args.length > most || (send && command !== "api");
if (badUsage) {
  console.error(USAGE);
  process.exit(EXIT_USAGE);
}

const checksOnePost = command === "check" && args.length > 0;
if (checksOnePost) process.exit(await postPasses(args[0]) ? 0 : 1);

const settings = await loadSettings();
const api = async () => client(settings, await readKey());

switch (command) {
  case "diff": {
    const {differs, tags} = await drift(settings, await api());
    const all = [...differs, ...tags.map((t) => `tag ${t.body.name}`)];
    console.log(all.length
      ? `buttondown: live differs in ${all.join(", ")}`
      : "buttondown: live matches");
    process.exit(all.length ? 1 : 0);
    break;
  }
  case "apply": {
    const {refused} = await apply(settings, await api());
    if (refused.length) {
      console.error(`buttondown: refused ${refused.join(", ")}`);
      process.exit(1);
    }
    break;
  }
  case "check": {
    const problems = await runCheck(settings);
    if (problems.length) {
      console.error(`buttondown check:\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log("buttondown check: clean");
    break;
  }
  case "tokens":
    await writeTokens(settings);
    console.log("buttondown: TOKENS block written");
    break;
  case "emit":
    for (const field of await emit(settings, args[0])) console.log(field);
    break;
  case "draft":
    if (!await postPasses(args[0])) process.exit(1);
    await draft(settings, await api(), args[0]);
    break;
  case "upload":
    console.log(await upload(await api(), args[0]));
    break;
  case "api": {
    const [method, url, body] = args;
    assertApiPath(settings, method, url);
    const payload = body && JSON.parse(body);
    if (!send) {
      try {
        assertNotSending(method, url, payload);
      } catch (e) {
        console.error(`buttondown: ${e.message}; add ${SEND_FLAG} to send it`);
        process.exit(1);
      }
    }
    const res = await (await api()).call(method.toUpperCase(), url, payload);
    const shown = res.data ? JSON.stringify(res.data, null, JSON_INDENT) : "";
    console.log(res.status, shown);
    process.exit(res.ok ? 0 : 1);
  }
}
