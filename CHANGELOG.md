# Change Log

All notable changes to the "pusher" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2018-05-29

### Added

* start using books

## [1.0.2] - 2018-05-27

### Fixed

* return only the id when creating an event
* check if the file / session / event were created successfully

## [1.0.1] - 2018-05-21

### Fixed

* the first event to be pushed is the whole file contents

## [1.0.0] - 2018-05-16

## Added

* client timestamps for files, sessions and events
* the first event to be pushed is the whole file contents

## [0.3.1] - 2018-05-14

### Fixed

* createEvent should publish all data

## [0.3.0] - 2018-05-14

### Added

* event counter at the status bar

### Changed

* timeoutLimit to 1 sec

### Fixed

* check for events with 0 content changes

## [0.2.0] - 2018-05-10

### Added

* db functions refactoring
* new db schema, queries and mutations
* event queue

## [0.1.0] - 2018-04-30

### Added

* proof of concept
