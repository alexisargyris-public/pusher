# Change Log

All notable changes to the "pusher" extension will be documented in this file.

## [1.4.0](https://github.com/anemomazomata/pusher/releases/tag/v1.3.0) (2019-01-02)

### Added

- support read-only mode

### Changed

- code re-factoring for better maintainability

## [1.3.0](https://github.com/anemomazomata/pusher/releases/tag/v1.3.0) (2018-10-29)

### Added

- stringified event packages

## [1.2.0](https://github.com/anemomazomata/pusher/releases/tag/1.2.0) (2018-10-15)

### Fixed

- time of event occurence

### Added

- batch event transfer
- double event queue (to handle events occuring while processing events)

## [1.1.2](https://github.com/anemomazomata/pusher/releases/tag/1.1.2) (2018-09-30)

### Fixed

- rolled back to aws-appsync@1.3.3 to avoid an error introduced in 1.3.4.
- initial setup of environment

## [1.1.1](https://github.com/anemomazomata/pusher/releases/tag/1.0.0) (2018-09-23)

### Fixed

- installation errors

## [1.1.0](https://github.com/anemomazomata/pusher/releases/tag/1.0.0) (2018-05-29)

### Added

- start using books

## [1.0.2](https://github.com/anemomazomata/pusher/releases/tag/1.0.0) (2018-05-27)

### Fixed

- return only the id when creating an event
- check if the file / session / event were created successfully

## [1.0.1](https://github.com/anemomazomata/pusher/releases/tag/1.0.0) (2018-05-21)

### Fixed

- the first event to be pushed is the whole file contents

## [1.0.0](https://github.com/anemomazomata/pusher/releases/tag/1.0.0) (2018-05-16)

### Added

- client timestamps for files, sessions and events
- the first event to be pushed is the whole file contents

## [0.3.1](https://github.com/anemomazomata/pusher/releases/tag/0.3.1) (2018-05-14)

### Fixed

- createEvent should publish all data

## [0.3.0](https://github.com/anemomazomata/pusher/releases/tag/0.3.0) (2018-05-14)

### Added

- event counter at the status bar

### Changed

- timeoutLimit to 1 sec

### Fixed

- check for events with 0 content changes

## [0.2.0](https://github.com/anemomazomata/pusher/releases/tag/0.2.0) (2018-05-10)

### Added

- db functions refactoring
- new db schema, queries and mutations
- event queue

## [0.1.0](https://github.com/anemomazomata/pusher/releases/tag/v0.1.0-alpha) (2018-04-30)

### Added

- proof of concept
 
