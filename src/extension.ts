'use strict'

import * as vscode from 'vscode'
import Database from './db'

class Queue {
  protected contents: string = ''
  protected eventsCounter: number = 0
  makeContent(event: any): string {
    return JSON.stringify({
      eventId: event.timestamp,
      content: event.contentChanges[0]
    })
  }
  add(editorEvent): void {
    this.eventsCounter++
    this.contents += this.makeContent(editorEvent)
  }
  empty(): void {
    this.contents = ''
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
  constructor(sessionId: string, db: Database) {
    super()
    this.sessionId = sessionId
    this.db = db
  }
  flash() {
    return this.db
      .createEvent(makeTimestamp(), this.sessionId, this.contents)
      .then(() => {})
      .catch(error => {
        // something went wrong
        let errorMsg = `[ERROR] Pusher.eventLoop caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
        deactivate()
      })
  }
}
class queueController {
  private mainQueue: FlashableQueue
  private spareQueue: Queue
  private readonly mainSizeLimit: any = 1000
  constructor(sessionId: string, db: Database) {
    this.mainQueue = new FlashableQueue(sessionId, db)
    this.spareQueue = new Queue()
  }
  add(editorEvent) {
    if (this.mainQueue.getContentsSize > this.mainSizeLimit) {
      this.spareQueue.add(editorEvent)
    } else {
      this.mainQueue.add(editorEvent)
    }
  }
}

/**
 * EventQueue provides functionality related to event queue management
 *
 * how to calculate the size of a js object:
 * https://stackoverflow.com/questions/1248302/how-to-get-the-size-of-a-javascript-object
 * aws dynamodb limits:
 * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Limits.html
 */
class EventQueue {
  private mainQueue: any[] = []
  private spareQueue: any[] = [] // to store events while the contents of the main queue are being processed
  private isMainQueueBusy: boolean = false
  private sizeOfMainQueue: number = 0
  readonly sizeQueueLimit = 100000
  constructor() {}
  private calcSize(object): number {
    let objectList = []
    let stack = [object]
    let bytes = 0

    while (stack.length) {
      let value = stack.pop()

      if (typeof value === 'boolean') {
        bytes += 4
      } else if (typeof value === 'string') {
        bytes += value.length * 2
      } else if (typeof value === 'number') {
        bytes += 8
      } else if (
        typeof value === 'object' &&
        objectList.indexOf(value) === -1
      ) {
        objectList.push(value)

        for (var i in value) {
          stack.push(value[i])
        }
      }
    }
    return bytes
  }
  private flushQueue() {}
  addEvent(ev: any) {
    // decide to which queue to add the event
    if (this.isMainQueueBusy) {
      this.spareQueue.push(ev)
    } else {
    }
    // calculate the size of the current event
    // update the event queue size total
    // decide if the main queue is large enough to flush
  }
}

let eq = new EventQueue()
let statusBarItem: vscode.StatusBarItem

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  const eventLoopTimeoutLimit = 4000 // how often does the event loop get called
  const eventQueueProcessLimit = 19 // actually the limit is 25, see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
  const extBarLabel = 'Pusher: '
  let fileId: any // Promise<String | Boolean>
  let sessionId: any // Promise<String>
  let eventQueue: any[] = []
  let eventQueueSpare: any[] = []
  let isEventLoopBusy: boolean = false
  let eventsBeingProcessed: number
  const spareQueue: Queue = new Queue()
  let mainQueue: Queue

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
  function eventLoop() {
    function processEventsBatch(): Promise<any[]> {
      return new Promise((resolve, reject) => {
        let events = []
        // create the event records
        for (let index = 0; index < eventsBeingProcessed; index++) {
          events.push({
            eventId: eventQueue[index].timestamp.toString(),
            sessionId: sessionId,
            content: eventQueue[index].contentChanges[0]
          })
        }
        return db
          .batchCreateEvent(events)
          .then(res => {
            // remove processed items from queue
            for (let index = 0; index < eventsBeingProcessed; index++) {
              eventQueue.shift()
            }
            resolve(res)
          })
          .catch(err => {
            reject(err)
          })
      })
    }
    // update status
    statusBarItem.text = extBarLabel + eventQueue.length
    statusBarItem.show()
    if (isReadyToFlush(eventQueue)) {
      isEventLoopBusy = true
      flush(eventQueue)
    } else {
      // reset the timeout
      timerId = setTimeout(eventLoop, eventLoopTimeoutLimit)
      isEventLoopBusy = false
    }

    /*
    // check if there are any events to process
    if (eventQueue.length) {
      // there are events to process
      isEventLoopBusy = true
      // set events to process: min of eventQueueProcessLimit, eventQueue.length
      eventsBeingProcessed =
        eventQueueProcessLimit < eventQueue.length
          ? eventQueueProcessLimit
          : eventQueue.length
      processEventsBatch()
        .then(res => {
          // check if we received as many events as we've sent
          if (res.length === eventsBeingProcessed) {
            // all ok
            // check if the spare event queue contains any events
            if (eventQueueSpare.length) {
              console.log(
                `found ${eventQueueSpare.length} events in spare queue`
              )
              // copy the events from the spare to the main event queue
              for (let index = 0; index < eventQueueSpare.length; index++) {
                eventQueue.push(
                  JSON.parse(JSON.stringify(eventQueueSpare[index]))
                )
              }
              // empty spare queue
              eventQueueSpare.length = 0
            }
            // reset the timeout
            timerId = setTimeout(eventLoop, eventLoopTimeoutLimit)
            isEventLoopBusy = false
          } else {
            // something went wrong
            let errorMsg = `[ERROR] Pusher.eventLoop: ${eventsBeingProcessed} events were sent, but only ${
              res.length
            } were received, so deactivating extension`
            console.error(errorMsg)
            vscode.window.showErrorMessage(errorMsg)
            deactivate()
          }
        })
        .catch(err => {
          // top error handler
          // TODO: partial batch success / failure
          console.error(err)
          vscode.window.showErrorMessage(err.message)
          deactivate()
        })
    } else {
      // no events to process; reset the timeout
      timerId = setTimeout(eventLoop, eventLoopTimeoutLimit)
    }
*/
  }
  function onTextChange(event: any) {
    // the text in the active editor was changed; store the change
    if (event.contentChanges.length) {
      event.timestamp = makeTimestamp()
      eq.addEvent(event)
      // // check which event queue to use
      // if (isEventLoopBusy) {
      //   console.log('main loop is busy')
      //   eventQueueSpare.push(event)
      // } else {
      //   eventQueue.push(event)
      // }
    }
  }

  // if no document is open, exit immediately
  if (typeof vscode.window.activeTextEditor === 'undefined') return
  // init appsync db and first event (whole document)
  const db = new Database()
  try {
    fileId = await findOrCreateFile(
      vscode.window.activeTextEditor.document.fileName
    )
    sessionId = await createSession(fileId)
    mainQueue = new FlashableQueue(sessionId, db, spareQueue)
    mainQueue.add(createFirstChange(vscode.window.activeTextEditor.document))
    // eventQueue.push(createFirstChange(vscode.window.activeTextEditor.document))
    // change text content event handler
    // TODO: event should be vscode.TextDocumentChangeEvent
    vscode.workspace.onDidChangeTextDocument((event: any) => {
      onTextChange(event)
    })
    // change active editor event handler
    vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
      // the active editor was changed; hide and deactivate the extension
      deactivate()
    })
    // the event processing loop
    // timerId = setTimeout(eventLoop, eventLoopTimeoutLimit)
    // the command associated with the extension
    let disposable = vscode.commands.registerCommand('extension.pusher', () => {
      // all necessary set up work has already been done (on first activation); nothing to do here (i.e. on each subsequent activation)
    })
    context.subscriptions.push(disposable)
    // status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right
    )
    console.log('pusher activated')
    // TODO: user renames file
  } catch (err) {
    // something went wrong; deactivate the extension
    console.error(`[ERROR] Pusher.activate caused: ${err}`)
    deactivate()
  }
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export function deactivate() {
  if (statusBarItem) statusBarItem.hide()
}

function makeTimestamp(): string {
  return Date.now().toString()
}
