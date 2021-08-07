import { extend } from './base.ts'


// Helpers -----------------------------------------------------------------------------------------
export const day_hours  = 24
export const day_min    = 24 * 60
export const day_sec    = 24 * 60 * 60

export const hour_min   = 60
export const hour_sec   = 60 * 60

export const minute_sec = 60

// Epoch -------------------------------------------------------------------------------------------
export function epoch_seconds(
  year: number, month: number, day: number, hour: number, minute: number, second: number
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second).div(1000)
}


export class EpochTime {
  constructor(
    public readonly epoch:  number // in seconds, could be negative
  ) {}

  is_equal(other: EpochTime): boolean { return this.epoch == other.epoch }

  // negative if this is less than other, 0 if same, positive if this is greather than other
  compare(other: EpochTime): number { return this.epoch - other.epoch }

  minus(b: Time | TimeD | TimeM): TimeInterval { return new TimeInterval(this.epoch - b.epoch) }

  hash(): number { return this.epoch }

  to_time(): Time { return new Time(this.epoch) }

  to_timed(): TimeD { return new TimeD(this.epoch) }

  to_timem(): TimeM { return new TimeM(this.epoch) }
}


// Time ---------------------------------------------------------------------------------------------
// More strict time, UTC only.
export class Time extends EpochTime {
  public readonly year:   number
  public readonly month:  number // 1..12
  public readonly day:    number // 1..31
  public readonly hour:   number // 0..23
  public readonly minute: number // 0..59
  public readonly second: number // 0..59

  constructor(date: string) // '2021-05-24 00:08:53'
  constructor(epoch_sec: number)
  constructor(date: Date)
  constructor(year: number, month: number, day: number, hour: number, minute: number, second: number)
  constructor(
    arg: number | Date | string, month?: number, day?: number, hour?: number, minute?: number, second?: number
  ) {
    let y: number, mon: number, d: number, h: number, m: number, s: number
    if (is_number(arg) && month !== undefined) {
      y = arg;   mon = month!; d = day!;
      h = hour!; m = minute!;  s = second!;
    } else {
      let date: Date
      if (arg instanceof Date) {
        date = arg
      } else if (is_string(arg)) {
        date = new Date(arg + '.000Z')
      } else if (is_number(arg) && month === undefined) {
        date = new Date(arg * 1000)
      } else {
        throw new Error('invalid Time arguments')
      }
      y = date.getUTCFullYear(); mon = date.getUTCMonth() + 1; d = date.getUTCDate()
      h = date.getUTCHours();    m   = date.getUTCMinutes();   s = date.getUTCSeconds()
    }
    super(epoch_seconds(y, mon, d, h, m, s))
    this.year = y; this.month = mon; this.day = d; this.hour = h; this.minute = m; this.second = s
  }

  static now(): Time { return new Time(Date.now().div(1000)) }

  // '2021-05-24 00:08:53'
  to_s(): string { return (
    this.year.to_s().rjust(4, '0') + '-' +
    this.month.to_s().rjust(2, '0') + '-' +
    this.day.to_s().rjust(2, '0') + ' ' +
    this.hour.to_s().rjust(2, '0') + ':' +
    this.minute.to_s().rjust(2, '0') + ':' +
    this.second.to_s().rjust(2, '0')
  )}

  plus(ti: TimeInterval): Time { return new Time(this.epoch + ti.seconds()) }

  to_json_hook(): string { return this.to_s() }
}


// TimeD -------------------------------------------------------------------------------------------
export class TimeD extends EpochTime {
  public readonly year:   number
  public readonly month:  number // 1..12
  public readonly day:    number // 1..31


  constructor(date: string) // '2021-05-24'
  constructor(epoch_sec: number)
  constructor(date: Date)
  constructor(year: number, month: number, day: number)
  constructor(arg: number | Date | string, month?: number, day?: number) {
    let y: number, mon: number, d: number
    if (is_number(arg) && month !== undefined) {
      y = arg;   mon = month!; d = day!;
    } else {
      let date: Date
      if (arg instanceof Date) {
        date = arg
      } else if (is_string(arg)) {
        date = new Date(arg + ' 00:00:01.000Z')
      } else if (is_number(arg) && month === undefined) {
        date = new Date(arg * 1000)
      } else {
        throw new Error('invalid Time arguments')
      }
      y = date.getUTCFullYear(); mon = date.getUTCMonth() + 1; d = date.getUTCDate()
    }
    super(epoch_seconds(y, mon, d, 0, 0, 1))
    this.year = y; this.month = mon; this.day = d;
  }

