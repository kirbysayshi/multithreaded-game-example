
var Boid = require('./boid');

/**
 * Boids are managed via an entity-like system.
 */

module.exports = BoidManager;
function BoidManager() {
  this.knownBoids = {};
}

/**
 * Generate a unique id if needed. These are only guaranteed to be unique
 * within the same execution context (e.g. not unique for worker vs main).
 */

BoidManager.uid = (function() {
  var id = 0;
  return function() {
    return 'boid_' + (++id);
  }
}());

/**
 * Either get or instantiate and get a Boid by id. id can be undefined, and
 * a new Boid will still be created and returned. opt_ctorArgs will cause
 * the Boid constructor to be called again via `apply`.
 */

BoidManager.prototype.getinate = function(opt_id, opt_ctorArgs) {
  var boid = this.knownBoids[opt_id];
  if (!boid) {
    boid = new Boid();
    if (opt_ctorArgs) {
      Boid.apply(boid, opt_ctorArgs);
    }
    boid.id = opt_id || BoidManager.uid();
    this.knownBoids[boid.id] = boid;
  }

  return boid;
}

/**
 * Return an array containing the current known boids at call time.
 * The array will not be updated if boids are created or destroyed.
 */

BoidManager.prototype.all = function() {
  var self = this;
  return Object.keys(this.knownBoids).map(function(id) {
    return self.knownBoids[id];
  });
}

/**
 * Perform a callback on each known boid.
 */

BoidManager.prototype.forEach = function(cb) {
  var boidIds = Object.keys(this.knownBoids)
    , boid
    , i;

  for (i = 0; i < boidIds.length; i++) {
    boid = this.knownBoids[boidIds[i]];
    cb(boid, i);
  }
}
