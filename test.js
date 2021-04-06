import test from 'ava';
import { Queue } from './index.js';

const
  queueDefault = new Queue(),
  queueTest = new Queue('test', 2, 1),
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

  t.assert( q1._id && q1.sent instanceof Date && q1.data === 'Craig' );
  t.assert( q2._id && q2.sent instanceof Date && q2.data === 51 );
  t.assert( q3._id && q3.sent instanceof Date );
  t.deepEqual( q3.data, dataItem );

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

  const q1 = await queueTest.send( 'test' );
  t.assert( q1._id && q1.sent instanceof Date && q1.data === 'test' );

  const q1rec = await queueTest.receive();
  t.assert( q1rec._id && q1rec.sent instanceof Date && q1rec.runs === 1 && q1rec.data === 'test' );
  t.falsy( await queueTest.receive() );

  await pause(1000);

  const q2rec = await queueTest.receive();
  t.assert( q2rec._id && q2rec.sent instanceof Date && q2rec.runs === 0 && q1rec.data === 'test' );
  t.is( await queueTest.count(), 0);

});


// test future queuing
test.serial('test queue   : future queuing', async t => {

  const q1 = await queueTest.send( 'future', 1, new Date( +new Date() + 800 ) );
  t.assert( q1._id && q1.sent instanceof Date && q1.data === 'future' );

  t.falsy( await queueTest.receive() );
  await pause(1000);

  const q1rec = await queueTest.receive();
  t.assert( q1rec._id && q1rec.sent instanceof Date && q1rec.runs === 0 && q1rec.data === 'future' );
  t.is( await queueTest.count(), 0);

});


// process default queue items
test.serial('default queue: process three items', async t => {

  const
    q1 = await queueDefault.receive(),
    q2 = await queueDefault.receive(),
    q3 = await queueDefault.receive();

  t.falsy( await queueDefault.receive() );

  t.assert( q1._id && q1.sent instanceof Date && q1.runs && q1.data === 'Craig' );
  t.assert( q2._id && q2.sent instanceof Date && q2.runs && q2.data === 51 );
  t.assert( q3._id && q3.sent instanceof Date && q3.runs );
  t.deepEqual( q3.data, dataItem );

  t.truthy( await queueDefault.remove(q1) );
  t.falsy( await queueDefault.remove(q1) );
  t.truthy( await queueDefault.remove(q2) );
  t.truthy( await queueDefault.remove(q3) );

  t.is( await queueDefault.count(), 0);

});


// pause
function pause(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}
