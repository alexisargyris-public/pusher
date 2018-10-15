// https://stackoverflow.com/questions/35074713/extending-typescript-global-object-in-node-js

declare namespace NodeJS {
  export interface Global {
    WebSocket: any
    window: any
    localStorage: any
  }
}