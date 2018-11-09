'use strict'

import * as vscode from 'vscode'
import Database from './db'
import * as LZString from '../node_modules/lz-string'

interface AnmzTextDocumentChangeEvent {
  timestamp: string
  contentChanges: vscode.TextDocumentContentChangeEvent
}
class Queue {
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
class FlashableQueue extends Queue {
  private context: vscode.ExtensionContext
  private sessionId: string
  private db: Database
  private readonly storageKey: string = 'anmz'
  isFlashing: boolean = false
  private readonly firstChangeLabel: string = 'firstChange'
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
  async flash() {
    // check if there is any content to flash
    if (this.contents.length) {
      this.isFlashing = true
      let contentsToFlash = this.writeContents(this.contents)
      try {
        await this.db.createEvent(
          makeTimestamp(),
          this.sessionId,
          contentsToFlash
        )
        this.emptyQueue()
      } catch (error) {
        // something went wrong
        let errorMsg = `[ERROR] Pusher.QueueController caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
      } finally {
        this.isFlashing = false
      }
    }
  }
  // not used
  saveContents(): Promise<void> {
    if (this.contents.length) {
      return new Promise<void>(resolve => {
        // first load any already existing data from storage
        let temp = this.context.workspaceState.get(this.storageKey)
        temp = this.readContents(temp)
        // add current contents
        temp += this.getContents() // TODO: is this good enough?
        // save contents back to storage
        this.writeContents(temp)
        this.context.workspaceState.update(
          this.storageKey,
          this.writeContents(temp)
        )
      })
    } else {
      return Promise.resolve()
    }
  }
  // not used
  loadContents() {
    let temp = this.context.workspaceState.get(this.storageKey)
    // check if there are any contents to load
    if (temp) {
      let temp2 = this.readContents(temp)
      this.addString(temp2)
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
  // not used
  saveCurrentState() {
    return this.mainQueue.saveContents() // async function
  }
  // not used
  processPreviousState() {
    this.mainQueue.loadContents() // sync function
  }
  async flash() {
    await this.mainQueue.flash()
    this.updateStatus()
  }
}

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  let fileId: string | boolean
  let sessionId: string
  let db: Database
  let qc: QueueController
  let sbi: vscode.StatusBarItem
  const sbiCommandLabel = '_anmzDeactivate'

  function createFirstChange(
    doc: vscode.TextDocument
  ): AnmzTextDocumentChangeEvent {
    return {
      timestamp: makeTimestamp(),
      contentChanges: {
        range: new vscode.Range(0, 0, 0, 0),
        rangeLength: 0,
        // rangeOffset: 0,
        text: doc.getText()
      }
    }
  }
  function findOrCreateFile(fn): Promise<string | boolean> {
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
  function createSession(fi): Promise<string> {
    return new Promise(resolve => {
      return db.createSession(fi).then(id => {
        resolve(id)
      })
    })
  }
  function onTextChange(
    event: vscode.TextDocumentContentChangeEvent,
    qc: QueueController
  ) {
    // the text in the active editor was changed; store the change
    qc.add({
      timestamp: makeTimestamp(),
      contentChanges: event
    })
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
    // command used by status bar item
    vscode.commands.registerTextEditorCommand(sbiCommandLabel, async () => {
      try {
        qc.mergeQueues()
        await qc.flash()
      } catch (error) {
        let errorMsg = `[ERROR] Pusher.activate caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
      }
    })
    // status bar item
    sbi = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right)
    sbi.command = sbiCommandLabel
    qc = new QueueController(context, sessionId, db, sbi)
    // qc.processPreviousState()
    qc.add(createFirstChange(vscode.window.activeTextEditor.document))
    // change text content event handler
    vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => {
        // check if a content change exists
        if (event.contentChanges.length) {
          onTextChange(event.contentChanges[0], qc) // note: only the first change is processed
        }
      }
    )
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
  } catch (error) {
    // something went wrong; deactivate the extension
    console.error(`[ERROR] Pusher.activate caused: ${error.message}`)
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
  try {
    qc.mergeQueues()
    await qc.flash()
  } finally {
    if (sbi) sbi.hide()
  }
}

function makeTimestamp(): string {
  return Date.now().toString()
}
