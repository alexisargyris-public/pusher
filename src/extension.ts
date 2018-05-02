'use strict'

import * as vscode from 'vscode'
import Config from './aws-exports'

/**
 * This is called by vscode to activate the command contributed by the extension
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
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
  statusBarItem.text = 'pusher'
  statusBarItem.show()
  // name of file to watch
  const filename = vscode.window.activeTextEditor.document.fileName
  // current session id
  let sessionId: String

  // TODO: reset when user renames file

  // change active editor event handler
  vscode.window.onDidChangeActiveTextEditor((event: vscode.TextEditor) => {
    // update status bar
    if (filename === event.document.fileName) statusBarItem.show()
    else statusBarItem.hide()
  })

  // change text event handler
  vscode.workspace.onDidChangeTextDocument(
    (event: vscode.TextDocumentChangeEvent) => {
      let mutation: any
      let content: String
      let eventId: String

      // process only events happening to filename being watched
      if (filename === event.document.fileName) {
        if (typeof sessionId === 'undefined') sessionId = Date.now().toString()

        // TODO: handle multiple / complex content changes
        if (event.contentChanges.length > 1)
          vscode.window.showWarningMessage('a complex edit occured')

        // double stringify to escape all double quotes...
        content = JSON.stringify(event.contentChanges[0])
        content = JSON.stringify(content)
        // ...but remove outer double quotes
        content = content.substring(1, content.length - 1)
        eventId = Date.now().toString()
        mutation = gql(`
        mutation {
          createEvent(
            sessionId: "${sessionId}",
            eventId: "${eventId}",
            content: "${content}",
            filename: "${filename}"
          ){
            sessionId
          }
        }`)
        client.mutate({ mutation: mutation }).catch(error => {
          vscode.window.showErrorMessage('an error occured: ' + error.message)
        })
      }
    }
  )

  // command associated with extension
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {})
  context.subscriptions.push(disposable)

  // appsync client
  const config = new Config()
  global.WebSocket = require('ws')
  global.window = global.window || {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    WebSocket: global.WebSocket,
    ArrayBuffer: global.ArrayBuffer,
    addEventListener: function() {},
    navigator: { onLine: true }
  }
  global.localStorage = {
    store: {},
    getItem: function(key) {
      return this.store[key]
    },
    setItem: function(key, value) {
      this.store[key] = value
    },
    removeItem: function(key) {
      delete this.store[key]
    }
  }
  require('es6-promise').polyfill()
  require('isomorphic-fetch')

  const AUTH_TYPE = require('aws-appsync/lib/link/auth-link').AUTH_TYPE
  const AWSAppSyncClient = require('aws-appsync').default
  const url = config.ENDPOINT
  const region = config.REGION
  const type = AUTH_TYPE.AWS_IAM
  const AWS = require('aws-sdk')
  AWS.config.update({
    region: config.REGION,
    credentials: new AWS.Credentials({
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY
    })
  })
  const credentials = AWS.config.credentials
  const gql = require('graphql-tag')
  const client = new AWSAppSyncClient({
    url: url,
    region: region,
    auth: {
      type: type,
      credentials: credentials
    },
    disableOffline: true
  })
}

/**
 * This is called by vscode when the extension needs to be deactivated
 */
export function deactivate() {}
