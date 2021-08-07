import * as fs from './fs.ts'

export class PersistentVariable<T extends {}> {
  constructor(
    protected readonly klass:         { from_json: (json: string) => T },
    protected readonly fname:         string,
    protected readonly default_value: () => T,
    protected readonly post_process:  ((v: T) => T) = (v) => v
  ) {}

  async read(): Promise<T> {
    let json: string
    try {
      json = await fs.read_file(this.fname, { encoding: 'utf8' })
    } catch(e) {
      // A new default value should be created every time, because
      // otherwise equality would fail `changed_value == await variable.read()`
      return this.default_value()
    }
    return this.post_process(this.klass.from_json(json))
  }

  async delete() { await fs.remove(this.fname) }

  async write(value: T) { await fs.write_json(this.fname, value) }
}