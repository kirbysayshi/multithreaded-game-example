var config = require('./config');

module.exports = Boid;

function Boid(x, y, radius) {
  this.id = null;
  this.cpos = { x: x, y: y }
  this.ppos = { x: x, y: y }
  this.acel = { x: 0, y: 0 }
  this.radius = radius;
}

Boid.DAMPING = config.BOID_DAMPING;

Boid.prototype.accelerate = function(dt) {
  this.cpos.x += this.acel.x * dt * dt * 0.001;
  this.cpos.y += this.acel.y * dt * dt * 0.001;
  this.acel.x = 0;
  this.acel.y = 0;
}
 
Boid.prototype.inertia = function(dt) {
  var x = this.cpos.x*2 - this.ppos.x
    , y = this.cpos.y*2 - this.ppos.y;
  this.ppos.x = this.cpos.x;
  this.ppos.y = this.cpos.y;
  this.cpos.x = x;
  this.cpos.y = y;
}

Boid.prototype.collideWith = function(other, preserveInertia) {
  var xdiff = other.cpos.x - this.cpos.x
    , ydiff = other.cpos.y - this.cpos.y
    , r = this.radius + other.radius;
  
  // Test for overlap
  if (xdiff*xdiff + ydiff*ydiff > r*r) return;
  
  // Shortcuts
  var a = this;
  var b = other;
  
  // Calculate X velocities.
  var v1x = a.cpos.x - a.ppos.x;
  var v2x = b.cpos.x - b.ppos.x;

  // Calculate Y velocities.
  var v1y = a.cpos.y - a.ppos.y;
  var v2y = b.cpos.y - b.ppos.y;

  var x = a.cpos.x - b.cpos.x;
  var y = a.cpos.y - b.cpos.y;

  var length2 = x*x + y*y;
  var length = Math.sqrt(length2);
  var target = a.radius + b.radius;
  var factor = (length - target) / length;

  // Move a away.
  a.cpos.x -= x * factor * 0.5;
  a.cpos.y -= y * factor * 0.5;

  // Move b away.
  b.cpos.x += x * factor * 0.5;
  b.cpos.y += y * factor * 0.5;

  if (preserveInertia) {

    // Correct the previous position to compensate.
    var f1 = (Boid.DAMPING * (x * v1x + y * v1y)) / length2;
    var f2 = (Boid.DAMPING * (x * v2x + y * v2y)) / length2;

    v1x += f2 * x - f1 * x;
    v2x += f1 * x - f2 * x;
    v1y += f2 * y - f1 * y;
    v2y += f1 * y - f2 * y;

    a.ppos.x = a.cpos.x - v1x;
    a.ppos.y = a.cpos.y - v1y;
    b.ppos.x = b.cpos.x - v2x;
    b.ppos.y = b.cpos.y - v2y;
  }
}

/**
 * This method can set the state of a boid via a "snapshot", which is simply
 * a flat object. The object, in this demo, is emitted via postMessage from
 * the worker and is generated via `writeToSnapshot`.
 */
Boid.prototype.readFromSnapshot = function(data) {
  this.ppos.x = data.px;
  this.ppos.y = data.py;
  this.cpos.x = data.cx;
  this.cpos.y = data.cy;
  this.radius = data.radius;
  this.id = this.id || data.id;
}

/**
 * Given an object, write the current state of this boid. The property names
 * are changed slightly to ensure the object is flat. This attempts to be as
 * fast as possible, since in Chrome nested objects seem to serialize more
 * slowly than in FF.
 */
Boid.prototype.writeToSnapshot = function(data) {
   data.px = this.ppos.x;
   data.py = this.ppos.y;
   data.cx = this.cpos.x;
   data.cy = this.cpos.y;
   data.radius = this.radius;
   data.id = this.id;
   return data;
}

/**
 * This should only be called from within the renderer process, e.g.
 * the main thread. It requires an interpolation ratio to accurately
 * draw while awaiting a new snapshot from the worker process.
 */
Boid.prototype.draw = function(ctx, ratio) {
  var oneMinusRatio = 1 - ratio;
  var x = (this.cpos.x * ratio) + (this.ppos.x * oneMinusRatio);
  var y = (this.cpos.y * ratio) + (this.ppos.y * oneMinusRatio);
  ctx.fillStyle = 'rgba(0,0,255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, this.radius, 0, Math.PI*2, false);
  ctx.fill();
}