import { makeAutoObservable } from 'mobx'

export type Flow = 'leftToRight' | 'rightToLeft'

export class Queue<T> {
  private queue: T[] = []

  /**
   * @param itemLength 队列长度
   * @param flow 队列方向
   */
  constructor(private itemLength = 20, private flow: Flow = 'rightToLeft') {
    makeAutoObservable(this)
  }

  push(item: T, noLimit?: boolean): void {
    this.queue.push(item)
    this._handle(noLimit)
  }

  unshift(item: T, noLimit?: boolean): void {
    this.queue.unshift(item)
    this._handle(noLimit)
  }

  pop(): T | undefined {
    return this.queue.pop()
  }

  shift(): T | undefined {
    return this.queue.shift()
  }

  resetLimitState(): void {
    this._handle()
  }

  clear(): void {
    this.queue.length = 0
  }

  get(): T[] {
    return this.queue
  }

  set(value: T[], noLimit?: boolean): void {
    this.queue = value
    this._handle(noLimit)
  }

  get length(): number {
    return this.queue.length
  }

  private _handle(noLimit = false) {
    if (this.queue.length > this.itemLength && !noLimit) {
      if (this.flow === 'leftToRight') {
        this.queue.splice(this.itemLength, this.queue.length - this.itemLength)
      } else {
        this.queue.splice(0, this.queue.length - this.itemLength)
      }
    }
  }
}

export class QueueMap<T> {
  map = new Map<string, Queue<T>>()

  constructor(private itemLength = 20, private flow: Flow = 'rightToLeft') {
    makeAutoObservable(this)
  }

  get(key: string): T[] | undefined {
    return this.map.get(key)?.get()
  }

  set(key: string, value: T[], noLimit: boolean): void {
    const queue = new Queue<T>(this.itemLength, this.flow)

    queue.set(value, noLimit)
    this.map.set(key, queue)
  }

  delete(key: string): boolean {
    this.map.get(key)?.clear()
    return this.map.delete(key)
  }

  resetLimitState(): void {
    this.map.forEach((item) => item.resetLimitState())
  }

  clear(): void {
    this.map.forEach((item) => item.clear())
    this.map.clear()
  }

  values(): T[] {
    return [...this.map.values()].map((item) => item.get()).flat()
  }
}
