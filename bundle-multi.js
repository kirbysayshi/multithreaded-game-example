(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./config":3}],2:[function(require,module,exports){

var Boid = require('./boid');

/**
 * Boids are managed via an entity-like system. This is to ensure
 * that in single threaded or multi threaded mode updating a boid
 * is exactly the same. This does mean that in multi threaded mode
 * _two_ BoidManagers will each have copies of all the boids.
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

},{"./boid":1}],3:[function(require,module,exports){

module.exports = {

    // How often should the physics be calculated?
    PHYSICS_HZ: 30

    /**
     * What timestep should be used to compute the physics?
     * A smaller value yields more accurate collisions, but will require
     * more iterations per second (above).
     */
  , PHYSICS_DT: 16

    /**
     * How many boids should we generate?
     */
  , BOID_COUNT: 800

    /**
     * How much energy should be lost when colliding? This is fairly low
     * so the boids coalesce quickly.
     */
  , BOID_DAMPING: 0.5

    /**
     * How far away should the boids be generated from the attraction point?
     */
  , BOID_INITIAL_DISTANCE: 600

    /**
     * Where boids be attracting.
     */
  , BOID_ATTRACTION_POINT_X: 400
  , BOID_ATTRACTION_POINT_Y: 200

    /**
     * Boid raidus is randomly generated using a seedable generator. Meaning
     * while the generation is random, it's reproducible between runs if the
     * same seed is used.
     */
  , BOID_MIN_RADIUS: 4
  , BOID_MAX_RADIUS: 8

    /**
     * How potent is the attraction?
     */
  , CENTER_ATTRACTION: 0.5
}

},{}],4:[function(require,module,exports){

module.exports = FixedStep;

/**
 * Given a target delta time, execute a callback only when that target
 * delta time has been execeeded. If more time than the target delta
 * has elapsed since the last call to `update`, then execute the callback
 * multiple times synchronously to compensate.
 *
 * A common use for this is if you put a tab into the background. When focus
 * returns physics will still be up to date, even though they were not being
 * calculated in real time.
 *
 * This object does no time calculations itself, so it relies on accurate
 * elapsed times being passed into `update`.
 */

function FixedStep(targetHZ, dt, onStep) {
  this.accumulator = 0;
  this.accumulatorRatio = 0;
  this.onStep = onStep;
  this.targetHZ = 1000 / (targetHZ || 30);
  this.dt = dt;
}

FixedStep.prototype.update = function(dt) {

  this.accumulator += dt;

  // take the current delta, plus what remains from last time,
  // and determine how many logical steps fit.
  var steps = Math.floor(this.accumulator / this.targetHZ);
  var totalSteps = steps;

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetHZ;

  this.accumulatorRatio = this.accumulator / this.targetHZ;

  //console.log('steps this update: ' + steps + ', dt: ' + dt);

  while(steps > 0) {
    this.onStep(this.dt);
    steps--;
  }

  return totalSteps;
}

},{}],5:[function(require,module,exports){

var _instance = null;
module.exports = function() {
  if (!_instance) {
    _instance = new MessageManager;
  }

  return _instance;
}

// This should probably just be a duplex stream.

function MessageManager() {
  var _self = this;
  this._buffer = [];
  this._unreceived = [];
}

MessageManager.prototype._queue = function(msg) {
  this._buffer.push(msg);
}

MessageManager.prototype.length = function(msg) {
  return this._buffer.length;
}

MessageManager.prototype._write = function() {
  throw new Error('NotImplemented');
}

MessageManager.prototype.write = function(msg) {
  this._write(msg);
}

MessageManager.prototype.read = function(cb) {
  var msg, ret, total = 0;

  while(msg = this._buffer.shift()) {
    ret = cb(msg);
    if (ret !== true) {
      this._unreceived.push(msg);
    } else {
      total += 1;
    }
  }

  // Swap the arrays to prevent allocations.
  var oldBuffer = this._buffer;
  this._buffer = this._unreceived;
  this._unreceived = oldBuffer;

  return total;
}
},{}],6:[function(require,module,exports){
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

  collideAll(boids, false);

  for (i = 0; i < boids.length; i++) {
    boid = boids[i];
    boid.inertia(dt);
  }

  collideAll(boids, true);
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
},{"./config":3}],7:[function(require,module,exports){

/**
 * Call a function as often as possible using either the provided
 * `immediateImplementation` function or `setTimeout`. You could pass,
 * for example, `requestAnimationFrame` or something like `process.nextTick`.
 * The callback is given the delta of time from when the callback was last
 * called (this includes the callback's previous execution time).
 */

module.exports = function(cb, immediateImpl) {
  var last = null
    , running = true;

  // Use whatever is passed in to add to the run loop.
  immediateImpl = immediateImpl || setTimeout;

  function next() {
    var now = Date.now();
    cb(now - last);
    last = now;
    if (running) immediateImpl(next);
  }

  return {
    stop: function() { running = false; },
    start: function() {
      last = Date.now();
      next();
    }
  }
}

},{}],8:[function(require,module,exports){

module.exports = function(cvs) {
  function resize(e) {
    cvs.width = document.body.clientWidth;
    cvs.height = document.body.clientHeight;
  }

  window.addEventListener('resize', resize, false);
  resize();

  return resize;
};
},{}],9:[function(require,module,exports){
var config = require('./config');

var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    'phys: time': { caption: 'time spent this step', over: 1000 / config.PHYSICS_HZ },
    'phys: steps': { caption: 'steps this update' },
    'phys: steps-computed-time': { caption: 'time spent updating (ms)', over: 1000 / config.PHYSICS_HZ },
    fps: { caption: 'FPS (avg)', below: 58 },
    render: { caption: 'render duration (ms)' },
    raf: { caption: 'time since last rAF (ms)', over: 17, average: true },
    'msgs: main-recv': { caption: 'received per sec', interpolate: false },
    'msgs: latency': { caption: 'worker to main latency (ms)', interpolate: false },
    'msgs: main-queued': { caption: 'queue length', average: false },
    'msgs: read-time': { caption: 'queue processing (ms)' },
    'msgs: main-processed': { caption: 'number dequeued' },
  },
  groups: [
    {
      caption: 'Message Bus',
      values: [
        'msgs: main-recv',
        'msgs: latency',
        'msgs: main-queued',
        'msgs: read-time',
        'msgs: main-processed'
      ]
    },
    {
      caption: 'Rendering',
      values: ['render', 'raf', 'fps']
    },
    {
      caption: 'Physics',
      values: ['phys: time', 'phys: steps', 'phys: steps-computed-time']
    }
  ],
  /*fractions: [
    { base: 'phys: steps-computed-time', steps: ['phys: time'] }
  ],*/
  CSSPath: 'vendor/'
});