  // minus(b: Time | TimeD | TimeM): TimeInterval { return new TimeInterval(this.epoch - b.epoch) }

  static now(): TimeD { return new TimeD(Date.now().div(1000)) }

  // '2021-05-24'
  to_s(): string { return (
    this.year.to_s().rjust(4, '0') + '-' +
    this.month.to_s().rjust(2, '0') + '-' +
    this.day.to_s().rjust(2, '0')
  )}

  to_json_hook(): string { return this.to_s() }

  // to_time(): Time { return new Time(this.year, this.month, this.day, 0, 0, 1) }

  // to_timem(): TimeM { return new TimeM(this.year, this.month) }
}


// TimeM -------------------------------------------------------------------------------------------
export class TimeM extends EpochTime {
  public readonly year:   number
  public readonly month:  number // 1..12


  constructor(date: string) // '2021-05'
  constructor(epoch_sec: number)
  constructor(date: Date)
  constructor(year: number, month: number)
  constructor(arg: number | Date | string, month?: number) {
    let y: number, mon: number
    if (is_number(arg) && month !== undefined) {
      y = arg;   mon = month!
    } else {
      let date: Date
      if (arg instanceof Date) {
        date = arg
      } else if (is_string(arg)) {
        date = new Date(arg + ':01 00:00:01.000Z')
      } else if (is_number(arg) && month === undefined) {
        date = new Date(arg * 1000)
      } else {
        throw new Error('invalid Time arguments')
      }
      y = date.getUTCFullYear(); mon = date.getUTCMonth() + 1
    }
    super(epoch_seconds(y, mon, 1, 0, 0, 1))
    this.year = y; this.month = mon
  }

  static now(): TimeD { return new TimeD(Date.now().div(1000)) }

  plus(ti: CalendarInterval): TimeM {
    assert.equal(ti.days_part, 0)
    assert.equal(ti.hours_part, 0)
    assert.equal(ti.minutes_part, 0)
    assert.equal(ti.seconds_part, 0)
    const mcount = this.month + ti.months_part
    let years  = this.year + ti.years_part + mcount.div(12)
    let months = mcount.rem(12)
    if (months == 0) {
      years  -= 1
      months = 12
    }
    return new TimeM(years, months)
  }

  // '2021-05-24'
  to_s(): string {
    return this.year.to_s().rjust(4, '0') + '-' + this.month.to_s().rjust(2, '0')
  }

  to_json_hook(): string { return this.to_s() }

  // to_time(): Time { return new Time(this.year, this.month, 1, 0, 0, 1) }

  // to_timed(): TimeD { return new TimeD(this.year, this.month, 1) }
}

test(TimeM.prototype.plus, () => {
  assert.equal(new TimeM(2001, 1).plus(2..months()), new TimeM(2001, 3))
  assert.equal(new TimeM(2001, 1).plus(12..months()), new TimeM(2002, 1))
  assert.equal(new TimeM(2001, 1).plus(14..months()), new TimeM(2002, 3))
  assert.equal(new TimeM(2001, 11).plus(1..months()), new TimeM(2001, 12))
  assert.equal(new TimeM(2001, 11).plus(13..months()), new TimeM(2002, 12))
})

export class TimeInterval {
  constructor(
    public readonly seconds_part: number,
    public readonly minutes_part: number = 0,
    public readonly hours_part:   number = 0,
    public readonly days_part:    number = 0
  ) {}

  days(): number {
    return this.days_part + (this.hours_part / 24.0) + (this.minutes_part / day_min) +
      (this.seconds_part / day_sec)
  }

  hours(): number {
    return this.days_part * day_hours + this.hours_part + (this.minutes_part / hour_min) +
      (this.seconds_part / hour_sec)
  }

  seconds(): number {
    return this.days_part * day_sec + this.hours_part * hour_sec + this.minutes_part * minute_sec +
      this.seconds_part
  }

  plus(b: TimeInterval): TimeInterval { return new TimeInterval(
    this.seconds_part + b.seconds_part,
    this.minutes_part + b.minutes_part,
    this.hours_part   + b.hours_part,
    this.days_part    + b.days_part
  )}

  humanize(round = true, short = false): string {
    return humanize(this.seconds(), round, short)
  }

