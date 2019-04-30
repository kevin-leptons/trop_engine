# ITask

Interface for long task which need update it's progress

## Members

### run()

* Description
    * Start to perform task
    * Implementation MUST implement this member
* Input - Override by implementation
* Output
    * `Promise<undefined>`

### close()

* Description
    * Terminate running of this task
    * Implementation MUST implement this member
* Input - none
* Output
    * `Promise<undefined>`


### on(event_name, callback)

* Description
    * Register event on this task
    * It affects to any instance of events
* Input
    * `event_name` / `String`
         * `success`
         * `failure`
         * `update`
    * `callback` / `Function(event)`
* Output - none

### once(event_name, callback)

* Description
    * Register event on this task
    * It affects to only one time
    * Input, output and exception is similar like on()

### \_emit(event_name, data)

* Description
    * Implementation uses this method to fire an event
* Input
    * `event_name` / `String`
    * `data` / `any` - Correspond data with event
* Output - none

## Example

```js
const {ITask} = require('@trop/engine')
const {delay, error, Deferral} = require('@trop/gear')

class LongLiveTask extends ITask {
    async run() {
        for (let i = 0; i < 4; ++i) {
            if (this._close_defer) {
                this._close_defer.resolve()
                throw error.Useless('Task is terminated')
            }

            this._emit('update', `${i*25}%`)
            await delay(100)
        }
    }

    async close() {
        this._close_defer = new Deferral()
        await this._close_defer.promise
        this._close_defer = null
    }
}
```
