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
  function eventLoop() {
    function createOrFindFileId(path) {
      if (typeof fileId === 'undefined') {
        return db.findFileId(path).then(id => {
          fileId = id
        })
      } else {
        return Promise.resolve()
      }
    }
    function createSession(fileId) {
      if (typeof sessionId === 'undefined') {
        return db.createSession(fileId).then(id => {
          sessionId = id
        })
      } else {
        return Promise.resolve()
      }
    }
    function createEvent(event) {
      // TODO: handle multiple / complex content changes
      let content: String

      if (event.contentChanges.length > 1)
        vscode.window.showWarningMessage('a complex edit occured')

      // double stringify to escape all double quotes...
      content = JSON.stringify(event.contentChanges[0])
      content = JSON.stringify(content)
      // ...but remove outer double quotes
      content = content.substring(1, content.length - 1)
      return db.createEvent(sessionId, content)
    }
    function processOneEvent(event) {
      return createOrFindFileId(path)
        .then(() => {
          return createSession(fileId)
        })
        .then(() => {
          return createEvent(eventQueue[0])
        })
    }

    // update status
    statusBarItem.text = 'pusher: ' + eventQueue.length
    statusBarItem.show()

    // check if not already processing and that there is an event to process
    if (!isProcessing && eventQueue.length > 0) {
      isProcessing = true
      processOneEvent(eventQueue[0])
        .then(() => {
          isProcessing = false
          eventQueue.shift()
        })
        .catch(error => {
          isProcessing = false
          vscode.window.showErrorMessage('an error occured: ' + error.message)
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
  let fileId: String
  // path of file to watch
  const path = vscode.window.activeTextEditor.document.fileName
  // current session id
  let sessionId: String
  let eventQueue: any[] = []
  let isProcessing: Boolean = false
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
      // TODO: compare with event.document, not event.document.fileName to ensure that no file renaming, etc
      if (event.contentChanges.length && path === event.document.fileName)
        eventQueue.push(event)
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
