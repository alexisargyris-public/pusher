'use strict'

import * as vscode from 'vscode'
import Config from './aws-exports'

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

  // the change event handler
  vscode.workspace.onDidChangeTextDocument(
    (ev: vscode.TextDocumentChangeEvent) => {
      // TODO ignore change events of different editors

      if (
        vscode.window.activeTextEditor &&
        ev.document === vscode.window.activeTextEditor.document
      ) {
        console.log(ev.contentChanges[0].text)
        const mutation = gql(`
        mutation {
          createEvent(
            datetime: "${Date.now()}",
            content: "${ev.contentChanges[0].text}",
            filename: "filename",
            user: "user",
            device: "device",
            editor: "editor",
            sitting: "sitting"
          ){
            id
          }
        }`)
        client.mutate({ mutation: mutation }).catch(error => {
          console.error(error)
        })
      }
    }
  )

  // the command associated with the extension
  let disposable = vscode.commands.registerCommand('extension.pusher', () => {
    // execute every time the command is executed
  })
  context.subscriptions.push(disposable)

  // the appsync client
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

export function deactivate() {}
