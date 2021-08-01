import 'base/base.ts'
import { Log } from 'base/log.ts'
import * as fs from 'base/fs.ts'
import { block_urls } from './helpers.ts'
import { driver } from "./deps.ts"

declare const document: any

// CFrame ------------------------------------------------------------------------------------------
export abstract class AbstractFrame {
  public readonly log: Log

  protected readonly next_id = build_id_generator()
  protected          last_ids = ''

  constructor(
    public readonly frame:     driver.Frame,
    public readonly options:   PageOptions,
  ) {
    this.log = new Log(options.id || 'parser')
  }

  async find(query: string, condition?: (element: PElement) => Promise<boolean>): Promise<PElement[]> {
    const handles = await this.frame.$$(query)
    const elements = handles.map(
      (handle) => new PElement(this.frame, handle, this.next_id, this.options))
    if (condition) {
      const filtered = []
      for (const element of elements) if (await condition(element)) filtered.push(element)
      return filtered
    } else return elements
  }

  async find_one(query: string, condition?: (element: PElement) => Promise<boolean>): Promise<PElement> {
    const found = await this.find(query, condition)
    assert.equal(found.length, 1, `required to find exactly 1 '${query}' but found ${found.length}`)
    return found[0]
  }

  // async find_parents(query: string, condition?: (element: PElement) => Promise<boolean>): Promise<PElement[]> {
  //   const handles = await this.frame.$$(query)
  //   const elements = handles.map(
  //     (handle) => new PElement(this.frame, handle, this.next_id, this.options))
  //   if (condition) {
  //     const filtered = []
  //     for (const element of elements) if (await condition(element)) filtered.push(element)
  //     return filtered
  //   } else return elements
  // }

  async size(query: string): Promise<number> { return (await this.find(query)).length }

  async has(query: string, condition?: (element: PElement) => Promise<boolean>): Promise<boolean> {
    return (await this.find(query, condition)).length > 0
  }

  async has_text(query: string, regex: RegExp): Promise<boolean> {
    const elements = await this.find(query)
    for (const element of elements) {
      const text = await element.text()
      if (regex.test(text)) return true
    }
    return false
  }

  async outer_html(): Promise<string> { return this.evaluate(() => document.documentElement.outerHTML) }

  async inner_html(): Promise<string> { return this.frame.evaluate(() => document.documentElement.innerHTML) }

  async evaluate<Input extends driver.Serializable, Output>(
    fn: (input: Input) => Output, input: Input
  ): Promise<Output>
  async evaluate<Output>(fn: () => Output): Promise<Output>
  async evaluate(fn: any, input?: any) { return this.frame.evaluate(fn, input) }

  url(): string { return '' + this.frame.url() }
}

export class Frame extends AbstractFrame {
  constructor(
    public readonly parent:  Page,
                    frame:   driver.Frame,
                    options: PageOptions
  ) {
    super(frame, options)
  }
}

// Page --------------------------------------------------------------------------------------------
export interface PageOptions {
  readonly show:       boolean
  readonly block:      (RegExp | ((url: string) => boolean))[]
  readonly timeout_ms: number
  readonly tmp_dir:    string // Will be created automatically
  readonly id?:        string // Used for logging
}

const default_options = {
  show:       false,
  block:      block_urls,
  timeout_ms: 30 * 1000
  // log:        true
}

export const to_page_options = (options: Partial<PageOptions>): PageOptions => {
  const tmp_dir = options.tmp_dir || Deno.makeTempDirSync()
  return ({ ...default_options, ...options, tmp_dir })
}

export type IsDownloadAborted = (page: Page) => Promise<{ aborted: false } | { aborted: true, reason: string }>

export class Page extends AbstractFrame {
  protected readonly is_blocked_checks: ((url: string) => boolean)[]

  constructor(
    public readonly page:    driver.Page,
                    options: Partial<PageOptions> = {}
  ) {
    super(page.mainFrame(), to_page_options(options))
    this.is_blocked_checks = this.options.block.map((reFn) =>
      reFn instanceof Function ? reFn : (url: string) => reFn.test(url))
  }

