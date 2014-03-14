
var Alea = require('alea');
var random = new Alea('NOT ENOUGH STONE');

var BoidManager = require('./boidmanager');
var FixedStep = require('./fixedstep');
var repeater = require('./repeater');

var config = require('./config');

// All worker code must be within this function for webworkify
module.exports = function() {

  // Allow this code to be used either as a true worker or
  // single threaded without a worker.
  var postMsg;
  if (typeof window !== 'undefined') {
    // We're running in single threaded mode, so ensure that messages are
    // always posted on the next tick.
    postMsg = function(obj) {
      // NOTE: we're posting to * domain for simplicity here, but to be
      // secure we should be explicit for production code.
      window.postMessage(obj, '*');
    }
  } else {
    // We're running in a worker, so just use the default semantics.
    postMsg = function(obj) {
      postMessage(obj);
    }
  }

  // Only call the simulation at 30 Hz.
  var stepper = new FixedStep(1000 / config.PHYSICS_HZ, update);

  // The worker will manage its own list of boids.
  var boidman = new BoidManager;

  // Initialize the game world

  var maxBoids = config.BOID_COUNT
    , distance = config.BOID_INITIAL_DISTANCE
    , minRadius = config.BOID_MIN_RADIUS
    , maxRadius = config.BOID_MAX_RADIUS
    , theta
    , x
    , y
    , radius
    , boid

  // Make a bunch of boids evenly spaced in a circle.
  for(var i = 0; i < maxBoids; i++) {
    theta = (i/maxBoids) * Math.PI*2;
    x = config.BOID_ATTRACTION_POINT_X + (Math.cos(theta) * distance);
    y = config.BOID_ATTRACTION_POINT_Y + (Math.sin(theta) * distance);
    radius = minRadius + (maxRadius - minRadius) * random();
    boid = boidman.getinate(null, [x, y, radius]);
  }

  boidman.all()[0].radius = 10;

  function update(dt) {
    var startTime = Date.now();
    var i, boid;

    var boids = boidman.all();

    attractAll(
      config.CENTER_ATTRACTION,
      config.BOID_ATTRACTION_POINT_X,
      config.BOID_ATTRACTION_POINT_Y);

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
  })

  repeaterCtl.start();

  // listen for messages from the "main" thread
  addEventListener('message', function(ev) {

    if (ev.data.type === 'input') {
      var player = boidman.all()[0];
      var kb = ev.data.kb;
      var thrust = 0.5;
      if (kb.right) {
        // This is wrong, it needs to be constrained per physics update
        // or at least affected by dt.
        player.acel.x += thrust;
      }
      if (kb.left) {
        // This is wrong, it needs to be constrained per physics update
        // or at least affected by dt.
        player.acel.x -= thrust;
      }
      if (kb.up) {
        // This is wrong, it needs to be constrained per physics update
        // or at least affected by dt.
        player.acel.y -= thrust;
      }
      if (kb.down) {
        // This is wrong, it needs to be constrained per physics update
        // or at least affected by dt.
        player.acel.y += thrust;
      }
    }

    if (ev.data.type === 'HALT') {
      repeaterCtl.stop();
      // This will error in a FF worker, but it's ok since we'll still see it.
      // It just has to be the last line, otherwise other stuff will break
      // (also, we're not starting this up again, so it's fine).
      console.log('halting from worker');
    }
  });
}
