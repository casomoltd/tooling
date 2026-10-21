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
 *   buttondown tokens              rewrite the web skin's TOKENS block
 *   buttondown emit <dir>          write each long field out as rendered
 *   buttondown draft <file.md>     create or replace a draft
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
  apply, assertApiPath, assertNotSending, client, draft, drift, emit,
  loadSettings, readKey, runCheck, upload, writeTokens,
} from "../buttondown/engine.mjs";

/** The one flag: without it, `api` refuses any call that could send an
 *  email, and no other command takes it. */
const SEND_FLAG = "--send";

const USAGE = "usage: buttondown [diff|apply|check|tokens|emit <dir>|"
  + `draft <file.md>|upload <image>|api <METHOD> <path> [json] [${SEND_FLAG}]]`;

/** Each command with the fewest and most arguments it takes. */
const ARGS = {
  diff: [0, 0], apply: [0, 0], check: [0, 0], tokens: [0, 0],
  emit: [1, 1], draft: [1, 1], upload: [1, 1], api: [2, 3],
};

const argv = process.argv.slice(2);
const send = argv.includes(SEND_FLAG);
const [command = "diff", ...args] = argv.filter((a) => a !== SEND_FLAG);
const [fewest, most] = ARGS[command] ?? [];
const badUsage = fewest === undefined || args.length < fewest
  || args.length > most || (send && command !== "api");
if (badUsage) {
  console.error(USAGE);
  process.exit(2);
}

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
    console.log(res.status, res.data ? JSON.stringify(res.data, null, 2) : "");
    process.exit(res.ok ? 0 : 1);
  }
}
