# TaskExecutor

A way to perform tasks, with limited number of tasks at a time

## Members

### constructor(capacity)

* Description
    * A way to perform tasks, with limited number of tasks at a time
    * It is useful to perform batch operations with limited resources and
      max effective
    * Task should be independent, there are no specific for task's
      dependency or solve it between tasks
    * If there are dependency between tasks, it must be sorted before push
      into executor
* Input
    * `capacity` / `Number` / `4` - Unsigned integer, number of slots in executor.
      Depends on computer resources, this value should be calculate for
      good match with `push()`
* Exception
    * `TypeError` - Capacity must be an integer, greater than zero

### get capacity()

`Number` - Non-negative integer, number of free slots

### get free()

`Number` - Non-negative integer, number of free slots

### get task_count()

`Number` - Non-negative integer, number of tasks which is pushed

### get done_count()

`Number` - Non-negative integer, number of tasks which is done

### push(task, args=[], slots=1)

* Description
    * Add a task to executor by specific number of slots
    * If there are empty slots then executor start to run it
      and return immediately
    * If there are no empty slots then executor block calling
      until other tasks is done and release enough slots
    * Task results is update by register events via on()
* Input
    * `task` / `Function` | `ITask` - Task to run. If task is implement from
      `ITask` then it can update it's progress instead of start-finish
      running as function
    * `args` / `Array<any>` / `[]` - Argument to bind to task
    * `slots` / `Number` / `1` - Unsigned integer, number of slots
      to perform task. With tasks requires many computer resources
      then can raise slots
* Output
    * `Promise<undefined>`
* Exception
    * `TypeError` - Task is not a function
    * `TypeError` - Task is not an instance of ITask
    * `TypeError` - Slots is not an integer, greater than zero
    * `Conflict` - Other caller is waiting on executor
    * `Closed` - Executor is closed

### finish()

* Description
    * Close this executor, do not allow push task anymore
    * Wait until all tasks is done
* Input - none
* Output
    * `Promise<undefined>`
* Exception - none

### on(event_name, callback)

* Description
    * Register event from executor
    * On events is fire, trigger to run callback
* Input
    * `event_name` / `String` - Event name
        * `task-success` - A task is finished with succeed result
        * `task-failure` - A task is finished with failed result
        * `task-update` - A task update it's progress. This event is fire if and
          only if task is implement from ITask do update it' status manually
        * `done` - Executor is closed, all of taks is done
    * `callback` / Function - Function will be trigger to run on event is
      fired, every time
        * `event` / `any` - Data which is emited with event
* Output - none
* Exception - none

### once(event_name, callback)

* Description
    * It is similar like `on()`, but callback will be trigger only one time
      on event is fire

### close()

* Description
    * Close this executor, do not allow push tasks anymore
    * Reject all of push request on waiting
    * Stop all of running tasks if they implement from ITask
    * Tasks which is function can be stop and must wait for terminations
    * Wait for all of tasks is done
* Input - none
* Output
    * `Promise<undefined>`

### reset()

* Description
    * Close executor
    * Open executor for re-using
* Input - none
* Output
    * `Promise<undefined>`

## Example

### With lightweight tasks

```js
const {
    TaskExecutor,
    delay
} = require('@trop/std')

async function kick_to_the_ball(index) {
    await delay(100)
    console.log(`Kick to the ball ${index}`)
}

async function main(n) {
    let t = new TaskExecutor(10)

    for (let i = 0; i < 100; ++i) {
        await t.push(kick_to_the_ball, [i])
    }

    await t.finish()
}

main().
catch(e => console.error(e))
```

### With heavy tasks

```js
const {
    TaskExecutor,
    ITask,
    delay
} = require('@trop/std')

class HouseCleanup extends ITask {
    constructor(task_index) {
        super()
        this._task_index = task_index
    }

    async run(index) {
        this._emit('update', `${index} - 0%`)

        await delay(100)
        this._emit('update', `${index} - 25%`)

        await delay(100)
        this._emit('update', `${index} - 75%`)

        await delay(100)
        this._emit('update', `${index} - 100%`)
    }
}

async function main(n) {
    let t = new TaskExecutor(10)

    t.on('task-update', data => console.log(data))

    for (let i = 0; i < 100; ++i) {
        let task = new HouseCleanup()
        await t.push(task, [i])
    }

    await t.finish()
}

main().
catch(e => console.error(e))
```
