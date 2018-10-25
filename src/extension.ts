'use strict'

import * as vscode from 'vscode'
import Database from './db'

class Queue {
  protected contents: string = ''
  protected eventsCounter: number = 0
  makeContents(event: any): string {
    return JSON.stringify({
      eventId: event.timestamp,
      content: event.contentChanges[0]
    })
  }
  add(editorEvent): void {
    this.eventsCounter++
    this.contents += this.makeContents(editorEvent)
  }
  empty(): void {
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
class FlashableQueue extends Queue {
  private sessionId: string
  private db: Database
  isFlashing: boolean = false
  constructor(sessionId: string, db: Database) {
    super()
    this.sessionId = sessionId
    this.db = db
  }
  private prepareContents(cont): string {
    // double stringify to escape all double quotes...
    let eventContent = JSON.stringify(cont)
    // remove outer double quotes
    eventContent = eventContent.substring(1, eventContent.length - 1)
    return eventContent
  }
  pushContents(contents) {
    // TODO: what separator is required between events in same package?
    // TODO: in different packages?
    this.contents += contents // TODO: is the order correct?
  }
  flash() {
    this.isFlashing = true
    let cnt = this.prepareContents(this.contents)
    return this.db
      .createEvent(makeTimestamp(), this.sessionId, cnt)
      .then(() => {
        this.isFlashing = false
        this.empty()
      })
  }
}
class QueueController {
  private readonly extBarLabel: string = 'Pusher'
  private mainQueue: FlashableQueue
  private spareQueue: Queue
  private readonly queueSizeLimit: number = 1000
  private sbi: vscode.StatusBarItem
  constructor(sessionId: string, db: Database, sbi: vscode.StatusBarItem) {
    this.mainQueue = new FlashableQueue(sessionId, db)
    this.spareQueue = new Queue()
    this.sbi = sbi
  }
  private updateStatus() {
    this.sbi.text = `${
      this.extBarLabel
    }: M ${this.mainQueue.getContentsSize()}(${this.mainQueue.getEventsCounter()}), S ${this.spareQueue.getContentsSize()}(${this.spareQueue.getEventsCounter()})`
    this.sbi.show()
  }
  async add(editorEvent) {
    if (this.mainQueue.getContentsSize() > this.queueSizeLimit) {
      // main queue is full, start flashing and meanwhile use spare queue
      try {
        // check if the main queue is already being flashed
        if (!this.mainQueue.isFlashing) {
          let fl = await this.mainQueue.flash()
          let spareContent = this.spareQueue.getContents()
          // check if there are any spare events waiting to be processed
          if (spareContent.length > 0) {
            this.mainQueue.add(editorEvent)
            this.mainQueue.pushContents(spareContent)
            this.spareQueue.empty()
          }
        } else {
          // store event in spare queue
          this.spareQueue.add(editorEvent)
        }
      } catch (error) {
        // something went wrong
        let errorMsg = `[ERROR] Pusher.QueueController caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
        deactivate(this.sbi)
      }
    } else {
      // main queue still has space, store the event
      this.mainQueue.add(editorEvent)
    }
    this.updateStatus()
  }
}

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  let fileId: any // Promise<String | Boolean>
  let sessionId: any // Promise<String>
  let db: Database
  let qc: QueueController
  let sbi: vscode.StatusBarItem

  function createFirstChange(doc) {
    return {
      timestamp: Date.now(),
      contentChanges: [
        {
          range: new vscode.Range(0, 0, 0, 0),
          rangeLength: 0,
          rangeOffset: 0,
          text: doc.getText()
        }
      ]
    }
  }
  function findOrCreateFile(fn) {
    return new Promise(resolve => {
      return db.findFile(fn).then(id => {
        if (id) {
          // the file exists
          resolve(id)
        } else {
          // the file does not exist; create it
          return db.createFile(fn).then(id => {
            resolve(id)
          })
        }
      })
    })
  }
  function createSession(fi) {
    return new Promise(resolve => {
      return db.createSession(fi).then(id => {
        resolve(id)
      })
    })
  }
  function onTextChange(event: any, qc: QueueController) {
    // the text in the active editor was changed; store the change
    if (event.contentChanges.length) {
      event.timestamp = makeTimestamp()
      qc.add(event)
    }
  }

  // if no document is open, exit immediately
  if (typeof vscode.window.activeTextEditor === 'undefined') return
  // init appsync db and first event (whole document)
  try {
    db = new Database()
    fileId = await findOrCreateFile(
      vscode.window.activeTextEditor.document.fileName
    )
    sessionId = await createSession(fileId)
    sbi = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
    qc = new QueueController(sessionId, db, sbi)
    qc.add(createFirstChange(vscode.window.activeTextEditor.document))
    // change text content event handler
    // FIXME: event should be vscode.TextDocumentChangeEvent
    vscode.workspace.onDidChangeTextDocument((event: any) => {
      onTextChange(event, qc)
    })
    // change active editor event handler
    vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
      // the active editor was changed; hide and deactivate the extension
      deactivate(sbi)
    })
    // the command associated with the extension
    let disposable = vscode.commands.registerCommand('extension.pusher', () => {
      // all necessary set up work has already been done (on first activation); nothing to do here (i.e. on each subsequent activation)
    })
    context.subscriptions.push(disposable)
    console.log('pusher activated')
  } catch (err) {
    // something went wrong; deactivate the extension
    console.error(`[ERROR] Pusher.activate caused: ${err.message}`)
    deactivate(sbi)
  }
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export function deactivate(sbi) {
  if (sbi) sbi.hide()
}

function makeTimestamp(): string {
  return Date.now().toString()
}
