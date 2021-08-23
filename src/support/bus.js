const EventEmitter = require('events').EventEmitter;


module.exports = {
    bus: new EventEmitter,

    // Event names
    FILE_WATCHING_COMPLETE: 1,
}