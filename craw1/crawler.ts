import { p, assert, sleep, min, ensure_error, isEqual, something, shuffle, hour, day,
  each, toJson, round, map} from 'base/base.ts'
import { Log } from 'base/log.ts'
import * as fs from 'base/fs.ts'
import { Page } from "./parser.ts"
import { Pool } from './pool.ts'
import { PersistentVariable } from 'base/persistent-variable.ts'


// Defaults ------------------------------------------------------------------------------
const default_retry_timeout     = 5 * min
const default_max_retry_timeout = 3 * day


// Job -----------------------------------------------------------------------------------
export interface Job {
  readonly type:       string
  readonly id:         string
}

// JobState ------------------------------------------------------------------------------
export interface JobState {
  readonly job_id:    string
  readonly timestamp: number
  readonly version:   number
}

// ShouldProcessResult -------------------------------------------------------------------
export type ShouldProcessResult =
  { process: false } |
  { process: true, reason: 'outdated' } |
  { process: true, reason: 'expired', by: number }


// CreateJobs ----------------------------------------------------------------------------
export type CreateJobsResult = { jobs: Job[], job_states: JobState[] }
export type CreateJobs = () => Promise<CreateJobsResult>


// After ---------------------------------------------------------------------------------
export type After = (job: Job) => Promise<void>

// Processor
export type ShouldProcessJob = (job: Job, state: JobState | undefined) => ShouldProcessResult
export type ProcessJob       = (job: Job, page: Page) => Promise<JobState>

export interface JobProcessor {
  job_type:       string
  create_jobs:    CreateJobs
  should_process: ShouldProcessJob
  process:        ProcessJob
  after?:         After
}


// JobStats ------------------------------------------------------------------------------
interface JobStatistic {
  total_count:   number
  success_count: number
  retry?:        { in: number, count: number, error: string, crawler_version: number }
}
interface JobStatistics {
  [id: string]: JobStatistic | undefined
}

function update_statistics_on_success(job_statistic: JobStatistic) {
  delete job_statistic.retry
  job_statistic.total_count   += 1
  job_statistic.success_count += 1
}
function update_statistics_on_error(
  job_statistic: JobStatistic, retry_delay: number, retry_count: number, error: Error, crawler_version: number
) {
  job_statistic.total_count   += 1
  job_statistic.success_count =  0
  job_statistic.retry = {
    in:    Date.now() + retry_delay,
    count: retry_count,
    error: ensure_error(error).message,
    crawler_version
  }
}
function get_errors(job_statistics: JobStatistics) {
  const errors: { [symbol: string]: { error: string, count: number } } = {}
  for (const symbol in job_statistics) {
    const stat = job_statistics[symbol]
    // Only collecting errors if it already retried
    if (stat && stat.retry && stat.retry.count > 2)
      errors[symbol] = { error: stat.retry.error, count: stat.retry.count }
  }
  return errors
}

