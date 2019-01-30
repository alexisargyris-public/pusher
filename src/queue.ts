import { AnmzTextDocumentChangeEvent } from './utils'

export class Queue {
  protected readonly eventSeparator: string = '~'
  protected contents: string = ''
  protected eventsCounter: number = 0
  private toString(event: AnmzTextDocumentChangeEvent): string {
    return JSON.stringify({
      eventId: event.timestamp,
      content: event.contentChanges
    })
  }
  addString(newStr: string): void {
    // later events are inserted _in front_ of earlier events
    let newEventsCounter =
      newStr.indexOf(this.eventSeparator) < 0
        ? 1
        : newStr.split(this.eventSeparator).length
    this.eventsCounter += newEventsCounter
    this.contents = this.contents.length
      ? newStr + this.eventSeparator + this.contents
      : newStr
  }
  addEvent(editorEvent: AnmzTextDocumentChangeEvent): void {
    this.addString(this.toString(editorEvent))
  }
  emptyQueue(): void {
    this.contents = ''
    this.eventsCounter = 0
  }
  getContents(): string {
    return this.contents
  }
  getContentsSize(): number {
    return this.contents.length
  }
  getEventsCounter(): number {
    return this.eventsCounter
  }
}