import * as fs from './fs.ts'

export class PersistentVariable<T extends {}> {
  constructor(
    protected readonly fname:         string,
    protected readonly default_value: () => T
  ) {}

  async read(): Promise<T> {
    try {
      return await fs.readJson<T>(this.fname)
    } catch(e) {
      // A new default value should be created every time, because
      // otherwise equality would fail `changed_value == await variable.read()`
      return this.default_value()
    }
  }

  async delete() { await fs.remove(this.fname) }

  async write(value: T) { await fs.writeJson(this.fname, value) }
}