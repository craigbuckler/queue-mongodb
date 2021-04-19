import test from 'ava';
import { Queue } from './index.js';

const
  queueDefault = new Queue(),
  queueTest = new Queue('test'),
  dataItem = { a:1, b:2, c:3 };


// purge existing items
test.serial('default queue: purge', async t => {

  const count = await queueDefault.count();

  t.is( await queueDefault.purge(), count);
  t.is( await queueDefault.count(), 0);

});


// queue three items
test.serial('default queue: send three items', async t => {

  const
    q1 = await queueDefault.send( 'Craig' ),
    q2 = await queueDefault.send( 51 ),
    q3 = await queueDefault.send( dataItem );

  // check queued items
  t.assert( q1 && q1._id && q1.sent instanceof Date && q1.data === 'Craig' );
  t.assert( q2 && q2._id && q2.sent instanceof Date && q2.data === 51 );
  t.assert( q3 && q3._id && q3.sent instanceof Date );
  t.deepEqual( q3.data, dataItem );

  // check three items are on the queue
  t.is( await queueDefault.count(), 3);

});


// purge existing items
test.serial('test queue   : purge', async t => {

  const count = await queueTest.count();

  t.is( await queueTest.purge(), count);
  t.is( await queueTest.count(), 0);

});


// test re-queuing
test.serial('test queue   : re-queuing', async t => {

  // send item to queue
  const q1 = await queueTest.send( 'test' );
  t.assert( q1 && q1._id && q1.sent instanceof Date && q1.data === 'test' );

  // receive same item
  const q1rec = await queueTest.receive();
  t.assert( q1rec && q1rec._id.toString() === q1._id.toString() && q1rec.sent.toString() === q1.sent.toString() && q1rec.data === q1.data );

  // check nothing is waiting
  t.falsy( await queueTest.receive() );

  // add same item to queue
  const q2 = await queueTest.send( q1.data );
  t.assert( q2 && q2._id && q2.sent instanceof Date && q2.data === q1.data );

  // receive same item
  const q2rec = await queueTest.receive();

  t.assert( q2rec && q2rec._id.toString() !== q1._id.toString() && q2rec.data === q1rec.data );

  // make sure queue is now empty
  t.is( await queueTest.count(), 0);

});


// test future queuing
test.serial('test queue   : future queuing (seconds)', async t => {

  // send item to queue to be processed at 1s into the future
  const q1 = await queueTest.send( 'future', 1 );
  t.assert( q1 && q1._id && q1.sent instanceof Date && q1.data === 'future' );

  // check nothing is on queue
  t.falsy( await queueTest.receive() );

  // wait for 1.2 seconds
  await pause(1200);

  // make sure same item has been requeued for the last time
  const q1rec = await queueTest.receive();
  t.assert( q1rec && q1rec._id.toString() === q1._id.toString() && q1rec.sent.toString() === q1.sent.toString() && q1rec.data === q1.data );

  // make sure queue is now empty
  t.is( await queueTest.count(), 0);

});


// test future queuing
test.serial('test queue   : future queuing (date)', async t => {

  // send item to queue to be processed at 1s into the future
  const q1 = await queueTest.send( 'future', new Date(+new Date() + 1000) );
  t.assert( q1 && q1._id && q1.sent instanceof Date && q1.data === 'future' );

  // check nothing is on queue
  t.falsy( await queueTest.receive() );

  // wait for 1.2 seconds
  await pause(1200);

  // make sure same item has been requeued for the last time
  const q1rec = await queueTest.receive();
  t.assert( q1rec && q1rec._id.toString() === q1._id.toString() && q1rec.sent.toString() === q1.sent.toString() && q1rec.data === q1.data );

  // make sure queue is now empty
  t.is( await queueTest.count(), 0);

});


// process default queue items
test.serial('default queue: process three items', async t => {

  const
    q1 = await queueDefault.receive(),
    q2 = await queueDefault.receive(),
    q3 = await queueDefault.receive();

  t.falsy( await queueDefault.receive() );

  t.assert( q1._id && q1.sent instanceof Date && q1.data === 'Craig' );
  t.assert( q2._id && q2.sent instanceof Date && q2.data === 51 );
  t.assert( q3._id && q3.sent instanceof Date);
  t.deepEqual( q3.data, dataItem );

  t.is( await queueDefault.count(), 0);

});


// remove queued item
test.serial('default queue: remove items', async t => {

  const
    data = 'to remove',
    q1 = await queueDefault.send( data );
  t.assert( q1._id && q1.sent instanceof Date && q1.data === data );

  t.is( await queueDefault.count(), 1);
  t.truthy( await queueDefault.remove(q1) );
  t.is( await queueDefault.count(), 0);

});


// close connections
test.after('clean up', async t => {

  await queueDefault.close();
  await queueTest.close();

  t.pass();

});


// pause
function pause(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}
