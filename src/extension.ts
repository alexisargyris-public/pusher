'use strict'

import * as vscode from 'vscode'

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('pusher activated')
  // exit immediately if no document is open
  if (!vscode.workspace.textDocuments.length) {
    return
  }

  // TODO note which editor currently has focus

  // change event handler
  vscode.workspace.onDidChangeTextDocument(
    (ev: vscode.TextDocumentChangeEvent) => {
      // TODO ignore change events of different editors

      if (
        vscode.window.activeTextEditor &&
        ev.document === vscode.window.activeTextEditor.document
      ) {
        console.log(ev.contentChanges[0].text)
      }
    }
  )

  // the command associated with the extension
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {
    // execute every time the command is executed
  })
  context.subscriptions.push(disposable)
}

export function deactivate() {}
