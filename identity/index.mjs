/**
 * The public face of the identity entry: what a site imports. The value
 * lives in organization.mjs, where the typecheck can read it against the
 * declaration here; beside a .d.mts, TypeScript would skip it.
 */
export {
  CASOMO_ORGANIZATION,
  COMPANY_REGISTER,
  ICO_REGISTER,
  REGISTERED_OFFICE,
} from "./organization.mjs";
