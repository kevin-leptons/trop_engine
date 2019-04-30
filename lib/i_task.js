const EventEmitter = require('events')

const {error} = require('@trop/gear')

class ITask {
    constructor() {
        this._event = new EventEmitter()
    }

    // Description
    // * Start to perform task
    // * Implementation MUST implement this member
    //
    // Input - Override by implementation
    //
    // Output
    // * Promise<undefined>
    async run() {
        throw new error.NotImplemented()
    }

    // Description
    // * Terminate running of this task
    // * Implementation MUST implement this member
    //
    // Input - none
    //
    // Output
    // * Promise<undefined>
    async close() {
        throw new error.NotImplemented()
    }

    // Description
    // * Register event on this task
    // * It affects to any instance of events
    //
    // Input
    // * event_name / String
    //  * success
    //  * failure
    //  * update
    // * callback / Function
    //
    // Output - none
    //
    // Exception - none
    on(event_name, callback) {
        this._event.on(event_name, callback)
    }

    // Description
    // * Register event on this task
    // * It affects to only one time
    // * Input, output and exception is similar like on()
    once(event_name, callback) {
        this._event.once(event_name, callback)
    }

    // PRIVATE MEMBERS

    // Description
    // * Implementation uses this method to fire an event
    //
    // Input
    // * event_name / String
    // * data / any - Correspond data with event
    //
    // Output - none
    _emit(event_name, data) {
        this._event.emit(event_name, data)
    }
}

module.exports = ITask
