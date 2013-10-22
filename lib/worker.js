
var Boid = require('./boid');

// All worker code must be within this function for webworkify
module.exports = function() {

  // Initialize the game world

  var boids = [];

  var maxBoids = 2000
    , distance = 400
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

    postMessage({ type: 'new boid', update: makeUpdateForBoid(boid) });
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
    postMessage({ type: 'boid updates', updates: updates });
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
  onmessage = function(ev) {

    // Time to update the physics!
    if (ev.data.type === 'logics') {
      update(ev.data.dt);
    }
  }
}