  protected async prepare() {
    await this.page.setRequestInterception(true)
    this.page.on('request', (request) => {
      const url = request.url(), isBlocked = this.is_blocked(url)
      if (isBlocked) {
        request.abort()
      } else {
        // this.log('debug', `loading ${url}`)
        request.continue()
      }
    })
  }

  is_blocked(url: string): boolean { return this.is_blocked_checks.some((fn) => fn(url)) }

  async goto(url: string): Promise<void> {
    this.log.debug(`opening ${url}`)
    await this.frame.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeout_ms })
    await this.frame.addStyleTag({ content: build_styles() })
  }

  async save_as_file(path: string, callback: () => Promise<void>, abort?: IsDownloadAborted): Promise<void> {
    // Creating tmp dir
    const tmp_download_dir = fs.resolve(this.options.tmp_dir, `tmp-${('' + Math.random()).replace(/.*\./, '')}`)
    await fs.create_dir(tmp_download_dir)

    await this.frame._frameManager._client.send('Page.setDownloadBehavior', {
      behavior:     'allow',
      downloadPath: tmp_download_dir,
    })

    // Initiating download
    await callback()

    // Waiting for download to complete
    let file_name: string | undefined = undefined
    const started = Date.now()
    while (!file_name || file_name.endsWith('.crdownload')) {
      if ((Date.now() - started) > this.options.timeout_ms) throw new Error(`download timed out`)
      await sleep(50)
      file_name = (await fs.read_dir(tmp_download_dir))[0]?.name
      if (abort) {
        const aborted = await abort(this)
        if (aborted.aborted) throw new Error(aborted.reason || 'download aborted')
      }
    }

    // Renaming downloaded file
    const tmpFilePath = fs.resolve(tmp_download_dir, file_name)
    assert((await fs.get_type(tmpFilePath)) == 'file', `download '${tmpFilePath}' is not a file`)
    await fs.move(tmpFilePath, path, { overwrite: true })
    this.log.debug(`file saved as ${path}`)

    // Cleaning tmp dir
    await fs.remove_mp_dir(tmp_download_dir)
  }

  async download({ url }: { url: string }): Promise<void> {
    this.log.debug(`opening ${url}`)
    await this.evaluate((url) => {
      const link = document.createElement('a')
      link.setAttribute('href', url)
      document.body.appendChild(link)
      link.click()
    }, url)
  }

  close(): Promise<void> { return this.page.close() }

  static async build(browser: driver.Browser, options: Partial<PageOptions> = {}): Promise<Page> {
    const page = await browser.newPage()
    const qpage = new Page(page, options)
    await qpage.prepare()
    return qpage
  }

  // Dave every downloaded resource to disk, mostly needed for inspection
  on_response(cb: (url: string, get_data: () => Promise<string>) => void): ResponseListener {
    const listener = async (response: driver.HTTPResponse) => {
      const url = response.url()
      // Delaying `buffer.toString('utf-8')` because it would cause error on redirect
      cb(url, async () => (new TextDecoder("utf-8")).decode(await response.arrayBuffer()))
    };
    this.page.on('response', listener)
    return listener
  }
  off_response(listener: ResponseListener) {
    this.page.off('response', listener)
  }

  // Handy wrapper around `on_response`
  async wait_response(
    is_awaited_response: (url: string, get_data: () => Promise<string>) => boolean | Promise<boolean>
  ): Promise<{ url: string, data: string }> {
    let
      response_listener: ResponseListener | undefined = undefined,
      response: { is_error: false, url: string, get_data: () => Promise<string> } |
                { is_error: true, error: Error } |
                undefined
    try {
      response_listener = this.on_response(async (url, get_data) => {
        try {
          const result_or_promise = is_awaited_response(url, get_data)
          const result = result_or_promise instanceof Promise ? (await result_or_promise) : result_or_promise
          if (result) response = { is_error: false, url, get_data }
        } catch (e) {
          response = { is_error: true, error: ensure_error(e, 'unknown async error') }
        }
      })
      await this.wait_until(() => !!response)
    } finally {
      if (response_listener) this.off_response(response_listener)
    }
    if (!response) throw new Error(`internal error response not defined`)
    if (response.is_error) throw response.error
    return { url: response.url, data: await response.get_data() }
  }

  // Dave every downloaded resource to disk, mostly needed for inspection
  dump_everything_to(path: string) {
    this.page.on('response', async (response) => {
      const url = new URL(response.url())
      const file_path = fs.resolve(path,
        url.pathname.slice(0, 255).replace(/^\//, '').replace(/[^a-z0-9\-\.]/gi, '-'))
      await fs.write_file(file_path, new Uint8Array(await response.arrayBuffer()))
    })
  }

  frames() { return this.page.mainFrame().childFrames().map((frame) => new Frame(this, frame, this.options)) }

  wait_until<T>(condition: () => boolean,              custom_delay_ms?: number): Promise<void>
  wait_until<T>(condition: () => Promise<boolean>,     custom_delay_ms?: number): Promise<void>
  wait_until<T>(condition: () => Promise<boolean | T>, custom_delay_ms?: number): Promise<T>
  async wait_until<T>(condition: () => boolean | Promise<boolean | T>, custom_delay_ms?: number) {
    const started = Date.now()
    let delay = 10
    while (true) {
      const unresolved_result = condition()
      const result = unresolved_result instanceof Promise ? await unresolved_result : unresolved_result
      if (result !== false) return result as any

      const now = Date.now()
      if ((now - started) > this.options.timeout_ms) throw new Error("waitUntil timed out")

      const sleep_ms = custom_delay_ms !== undefined ? custom_delay_ms : delay
      const max_sleep_ms = this.options.timeout_ms - (now - started)
      await sleep(sleep_ms > max_sleep_ms ? max_sleep_ms : sleep_ms)

      // Progressive delay
      delay = delay > 500 ? 500 : 2 * delay
    }
  }


  catch_until<T>(condition: () => boolean,              custom_delay_ms?: number): Promise<void>
  catch_until<T>(condition: () => Promise<boolean>,     custom_delay_ms?: number): Promise<void>
  catch_until<T>(condition: () => Promise<boolean | T>, custom_delay_ms?: number): Promise<T>
  async catch_until<T>(condition: () => boolean | Promise<boolean | T>, custom_delay_ms?: number) {
    const started = Date.now()
    let delay = 10
    while (true) {
      let _e: any = undefined
      try {
        const unresolved_result = condition()
        const result = unresolved_result instanceof Promise ? await unresolved_result : unresolved_result
        if (result !== false) return result as any
      } catch (e) { _e = e }

      const now = Date.now()
      if ((now - started) > this.options.timeout_ms) throw _e || (new Error("catch_until timed out"))
      // if ((now - started) > this.options.timeout) throw new Error("waitUntil timed out")

      const sleep_ms = custom_delay_ms !== undefined ? custom_delay_ms : delay
      const max_sleep_ms = this.options.timeout_ms - (now - started)
      await sleep(sleep_ms > max_sleep_ms ? max_sleep_ms : sleep_ms)

      // Progressive delay
      delay = delay > 500 ? 500 : 2 * delay
    }
  }

  async try_until(action: () => Promise<void>, condition: () => Promise<boolean>, delay_ms: number): Promise<void> {
    const started = Date.now()
    while (true) {
      let _e: any = undefined
      try {
        await action()
        const result = await condition()
        if (result) return result as any
      } catch (e) { _e = e }

      const now = Date.now()
      if ((now - started + delay_ms) > this.options.timeout_ms) throw _e || (new Error("tryUntil timed out"))

      await sleep(delay_ms)
    }
  }
}


// PElement -----------------------------------------------------------------------
export class PElement {
  constructor(
    public readonly    frame:   driver.Frame,
    public readonly    handle:  driver.ElementHandle,
    protected readonly nextId:  () => number,
    protected readonly options: PageOptions
  ) {}

  async unique_id() {
    const id_attr = 'PElement-id'
    const get_id = async () => await this.evaluate((element, idAttr) => element[idAttr], id_attr)
    let id = await get_id()
    if (id) return id
    await this.evaluate((element, { id_attr, id }) => element[id_attr] = id,
      { id_attr, id: "PElement-" + this.nextId() })
    return await get_id()
  }

  async find(query: string): Promise<PElement[]> {
    const handles = await this.handle.$$(query)
    const elements = handles.map(
      (handle) => new PElement(this.frame, handle, this.nextId, this.options))
    return elements
  }

  async find_one(query: string): Promise<PElement> {
    const found = await this.find(query)
    assert.equal(found.length, 1, `required to find exactly 1 '${query}' but found ${found.length}`)
    return found[0]
  }

  async select_value(value: string | number | boolean): Promise<void> {
    assert.equal(await this.tag_name(), 'select', `selection can be used for <select> element only`)
    this.set_value('' + value)
    // await this.evaluate((element, value) => {
    //   element.value = value
    //   element.dispatchEvent(new Event('change', { bubbles: true }))
    // }, '' + value)
  }

  async set_value(value: string | number): Promise<void> {
    await this.evaluate((element, value) => {
      element.value = value
      element.dispatchEvent(new Event('change', { bubbles: true }))
    }, '' + value)
  }

  async size(query: string): Promise<number> { return (await this.find(query)).length }

  async has(query: string): Promise<boolean> { return (await this.find(query)).length > 0 }

  async has_text(query: string, regex: RegExp): Promise<boolean> {
    const elements = await this.find(query)
    for (const element of elements) {
      const text = await element.text()
      if (regex.test(text)) return true
    }
    return false
  }

  async tag_name(): Promise<string> { return this.evaluate((el) => el.tagName.toLowerCase()) }

  async attr(name: string): Promise<string> {
    const result = await this.evaluate((element, name) => element.getAttribute(name), name)
    return result === undefined || result === null ? '' : '' + result
  }

  async text(): Promise<string> {
    const result = await this.evaluate((element) => element.textContent)
    return result === undefined || result === null ? '' : '' + result
  }

  async outer_html(): Promise<string> {
    const result = await this.evaluate((element) => element.outerHTML)
    return result === undefined || result === null ? '' : '' + result
  }

  async inner_html(): Promise<string> {
    const result = await this.evaluate((element) => element.innerHTML)
    return result === undefined || result === null ? '' : '' + result
  }

  async click(): Promise<void> {
    await this.handle.click()
  }

  async flash(scroll = true): Promise<void> {
    const timeout = 1500 // should be same as in CSS animation
    await this.evaluate((element, { timeout, scroll }) => {
      if (scroll) element.scrollIntoView()
      element.classList.add('flash')
      setTimeout(() => element.classList.remove('flash'), timeout)
    }, { timeout, scroll })
    await sleep(timeout)
  }

  async evaluate<Input extends driver.Serializable, Output>(
    fn: (element: any, input: Input) => Output, input: Input
  ): Promise<Output>
  async evaluate<Output>(fn: (element: any) => Output): Promise<Output>
  async evaluate(fn: any, input?: any) { return this.frame.evaluate(fn, this.handle, input) }
}


// Utils --------------------------------------------------------------------------
export type ResponseListener = (response: driver.HTTPResponse) => Promise<void>

function build_id_generator() {
  let id = 0
  return () => id++
}

function build_styles() {
  return `
    @keyframes yellowfade {
      from { background: #fdd835; }
      to { background: #fff; }
    }

    .flash {
      animation-name: yellowfade;
      animation-duration: 1.5s;
    }
  `
}