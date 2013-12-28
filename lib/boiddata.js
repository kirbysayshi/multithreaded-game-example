
/**
 * This will hold our boids to prevent having to manually
 * track them when new data is available.
 * @type {Object}
 */
var knownBoids = {};

/**
 * This will function as our renderable representation of the
 * physics entity.
 */
module.exports = BoidData;
function BoidData(data) {

  // We need to be able to recall this structure when the physics
  // notify us of an update.
  knownBoids[data.id] = this;

  this.id = data.id;
  this.px = data.x;
  this.py = data.y;
  this.cx = data.x;
  this.cy = data.y;
  this.radius = data.radius;
}

BoidData.update = function(data) {
  var boid = knownBoids[data.id];
  boid.update(data);
}

BoidData.drawAll = function(ctx, ratio) {
  var boidIds = Object.keys(knownBoids)
    , boid
    , i;

  for (i = 0; i < boidIds.length; i++) {
    boid = knownBoids[boidIds[i]];
    boid.draw(ctx, ratio);
  }
}

BoidData.prototype.update = function(data) {
  this.px = this.cx;
  this.py = this.cy;
  this.cx = data.x;
  this.cy = data.y;
  this.radius = data.radius;
}

BoidData.prototype.draw = function(ctx, ratio) {
  var oneMinusRatio = 1 - ratio;
  var x = (this.cx * ratio) + (this.px * oneMinusRatio);
  var y = (this.cy * ratio) + (this.py * oneMinusRatio);
  ctx.fillStyle = 'rgba(0,0,255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, this.radius, 0, Math.PI*2, false);
  ctx.fill();
}
