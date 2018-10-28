'use strict'

import * as vscode from 'vscode'
import Database from './db'
import * as LZString from '../node_modules/lz-string'

class Queue {
  protected readonly eventSeparator: string = '~'
  protected contents: string = ''
  protected eventsCounter: number = 0
  private toString(event: any): string {
    return JSON.stringify({
      eventId: event.timestamp,
      content: event.contentChanges[0]
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
  addEvent(editorEvent): void {
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
class FlashableQueue extends Queue {
  private context: vscode.ExtensionContext
  private sessionId: string
  private db: Database
  private readonly storageKey: string = 'anmz'
  isFlashing: boolean = false
  loadedFirstChange: boolean = false
  constructor(cntxt: vscode.ExtensionContext, sessionId: string, db: Database) {
    super()
    this.context = cntxt
    this.sessionId = sessionId
    this.db = db
  }
  private readContents(cont): string {
    function uncompress(str): string {
      // https://github.com/pieroxy/lz-string
      return LZString.decompressFromEncodedURIComponent(str)
    }
    let temp = uncompress(cont)
    // add outer double quotes
    temp = `"${temp}"`
    // double parse to un-escape all double quotes
    return JSON.parse(temp)
  }
  private writeContents(cont): string {
    function compress(str): string {
      // https://github.com/pieroxy/lz-string
      return LZString.compressToEncodedURIComponent(str)
    }

    // double stringify to escape all double quotes
    let eventContent = JSON.stringify(cont)
    // remove outer double quotes
    eventContent = eventContent.substring(1, eventContent.length - 1)
    return compress(eventContent)
  }
  flash() {
    this.isFlashing = true
    let contentsToFlash = this.writeContents(this.contents)
    return this.db
      .createEvent(makeTimestamp(), this.sessionId, contentsToFlash)
      .then(() => {
        this.isFlashing = false
        this.emptyQueue()
      })
  }
  saveContents() {
    // check if there are any contents to save
    return this.contents.length
      ? this.context.workspaceState.update(
          this.storageKey,
          this.writeContents(this.contents)
        )
      : Promise.resolve()
  }
  loadContents() {
    let temp = this.context.workspaceState.get(this.storageKey)
    // check if there are any contents to load
    if (temp) {
      let temp2 = this.readContents(temp)
      this.addString(temp2)
      let temp3 = JSON.parse(temp2)
      if (temp3.content.firstChange) this.loadedFirstChange = true
    }
  }
}
class QueueController {
  private readonly extBarLabel: string = 'Pusher'
  private mainQueue: FlashableQueue
  private spareQueue: Queue
  private readonly queueSizeLimit: number = 5000
  private sbi: vscode.StatusBarItem
  constructor(
    cntxt: vscode.ExtensionContext,
    sessionId: string,
    db: Database,
    sbi: vscode.StatusBarItem
  ) {
    this.mainQueue = new FlashableQueue(cntxt, sessionId, db)
    this.spareQueue = new Queue()
    this.sbi = sbi
  }
  private updateStatus() {
    this.sbi.text = `${
      this.extBarLabel
    }: M ${this.mainQueue.getContentsSize()}(${this.mainQueue.getEventsCounter()}), S ${this.spareQueue.getContentsSize()}(${this.spareQueue.getEventsCounter()})`
    this.sbi.show()
  }
  mergeQueues() {
    // move any events from spare to main queue
    if (this.spareQueue.getEventsCounter() > 0) {
      this.mainQueue.addString(this.spareQueue.getContents())
      this.spareQueue.emptyQueue()
    }
  }
  async add(editorEvent) {
    if (this.mainQueue.getContentsSize() > this.queueSizeLimit) {
      // main queue is full, start flashing and meanwhile store events in spare queue
      this.spareQueue.addEvent(editorEvent)
      try {
        // check if the main queue is already being flashed
        if (!this.mainQueue.isFlashing) {
          let fl = await this.mainQueue.flash()
          this.mergeQueues()
        }
      } catch (error) {
        // something went wrong
        let errorMsg = `[ERROR] Pusher.QueueController caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
        deactivate(this.sbi, this)
      }
    } else {
      // main queue still has space, store the event
      this.mainQueue.addEvent(editorEvent)
    }
    this.updateStatus()
  }
  saveState() {
    return this.mainQueue.saveContents() // async function
  }
  loadState() {
    this.mainQueue.loadContents() // sync function
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
      timestamp: makeTimestamp(),
      contentChanges: [
        {
          range: new vscode.Range(0, 0, 0, 0),
          rangeLength: 0,
          rangeOffset: 0,
          text: doc.getText(),
          firstChange: true
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
    deactivate(sbi, qc)
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
    qc = new QueueController(context, sessionId, db, sbi)
    qc.loadState()
    // TODO: need to know state of mainQueue.loadedFirstChange
    if () {
      qc.add(createFirstChange(vscode.window.activeTextEditor.document))
    }
    // change text content event handler
    // FIXME: event should be vscode.TextDocumentChangeEvent
    vscode.workspace.onDidChangeTextDocument((event: any) => {
      onTextChange(event, qc)
    })
    // change active editor event handler
    vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
      // the active editor was changed; hide and deactivate the extension
      deactivate(sbi, qc)
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
    deactivate(sbi, qc)
  }
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export async function deactivate(
  sbi: vscode.StatusBarItem,
  qc: QueueController
) {
  qc.mergeQueues()
  await qc.saveState()
  if (sbi) sbi.hide()
}

function makeTimestamp(): string {
  return Date.now().toString()
}
