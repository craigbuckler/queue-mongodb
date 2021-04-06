/** @module Queue-MongoDB */

// modules
import dotenv from 'dotenv';
import mongoDB from 'mongodb';

// environment variables
if (!process.env.QUEUE_DB_HOST) {
  dotenv.config();
}

// MongoDB database connection
const
  qCollectionName = 'queue',
  dbName = process.env.QUEUE_DB_NAME || '',
  dbClient = new mongoDB.MongoClient(
    `mongodb://${ process.env.QUEUE_DB_USER || 'root' }:${ process.env.QUEUE_DB_PASS || 'pass' }@${ process.env.QUEUE_DB_HOST || 'localhost' }:${ process.env.QUEUE_DB_PORT || '27017' }/`,
    { useNewUrlParser: true, useUnifiedTopology: true }
  );

let db, qCollection = null;

// shared connection
async function dbConnect() {

  // collection available
  if (qCollection) return qCollection;

  // connect to database
  await dbClient.connect();
  db = dbClient.db( dbName );

  // collection defined?
  let colList = await db.listCollections({ name: qCollectionName }, { nameOnly: true }).toArray();

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


/**
 * Queue management class.
 */
export class Queue {

  /**
   * Create a new queue handler.
   * @param {string} type="DEFAULT" - queue identifier (any number of separate queues can be defined)
   * @param {number} [maxRetries=5] - maximum number if times an item can be retrieved from the queue before processing is assumed to be complete
   * @param {number} [processingTime=300] - maximum time in seconds a queued item held for processing
   */
  constructor(type, maxRetries = 5, processingTime = 300) {

    this.type = type || 'DEFAULT';
    this.maxRetries = maxRetries;
    this.processingTime = processingTime;

  }

  /**
   * Push data to the queue.
   * @param {any} data - data to queue
   * @param {number} [maxRetries] - maximum number if times an item can be retrieved from the queue (overrides this.maxRetries)
   * @param {Date} [delayUntil] - date which can be set in the future to delay processing
   * @returns {qItem} a queue item object: { _id, sent: {date}, runs: {retries remaining}, data: {data}}, or null when a failure occurs
   */
  async send(data = null, maxRetries, delayUntil) {

    try {

      const
        runs  = maxRetries || this.maxRetries,
        q     = await dbConnect(),
        ins   = await q.insertOne({
          type: this.type,
          proc: delayUntil && delayUntil instanceof Date ? delayUntil : new Date(),
          runs,
          data
        });

      return ins && ins.insertedCount && ins.insertedId ? { _id: ins.insertedId, sent: ins.insertedId.getTimestamp(), runs, data } : null;

    }
    catch(err) {

      console.log(`Queue.send error:\n${ err }`);
      return null;

    }

  }


  /**
   * Retrieve the next item from the queue.
   * @returns {qItem} a queue item object: { _id, sent: {date}, runs: {retries remaining}, data: {data}}, or null when no items are available
   */
  async receive() {

    try {

      const
        now = new Date(),
        q   = await dbConnect(),
        rec = await q.findOneAndUpdate(
          {
            type: this.type,
            proc: { $lt: now }
          },
          {
            $set: { proc: new Date( +new Date() + this.processingTime * 1000 ) },
            $inc: { runs: -1 }
          },
          {
            sort: { proc: 1 },
            returnOriginal: false
          }
        );

      const v = rec && rec.value;
      if (!v || !v._id) return null;

      const qItem = { _id: v._id, sent: v._id.getTimestamp(), runs: v.runs, data: v.data };

      if (!v.runs) {

        // no more runs permitted - delete item
        await this.remove( qItem );

      }

      return qItem;

    }
    catch(err) {

      console.log(`Queue.receive error:\n${ err }`);
      return null;

    }

  }


  /**
   * Remove a queued item. This must be called once the item has been handled or it will be re-queued after `this.processingTime`.
   * @param {qItem} qItem - the queue item to remove
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

}
