/** @module Queue-MongoDB */

// modules
import dotenv from 'dotenv';
import mongoDB from 'mongodb';

// environment variables
if (!process.env.QUEUE_DB_HOST) {
  dotenv.config();
}

// MongoDB database client
const
  dbName = process.env.QUEUE_DB_NAME || 'qdb',
  qCollectionName = process.env.QUEUE_DB_COLL || 'queue',

  dbClient = new mongoDB.MongoClient(
    `mongodb://${ process.env.QUEUE_DB_USER || 'root' }:${ process.env.QUEUE_DB_PASS || 'pass' }@${ process.env.QUEUE_DB_HOST || 'localhost' }:${ process.env.QUEUE_DB_PORT || '27017' }/`,
    { useNewUrlParser: true, useUnifiedTopology: true }
  );


let qCollection; // queue collection


// shared connection
async function dbConnect() {

  // collection available
  if (qCollection) return qCollection;

  // connect to database
  await dbClient.connect();

  // collection defined?
  const
    db = dbClient.db( dbName ),
    colList = await db.listCollections({ name: qCollectionName }, { nameOnly: true }).toArray();

  if (!colList.length) {

    // define collection schema
    let $jsonSchema = {
      bsonType: 'object',
      required: [ 'type', 'proc', 'runs', 'data' ],
      properties: {
        type: { bsonType: 'string', minLength: 1 },
        proc: { bsonType: 'date' },
        runs: { bsonType: 'number', minimum: 0 }
      }
    };
    await db.createCollection(qCollectionName, { validator: { $jsonSchema } });

    // define indexes
    await db.collection( qCollectionName ).createIndexes([
      { key: { type: 1 } },
      { key: { proc: 1 } }
    ]);

  }

  // return queue collection
  qCollection = db.collection( qCollectionName );
  return qCollection;

}


// close MongoDB database connection
async function dbClose() {

  if (qCollection) await dbClient.close();

}


/**
 * Queue management class.
 */
export class Queue {

  /**
   * Create a new queue handler.
   * @param {string} [type="DEFAULT"] - queue identifier (any number of separate queues can be defined)
   */
  constructor(type = 'DEFAULT') {

    this.type = type;
    this.maxTries = 3;
    this.processingTime = 300;

  }

  /**
   * Push data to the queue.
   * @param {any} data - data to queue
   * @param {number}|{Date} [delayUntil] - optional future seconds or date to delay processing
   * @param {number} [maxTries=3] - the number times an item queued then re-queued before it is removed from the queue (overrides this.maxTries)
   * @returns {qItem} a queue item object: { _id, sent: {date}, runs: {tries remaining}, data: {data}}, or null when a failure occurs
   */
  async send(data = null, delayUntil, maxTries) {

    try {

      // calculate start date/time
      let proc = new Date();
      if (delayUntil instanceof Date) {
        proc = delayUntil;
      }
      else if (!isNaN(delayUntil)) {
        proc = new Date( +proc + delayUntil * 1000);
      }

      // add item to queue
      const
        runs  = maxTries || this.maxTries,
        q     = await dbConnect(),
        ins   = await q.insertOne({
          type: this.type, proc, runs, data
        });

      // return qItem
      return ins && ins.insertedCount && ins.insertedId ? { _id: ins.insertedId, sent: ins.insertedId.getTimestamp(), runs, data } : null;

    }
    catch(err) {

      console.log(`Queue.send error:\n${ err }`);
      return null;

    }

  }


  /**
   * Retrieve the next item from the queue.
   * @returns {qItem} a queue item object: { _id, sent: {date}, runs: {tries remaining}, data: {data}}, or null when no items are available
   * @param {number} [processingTime=300] - optional minimum processing time in seconds. An item will be re-queued after this expires (overrides this.processingTime)
   */
  async receive(processingTime) {

    try {

      // next processing time
      processingTime = Math.max(1, processingTime || this.processingTime);

      // find and update next item on queue
      const
        now = new Date(),
        q   = await dbConnect(),
        rec = await q.findOneAndUpdate(
          {
            type: this.type,
            proc: { $lt: now }
          },
          {
            $set: { proc: new Date( +now + processingTime * 1000 ) },
            $inc: { runs: -1 }
          },
          {
            sort: { proc: 1 },
            returnOriginal: false
          }
        );

      const v = rec && rec.value;

      // nothing available
      if (!v || !v._id) return null;

      const qItem = { _id: v._id, sent: v._id.getTimestamp(), runs: v.runs, data: v.data };

      // no more runs permitted - delete item
      if (!v.runs) {
        await this.remove( qItem );
      }

      // return qItem
      return qItem;

    }
    catch(err) {

      console.log(`Queue.receive error:\n${ err }`);
      return null;

    }

  }


  /**
   * Remove a queued item. This must be called once the item has been handled or it will be re-queued (if tries remain)
   * @param {qItem} qItem - remove a queue item (returned by send() or receive())
   * @returns {number} the number of deleted items (normally 1)
   */
  async remove(qItem) {

    // no item to remove
    if (!qItem || !qItem._id) return null;

    try {

      const
        q   = await dbConnect(),
        del = await q.deleteOne({ _id: qItem._id });

      return del.deletedCount;

    }
    catch(err) {

      console.log(`Queue.remove error:\n${ err }`);
      return null;

    }

  }


  /**
   * Removes all queued items, including future ones.
   * @returns {number} the number of deleted items
   */
  async purge() {

    try {

      const
        q   = await dbConnect(),
        del = await q.deleteMany({ type: this.type });

      return del.deletedCount;

    }
    catch(err) {

      console.log(`Queue.purge error:\n${ err }`);
      return null;

    }

  }


  /**
   * Count of all queued items.
   * @returns {number} items in the queue
   */
  async count() {

    try {

      const q = await dbConnect();
      return await q.countDocuments({ type: this.type });

    }
    catch(err) {

      console.log(`Queue.count error:\n${ err }`);
      return null;

    }

  }

  /**
   * Close queue connection.
   */
  async close() {

    try {

      await dbClose();

    }
    catch(err) {

      console.log(`Queue.close error:\n${ err }`);
      return null;

    }

  }

}
