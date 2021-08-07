import { sec, mb } from 'base/base.ts'
import { Log } from 'base/log.ts'
import * as fs from 'base/fs.ts'
import { Page, PageOptions, to_page_options } from './parser.ts'
import { driver, driver_default_import } from './deps.ts'

export interface PoolOptions {
  readonly headless:        boolean
  // readonly pool_size:       number
  readonly page_used_count: number
  readonly delay:           () => Promise<void>
  readonly id?:             string // Used for logging
}

export type WithPage = <T>(cb: ((page: Page) => Promise<T>)) => Promise<T>

const default_options: PoolOptions = {
  headless:        true,
  // pool_size:       2,
  page_used_count: 11,
  delay:           () => sleep(1 * sec + Math.random() * 2 * sec)
}

export class Pool {
  protected browser:          driver.Browser | undefined
  protected page:             Page | undefined
  protected page_used_count = 0
  protected is_first_call   = true
  public readonly options:          PoolOptions
  public readonly page_options:    PageOptions
  public readonly log:              Log

  constructor(
    options:      Partial<PoolOptions>  = {},
    page_options: Partial<PageOptions> = {}
  ) {
    this.options = { ...default_options, ...options }
    // if (page_options.tmp_dir) assert(fs.is_tmp_dir(page_options.tmp_dir), fs.notTmpDirectoryMessage)
    this.page_options = to_page_options(page_options)
    this.log = new Log(options.id || 'parser_pool')
  }

  async close_page() {
    if (this.page) {
      this.log.debug('closing page')
      await sleep(200) // Otherwise sometimes it prints error
      try { await this.page.close() } catch(e) {}
    }

    if (this.browser) {
      this.log.debug('closing browser')
      await sleep(200) // Otherwise sometimes it prints error
      try { await this.browser.close() } catch(e) {}
      await sleep(2000)
    }

    this.page            = undefined
    this.browser         = undefined
    this.page_used_count = 0
  }

  protected async create_new_page_and_close_existing(): Promise<Page> {
    await this.close_page()

    await fs.remove_mp_dir(this.page_options.tmp_dir)

    this.log.debug('opening page')
    this.browser = await driver_default_import.launch({
      headless:        this.options.headless,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        // Options to reduce CPU usage
        '--single-process',
        '--disable-gpu',
        '--disable-canvas-aa',
        '--disable-2d-canvas-clip-aa',
        '--disable-gl-drawing-for-tests'
      ]
    } as any)

    const page = await Page.build(this.browser, this.page_options)
    // Increasing buffer size for responses
    await (page.page as any)._client.send('Network.enable', {
      maxResourceBufferSize: 400 * mb,
      maxTotalBufferSize:    1000 * mb,
    })
    return page
  }

  with_page = async<T> (cb: ((page: Page) => Promise<T>), retry = false): Promise<T> => {
    this.page_used_count += 1

    // Delay, except for the very first call
    if (this.is_first_call) this.is_first_call = false
    else                    await this.options.delay()

    // Checking if page used too much and should be re-created
    if (this.page_used_count > this.options.page_used_count) await this.close_page()

    if (!this.page) this.page = await this.create_new_page_and_close_existing()

    try {
      return await cb(this.page)
    } catch (e) {
      if (!retry) throw e

      // Retrying with new page
      this.log.debug('retrying')
      this.page = await this.create_new_page_and_close_existing()
      await this.options.delay()
      return await cb(this.page)
    }
  }

  with_page_and_retry: WithPage = <T>(cb: ((page: Page) => Promise<T>)): Promise<T> => {
    return this.with_page(cb, true)
  }
}


// Test --------------------------------------------------------------------------------------------
// deno run -A --unstable craw1/pool.ts
if (import.meta.main) {
  const pool = new Pool({ headless: true })

  const result = await pool.with_page(async (page) => {
    await page.goto("https://example.com")

    const header = await page.catch_until(async () => {
      const h1 = await page.find_one('h1')
      return await h1.text()
    })

    return header
  })

  p(result)
  pool.close_page()
}