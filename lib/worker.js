
var Alea = require('alea');
var random = new Alea('NOT ENOUGH STONE');

var BoidManager = require('./boidmanager');
var FixedStep = require('./fixedstep');
var repeater = require('./repeater');
var physics = require('./physicsmagic');

var config = require('./config');

var mm = require('./messagemanager')();

// All worker code must be within this function for webworkify
module.exports = function() {

  // If truly running in a worker, then ensure that the messagemanager
  // will post/read to/from the main thread.
  // If not a true worker, this behavior is handled by the main thread.
  if (typeof importScripts !== 'undefined') {
    mm._write = function(msg) {
      postMessage(msg);
    }
    addEventListener('message', function(ev) {
      mm._queue(ev.data);
    })
  }

  // Only call the simulation at 30 Hz.
  var stepper = new FixedStep(1000 / config.PHYSICS_HZ, update);

  // The worker will manage its own list of boids.
  var boidman = new BoidManager;

  // Setup all the boids.
  initGameScene();

  var repeaterCtl = repeater(function(dt) {
    // Call the stepper as often as possible.
    stepper.update(dt);
  })

  repeaterCtl.start();

  function update(dt, totalUpdatesThisCall) {
    var startTime = Date.now();

    // Process messages from the main thread.
    mm.read(message);

    var boids = boidman.all();

    // It doesn't matter how this works, only that the objects
    // are updated in space.
    physics.updateBoids(boids, dt);

    // Notify the main thread that all boids have a new position
    var snapshots = [];
    for (i = 0; i < boids.length; i++) {
      // We pass in an empty object. As a future optimization, these objects
      // could be Object.create(null) or object pooled.
      snapshots.push(boids[i].writeToSnapshot({}));
    }

    // TODO: If update is called multiple times via FixedTime, it will emit
    // multiple snapshots. If the render thread is behind, that will look
    // extremely jarring (bump max boids to a high number to see).

    var endTime = Date.now();
    mm.write({
      type: 'step',
      snapshots: snapshots,
      computedTime: endTime - startTime,
      endTime: endTime,
      steps: totalUpdatesThisCall
    });
  }

  function initGameScene() {
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
  }

  // Handle for messages from the "main" thread
  function message(msg) {
    if (msg.type === 'HALT') {
      repeaterCtl.stop();
      // This will error in a FF worker, but it's ok since we'll still see it.
      // It just has to be the last line, otherwise other stuff will break
      // (also, we're not starting this up again, so it's fine).
      console.log('halting from worker');
      return true;
    }
  }
}
