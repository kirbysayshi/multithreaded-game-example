
var Boid = require('./boid');

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
      process.nextTick(function() {
        // NOTE: we're posting to * domain for simplicity here, but to be
        // secure we should be explicit for production code.
        window.postMessage(obj, '*');
      })
    }
  } else {
    // We're running in a worker, so just use the default semantics.
    postMsg = function(obj) {
      process.nextTick(function() {
        postMessage(obj);
      })
    }
  }

  // Initialize the game world

  var boids = [];

  var maxBoids = 800
    , distance = 600
    , offset = { x: 400, y: 100 }
    , minRadius = 2
    , maxRadius = 2
    , theta
    , x
    , y
    , radius
    , boid

  for(var i = 0; i < maxBoids; i++) {
    theta = (i/maxBoids) * Math.PI*2;
    x = offset.x + (Math.cos(theta) * distance);
    y = offset.y + (Math.sin(theta) * distance);
    radius = minRadius + (maxRadius - minRadius) * Math.random();
    boid = new Boid(x, y, radius);
    boids.push(boid);

    postMsg({ type: 'new boid', update: makeUpdateForBoid(boid) });
  }

  function update(dt) {
    var i, boid;

    attractAll(1, offset.x, offset.y);

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
    var updates = [];
    for (i = 0; i < boids.length; i++) {
      updates.push(makeUpdateForBoid(boids[i]));
    }
    postMsg({ type: 'boid updates', updates: updates });
  }

  function collideAll(preserveInertia) {
    var i, j, boidA, boidB;

    for (i = 0; i < boids.length; i++) {
      boidA = boids[i]
      for (j = i + 1; j < boids.length; j++) {
        boidB = boids[j];
        boidA.collideWith(boidB, preserveInertia);
      }
    }
  }

  function makeUpdateForBoid(boid) {
    var msg = {
      id: boid.id,
      x: boid.cpos.x,
      y: boid.cpos.y,
      radius: boid.radius
    };

    return msg;
  }

  function attractAll(amount, x, y) {
    var i, boid, dirX, dirY, mag;

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

  // listen for messages from the "main" thread
  addEventListener('message', function(ev) {
    // Time to update the physics!
    if (ev.data.type === 'logics') {
      update(ev.data.dt);
    }
  });
}