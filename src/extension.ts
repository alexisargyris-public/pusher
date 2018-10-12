'use strict'

import * as vscode from 'vscode'
import Database from './db'

let timerId = null

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  const timeoutLimit = 1000
  const extBarLabel = 'Pusher: '
  let fileId: any // Promise<String | Boolean>
  let sessionId: any // Promise<String>
  let eventQueue: any[] = []
  const eventQueueLengthLimit = 1

  function createFirstEvent(doc) {
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
    return new Promise((resolve) => {
      return db
        .findFile(fn)
        .then(id => {
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
    return new Promise((resolve) => {
      return db.createSession(fi).then(id => {
        resolve(id)
      })
    })
  }

  function eventLoop() {
    function processOneEvent(event): Promise<any> {
      // TODO: deprecated
      function findOrCreateFile() {
        // set fileId if it doesn't already exist
        return new Promise((resolve, reject) => {
          if (typeof fileId === 'undefined') {
            // fileId is not set; check if the file exists in the db
            return db
              .findFile(fileName)
              .then(id => {
                if (id) {
                  // the file exists
                  fileId = id
                  resolve()
                } else {
                  // the file does not exist; create it
                  return db.createFile(fileName).then(id => {
                    if (id) {
                      fileId = id
                      resolve()
                    } else {
                      reject('fileId creation failed')
                    }
                  })
                }
              })
              .catch(err => {
                // something went wrong; deactivate the extension
                console.error(`[ERROR] Pusher.findOrCreateFile ${err}`)
                this.statusBarItem.hide()
                deactivate()
              })
          } else {
            // fileId is already set
            resolve()
          }
        })
      }
      // TODO: deprecated
      function findOrCreateSession() {
        // set sessionId if it doesn't already exist
        return new Promise((resolve, reject) => {
          if (typeof sessionId === 'undefined') {
            // sessionId is not set; this is a new session, create it
            return db.createSession(fileId).then(id => {
              if (id) {
                sessionId = id
                resolve()
              } else {
                reject('sessionId creation failed')
              }
            })
          } else {
            // sessionId is already set
            resolve()
          }
        })
      }
      function createEvent(event) {
        // TODO: handle multiple / complex content changes
        let content: String
  
        if (event.contentChanges.length > 1)
          vscode.window.showWarningMessage('a complex edit occured')
  
        // double stringify to escape all double quotes...
        content = JSON.stringify(JSON.stringify(event.contentChanges[0]))
        // ...but remove outer double quotes
        content = content.substring(1, content.length - 1)
        return db.createEvent(event.timestamp, sessionId, content).then(id => {
          if (!id) {
            return Promise.reject('eventId creation failed')
          }
        })
      }
    
      return findOrCreateFile()
        .then(() => {
          return findOrCreateSession()
        })
        .then(() => {
          return createEvent(event)
        })
    }
    function processEventBatch() {
      // TODO: continue
    }

/* 
mutation ddd {
  batchCreateEvent(input: [
    {eventId: "1539108309570", sessionId: "1539108258820", content: "test1"}, 
    {eventId: "1539108309571", sessionId: "1539108258820", content: "test2"},
    {eventId: "1539108309572", sessionId: "1539108258820", content: "test3"}
  ]) {
  eventId
  sessionId
  content
  }
}
*/

    // update status
    statusBarItem.text = extBarLabel + eventQueue.length
    statusBarItem.show()
    // check if it's time to process events
    if (eventQueue.length > eventQueueLengthLimit) {
      // it is time to process events
      processEventBatch().then(
        // reset the timeout
        timerId = setTimeout(eventLoop, timeoutLimit)
      ).catch(err => {
        // TODO: partial batch success / failure
        vscode.window.showErrorMessage(err)
      })
      // let promises = []
      // eventQueue.forEach(event => {
      //   promises.push(processOneEvent(event))
      // })
      // Promise.all(promises)
      //   .then(() => {
      //     // reset the timeout
      //     timerId = setTimeout(eventLoop, timeoutLimit)
      //   })
      //   .catch(error => {
      //     vscode.window.showErrorMessage(error)
      //   })
    } else {
      // it's not yet time to process events; reset the timeout
      timerId = setTimeout(eventLoop, timeoutLimit)
    }
  }

  // if no document is open exit immediately
  if (typeof vscode.window.activeTextEditor === 'undefined') return
  // init appsync db and first event (whole document)
  const db = new Database()
  try {
    fileId = await findOrCreateFile(vscode.window.activeTextEditor.document.fileName)
    sessionId = await createSession(fileId)
  } catch(err) {
    // something went wrong; deactivate the extension
    console.error(`[ERROR] Pusher.findOrCreateFile caused: ${err}`)
    this.statusBarItem.hide()
    deactivate()
  }
  eventQueue.push(createFirstEvent(vscode.window.activeTextEditor.document))
  // change text content event handler
  vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      // the text in the active editor was changed; process the change
      if (event.contentChanges.length) {
        event.timestamp = Date.now()
        eventQueue.push(event)
      }
    }
  )
  // change active editor event handler
  vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    // the active editor was changed; hide and deactivate the extension
    this.statusBarItem.hide()
    deactivate()
  })
  // the event processing loop
  timerId = setTimeout(eventLoop, timeoutLimit)
  // the command associated with the extension
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {
    // all necessary set up work has already been done (on first activation); nothing to do here (i.e. on each subsequent activation)
  })
  context.subscriptions.push(disposable)
  // status bar item
  let statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  )
  console.log('pusher activated')
  // TODO: user renames file
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export function deactivate() {
  clearTimeout(timerId)
}
