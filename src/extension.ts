'use strict'

import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  // execute once when the command is activated
  console.log('pusher activated')
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {
    // execute every time the command is executed
    console.log('pusher running')
  })
  context.subscriptions.push(disposable)
}

export function deactivate() {}