module.exports = function(id) {
  if (enabled) return rstats(id);
  else return facade;
}

var enabled = true;
var noop = function() {};
var facade = {
  update: noop,
  set: noop,
  start: noop,
  end: noop,
  frame: noop,
  tick: noop
}

module.exports.toggle = function() {
  enabled = !enabled;
}
},{"../vendor/rstats":15,"./config":3}],10:[function(require,module,exports){

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
  var stepper = new FixedStep(config.PHYSICS_HZ, config.PHYSICS_DT, update);

  // The worker will manage its own list of boids.
  var boidman = new BoidManager;

  // Setup all the boids.
  initGameScene();

  // Call the stepper as often as possible.
  var repeaterCtl = repeater(function(dt) {
    var start = Date.now();
    var steps = stepper.update(dt);
    var end = Date.now();
    if (steps > 0) {
      mm.write({
        type: 'physics:timing',
        steps: steps,
        computedTime: end - start,
        postedAt: end
      });
    }
  })

  repeaterCtl.start();

  function update(dt) {
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
      type: 'physics:step',
      snapshots: snapshots,
      computedTime: endTime - startTime,
      postedAt: endTime
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

},{"./boidmanager":2,"./config":3,"./fixedstep":4,"./messagemanager":5,"./physicsmagic":6,"./repeater":7,"alea":12}],11:[function(require,module,exports){

console.log('running in MULTI THREADED MODE');

var work = require('webworkify')
  , scihalt = require('science-halt');

var config = require('./lib/config');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var rstats = require('./lib/rstatshelper');

var repeater = require('./lib/repeater');

var worker = work(require('./lib/worker'));

var BoidManager = require('./lib/boidmanager');
var boidman = new BoidManager;
var lastSnapshotReceivedAt = performance.now();

var mm = require('./lib/messagemanager')();
worker.addEventListener('message', function(ev) {
  mm._queue(ev.data);
  rstats('msgs: main-recv').flow(1);
  rstats('msgs: latency').set(Date.now() - ev.data.postedAt);
});
mm._write = function(msg) {
  worker.postMessage(msg);
}

function message(msg) {

  // A full step contains snapshots.
  if (msg.type === 'physics:step') {
    for (var i = 0; i < msg.snapshots.length; i++) {
      var snapshot = msg.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    // TODO: there has to be a better way to do this?
    lastSnapshotReceivedAt = performance.now();

    rstats('phys: time').set(msg.computedTime);
    return true; // mark message as received
  }

  if (msg.type === 'physics:timing') {
    rstats('phys: steps').set(msg.steps);
    rstats('phys: steps-computed-time').set(msg.computedTime);
    return true;
  }
}

function graphics(dt) {
  var now = performance.now();

  rstats('msgs: read-time').start();
  var total = mm.read(message);
  rstats('msgs: read-time').end();
  rstats('msgs: main-processed').set(total);

  rstats('render').start();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;
  var boids = boidman.all();
  for (var i = 0; i < boids.length; i++) {
    boids[i].draw(ctx, ratio);
  }
  rstats('render').end();
}

function graph() {
  rstats('raf').tick();
  rstats('FPS').frame();
  rstats('msgs: main-recv').flow(0);
  rstats('msgs: main-queued').set(mm.length());
  rstats().update();
}

// Call `graphics` as often as possible using `requestAnimationFrame`.
var gfxCtl = repeater(graphics, requestAnimationFrame);
gfxCtl.start();

scihalt(function() {
  gfxCtl.stop();
  mm.write({ type: 'HALT' });
});

var graphCtl = repeater(graph, requestAnimationFrame);
graphCtl.start();

scihalt(function() {
  graphCtl.stop();
}, 'GRAPH!', 81);



},{"./lib/boidmanager":2,"./lib/config":3,"./lib/messagemanager":5,"./lib/repeater":7,"./lib/resizemon":8,"./lib/rstatshelper":9,"./lib/worker":10,"science-halt":13,"webworkify":14}],12:[function(require,module,exports){
(function (root, factory) {
  if (typeof exports === 'object') {
      module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
      define(factory);
  } else {
      root.Alea = factory();
  }
}(this, function () {

  'use strict';

  // From http://baagoe.com/en/RandomMusings/javascript/

  // importState to sync generator states
  Alea.importState = function(i){
    var random = new Alea();
    random.importState(i);
    return random;
  };

  return Alea;

  function Alea() {
    return (function(args) {
      // Johannes Baagøe <baagoe@baagoe.com>, 2010
      var s0 = 0;
      var s1 = 0;
      var s2 = 0;
      var c = 1;

      if (args.length == 0) {
        args = [+new Date];
      }
      var mash = Mash();
      s0 = mash(' ');
      s1 = mash(' ');
      s2 = mash(' ');

      for (var i = 0; i < args.length; i++) {
        s0 -= mash(args[i]);
        if (s0 < 0) {
          s0 += 1;
        }
        s1 -= mash(args[i]);
        if (s1 < 0) {
          s1 += 1;
        }
        s2 -= mash(args[i]);
        if (s2 < 0) {
          s2 += 1;
        }
      }
      mash = null;

      var random = function() {
        var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        return s2 = t - (c = t | 0);
      };
      random.uint32 = function() {
        return random() * 0x100000000; // 2^32
      };
      random.fract53 = function() {
        return random() + 
          (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
      };
      random.version = 'Alea 0.9';
      random.args = args;

      // my own additions to sync state between two generators
      random.exportState = function(){
        return [s0, s1, s2, c];
      };
      random.importState = function(i){
        s0 = +i[0] || 0;
        s1 = +i[1] || 0;
        s2 = +i[2] || 0;
        c = +i[3] || 0;
      };
 
      return random;

    } (Array.prototype.slice.call(arguments)));
  }

  function Mash() {
    var n = 0xefc8249d;

    var mash = function(data) {
      data = data.toString();
      for (var i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        var h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };

    mash.version = 'Mash 0.9';
    return mash;
  }
}));

},{}],13:[function(require,module,exports){

module.exports = function(onhalt, opt_msg, opt_keycode) {
  document.addEventListener('keydown', function(e) {
    if (e.which == (opt_keycode || 27)) {
      onhalt();
      console.log(opt_msg || 'HALT IN THE NAME OF SCIENCE!');
    }
  })
}
},{}],14:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    return new Worker(window.URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],15:[function(require,module,exports){
// performance.now() polyfill from https://gist.github.com/paulirish/5438650

(function(){

  // prepare base perf object
  if (typeof window.performance === 'undefined') {
      window.performance = {};
  }

  if (!window.performance.now){

    var nowOffset = Date.now();

    if (performance.timing && performance.timing.navigationStart){
      nowOffset = performance.timing.navigationStart
    }


    window.performance.now = function now(){
      return Date.now() - nowOffset;
    }

  }

})();

module.exports = function rStats( settings ) {

    'use strict';

    function importCSS( url ){

        var element = document.createElement('link');
        element.href = url;
        element.rel = 'stylesheet';
        element.type = 'text/css';
        document.getElementsByTagName('head')[0].appendChild(element)

    }

    var _settings = settings || {},
        _colours = [ '#850700', '#c74900', '#fcb300', '#284280', '#4c7c0c' ];

    importCSS( 'http://fonts.googleapis.com/css?family=Roboto+Condensed:400,700,300' );
    importCSS( ( _settings.CSSPath?_settings.CSSPath:'' ) + 'rstats.css' );

    if( !_settings.values ) _settings.values = {};

    function Graph( _dom, _id, _def ) {

        var _def = _def || {};
        var _canvas = document.createElement( 'canvas' ),
            _ctx = _canvas.getContext( '2d' ),
            _max = 0,
            _current = 0;

        var c = _def.color?_def.color:'#666666';
        var wc = _def.warningColor?_def.warningColor:'#b70000';

        var _dotCanvas = document.createElement( 'canvas' ),
            _dotCtx = _dotCanvas.getContext( '2d' );
        _dotCanvas.width = 1;
        _dotCanvas.height = 2 * _elHeight;
        _dotCtx.fillStyle = '#444444';
        _dotCtx.fillRect( 0, 0, 1, 2 * _elHeight );
        _dotCtx.fillStyle = c;
        _dotCtx.fillRect( 0, _elHeight, 1, _elHeight );
        _dotCtx.fillStyle = '#ffffff';
        _dotCtx.globalAlpha = .5;
        _dotCtx.fillRect( 0, _elHeight, 1, 1 );
        _dotCtx.globalAlpha = 1;

        var _alarmCanvas = document.createElement( 'canvas' ),
            _alarmCtx = _alarmCanvas.getContext( '2d' );
        _alarmCanvas.width = 1;
        _alarmCanvas.height = 2 * _elHeight;
        _alarmCtx.fillStyle = '#444444';
        _alarmCtx.fillRect( 0, 0, 1, 2 * _elHeight );
        _alarmCtx.fillStyle = '#b70000';
        _alarmCtx.fillRect( 0, _elHeight, 1, _elHeight );
        _alarmCtx.globalAlpha = .5;
        _alarmCtx.fillStyle = '#ffffff';
        _alarmCtx.fillRect( 0, _elHeight, 1, 1 );
        _alarmCtx.globalAlpha = 1;

        function _init() {

            _canvas.width = _elWidth;
            _canvas.height = _elHeight;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.className = 'rs-canvas';
            _dom.appendChild( _canvas );

            _ctx.fillStyle = '#444444';
            _ctx.fillRect( 0, 0, _canvas.width, _canvas.height );

        }

        function _draw( v, alarm ) {
            _current += ( v - _current ) * .1;
            _max *= .99;
            if( _current > _max ) _max = _current;
            _ctx.drawImage( _canvas, 1, 0, _canvas.width - 1, _canvas.height, 0, 0, _canvas.width - 1, _canvas.height );
            if( alarm ) {
                _ctx.drawImage( _alarmCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - _elHeight );
            } else {
                _ctx.drawImage( _dotCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - _elHeight );
            }
        }

        _init();

        return {
            draw: _draw
        }

    }

    function StackGraph( _dom, _num ) {

        var _canvas = document.createElement( 'canvas' ),
            _ctx = _canvas.getContext( '2d' ),
            _max = 0,
            _current = 0;

        function _init() {

            _canvas.width = _elWidth;
            _canvas.height = _elHeight * _num;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.className = 'rs-canvas';
            _dom.appendChild( _canvas );

            _ctx.fillStyle = '#444444';
            _ctx.fillRect( 0, 0, _canvas.width, _canvas.height );

        }

        function _draw( v ) {
            _ctx.drawImage( _canvas, 1, 0, _canvas.width - 1, _canvas.height, 0, 0, _canvas.width - 1, _canvas.height );
            var th = 0;
            for( var j in v ) {
                var h = v[ j ] * _canvas.height;
                _ctx.fillStyle = _colours[ j ];
                _ctx.fillRect( _canvas.width - 1, th, 1, h );
                th += h;
            }
        }

        _init();

        return {
            draw: _draw
        }

    }

    function PerfCounter( id, group ) {

        var _id = id,
            _time,
            _value = 0,
            _total = 0,
            _averageValue = 0,
            _accumValue = 0,
            _accumStart = Date.now(),
            _accumSamples = 0,
            _dom = document.createElement( 'div' ),
            _spanId = document.createElement( 'span' ),
            _spanValue = document.createElement( 'div' ),
            _spanValueText = document.createTextNode( '' ),
            _def = _settings?_settings.values[ _id.toLowerCase() ]:null,
            _graph = new Graph( _dom, _id, _def );

        _dom.className = 'rs-counter-base';

        _spanId.className = 'rs-counter-id'
        _spanId.textContent = ( _def && _def.caption )?_def.caption:_id;

        _spanValue.className = 'rs-counter-value';
        _spanValue.appendChild( _spanValueText );

        _dom.appendChild( _spanId );
        _dom.appendChild( _spanValue );
        if( group ) group.div.appendChild( _dom );
        else _div.appendChild( _dom );

        _time = performance.now();

        function _average( v ) {
            if( _def && _def.average ) {
                _accumValue += v;
                _accumSamples++;
                var t = Date.now();
                if( t - _accumStart >= ( _def.avgMs || 1000 ) ) {
                    _averageValue = _accumValue / _accumSamples;
                    _accumValue = 0;
                    _accumStart = t;
                    _accumSamples = 0;
                }
            }
        }

        function _start(){
            _time = performance.now();
        }

        function _end() {
            _value = performance.now() - _time;
            _average( _value );
        }

        function _tick() {
            _end();
            _start();
        }

        function _draw() {
            var v = ( _def && _def.average )?_averageValue:_value
            _spanValueText.nodeValue = Math.round( v * 100 ) / 100;
            var a = ( _def && ( ( _def.below && _value < _def.below ) || ( _def.over && _value > _def.over ) ) );
            _graph.draw( _value, a );
            _dom.style.color = a?'#b70000':'#ffffff';
        }

        function _frame() {
            var t = performance.now();
            var e = t - _time;
            _total++;
            if( e > 1000 ) {
                if( _def && _def.interpolate === false ) {
                    _value = _total;
                } else {
                    _value = _total * 1000 / e;
                }
                _total = 0;
                _time = t;
                _average( _value );
           }
        }

        function _flow(num) {
            var t = performance.now();
            var e = t - _time;
            _total += (num || 0);
            if( e > 1000 ) {
                if( _def && _def.interpolate === false ) {
                    _value = _total;
                } else {
                    _value = _total * 1000 / e;
                }
                _total = 0;
                _time = t;
                _average( _value );
           }
        }

        function _set( v ) {
            _value = v;
            _average( _value );
        }

        return {
            set: _set,
            start: _start,
            tick: _tick,
            end: _end,
            frame: _frame,
            flow: _flow,
            value: function(){ return _value; },
            draw: _draw
        }

    }

    function sample() {

        var _value = 0;

        function _set( v ) {
            _value = v;
        }

        return {
            set: _set,
            value: function(){ return _value; }
        }

    }

    var _base,
        _div,
        _height = null,
        _elHeight = 10,
        _elWidth = 200;

    var _perfCounters = {},
        _samples = {};

    function _perf( id ) {

        id = id.toLowerCase();
        if( id === undefined ) id = 'default';
        if( _perfCounters[ id ] ) return _perfCounters[ id ];

        var group = null;
        if( _settings && _settings.groups ) {
            for( var j in _settings.groups ) {
                var g = _settings.groups[ parseInt( j, 10 ) ];
                if( g.values.indexOf( id.toLowerCase() ) != -1 ) {
                    group = g;
                    continue;
                }
            }
        }

        var p = new PerfCounter( id, group );
        _perfCounters[ id ] = p;
        return p;

    }

    function _init() {

        if( _settings.plugins ) {
            if( !_settings.values ) _settings.values = {};
            if( !_settings.groups ) _settings.groups = [];
            if( !_settings.fractions ) _settings.fractions = [];
            for( var j = 0; j < _settings.plugins.length; j++ ) {
                _settings.plugins[ j ].attach( _perf );
                for( var k in _settings.plugins[ j ].values ) {
                    _settings.values[ k ] = _settings.plugins[ j ].values [ k ];
                }
                _settings.groups = _settings.groups.concat( _settings.plugins[ j ].groups );
                _settings.fractions = _settings.fractions.concat( _settings.plugins[ j ].fractions );
            }
        } else {
            _settings.plugins = {};
        }

        _base = document.createElement( 'div' );
        _base.className = 'rs-base';
        _div = document.createElement( 'div' );
        _div.className = 'rs-container';
        _div.style.height = 'auto';
        _base.appendChild( _div );
        document.body.appendChild( _base );

        var style = window.getComputedStyle( _base, null ).getPropertyValue( 'font-size' );
        //_elHeight = parseFloat( style );

        if( !_settings ) return;

        if( _settings.groups ) {
            for( var j in _settings.groups ) {
                var g = _settings.groups[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                div.className = 'rs-group';
                g.div = div;
                var h1 = document.createElement( 'h1' );
                h1.textContent = g.caption;
                h1.addEventListener( 'click', function( e ) {
                    this.classList.toggle( 'hidden' );
                    e.preventDefault();
                }.bind( div ) );
                _div.appendChild( h1 );
                _div.appendChild( div );
            }
        }

        if( _settings.fractions ) {
            for( var j in _settings.fractions ) {
                var f = _settings.fractions[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                div.className = 'rs-fraction';
                var legend = document.createElement( 'div' );
                legend.className = 'rs-legend';

                var h = 0;
                for( var k in _settings.fractions[ j ].steps ) {
                    var p = document.createElement( 'p' );
                    p.textContent = _settings.fractions[ j ].steps[ k ];
                    p.style.color = _colours[ h ];
                    legend.appendChild( p );
                    h++;
                }
                div.appendChild( legend );
                div.style.height = h * _elHeight + 'px';
                f.div = div;
                var graph = new StackGraph( div, h );
                f.graph = graph;
                _div.appendChild( div );
            }
        }

    }

    function _update() {

        for( var j in _settings.plugins ) {
            _settings.plugins[ j ].update();
        }

        for( var j in _perfCounters ) {
            _perfCounters[ j ].draw();
        }

        if( _settings && _settings.fractions ) {
            for( var j in _settings.fractions ) {
                var f = _settings.fractions[ parseInt( j, 10 ) ];
                var v = [];
                var base = _perfCounters[ f.base.toLowerCase() ];
                if( base ) {
                    base = base.value();
                    for( var k in _settings.fractions[ j ].steps ) {
                        var s = _settings.fractions[ j ].steps[ parseInt( k, 10 ) ].toLowerCase();
                        var val = _perfCounters[ s ];
                        if( val ) {
                            v.push( val.value() / base );
                        }
                    }
                }
                f.graph.draw( v );
            }
        }

        /*if( _height != _div.clientHeight ) {
            _height = _div.clientHeight;
            _base.style.height = _height + 2 * _elHeight + 'px';
        console.log( _base.clientHeight );
        }*/

    }

    _init();

    return function( id ) {
        if( id ) return _perf( id );
        return {
            update: _update
        }
    }

};

},{}]},{},[11])