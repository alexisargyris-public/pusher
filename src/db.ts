'use strict'

import Mygraphql from './mygraphql'

export default class Database {
  public gr: any

  constructor() {
    this.gr = new Mygraphql()
  }
  public createEvent(sessionId: String, content: String) {
    let timestamp = Date.now()
    let mutation = `
    mutation {
      createEvent(input: {
        eventId: "${timestamp}"
        sessionId: "${sessionId}",
        content: "${content}"
      }){
        eventId
      }
    }`
    return this.gr.mutate(mutation).then(res => {
      return res.data.createEvent.eventId
    })
  }
  public createSession(fileId: String) {
    let timestamp = Date.now()
    let mutation = `
    mutation {
      createSession(input: {
        sessionId: "${timestamp}"
        fileId: "${fileId}"
      }){
        sessionId
      }
    }
    `
    return this.gr.mutate(mutation).then(res => {
      return res.data.createSession.sessionId
    })
  }
  public createFile(path: String) {
    let timestamp = Date.now()
    let bookId = 'amomonaima' // FIXME: read the list of available bookIds
    let mutation = `
    mutation {
      createFile(input: {
        fileId: "${timestamp}"
        bookId: "${bookId}"
        path: "${path}"
      }){
        fileId
      }
    }
    `
    return this.gr.mutate(mutation).then(res => {
      return res.data.createFile.fileId
    })
  }
  public findFile(path: String) {
    // find a file and return its id or false
    return this.listFilesByPath(path).then(items => {
      return items.length >= 1 ? items[0].fileId : false
    })
  }
  private listFilesByPath(path: String) {
    let qr = `
    query {
      listFilesByPath(path: "${path}") {
        items {
          fileId
        }
      }
    }
    `
    return this.gr.query(qr).then(res => {
      return res.data.listFilesByPath.items
    })
  }
}
