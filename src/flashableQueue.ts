import { Queue } from './queue'
import Database from './db'
import { makeTimestamp } from './utils'
import * as vscode from 'vscode'
import * as LZString from '../node_modules/lz-string'

export class FlashableQueue extends Queue {
  private context: vscode.ExtensionContext
  private sessionId: string
  private db: Database
  private readonly storageKey: string = 'anmz'
  isFlashing: boolean = false
  private readonly firstChangeLabel: string = 'firstChange'
  constructor(cntxt: vscode.ExtensionContext, sessionId: string, db: Database) {
    super()
    this.context = cntxt
    this.sessionId = sessionId
    this.db = db
  }
  private readContents(cont): string {
    function uncompress(str): string {
      // https://github.com/pieroxy/lz-string
      return LZString.decompressFromEncodedURIComponent(str)
    }
    let temp = uncompress(cont)
    // add outer double quotes
    temp = `"${temp}"`
    // double parse to un-escape all double quotes
    return JSON.parse(temp)
  }
  private writeContents(cont): string {
    function compress(str): string {
      // https://github.com/pieroxy/lz-string
      return LZString.compressToEncodedURIComponent(str)
    }

    // double stringify to escape all double quotes
    let eventContent = JSON.stringify(cont)
    // remove outer double quotes
    eventContent = eventContent.substring(1, eventContent.length - 1)
    return compress(eventContent)
  }
  async flash() {
    // check if there is any content to flash
    if (this.contents.length) {
      this.isFlashing = true
      let contentsToFlash = this.writeContents(this.contents)
      try {
        await this.db.createEventAsync(
          makeTimestamp(),
          this.sessionId,
          contentsToFlash
        )
        this.emptyQueue()
      } catch (error) {
        // something went wrong
        let errorMsg = `[ERROR] Pusher.QueueController caused: ${error.message}`
        console.error(errorMsg)
        vscode.window.showErrorMessage(errorMsg)
      } finally {
        this.isFlashing = false
      }
    }
  }
  // not used
  saveContents(): Promise<void> {
    if (this.contents.length) {
      return new Promise<void>(resolve => {
        // first load any already existing data from storage
        let temp = this.context.workspaceState.get(this.storageKey)
        temp = this.readContents(temp)
        // add current contents
        temp += this.getContents() // TODO: is this good enough?
        // save contents back to storage
        this.writeContents(temp)
        this.context.workspaceState.update(
          this.storageKey,
          this.writeContents(temp)
        )
      })
    } else {
      return Promise.resolve()
    }
  }
  // not used
  loadContents() {
    let temp = this.context.workspaceState.get(this.storageKey)
    // check if there are any contents to load
    if (temp) {
      let temp2 = this.readContents(temp)
      this.addString(temp2)
    }
  }
}