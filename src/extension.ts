'use strict'

import { QueueController } from './queueController'
import { makeTimestamp, AnmzTextDocumentChangeEvent } from './utils'
import * as vscode from 'vscode'

let qc: QueueController
let sbi: vscode.StatusBarItem

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  const extensionName: string = 'extension.pusher'
  const sbiCommandId: string = '_anmzDeactivate'
  const sbiTextWhileLoading: string = 'Pusher: loading...'
  const sbiTooltip: string = 'Pusher sync'
  const sbiPriority: number = 10

  function createFirstChange(
    doc: vscode.TextDocument
  ): AnmzTextDocumentChangeEvent {
    return {
      timestamp: makeTimestamp(),
      contentChanges: {
        range: new vscode.Range(0, 0, 0, 0),
        rangeLength: 0,
        text: doc.getText()
      }
    }
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
  async function onSbiClick() {
    try {
      qc.mergeQueues()
      await qc.flash()
    } catch (error) {
      let errorMsg = `[ERROR] Pusher.activate caused: ${error.message}`
      console.error(errorMsg)
      vscode.window.showErrorMessage(errorMsg)
    }
  }

  // if no document is open, exit immediately
  if (typeof vscode.window.activeTextEditor === 'undefined') return
  // extension activation command handler
  context.subscriptions.push(vscode.commands.registerCommand(extensionName, () => {
    // the command associated with the extension
    // all init work has been done on first activation; here should go any re-activation work
  }))
  // status bar item click command handler
  context.subscriptions.push(vscode.commands.registerTextEditorCommand(sbiCommandId, onSbiClick))
  // change active editor event handler
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    // the active editor was changed; hide and deactivate the extension
    deactivate()
  }))
  // change text content event handler
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      // check if a content change exists
      if (event.contentChanges.length) {
        onTextChange(event.contentChanges[0], qc) // note: only the first change is processed
      }
    }
  ))
  // init status bar item
  sbi = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, sbiPriority)
  sbi.tooltip = sbiTooltip
  sbi.text = sbiTextWhileLoading
  sbi.command = sbiCommandId
  sbi.show()
  // init queue controller
  qc = new QueueController(context, sbi)
  try {
    await qc.init()
    qc.add(createFirstChange(vscode.window.activeTextEditor.document))
  } catch (error) {
    // something went wrong; deactivate the extension
    console.error(`[ERROR] Pusher.activate caused: ${error.message}`)
    deactivate()
  }
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export async function deactivate() {
  try {
    qc.mergeQueues()
    await qc.flash()
  } finally {
    if (sbi) sbi.hide()
  }
}
