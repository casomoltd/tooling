/** Where a site's Tally API key comes from, as `tally` in its
 *  casomo.config.mjs says. */
export interface TallyKeySource {
  /** The variable that holds the key for an account with no key file. */
  readonly apiKeyEnv: string;
  /** The account's own key file, as the config writes it (`~/` is the
   *  account's home), or undefined where the site names none. */
  readonly apiKeyFile: string | undefined;
}

/** Where the key comes from, read from the casomo.config.mjs under `root`
 *  (the working directory by default). Throws where the config lacks any of
 *  `tally.forms`, `registry`, `pushed`, `globals` or `stylesheet`, or where
 *  `apiKeyFile` is empty or not a string. */
export declare function loadTallySettings(root?: string): Promise<TallyKeySource>;

/** The API key: the file `apiKeyFile` names, where this account has one,
 *  else the variable `apiKeyEnv` names. A key file that is there but empty or
 *  unreadable is refused, never skipped for the variable. Throws where
 *  neither gives a key. */
export declare function tallyApiKey(settings: TallyKeySource): Promise<string>;