// process -------------------------------------------------------------------------------
export async function crawl(args: {
  pool:                 Pool,
  processors:           JobProcessor[],
  data_dir:             string,
  retry_timeout?:       number,
  max_retry_timeout?:   number,
  crawler_version?:     number,
  id?:                  string // Used for logging
  // after:
}) {
  // Preparing arguments
  const { pool } = args
  const crawler_version = args.crawler_version || 1
  const statistics_file_path = `${args.data_dir}/crawler.json`
  const errors_file_path     = `${args.data_dir}/crawler_errors.json`
  const retry_timeout        = args.retry_timeout     || default_retry_timeout
  const max_retry_timeout    = args.max_retry_timeout || default_max_retry_timeout
  const processors: { [type: string]: JobProcessor | undefined } = {}
  each(args.processors, (processor) => processors[processor.job_type] = processor as JobProcessor)

  const log = new Log(args.id || 'crawler')

  // Preparing job queue
  // log('info', `preparing jobs`)
  let jobs: Job[] = []
  const job_states: { [key: string]: JobState | undefined } = {}
  for (const { job_type, create_jobs } of args.processors) {
    const created = await create_jobs()

    // Adding jobs
    each(created.jobs, ({ type }) => assert.equal(type, job_type))
    jobs.push(...created.jobs)

    // Adding job states
    const job_ids = new Set<string>()
    each(created.jobs, ({ id }) => job_ids.add(id))
    each(created.job_states, (state) => {
      assert(job_ids.has(state.job_id), `job_state has non-existing id ${state.job_id}`)
      job_states[state.job_id] = state
    })
  }
  jobs = shuffle(jobs)

  // Preparing job stats
  const job_statistics_variable = new PersistentVariable<JobStatistics>(statistics_file_path, () => ({}))
  // Skipping statistics for different crawler version
  const job_statistics = map(await job_statistics_variable.read(), (job_statistic) => {
    if (job_statistic && job_statistic.retry && job_statistic.retry.crawler_version != crawler_version) {
      return { ...job_statistic, retry: undefined }
    } else return job_statistic
  })
  {
    // Removing old ids
    const ids = new Set(jobs.map(({ id }) => id))
    for (const id in job_statistics) if (!ids.has(id)) delete job_statistics[id]

    // Adding missing ids
    for (const { id } of jobs)
      if (!(id in job_statistics)) job_statistics[id] = { total_count: 0, success_count: 0 }

    // Adding auto-save
    setInterval(async () => {
      if (isEqual(job_statistics, await job_statistics_variable.read())) return
      // try {
        await job_statistics_variable.write(job_statistics)
        await fs.writeFile(errors_file_path, toJson(get_errors(job_statistics), true))
        log.debug('auto saving job stats')
      // } catch(e) {
      //   log('error', "can't auto save job stats", e)
      // }
    }, 1 * min)
  }

  // One pass
  let i = -1
  async function one_pass(): Promise<number> {
    let processed = 0
    for (let j = 0; j < jobs.length; j++) {
      // i - cyclical iterator
      i += 1
      if (i == jobs.length) i = 0

      const job  = jobs[i]
      const job_statistic = job_statistics[job.id]
      if (!job_statistic) throw new Error(`missing statistic for '${job.type}' '${job.id}'`)
      const processor = processors[job.type]
      if (!processor) throw new Error(`missing processor for '${job.type}' '${job.id}'`)
      assert.equal(job.type, processor.job_type)

      // Skipping explicitly scheduled items
      const now = Date.now()
      if (job_statistic.retry && job_statistic.retry.in > now) continue

      // Skipping not yet expired
      // Randomizing to distribute load more evenly in time
      let randomized_job_state: JobState | undefined = undefined
      {
        const job_state = job_states[job.id]
        if (job_state) {
          randomized_job_state = {
            ...job_state,
            timestamp: job_state.timestamp - Math.round(Math.random() * 10 * min)
          }
        }
      }
      const pss = await processor.should_process(job, randomized_job_state)
      if (!pss.process) continue

      // Processing
      processed += 1
      try {
        // Processing job
        const reason_message = pss.reason == 'outdated' ?
          'outdated' :
          `expired by ${round(pss.by / min)} min`
        log.info(`${job.type} ${job.id} processing '${reason_message}'`)

        const job_state = await pool.with_page((page) => processor.process(job, page))
        assert.equal(job.id, job_state.job_id)
        job_states[job.id] = job_state

        // Processing after
        // TODO 2 move after processing in another queue and track processing failures
        // in a persistent way
        if (processor.after) {
          log.info(`${job.type} ${job.id} after processing`)
          await processor.after(job)
        }

        update_statistics_on_success(job_statistic)
        log.info(`${job.type} ${job.id} processed`)
      } catch (e) {
        const already_retried = job_statistic.retry?.count || 0
        const retry_delay = Math.min(
          retry_timeout * Math.pow(2, already_retried),
          max_retry_timeout
        )
        const retry_count = already_retried + 1
        update_statistics_on_error(job_statistic, retry_delay, retry_count, ensure_error(e), crawler_version)
        if (retry_count > 2) log.warn(`${job.type} ${job.id} can't process '${ensure_error(e).message}'`)
        else                 log.info(`${job.type} ${job.id} failed ${retry_count} time, probably not an error`)
      }
    }
    return processed
  }

  // Processing
  log.info(`crawler started, version ${crawler_version}`)
  while (true) {
    const processed = await one_pass()
    // Sleeping if there's nothing to process
    if (processed == 0) {
      log.info('processed waiting')
      await pool.close_page()
      await sleep(5 * min)
    }
  }
}