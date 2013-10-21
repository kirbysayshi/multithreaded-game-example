module.exports = Boid;

function Boid(x, y, radius) {
  this.id = Boid.uid();
  this.cpos = { x: x, y: y }
  this.ppos = { x: x, y: y }
  this.acel = { x: 0, y: 0 }
  this.radius = radius;
}

Boid.DAMPING = 0.99;
 
Boid.uid = (function() {
  var id = 0;
  return function() {
    return 'boid_' + (++id);
  }
}());

Boid.prototype.accelerate = function(dt) {
  this.cpos.x += this.acel.x * dt * dt * 0.001;
  this.cpos.y += this.acel.y * dt * dt * 0.001;
  this.acel.x = 0;
  this.acel.y = 0;
}
 
Boid.prototype.inertia = function(dt) {
  var x = this.cpos.x*2 - this.ppos.x,
  y = this.cpos.y*2 - this.ppos.y;
  this.ppos.x = this.cpos.x;
  this.ppos.y = this.cpos.y;
  this.cpos.x = x;
  this.ppos.y = y;
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