  to_s(): string { return this.humanize() }

  to_json_hook(): string { return this.to_s() }
}


// Calendar time requires complex calender calculations
export class CalendarInterval {
  constructor(
    public readonly seconds_part: number,
    public readonly minutes_part: number,
    public readonly hours_part:   number,
    public readonly days_part:    number,
    public readonly months_part:  number,
    public readonly years_part:   number
  ) {}
}

test('minus', () => {
  assert.aequal(new TimeD(2001, 3, 1).minus(new TimeD(2001, 1, 1)).days(), 59)
  assert.aequal(new TimeM(2001, 3).minus(new TimeD(2001, 1, 1)).days(), 59)
  assert.aequal(new TimeD(2001, 1, 1).minus(new TimeM(2001, 3)).days(), -59)
})

// # years,months,...number ------------------------------------------------------------------------------
declare global {
  interface Number {
    years(this: number): CalendarInterval
    months(this: number): CalendarInterval

    seconds(this: number): TimeInterval
    minutes(this: number): TimeInterval
    hours(this: number): TimeInterval
    days(this: number): TimeInterval
  }
}

extend(Number.prototype, {
  years(this: number): CalendarInterval { return new CalendarInterval(0, 0, 0, 0, 0, this) },
  months(this: number): CalendarInterval { return new CalendarInterval(0, 0, 0, 0, this, 0) },
  seconds(this: number): TimeInterval { return new TimeInterval(this, 0, 0, 0) },
  minutes(this: number): TimeInterval { return new TimeInterval(0, this, 0, 0) },
  hours(this: number): TimeInterval { return new TimeInterval(0, 0, this, 0) },
  days(this: number): TimeInterval { return new TimeInterval(0, 0, 0, this) }
})

test(Number.prototype.days, () => {
  assert.aequal(12..hours().days(), 0.5)
  assert.aequal(2..minutes().seconds(), 120)
})


// humanize ----------------------------------------------------------------------------------------
function format_humanized(days: number, hours: number, minutes: number, seconds: number, short: boolean): string {
  let buff: string[] = []
  if (days > 0)    buff.add(days    + (short ? 'd' : ' ' + days.pluralize('day')))
  if (hours > 0)   buff.add(hours   + (short ? 'h' : ' ' + hours.pluralize('hour')))
  if (minutes > 0) buff.add(minutes + (short ? 'm' : ' ' + minutes.pluralize('min')))
  if (seconds > 0) buff.add(seconds + (short ? 's' : ' ' + seconds.pluralize('second')))
  return buff.join(' ')
}

function humanize(seconds: number, round = false, short = true): string {
  if (round) {
    const days = seconds / day_sec
    if (days >= 1) return format_humanized(days.round(), 0, 0, 0, short)
    else {
      const hours = seconds / hour_sec
      if (hours >= 1) return format_humanized(0, hours.round(), 0, 0, short)
      else {
        const minutes = seconds / minute_sec
        if (minutes >= 1) return format_humanized(0, 0, minutes.round(), 0, short)
        else {
          return format_humanized(0, 0, 0, seconds, short)
        }
      }
    }
  } else {
    const [days,    left_after_days]    = seconds.div_rem(day_sec)
    const [hours,   left_after_hours]   = left_after_days.div_rem(hour_sec)
    const [minutes, left_after_minutes] = left_after_hours.div_rem(minute_sec)
    return format_humanized(days, hours, minutes, left_after_minutes, short)
  }
}


test(humanize, () => {
  assert.equal(12..hours().humanize(false, true), '12h')
  assert.equal(70..minutes().humanize(false, true), '1h 10m')

  assert.equal(130..minutes().humanize(), '2 hours')
})


// parse_month -------------------------------------------------------------------------------------
const month_names = [
  'january',
  'february',

  'march',
  'april',
  'may',

  'june',
  'july',
  'august',

  'september',
  'october',
  'november',

  'december'
]
const short_month_names = month_names.map((name) => name.take(3))

const month_names_map = new Hash<number>()
for (let i = 0; i < month_names.length; i++) {
  month_names_map.set(month_names[i], i + 1)
  month_names_map.set(short_month_names[i], i + 1)
}

export function parse_month(month: string): number {
  const month_l = month.downcase()
  const n = month_names_map.get(month_l)
  if (n === undefined) throw new Error(`invalid month name '${month}'`)
  return n
}