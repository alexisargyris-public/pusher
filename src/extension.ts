'use strict'

import * as vscode from 'vscode'
import Database from './db'

let timeoutLimit = 1000
let timeout = null

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
          return db.findFile(path).then(id => {
            if (id) {
              // the file exists
              fileId = id
              resolve()
            } else {
              // the file does not exist; create it
              return db.createFile(path).then(id => {
                if (id) {
                  fileId = id
                  resolve()
                } else {
                  reject('fileId creation failed')
                }
              })
            }
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
    statusBarItem.text = 'pusher: ' + eventQueue.length
    statusBarItem.show()

    // check if not already processing and that there is an event to process
    if (!isProcessing && eventQueue.length > 0) {
      isProcessing = true
      processOneEvent()
        .then(() => {
          isProcessing = false
          eventQueue.shift()
        })
        .catch(error => {
          isProcessing = false
          vscode.window.showErrorMessage('an error occured: ' + error)
        })
    }
  }

  // exit immediately if no document is open
  if (typeof vscode.window.activeTextEditor === 'undefined')
    // no editor is open
    // FIXME: return something that will allow successful activation after an editor is opened
    return

  console.log('pusher activated')

  // status bar item
  let statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  )

  const db = new Database()
  // path of file to watch
  const path = vscode.window.activeTextEditor.document.fileName
  let fileId: String
  let sessionId: String
  let eventQueue: any[] = []
  let isProcessing: Boolean = false
  let isFirstEvent: Boolean = true
  timeout = setInterval(eventLoop, timeoutLimit)

  // TODO: reset when user renames file

  // change active editor event handler
  vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    // update status bar
    if (path === event.document.fileName) statusBarItem.show()
    else statusBarItem.hide()
  })

  // change text event handler
  vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      // process the event only if it occured to the document being watched
      if (event.contentChanges.length && path === event.document.fileName) {
        if (isFirstEvent) {
          isFirstEvent = false
          eventQueue.push(createFirstEvent(event.document))
        } else {
          eventQueue.push(event)
        }
      }
    }
  )

  // command associated with extension
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {})
  context.subscriptions.push(disposable)
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export function deactivate() {
  clearInterval(timeout)
}
