# Queue-MongoDB

A simple Node.js queuing system which uses MongoDB as a permanent data store.


## Configuration

Install the module with `npm install queue-mongodb`.

Database configuration parameters must be defined as environment variables or set in a `.env` file in the project root, e.g.

```env
QUEUE_DB_HOST=localhost
QUEUE_DB_PORT=27017
QUEUE_DB_NAME=queuetest
QUEUE_DB_USER=root
QUEUE_DB_PASS=mysecret
```

A collection named `queue` will be added to the database.


## Example

The following example pushes three items to a queue named `myqueue`. Each item can be retreived up to three times at no more than 60 second intervals:

```js
import { Queue } from 'queue-mongodb';
const myQueue = new Queue('myqueue', 3, 60);

// queue items
(async () => {

  await myQueue.send( 'item 1' );
  await myQueue.send( 42 ),
  await myQueue.send( { a:1, b:2, c:3 } ),

})();
```

The next item on the queue can be retrieved, processed, and removed (perhaps in a script called using a cron job):

```js
(async () => {

  // fetch item
  const qItem = await myQueue.receive();

  // item is returned
  if (qItem) {

    // ...process...

    // remove after successful processing
    await myQueue.remove( qItem );

  }

})();
```

If `remove()` is not run, processing is presumed to have failed. The item will be available again after 60 seconds for up to two more attempts.

Finally, to close the database connection:

```js
(async () => {

  await myQueue.close();

})();
```


## new Queue(type, [maxRetries], [processingTime])

Create a new queue handler.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>string</code> | <code>"DEFAULT"</code> | queue identifier (any number of separate queues can be defined) |
| [maxRetries] | <code>number</code> | <code>5</code> | maximum number if times an item can be retrieved from the queue before processing is assumed to be complete |
| [processingTime] | <code>number</code> | <code>300</code> | maximum time in seconds a queued item held for processing |


## queue.send(data, [maxRetries], [delayUntil]) ⇒ <code>qItem</code>

Push data to the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object: { `_id`, `sent` (date), `runs` (retries remaining), `data` }, or null when a failure occurs

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>any</code> | <code></code> | data to queue |
| [maxRetries] | <code>number</code> |  | maximum number if times an item can be retrieved from the queue (overrides this.maxRetries) |
| [delayUntil] | <code>Date</code> |  | date which can be set in the future to delay processing |


## queue.receive() ⇒ <code>qItem</code>

Retrieve the next item from the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object: { `_id`, `sent` (date), `runs` (retries remaining), `data` }, or null when no items are available


## queue.remove(qItem) ⇒ <code>number</code>

Remove a queued item. (Method is async and returns a Promise).

This must be called once the item has been handled or it will be re-queued after `this.processingTime`.

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items (normally 1).

| Param | Type | Description |
| --- | --- | --- |
| qItem | <code>qItem</code> | the queue item to remove |


## queue.purge() ⇒ <code>number</code>

Removes all queued items, including future ones. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items.


## queue.count() ⇒ <code>number</code>

Count of all queued items. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - items in the queue.


## queue.close()

Close database connection. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.


## Testing

Clone the repository and run `docker-compose up` to launch MongoDB 4.4 and Node.js 14 containers. `npm test` runs various test functions.
