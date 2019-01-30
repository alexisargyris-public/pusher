import * as vscode from 'vscode'

export interface AnmzTextDocumentChangeEvent {
  timestamp: string
  contentChanges: vscode.TextDocumentContentChangeEvent
}

export function makeTimestamp(): string {
  return Date.now().toString()
}