import { Queue } from './queue'
import { FlashableQueue } from './flashableQueue'
import Database from './db'
import { AnmzTextDocumentChangeEvent } from './utils'
import * as vscode from 'vscode'

export class QueueController {
  private mainQueue: FlashableQueue
  private spareQueue: Queue
  private readonly queueSizeLimit: number = 10000
  private cntxt: any
  private sbi: vscode.StatusBarItem
  private db: Database
  private fileId: string | boolean
  private sessionId: string

  constructor(cntxt: vscode.ExtensionContext, sbi: vscode.StatusBarItem) {
    this.cntxt = cntxt
    this.sbi = sbi
  }
  // must be called immediately after the constructor to do the async staff
  async init() {
    this.db = new Database()
    this.fileId = await this.findOrCreateFile(
      vscode.window.activeTextEditor.document.fileName
    )
    this.sessionId = await this.createSession(this.fileId)
    this.mainQueue = new FlashableQueue(this.cntxt, this.sessionId, this.db)
    this.spareQueue = new Queue()
  }
  async add(editorEvent: AnmzTextDocumentChangeEvent) {
    if (this.mainQueue.getContentsSize() > this.queueSizeLimit) {
      // main queue is full, store event in spare queue and start flashing (if not already started)
      this.spareQueue.addEvent(editorEvent)
      // check if the main queue is already being flashed
      if (!this.mainQueue.isFlashing) {
        try {
          let fl = await this.mainQueue.flash()
        } finally {
          this.mergeQueues() // move any events from spare to main queue
        }
      }
    } else {
      // main queue still has space, store the event
      this.mainQueue.addEvent(editorEvent)
    }
    this.updateStatus()
  }
  findOrCreateFile(fn): Promise<string> {
    return new Promise(resolve => {
      return this.db.findFileAsync(fn).then(id => {
        if (id.length) {
          // the file exists
          resolve(id)
        } else {
          // the file does not exist; create it
          return this.db.createFileAsync(fn).then(id => {
            resolve(id)
          })
        }
      })
    })
  }
  createSession(fi): Promise<string> {
    return new Promise(resolve => {
      return this.db.createSessionAsync(fi).then(id => {
        resolve(id)
      })
    })
  }
  mergeQueues() {
    // move any events from spare to main queue
    if (this.spareQueue.getEventsCounter() > 0) {
      this.mainQueue.addString(this.spareQueue.getContents())
      this.spareQueue.emptyQueue()
    }
  }
  private updateStatus() {
    this.sbi.text = `Pusher: ${this.mainQueue.getContentsSize()}/${this.mainQueue.getEventsCounter()}`
    this.sbi.text +=
      this.spareQueue.getContentsSize() > 0
        ? `, ${this.spareQueue.getContentsSize()}/${this.spareQueue.getEventsCounter()}`
        : ''
    this.sbi.show()
  }
  async flash() {
    await this.mainQueue.flash()
    this.updateStatus()
  }
  // not used
  saveCurrentState() {
    return this.mainQueue.saveContents() // async function
  }
  // not used
  processPreviousState() {
    this.mainQueue.loadContents() // sync function
  }
}
