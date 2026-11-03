/**
 * The three calls the engine makes to Tally's API: create a form, replace a
 * form's blocks and settings, and read a form back.
 *
 * Endpoints and request bodies follow the API reference at
 * https://developers.tally.so. A PATCH replaces the whole `blocks` array: a
 * block left out is deleted, so a push always sends the complete form.
 */
import {z} from "zod";

/** @import {Block, TallySettings} from "./index.d.mts" */

const API = "https://api.tally.so";

/** The page a form is edited on, for a person to open. */
export const EDITOR = "https://tally.so/forms";

/** The state a new form is created in: a draft, until it is published in
 *  Tally's editor. */
export const FORM_STATUS = Object.freeze({
  Draft: "DRAFT",
});

/** A form's identity and state, as every call returns it. */
const formSummary = z.object({
  id: z.string(),
  name: z.string().nullable(),
  status: z.string(),
});

/**
 * A form with its blocks, as `GET /forms/{id}` returns it. A block's type is
 * kept as Tally's own string: a form edited in Tally's editor can hold block
 * types this engine never writes.
 */
const tallyForm = formSummary.extend({
  settings: z.record(z.string(), z.unknown()).nullable(),
  blocks: z.array(z.object({
    uuid: z.string(),
    type: z.string(),
    groupUuid: z.string(),
    groupType: z.string(),
    payload: z.record(z.string(), z.unknown()),
  })),
});

/** @typedef {z.infer<typeof formSummary>} FormSummary */
/** @typedef {z.infer<typeof tallyForm>} TallyForm */

/**
 * A client for one account's forms. Tally answers a create or replace with
 * the form's summary and no blocks, so a push reads the blocks back itself.
 * @param {string} apiKey
 */
export function tallyClient(apiKey) {
  /**
   * @template T
   * @param {z.ZodType<T>} shape
   * @param {{method: "GET" | "POST" | "PATCH", path: string, body?: unknown}} request
   * @returns {Promise<T>}
   */
  async function call(shape, {method, path, body}) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json"},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = `${response.status} ${await response.text()}`;
      throw new Error(`Tally ${method} ${path}: ${detail}`);
    }
    return shape.parse(await response.json());
  }

  return {
    /** Create a form as a draft and return it, with the id Tally assigned.
     *  @param {Block[]} blocks @param {TallySettings} settings */
    create: (blocks, settings) => call(formSummary,
      {method: "POST", path: "/forms",
        body: {status: FORM_STATUS.Draft, blocks, settings}}),
    /** Replace a form's blocks and settings with these.
     *  @param {string} formId @param {Block[]} blocks
     *  @param {TallySettings} settings */
    replace: (formId, blocks, settings) => call(formSummary,
      {method: "PATCH", path: `/forms/${formId}`, body: {blocks, settings}}),
    /** @param {string} formId */
    read: (formId) => call(tallyForm, {method: "GET", path: `/forms/${formId}`}),
  };
}
