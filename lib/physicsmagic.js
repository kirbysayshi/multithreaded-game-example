var config = require('./config');

exports.updateBoids = function(boids, dt) {
  var i, boid;

  attractAll(
    boids,
    config.CENTER_ATTRACTION,
    config.BOID_ATTRACTION_POINT_X,
    config.BOID_ATTRACTION_POINT_Y);

  for (i = 0; i < boids.length; i++) {
    boid = boids[i];
    boid.accelerate(dt);
  }

  config.BOID_COLLISIONS && collideAll(boids, false);

  for (i = 0; i < boids.length; i++) {
    boid = boids[i];
    boid.inertia(dt);
  }

  config.BOID_COLLISIONS && collideAll(boids, true);
}

function collideAll(boids, preserveInertia) {
  var i, j, boidA, boidB;

  for (i = 0; i < boids.length; i++) {
    boidA = boids[i]
    for (j = i + 1; j < boids.length; j++) {
      boidB = boids[j];
      boidA.collideWith(boidB, preserveInertia);
    }
  }
}

function attractAll(boids, amount, x, y) {
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
