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
  qAuth = process.env.QUEUE_DB_USER ? `${ process.env.QUEUE_DB_USER }:${ process.env.QUEUE_DB_PASS || '' }@` : '',

  dbClient = new mongoDB.MongoClient(
    `mongodb://${ qAuth }${ process.env.QUEUE_DB_HOST || 'localhost' }:${ process.env.QUEUE_DB_PORT || '27017' }/`,
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
      required: [ 'type', 'proc', 'data' ],
      properties: {
        type: { bsonType: 'string', minLength: 1 },
        proc: { bsonType: 'date' }
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

  if (qCollection) {
    await dbClient.close();
    qCollection = null;
  }

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

  }

  /**
   * Push data to the queue.
   * @param {any} data - data to queue
   * @param {number}|{Date} [delayUntil] - optional future seconds or date to delay adding to the queue
   * @returns {qItem} a queue item object: { _id, sent: {date}, data: {data} }, or null when a failure occurs
   */
  async send(data = null, delayUntil) {

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
        q     = await dbConnect(),
        ins   = await q.insertOne({
          type: this.type, proc, data
        });

      // return qItem
      return ins && ins.insertedCount && ins.insertedId ? { _id: ins.insertedId, sent: ins.insertedId.getTimestamp(), data } : null;

    }
    catch(err) {

      console.log(`Queue.send error:\n${ err }`);
      return null;

    }

  }


  /**
   * Retrieve and remove next item from the queue.
   * @returns {qItem} a queue item object: { _id, sent: {date}, data: {data} }, or null when no items are available
   */
  async receive() {

    try {

      // find and delete next item on queue
      const
        now = new Date(),
        q   = await dbConnect(),
        rec = await q.findOneAndDelete(
          {
            type: this.type,
            proc: { $lt: now }
          },
          {
            sort: { proc: 1 }
          }
        );

      const v = rec && rec.value;

      // return qItem
      return v ? { _id: v._id, sent: v._id.getTimestamp(), data: v.data } : null;

    }
    catch(err) {

      console.log(`Queue.receive error:\n${ err }`);
      return null;

    }

  }


  /**
   * Remove a queued item
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
