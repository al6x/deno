import * as driver from "https://deno.land/x/puppeteer@9.0.1/mod.ts"

// `launch` exported as default and doesn't works correctly otherwise
import driver_default_import from "https://deno.land/x/puppeteer@9.0.1/mod.ts"

export { driver, driver_default_import }