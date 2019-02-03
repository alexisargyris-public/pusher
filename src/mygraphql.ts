'use strict'

import Config from './aws-exports'
let isReadOnly: boolean = false

/* 
  javascript client to appsync https://andrewgriffithsonline.com/blog/serverless-websockets-on-aws/#client-side-application-code 
*/
export default class Mygraphql {
  public gql: any
  public client: any

  constructor() {
    // environment setup
    const config = new Config()
    if (!global.WebSocket) {
      global.WebSocket = require('ws')
    }
    if (!global.window) {
      global.window = {
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        WebSocket: global.WebSocket,
        ArrayBuffer: global.ArrayBuffer,
        addEventListener: function() {},
        navigator: { onLine: true }
      }
    }
    if (!global.localStorage) {
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
    }

    require('es6-promise').polyfill()
    require('isomorphic-fetch')

    // appsync client
    const AUTH_TYPE = require('aws-appsync/lib/link/auth-link').AUTH_TYPE
    // issue https://github.com/awslabs/aws-mobile-appsync-sdk-js/issues/233 causes next statement to fail in appsync@1.3.4 -- rolled back to 1.3.3
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
    this.gql = require('graphql-tag')
    this.client = new AWSAppSyncClient({
      url: url,
      region: region,
      auth: {
        type: type,
        credentials: credentials
      },
      disableOffline: true
    })
  }

  public mutate(mt: String) {
    if (!isReadOnly) {
      return this.client.mutate({ mutation: this.gql(mt) })
    } else {
      return Promise.resolve(undefined)
    }
  }
  public query(qr: String) {
    return this.client.query({ query: this.gql(qr) })
  }
}
