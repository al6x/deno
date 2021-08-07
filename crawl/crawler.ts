import { timer_sec } from 'base/base.ts'
import { Time } from 'base/time.ts'
import { Log } from 'base/log.ts'
import { PersistentVariable } from 'base/persistent_variable.ts'
import * as fs from "base/fs.ts"

// Features:
// - Different Job types
// - Job priority
// - Distributing jobs fairly, penalizing long taking jobs
// - Retrying failed jobs with progressive delays
// - Preserving state after restart
// - Explanation for every job why it should be run
// - Reporting errors
//
// TODO - when waiting - reduce expiration x2 and pass to should_process
// TOD - keep track of duration for 1 month, cap by time, the current duration penalizing is wrong

export type ShouldProcess = { process: boolean, reason: string }

export type LastProcessed = { timestamp: Time, version: number }

export interface Job {
  id:        string
  last:      E<LastProcessed>
  priority?: number // -1000..1000, default 0

  should_process(): ShouldProcess
  process(): Promise<LastProcessed>
  after?(): Promise<void>
}
const max_abs_job_priority = 1000

export interface HistoryItemError {
  duration:        number
  crawler_version: number
  timestamp:       Time
  is_error:        true
  message:         string
}
export interface HistoryItemSuccess {
  duration:        number
  crawler_version: number
  timestamp:       Time
  is_error:        false
}

export type HistoryItem = HistoryItemError | HistoryItemSuccess

export interface JobState {
  history:        HistoryItem[] // reversed, [last, previous, ...]
  retry_at?:      Time
  total_duration: number
}
type JobStates = Hash<JobState>

function job_states_post_json(states: JobStates): JobStates {
  return states.apply((state) => {
    state.history.apply((item) => {
      item.timestamp = new Time(item.timestamp.to_s())
    })
    if (state.retry_at) state.retry_at = new Time(state.retry_at.to_s())
  })
}

function recent_errors(state: JobState): HistoryItemError[] {
  return state.history.filter_map((item) => item.is_error ? item : undefined)
}

type JobErrors = Hash<string>

export class Crawler {
  protected jobs:               Hash<Job>
  protected job_states:         JobStates
  protected job_states_storage: PersistentVariable<JobStates>
  protected focus:              HSet<string>
  protected log: Log
  // protected readonly state_path:        string

  protected constructor(
    public readonly    id:                 string,
    public readonly    version:            number,
                       jobs:               Job[],
    protected readonly data_dir:           string,
                       focus:              string[],
    protected readonly retry_timeout     = 5..minutes(),
    protected readonly max_retry_timeout = 4..hours()
  ) {
    this.jobs = jobs.to_hash(({ id }) => id)
    this.jobs.each(({ priority }) =>
      assert((priority || 0).abs() <= max_abs_job_priority, `job priority should be in -1000..1000 range`)
    )
    this.job_states = new Hash()
    this.focus = focus.to_set()
    this.log = new Log(id)
    this.job_states_storage = new PersistentVariable<JobStates>(
      Hash, `${this.data_dir}/${this.id}-crawler.json`, () => new Hash(), job_states_post_json
    )
  }

  async load(): Promise<void> {
    // Loading job states
    const ids = this.jobs.keys()
    assert.equal(ids.size(), this.jobs.size(), 'there are jobs with same ids')

    this.job_states = (await this.job_states_storage.read())
      .filter((_, id) => ids.has(id)) // Removing states for old jobs
      .apply((state) => { delete state.retry_at }) // Cleaning retry after restart

    ids.each((id) => { // Adding states for new jobs
      if (!this.job_states.has(id)) this.job_states.set(id, { history: [], total_duration: 0 })
    })
  }


  protected get_errors(): JobErrors {
    return this.job_states.filter_map((state) => {
      const errors = recent_errors(state)
      return errors.is_empty() ? undefined : errors[0].message
    })
  }


  async save(): Promise<void> {
    await this.job_states_storage.write(this.job_states)
    fs.write_json(`${this.data_dir}/${this.id}-crawler-errors.json`, this.get_errors())
    this.log.debug('state saved')
  }


  protected async process_job(id: string, reason: string): Promise<void> {
    let job = this.jobs.get(id), state = this.job_states.get(id)

    const tic = timer_sec(), history_size = 5
    try {
      this.log.with({ id, reason }).info("processing '{id}', {reason}")

      job.last = (await job.process()).to_success()

      // Processing after
      if (job.after) await job.after()

      const duration = tic()
      this.log.with({ id, duration }).info("processed  '{id}' in {duration} sec")

      // Updating state
      prepend_capped_m(state.history, {
        duration,
        crawler_version: this.version,
        timestamp:       Time.now(),
        is_error:        false
      }, history_size)
      delete state.retry_at
    } catch (e) {
      const duration = tic(), message = ensure_error(e).message
      prepend_capped_m(state.history, {
        duration,
        crawler_version: this.version,
        timestamp:       Time.now(),
        is_error:        true,
        message
      }, history_size)

      const retry_count = recent_errors(state).size()
      const delay_sec = [
        this.retry_timeout.seconds() * 2..pow(retry_count - 1),
        this.max_retry_timeout.seconds()
      ].min()
      state.retry_at = Time.now().plus(delay_sec.seconds())

      this.job_states.set(id, state)

      const l = this.log.with({ id, duration, retry_count, message })
      if (retry_count > 1) {
        l.warn("can't process '{id}' after {duration} sec, {retry_count} time, '{message}'")
      } else {
        l.info("can't process '{id}' after {duration} sec, {retry_count} time, will be retried, '{message}'")
      }
    }

    state.total_duration = state.history.map(({ duration }) => duration).sum()
  }

  async run(): Promise<void> {
    this.log.with({ version: this.version }).info("started v{version}")
    while(true) {
      // Building queue to process
      const now = Time.now()
      const queue: { job: Job, state: JobState, reason: string }[] = []

      if (!this.focus.is_empty()) {
        this.jobs
          .filter(({ id }) => this.focus.has(id))
          .each((job) => queue.add({ job, state: this.job_states.get(job.id), reason: 'focus' }))
      } else {
        this.jobs.each((job) => {
          const state = this.job_states.get(job.id)
          if (!state.retry_at || state.retry_at.compare(now) < 0) {
            // Checking `should_process` even if `retry_at < now`, because it could be already processed,
            // but state hasn't been saved because crawler crashed.
            const { process, reason } = job.should_process()
            if (process) queue.add({ job, state, reason })
          }
        })
      }

      this.log.with({ counts: queue.size() }).info("queue {counts} jobs")

      // Sorting and batching
      const batch = queue
        .asc(({ job, state }) => -max_abs_job_priority * (job.priority || 0) + state.total_duration)
        .take(5)

      // Processing
      for (const { job, reason } of batch) {
        await this.process_job(job.id, reason)
      }

      // Saving or sleeping if there's nothing to process
      // Would be better to save state every minute, instead of for every batch.
      if (!batch.is_empty()) await this.save()
      else {
        this.log.info('all processed, waiting')
        await sleep(5..minutes().seconds() * 1000)
      }
    }
  }
}

function prepend_capped_m<T>(list: T[], v: T, max: number): void {
  list.unshift(v)
  if (list.size() > max) list.pop()
}