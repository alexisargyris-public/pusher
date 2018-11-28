'use strict'

import Mygraphql from './mygraphql'

export default class Database {
  public gr: any

  constructor() {
    this.gr = new Mygraphql()
  }
  /**
   * @deprecated
   */
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
  /**
   * Create a session record
   * @param {string} fileId The file's id
   * @returns {Promise<string>} The session id
   */
  public createSessionAsync(fileId: String): Promise<string> {
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
  /**
   * Create a file record
   * @param {string} path The file's path
   * @returns {Promise<string>} The file id
   */
  public createFileAsync(path: string): Promise<string> {
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
  /**
   * Check if a particular file record exists
   * @param {string} path The file's path
   * @returns {Promise<string>} The file id or an empty string
   */
  public findFileAsync(path: string): Promise<string> {
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
        : ''
    })
  }
  /**
   * Create an event record
   * @param {string} timestamp The time of the event
   * @param {string} sessionId The session id
   * @param {string} content The event's content
   * @returns {Promise<string>} The new event id
   */
  public createEventAsync(
    timestamp: string,
    sessionId: string,
    content: string
  ): Promise<string> {
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
