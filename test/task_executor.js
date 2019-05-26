const assert = require('assert')

const {error, delay, Stopwatch} = require('@trop/gear')

const {TaskExecutor, ITask} = require('../lib')

describe('TaskExecutor.constructor()', () => {
    it('with default capacity', () => {
        new TaskExecutor()
    })

    it('with custom capacity', () => {
        new TaskExecutor(100)
    })

    it('with capacity=null, throw error', () => {
        assert.throws(() => {
            new TaskExecutor(null)
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity=true, throw error', () => {
        assert.throws(() => {
            new TaskExecutor(true)
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity=false, throw error', () => {
        assert.throws(() => {
            new TaskExecutor(false)
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity="string", throw error', () => {
        assert.throws(() => {
            new TaskExecutor('string')
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity=[1, 2, 3], throw error', () => {
        assert.throws(() => {
            new TaskExecutor([1, 2, 3])
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity={}, throw error', () => {
        assert.throws(() => {
            new TaskExecutor({})
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })

    it('with capacity=function() {}, throw error', () => {
        assert.throws(() => {
            new TaskExecutor(function() {})
        }, {
            name: 'TypeError',
            message: 'Capacity must be possitive integer'
        })
    })
})

describe('TaskExecutor.capacity', () => {
    it('with default capacity', () => {
        let x = new TaskExecutor()

        assert.equal(x.capacity, 4)
    })

    it('with custom capacity', () => {
        let c = 10
        let x = new TaskExecutor(c)

        assert.equal(x.capacity, c)
    })
})

describe('TaskExecutor.free', () => {
    it('with default capacity', () => {
        let x = new TaskExecutor()

        assert.equal(x.free, 4)
    })

    it('with custom capacity', () => {
        let c = 10
        let x = new TaskExecutor(c)

        assert.equal(x.free, c)
    })
})

describe('TaskExecutor.task_count', () => {
    it('with default capacity', () => {
        let x = new TaskExecutor()

        assert.equal(x.task_count, 0)
    })

    it('with custom capacity', () => {
        let c = 10
        let x = new TaskExecutor(c)

        assert.equal(x.task_count, 0)
    })
})

describe('TaskExecutor.done_count', () => {
    it('with default capacity', () => {
        let x = new TaskExecutor()

        assert.equal(x.done_count, 0)
    })

    it('with custom capacity', () => {
        let c = 10
        let x = new TaskExecutor(c)

        assert.equal(x.done_count, 0)
    })
})

describe('TaskExecutor.push()', () => {
    it('with empty executor, push less than capacity', async () => {
        let c = 4
        let p = 3
        let x = new TaskExecutor(c)

        for (let i = 0; i < p; ++i) {
            await x.push(task)
        }
        await x.finish()

        assert.equal(x.task_count, p)
        assert.equal(x.done_count, p)
        assert.equal(x.free, c)
    })

    it('with empty executor, push equal than capacity', async () => {
        let c = 4
        let x = new TaskExecutor(c)

        for (let i = 0; i < c; ++i) {
            await x.push(task)
        }
        await x.finish()

        assert.equal(x.task_count, c)
        assert.equal(x.done_count, c)
        assert.equal(x.free, c)
    })

    it('with empty executor, push over capacity', async () => {
        let c = 4
        let n = 10
        let x = new TaskExecutor(c)

        for (let i = 0; i < n; ++i) {
            await x.push(task)
        }
        await x.finish()

        assert.equal(x.task_count, n)
        assert.equal(x.done_count, n)
        assert.equal(x.free, c)
    })

    it('with full executor, wait until slots is avaiable', async () => {
        let c = 4
        let x = new TaskExecutor(c)
        let sw = new Stopwatch()

        for (let i = 0; i < c; ++i) {
            await x.push(task)
        }
        sw.start()
        await x.push(task)
        sw.stop()

        await x.finish()
        assert(sw.elapsed > 50)
    })

    it('with ITask, fire task-update events', async () => {
        let x = new TaskExecutor()
        let n = 10
        let u = 0

        x.on('task-update', data => u += 1)
        for (let i = 0; i < n; ++i) {
            let large_task = new LargeTask()
            await x.push(large_task)
        }
        await x.finish()

        assert.equal(u, n * 4)
    })

    it('with ITask, fire task-success events', async () => {
        let x = new TaskExecutor()
        let n = 10
        let u = 0

        x.on('task-success', data => u += 1)
        for (let i = 0; i < n; ++i) {
            let large_task = new LargeTask()
            await x.push(large_task)
        }
        await x.finish()

        assert.equal(u, n)
    })

    it('with ITask, fire task-failure events', async () => {
        let x = new TaskExecutor()
        let n = 10
        let u = 0

        x.on('task-failure', data => u += 1)
        for (let i = 0; i < n; ++i) {
            let large_task = new LargeTask(true)
            await x.push(large_task)
        }
        await x.finish()

        assert.equal(u, n)
    })
})

describe('TaskExecutor.close()', () => {
    it('do before all tasks is done', async () => {
        let x = new TaskExecutor()
        let n = 10

        let t1 = async () => {
            try {
                for (let i = 0; i < n; ++i) {
                    await x.push(task)
                }
            } catch (e) {
                if (e instanceof error.Closed) {
                    return e.message === 'Executor is closed' ? 1 : -1
                }
            }
            return -1
        }
        let t2 = async () => {
            await delay(200)
            await x.close()
        }
        let [r1, r2] = await Promise.all([t1(), t2()])
        let rejected = r1 === 1

        assert(rejected)
        assert(x.done_count === x.task_count)
    })

    it('do after all tasks is done', async () => {
        let x = new TaskExecutor()
        let n = 10

        for (let i = 0; i < n; ++i) {
            await x.push(task)
        }
        await x.finish()

        await x.close()
        assert(x.done_count === x.task_count)
    })
})

describe('TaskExecutor.reset()', () => {
    it('reset then push tasks', async () => {
        let c = 4
        let x = new TaskExecutor(c)
        let n = 10

        let t1 = async () => {
            try {
                for (let i = 0; i < n; ++i) {
                    await x.push(task)
                }
            } catch (e) {
                if (e instanceof error.Closed) {
                    return e.message === 'Executor is closed' ? 1 : -1
                }
            }

            return -1
        }
        let t2 = async() => {
            await delay(200)
            await x.reset()
        }

        let [r1, r2] = await Promise.all([t1(), t2()])
        let rejected = r1 === 1

        assert(rejected)
        assert.equal(x.task_count, 0)
        assert.equal(x.done_count, 0)
        assert.equal(x.free, c)
        assert.equal(x.capacity, c)

        for (let i = 0; i < n; ++i) {
            await x.push(task)
        }
        await x.finish()
        assert.equal(x.task_count, n)
        assert.equal(x.done_count, n)
        assert.equal(x.free, c)
    })
})

describe('TaskExecutor/performance', () => {
    it('keep free slots is near to zero', async () => {
        let c = 4
        let x = new TaskExecutor(c)
        let n = 100

        let t1 = async () => {
            for (let i = 0; i < n; ++i) {
                await x.push(task)
            }
            await x.finish()
        }
        let t2 = async () => {
            for (;;) {
                if (x.done_count === n - c) {
                    return true
                }
                await delay(50)
                if (x.free > 1) {
                    return false
                }
            }
        }
        let [r1, r2] = await Promise.all([t1(), t2()])
        let free_less_than_one = r2 === true

        assert(free_less_than_one)
    })

    it('run faster sequence by k times', async () => {
        let n = 100
        let c = 4
        let x = await run_sequence(n)
        let y = await run_with_executor(n, c)

        let r = Math.round(x / y)
        assert(c - 1000 <= r <= c + 1000)
    })

    it('with massive of tasks', async () => {
        let sw = new Stopwatch()
        let c = 10
        let n = 10000000
        let x = new TaskExecutor(c)
        async function small_task() {
            return true
        }

        sw.start()
        for (let i = 0; i < n; ++i) {
            await x.push(small_task)
        }
        await x.finish()
        sw.stop()
        assert(sw.elapsed < 7000)
    })

    async function run_sequence(n) {
        let sw = new Stopwatch()

        sw.start()
        for (let i = 0; i < n; ++i) {
            await task()
        }
        sw.stop()
        return sw.elapsed
    }

    async function run_with_executor(n, c) {
        let x = new TaskExecutor(c)
        let sw = new Stopwatch()

        sw.start()
        for (let i = 0; i < n; ++i) {
            await x.push(task)
        }
        await x.finish()
        sw.stop()
        return sw.elapsed
    }
})

async function task() {
    await delay(100)
}

class LargeTask extends ITask {
    constructor(will_be_failed) {
        super()
        this._will_be_failed = will_be_failed
    }

    async run() {
        if (this._will_be_failed) {
            throw Error('Just failed')
        }

        for (let i = 0; i < 4; ++i) {
            this._emit('update', `${i*25}%`)
            await delay(100)
        }
    }
}
