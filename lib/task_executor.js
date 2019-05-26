const EventEmitter = require('events')

const {error, Deferral} = require('@trop/gear')

const ITask = require('./i_task')

class TaskExecutor {
    // Description
    // * Provide a way to perform tasks, with limited number of tasks at a time
    // * It is useful to perform batch operations with limited resources and
    //   max effective
    // * Task should be independent, there are no specific for task's
    //   dependency or solve it between tasks
    // * If there are dependency between tasks, it must be sorted before push
    //   into executor
    //
    // Input
    // * capacity / Number / 4 - Unsigned integer, number of slots in executor.
    //   Depends on computer resources, this value should be calculate for
    //   good match with push()
    //
    // Exception
    // * TypeError - Capacity must be positive integer
    constructor(capacity=4) {
        this._verify_constructor_input(capacity)

        // Number
        // Integer, non-negative, number of slots for tasks
        this._capacity = capacity

        // Number
        // Integer, non-negative, number of free slots
        this._free = capacity

        // Number
        // Integer, non-negative, number of tasks which is pushed to
        // executor
        this._task_count = 0

        // Number
        // Integer, non-negative, number of tasks is done
        this._done_count = 0

        // EventEmitter
        // For emitting, handle events of executor
        this._event = new EventEmitter()

        // Deferral
        // Wait for executing of all tasks is done
        this._finished_defer = new Deferral()

        // Deferral
        // Deferral for request slots
        this._slot_request_defer

        // Number
        // Number of request slots
        this._slot_request

        // Boolean
        // * true on executor is closed
        // * false on executor is still open
        this._closed = false

        // Set<ITask>
        // Running tasks
        this._running_tasks = new Set()
    }

    // Number
    // Possitive integer, number of slots
    get capacity() {
        return this._capacity
    }

    // Number
    // Non-negative integer, number of free slots
    get free() {
        return this._free
    }

    // Number
    // Non-negative integer, number of tasks which is pushed
    get task_count() {
        return this._task_count
    }

    // Number
    // Non-negative integer, number of tasks which is done
    get done_count() {
        return this._done_count
    }

    // Description
    // * Add a task to executor by specific number of slots
    // * If there are empty slots then executor start to run it
    //   and return immediately
    // * If there are no empty slots then executor block calling
    //   until other tasks is done and release enough slots
    // * Task results is update by register events via on()
    //
    // Input
    // * task / Function | ITask - Task to run. If task is implement from
    //   ITask then it can update it's progress instead of start-finish
    //   running as function
    // * args / Array<any> / [] - Argument to bind to task
    // * slots / Number / 1 - Unsigned integer, number of slots
    //   to perform task. With tasks requires many computer resources
    //   then can be rais slots
    //
    // Output
    // * Promise<undefined>
    //
    // Exception
    // * TypeError - Task is not a function
    // * TypeError - Task is not an instance of ITask
    // * TypeError - Slots is not an integer, greater than zero
    // * Conflict - Other caller is waiting on executor
    // * Closed - Executor is closed
    async push(task, args=[], slots=1) {
        this._it_must_not_closed()
        this._verify_push_input(task, args, slots)
        await this._wait_for_empty_slot(slots)

        this._task_count += 1
        this._free -= slots

        let task_promise = this._execute_task(task, args)

        Promise.resolve(task_promise).
        then(res => this._event.emit('task-success', res)).
        catch(e => this._event.emit('task-failure', e)).
        finally(() => this._process_done_task(task, slots))
    }

    // Description
    // * Close this executor, do not allow push task anymore
    // * Wait until all tasks is done
    //
    // Input - none
    //
    // Output
    // * Promise<undefined>
    //
    // Exception - none
    async finish() {
        this._closed = true
        if (this._done_count === this._task_count) {
            this._event.emit('finished')
            return
        }
        await this._finished_defer.promise
    }

    // Description
    // * Register event from executor
    // * On events is fire, trigger to run callback
    //
    // Input
    // * event_name / String - Event name
    //  * task-success - A task is finished with succeed result
    //  * task-failure - A task is finished with failed result
    //  * task-update - A task update it's progress. This event is fire if and
    //    only if task is implement from ITask do update it' status manually
    //  * done - Executor is closed, all of taks is done
    // * callback / Function - Function will be trigger to run on event is
    //   fired, every time
    //  * event / any - Data which is emited with event
    //
    // Output - none
    //
    // Exception - none
    on(event_name, callback) {
        this._event.on(event_name, callback)
    }

    // Description
    // * It is similar like on(), but callback will be trigger only one time
    //   on event is fire
    once(event_name, callback) {
        this._event.once(event_name, callback)
    }

    // Description
    // * Close this executor, do not allow push tasks anymore
    // * Reject all of push request on waiting
    // * Stop all of running tasks if they implement from ITask
    // * Tasks which is function can be stop and must wait for terminations
    // * Wait for all of tasks is done
    //
    // Input - none
    //
    // Output
    // * Promise<undefined>
    async close() {
        this._closed = true
        if (this._slot_request_defer) {
            let e = new error.Closed('Executor is closed')
            this._slot_request_defer.reject(e)
        }
        this._stop_running_tasks()
        await this._finished_defer.promise
    }

    // Description
    // * Close executor
    // * Open executor for re-using
    //
    // Input - none
    //
    // Output
    // * Promise<undefined>
    async reset() {
        await this.close()
        this._closed = false
        this._free = this._capacity
        this._running_tasks = new Set()
        this._finished_defer = new Deferral()
        this._task_count = 0
        this._done_count = 0
        this._slot_request_defer = null
    }

    // PRIVATE MEMBERS

    _verify_constructor_input(capacity) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw TypeError('Capacity must be possitive integer')
        }
    }

    _verify_push_input(task, args, slots) {
        if (!task instanceof ITask && typeof task !== 'function') {
            throw TypeError('Task is not an instance of Task or function')
        }
        if (!Array.isArray(args)) {
            throw TypeError('Args must be an array')
        }
        if (!Number.isInteger(slots) || slots < 1) {
            throw TypeError('Slots is not an integer, greater than zero')
        }
    }

    _it_must_not_closed() {
        if (this._closed) {
            throw new error.Closed('Executor is closed')
        }
    }

    async _wait_for_empty_slot(slots) {
        if (this._free < slots) {
            if (this._slot_request_defer) {
                throw new error.Conflic('Other waiting on executor')
            }

            this._slot_request = slots
            this._slot_request_defer = new Deferral()
            await this._slot_request_defer.promise
            this._slot_request_defer = null
        }
    }

    async _stop_running_tasks() {
        for (let task of this._running_tasks) {
            await task.close()
        }
    }

    _execute_task(task, args) {
        if (task instanceof ITask) {
            this._running_tasks.add(task)
            task.on('update', data => this._event.emit('task-update', data))
            return task.run(...args)
        } else {
            return task(...args)
        }
    }

    _process_done_task(task, slots) {
        this._done_count += 1
        this._free += slots
        this._running_tasks.delete(task)

        if (this._slot_request_defer && this._free >= this._slot_request) {
            this._slot_request_defer.resolve()
        }

        if (this._closed && this._done_count === this._task_count) {
            this._finished_defer.resolve()
            this._event.emit('finished')
        }
    }
}

module.exports = TaskExecutor
