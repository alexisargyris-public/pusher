'use strict'

import * as vscode from 'vscode'
import Database from './db'

let timerId = null

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  function createFirstEvent(doc) {
    return {
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
  function eventLoop() {
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
              console.error(`something is wrong ${err}`)
              this.statusBarItem.hide()
              deactivate()
            })
        } else {
          // fileId is already set
          resolve()
        }
      })
    }
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
    function createEvent() {
      // TODO: handle multiple / complex content changes
      let content: String
      let event = eventQueue[0]

      if (event.contentChanges.length > 1)
        vscode.window.showWarningMessage('a complex edit occured')

      // double stringify to escape all double quotes...
      content = JSON.stringify(event.contentChanges[0])
      content = JSON.stringify(content)
      // ...but remove outer double quotes
      content = content.substring(1, content.length - 1)
      return db.createEvent(sessionId, content).then(id => {
        if (!id) {
          return Promise.reject('eventId creation failed')
        }
      })
    }
    function processOneEvent() {
      return findOrCreateFile()
        .then(() => {
          return findOrCreateSession()
        })
        .then(() => {
          return createEvent()
        })
    }

    // update status
    statusBarItem.text = extBarLabel + eventQueue.length
    statusBarItem.show()
    // check if there is an event to process
    if (eventQueue.length > 0) {
      // an event exists; process it
      processOneEvent()
        .then(() => {
          eventQueue.shift()
          // reset the timeout
          timerId = setTimeout(eventLoop, timeoutLimit)
        })
        .catch(error => {
          vscode.window.showErrorMessage(error)
        })
    } else {
      // an event does not exist; reset the timeout
      timerId = setTimeout(eventLoop, timeoutLimit)
    }
  }
  const timeoutLimit = 1000
  const extBarLabel = 'Pusher: '
  let fileId: String
  let sessionId: String
  let eventQueue: any[] = []
  let isFirstEvent: Boolean = true

  // if no document is open exit immediately
  if (typeof vscode.window.activeTextEditor === 'undefined') return
  const db = new Database()
  const fileName = vscode.window.activeTextEditor.document.fileName
  // change active editor event handler
  vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    // the active editor was changed; hide and deactivate the extension
    this.statusBarItem.hide()
    deactivate()
  })
  // change text content event handler
  vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      // the text in the active editor was changed; process the change
      if (event.contentChanges.length) {
        if (isFirstEvent) {
          eventQueue.push(createFirstEvent(event.document))
          isFirstEvent = false
        } else {
          eventQueue.push(event)
        }
      }
    }
  )
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
