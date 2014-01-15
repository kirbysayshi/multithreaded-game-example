
var BoidManager = require('./boidmanager');
var FixedStep = require('./fixedstep');
var repeater = require('./repeater');

// All worker code must be within this function for webworkify
module.exports = function() {

  // Allow this code to be used either as a true worker or
  // single threaded without a worker.
  var postMsg;
  if (typeof window !== 'undefined') {
    // We're running in single threaded mode, so ensure that messages are
    // always posted on the next tick. This unlocks the event loop since
    // this demo makes multiple posts in the same runloop, potentially
    // exceeding the maximum stack size.
    postMsg = function(obj) {
      // NOTE: we're posting to * domain for simplicity here, but to be
      // secure we should be explicit for production code.
      window.postMessage(obj, '*');
    }
  } else {
    // We're running in a worker, so just use the default semantics.
    postMsg = function(obj) {
      //process.nextTick(function() {
        postMessage(obj);
      //})
    }
  }

  // Only call the simulation at 30 Hz.
  var stepper = new FixedStep(1000 / 30, update);

  // The worker will manage its own list of boids.
  var boidman = new BoidManager;

  // Initialize the game world

  var maxBoids = 500
    , distance = 600
    , offset = { x: 400, y: 100 }
    , minRadius = 2
    , maxRadius = 2
    , theta
    , x
    , y
    , radius
    , boid

  // Make a bunch of boids evenly spaced in a circle.
  for(var i = 0; i < maxBoids; i++) {
    theta = (i/maxBoids) * Math.PI*2;
    x = offset.x + (Math.cos(theta) * distance);
    y = offset.y + (Math.sin(theta) * distance);
    radius = minRadius + (maxRadius - minRadius) * Math.random();
    boid = boidman.getinate(null, [x, y, radius]);
  }

  function update(dt) {
    var startTime = Date.now();
    var i, boid;

    var boids = boidman.all();

    attractAll(0.01, offset.x, offset.y);

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      boid.accelerate(dt);
    }

    collideAll(false);

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      boid.inertia(dt);
    }

    collideAll(true);

    // Notify the main thread that all boids have a new position
    var snapshots = [];
    for (i = 0; i < boids.length; i++) {
      // We pass in an empty object. As a future optimization, these objects
      // could be Object.create(null) or object pooled.
      snapshots.push(boids[i].writeToSnapshot({}));
    }
    var endTime = Date.now();
    postMsg({
      type: 'step',
      snapshots: snapshots,
      startTime: startTime,
      endTime: endTime
    });
  }

  function collideAll(preserveInertia) {
    var i, j, boidA, boidB;

    var boids = boidman.all();

    for (i = 0; i < boids.length; i++) {
      boidA = boids[i]
      for (j = i + 1; j < boids.length; j++) {
        boidB = boids[j];
        boidA.collideWith(boidB, preserveInertia);
      }
    }
  }

  function attractAll(amount, x, y) {
    var i, boid, dirX, dirY, mag;

    var boids = boidman.all();

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      dirX = x - boid.cpos.x;
      dirY = y - boid.cpos.y;

      // normalize
      mag = Math.sqrt(dirX*dirX + dirY*dirY);
      dirX /= mag;
      dirY /= mag;

      boid.acel.x += dirX * amount;
      boid.acel.y += dirY * amount;
    }
  }

  var repeaterCtl = repeater(function(dt) {
    // Call the stepper as often as possible.
    stepper.update(dt);
    // It may not have actually called the 'update' above. Ensure
    // that the main thread knows the interpolation ratio.
    postMsg({
      type: 'tick',
      interpolationRatio: stepper.accumulatorRatio
    });
  })

  repeaterCtl.start();

  // listen for messages from the "main" thread
  addEventListener('message', function(ev) {
    if (ev.data.type === 'HALT') {
      repeaterCtl.stop();
      console.log('halting from worker');
    }
  });
}
