# Queue-MongoDB

A simple Node.js queuing system which uses MongoDB as a permanent data store.


## Configuration

Install the module with `npm install queue-mongodb`.

Database configuration parameters must be defined as environment variables or set in a `.env` file in the project root, e.g.

```env
QUEUE_DB_HOST=localhost
QUEUE_DB_PORT=27017
QUEUE_DB_USER=root
QUEUE_DB_PASS=mysecret
QUEUE_DB_NAME=qdb
QUEUE_DB_COLL=queue
```

A queue management collection named `queue` will be added to the `qdb` database.


## Example

The following code defines a queue named `myqueue` and defaults. When an item is not removed from the queue, it will be re-queued 60 seconds later. This will occur until the item has been received a total of 3 times.

```js
import { Queue } from 'queue-mongodb';
const myQueue = new Queue('myqueue');

myQueue.processingTime = 60;
myQueue.maxTries = 3;
```

The following code adds three items to the queue.

```js
// queue items
(async () => {

  // item 1: string data available immediately
  await myQueue.send( 'item 1' );

  // item 2: number data available in 10 seconds
  await myQueue.send( 42, 10);

  // item 3: object data available immediately, 5 tries permitted
  await myQueue.send( { a:1, b:2, c:3 }, , 5 );

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

Processing is presumed to have failed if `remove()` is not run. The item is re-queued after 60 seconds (`myQueue.processingTime`) for up to two further attempts (or four for item 3).

Finally, close the database connection:

```js
(async () => {

  await myQueue.close();

})();
```


## new Queue(type, [maxTries], [processingTime])

Create a new queue handler.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>string</code> | <code>"DEFAULT"</code> | queue identifier (any number of separate queues can be defined) |


## queue.processingTime = {number}

The minimum time in seconds a queued item is held for processing before it is re-queued.

**Kind**: instance property of `Queue`.


## queue.maxTries = {number}

The number of times an item can be returned from the head of the queue before it is removed.

**Kind**: instance property of `Queue`.


## queue.send(data, [delayUntil], [maxTries]) ⇒ <code>qItem</code>

Push data to the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object:

```js
{
  "_id" : { MongoDB ID }, // ID of queued item
  "sent", { Date }        // date/time item was queued
  "runs", { number}       // processing runs remaining
  "data"  { any }         // data sent
}
```

`null` is returned when a failure occurs.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>any</code> | <code>null</code> | data to queue |
| [delayUntil] | <code>number</code> or <code>Date</code> | <code>0</code> | optional future date to delay processing, passed as a number of seconds or a Date object |
| [maxTries] | <code>number</code> | <code>this.maxTries</code> | number of times an item can be returned from the head of the queue before it is removed |


## queue.receive([processingTime]) ⇒ <code>qItem</code>

Retrieve the next item from the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object ({ `_id`, `sent`, `runs`, `data` }) or `null` when no items are available

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [processingTime] | <code>number</code> | <code>this.processingTime</code> | minimum time in seconds a queued item is held for processing before it is re-queued |


## queue.remove(qItem) ⇒ <code>number</code>

Remove a queued item. (Method is async and returns a Promise).

This must be called once the queued item has been handled or it will be re-queued after a processing time has expired.

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items (normally 1, but will be 0 if the number of tries has been exceeded).

| Param | Type | Description |
| --- | --- | --- |
| qItem | <code>qItem</code> | queue item to remove (returned by `send()` or `receive()`) |


## queue.purge() ⇒ <code>number</code>

Remove all queued items, including future ones. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items.


## queue.count() ⇒ <code>number</code>

Count of all queued items, including future ones. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - items in the queue.


## queue.close()

Close database connection. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.


## Testing

Clone the repository and run `docker-compose up` to launch MongoDB 4.4 and Node.js 14 containers. `npm test` runs various test functions.

Publish with: `npm publish --access=public`
