'use strict'

import Mygraphql from './mygraphql'

export default class Database {
  public gr: any

  constructor() {
    this.gr = new Mygraphql()
  }
  public batchCreateEvent(events: any[]) {
    let input: string = ''
    events.forEach(event => {
      // eventContent is a large string and needs to be stringified
      // double stringify to escape all double quotes...
      let eventContent = JSON.stringify(JSON.stringify(event.content))
      // remove outer double quotes
      eventContent = eventContent.substring(1, eventContent.length - 1)
      // the rest of the object should not be stringified
      input += `,{
        eventId: "${event.eventId}", 
        sessionId: "${event.sessionId}", 
        content: "${eventContent}"
      }`
    })
    input = input.substring(1) // remove first comma
    let mutation = `
    mutation bce {
      batchCreateEvent(input: [${input}]) {
        eventId
      }
    }
    `
    return this.gr.mutate(mutation).then(res => {
      return res.data.batchCreateEvent // events array
    })
  }
  public createSession(fileId: String) {
    let mutation = `
    mutation {
      createSession(input: {
        sessionId: "${Date.now()}"
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
    let bookId = 'amomonaima' // TODO: read the list of available bookIds
    // double escape backslash when writing paths
    let mutation = `
    mutation cf{
      createFile(input: {
        fileId: "${Date.now()}"
        bookId: "${bookId}"
        path: "${path.replace(/\\/g, '\\\\')}"
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
    // quadruple escape backslash when reading paths
    const qr = `
    query lfbp{
      listFilesByPath(path: "${path.replace(/\\/g, '\\\\\\\\')}") {
        items {
          fileId
        }
      }
    }
    `
    return this.gr.query(qr).then(res => {
      return res.data.listFilesByPath.items.length
        ? res.data.listFilesByPath.items[0].fileId
        : false
    })
  }
  // TODO: deprecated
  public createEvent(timestamp, sessionId: String, content: String) {
    let mutation = `
    mutation ce{
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
}
