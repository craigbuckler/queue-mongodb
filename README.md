# Queue-MongoDB

A simple Node.js queuing system which uses MongoDB as a permanent data store.


## Configuration

Install the module with `npm install queue-mongodb`.

Defined database configuration parameters as environment variables or set in a `.env` file in the project root, e.g.

```env
QUEUE_DB_HOST=localhost
QUEUE_DB_PORT=27017
QUEUE_DB_USER=root
QUEUE_DB_PASS=mysecret
QUEUE_DB_NAME=qdb
QUEUE_DB_COLL=queue
```

In this example, a queue management collection named `queue` will be added to the `qdb` database and accessed by the user `root` using a password `mysecret`. `QUEUE_DB_USER` and `QUEUE_DB_PASS` can be unset or have empty strings if database authentication is not required.


## Example

The following code defines a queue named `myqueue`:

```js
import { Queue } from 'queue-mongodb';
const myQueue = new Queue('myqueue');
```

The following code adds three items to the queue:

```js
// queue items
(async () => {

  // item 1: string data put on queue
  const item1 = await myQueue.send( 'item 1' );

  // item 2: object data put on queue
  const item2 = await myQueue.send( { a:1, b:2, c:3 } );

  // item 3: number data queued in 10 seconds
  const item3 = await myQueue.send( 42, 10 );

})();
```

A `qItem` object is returned by the `.send()` method:

```json
{
  "_id" : <database-ID>,
  "sent": <date-item-was-queued>,
  "data": <data-sent>
}
```

or `null` is returned when queuing is unsuccessful.

The next item on the queue can be retrieved and processed -- possibly by a script run via a cron job. If processing fails, the item can be re-queued after an optional delay:

```js
(async () => {

  // fetch item
  const qItem = await myQueue.receive();

  // item is returned
  if ( qItem ) {

    // ... process qItem.data ...

    // processing failed - requeue item in 60 seconds
    if (processingFails) {

      await myQueue.send( qItem.data, 60 );

    }

  }

})();
```

Finally, the queue connection can be closed:

```js
(async () => {

  await myQueue.close();

})();
```


## new Queue(type)

Create a new queue handler.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| type | <code>string</code> | <code>"DEFAULT"</code> | queue identifier (any number of separate queues can be defined) |


## queue.send(data, [delayUntil]) ⇒ <code>qItem</code>

Push data to the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object:

```js
{
  "_id" : { MongoDB ID }, // ID of queued item
  "sent": { Date },       // date/time item was queued
  "data": { any }         // data queued
}
```

`null` is returned when a failure occurs.

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| data | <code>any</code> | <code>null</code> | data to queue |
| [delayUntil] | <code>number</code> or <code>Date</code> | <code>0</code> | optional future seconds or date to delay adding to the queue |


## queue.receive() ⇒ <code>qItem</code>

Retrieve and remove the next item from the queue. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>qItem</code> - a queue item object ({ `_id`, `sent`, `data` }) or `null` when no items are available.


## queue.remove(qItem) ⇒ <code>number</code>

Remove a known queued item. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items (normally 1, but will be 0 if the number of tries has been exceeded).

| Param | Type | Description |
| --- | --- | --- |
| qItem | <code>qItem</code> | queue item to remove (returned by `.send()`) |


## queue.purge() ⇒ <code>number</code>

Remove all queued items, including future ones. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - the number of deleted items.


## queue.count() ⇒ <code>number</code>

Count of all queued items, including future ones. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.

**Returns**: <code>number</code> - items in the queue.


## queue.close()

Close queue and database connection. (Method is async and returns a Promise).

**Kind**: instance method of `Queue`.


## Testing

Clone the repository and run `docker-compose up` to launch MongoDB 4.4 and Node.js 14 containers. `npm test` runs various test functions.

Publish with: `npm publish --access=public`
