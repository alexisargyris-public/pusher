'use strict'

import { QueueController } from './queueController'
import { makeTimestamp, AnmzTextDocumentChangeEvent } from './utils'
import * as vscode from 'vscode'
import { Tea } from './tea'
import * as credentials from './credentials'

let qc: QueueController
let sbi: vscode.StatusBarItem
let sbiSub: vscode.Disposable

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export function activate(context: vscode.ExtensionContext): void {
  const extensionName: string = 'extension.pusher'
  const sbiOpts: any = {
    commandId: 'extension.pusherSaveOnDemand',
    defaultText: 'Pusher: not syncing',
    tooltip: 'Pusher status',
    priority: 10
  }
  const password: string = credentials.password
  const myTea: Tea = new Tea()

  async function onStartSyncing(): Promise<void> {
    // status bar item click command handler
    sbiSub = vscode.commands.registerTextEditorCommand(sbiOpts.commandId, onSbiClick)
    context.subscriptions.push(sbiSub)
    sbi.command = sbiOpts.commandId
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
  async function onStopSyncing(): Promise<void> {
    try {
      if (qc) {
        qc.mergeQueues()
        await qc.flash()
      }
    } finally {
      qc = void 0
      sbi.text = sbiOpts.defaultText
      sbi.show()
    }
  }
  function onTextChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length) {
      // the text in the active editor was changed; store the change
      // note: only the first change is processed
      let ev = event.contentChanges[0]
      qc.add({
        timestamp: makeTimestamp(),
        contentChanges: ev
      })
    }
  }
  async function onSbiClick(): Promise<void> {
    try {
      qc.mergeQueues()
      await qc.flash()
    } catch (error) {
      let errorMsg = `[ERROR] Pusher.onSbiClick caused: ${error.message}`
      console.error(errorMsg)
      vscode.window.showErrorMessage(errorMsg)
    }
  }
  function onEncode(textEditor: vscode.TextEditor): Thenable<boolean> {
    let encrpt = myTea.encrypt(textEditor.document.getText(), password)
    return textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
      editBuilder.replace(getDocumentRange(textEditor.document), encrpt)
    }, { undoStopBefore: false, undoStopAfter: false})
  }
  function onDecode(textEditor: vscode.TextEditor): Thenable<boolean> {
    let decrpt = myTea.decrypt(textEditor.document.getText(), password)
    return textEditor.edit((editBuilder: vscode.TextEditorEdit) => {
      editBuilder.replace(getDocumentRange(textEditor.document), decrpt)
    }, { undoStopBefore: false, undoStopAfter: false})
  }
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
  function initSbi() {
    // init status bar item
    sbi = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      sbiOpts.priority
    )
    sbi.text = sbiOpts.defaultText
    sbi.tooltip = sbiOpts.tooltip
    sbi.show()
  }
  function getDocumentRange(doc): vscode.Range {
    let topPos: vscode.Position = new vscode.Position(0, 0)
    let bottomTextLine: vscode.TextLine = doc.lineAt(doc.lineCount - 1)

    return new vscode.Range(topPos, bottomTextLine.range.end)
  }

  // extension start syncing command handler
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(extensionName + 'StartSyncing', onStartSyncing)
  )
  // extension stop syncing command handler
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(extensionName + 'StopSyncing', onStopSyncing)
  )
  // extension encoding command handler
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(extensionName + 'Encode', async (textEditor: vscode.TextEditor) => {
      let res = onEncode(textEditor)
      if (!res) {
        let errorMsg = `[ERROR] Pusher.onEncode failed`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
      }
    })
  )
  // extension decoding command handler
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(extensionName + 'Decode', async (textEditor: vscode.TextEditor) => {
      let res = onDecode(textEditor)
      if (!res) {
        let errorMsg = `[ERROR] Pusher.onDecode failed`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
      }
    })
  )
  // change text content event handler
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (event: vscode.TextDocumentChangeEvent) => onTextChange(event)
    )
  )
  // init status bar item (sbi)
  initSbi()
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export async function deactivate(): Promise<void> {
  try {
    if (qc) {
      qc.mergeQueues()
      await qc.flash()
    }
  } finally {
    qc = void 0
    if (sbi) {
      sbi.dispose()
      sbi = void 0
    }
  }
}
