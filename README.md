# pusher

## Description

A VS Code extension that pushes to a remote server each edit event occuring in a document. Events are stored along with the precise time they happen. When a (configurable) number of events has been reached, then they are compressed, packaged and pushed to the server as a single payload to minimize bandwidth requirements.

Events storage is carried out by a NoSQL database service (Amazon DynamoDB). To switch to any other database technology a different implementation of the following four functions is required:

1. find file: check if a particular file record exists
2. create file: create a file record
3. create session: create a session record
4. create event: create an event record

## Release Notes

Have a look [here](https://github.com/anemomazomata/pusher/blob/master/CHANGELOG.md).
