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
     * How many boids should we generate?
     */
  , BOID_COUNT: 700

    /**
     * How much energy should be lost when colliding? This is fairly low
     * so the boids coalesce quickly.
     */
  , BOID_DAMPING: 0.95

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
  , CENTER_ATTRACTION: 0.1
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

function FixedStep(targetDT, onStep) {
  this.accumulator = 0;
  this.accumulatorRatio = 0;
  this.onStep = onStep;
  this.targetDT = targetDT || 33.3333;
}

FixedStep.prototype.update = function(dt) {

  this.accumulator += dt;

  // take the current delta, plus what remains from last time,
  // and determine how many logical steps fit.
  var steps = Math.floor(this.accumulator / this.targetDT);

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetDT;

  this.accumulatorRatio = this.accumulator / this.targetDT;

  //console.log('steps this update', steps);

  while(steps > 0) {
    this.onStep(this.targetDT);
    steps--;
  }
}

},{}],5:[function(require,module,exports){

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
    if (running) immediateImpl(next);
    var now = Date.now();
    cb(now - last);
    last = now;
  }

  return {
    stop: function() { running = false; },
    start: function() {
      last = Date.now();
      next();
    }
  }
}

},{}],6:[function(require,module,exports){

module.exports = function(cvs) {
  function resize(e) {
    cvs.width = document.body.clientWidth;
    cvs.height = document.body.clientHeight;
  }

  window.addEventListener('resize', resize, false);
  resize();

  return resize;
};
},{}],7:[function(require,module,exports){
var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    phys: { caption: 'Time per physics update (ms)', over: 30 },
    fps: { caption: 'Frame rate', below: 58 },
    frame: { caption: 'Time spent drawing (ms)' },
    rAF: { caption: 'Time since last rAF (ms)' }
  }
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
},{"../vendor/rstats":12}],8:[function(require,module,exports){

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

    // TODO: If update is called multiple times via FixedTime, it will emit
    // multiple snapshots. If the render thread is behind, that will look
    // extremely jarring (bump max boids to a high number to see).

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
    if (ev.data.type === 'HALT') {
      repeaterCtl.stop();
      // This will error in a FF worker, but it's ok since we'll still see it.
      // It just has to be the last line, otherwise other stuff will break
      // (also, we're not starting this up again, so it's fine).
      console.log('halting from worker');
    }
  });
}

},{"./boidmanager":2,"./config":3,"./fixedstep":4,"./repeater":5,"alea":9}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){

module.exports = function(onhalt, opt_msg, opt_keycode) {
  document.addEventListener('keydown', function(e) {
    if (e.which == (opt_keycode || 27)) {
      onhalt();
      console.log(opt_msg || 'HALT IN THE NAME OF SCIENCE!');
    }
  })
}
},{}],11:[function(require,module,exports){

console.log('running in SINGLE THREADED MODE');

var scihalt = require('science-halt');

var config = require('./lib/config');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var rstats = require('./lib/rstatshelper');

var repeater = require('./lib/repeater');

var worker = require('./lib/worker')();

var BoidManager = require('./lib/boidmanager');
var boidman = new BoidManager;
var lastSnapshotReceivedAt = performance.now();

window.addEventListener('message', function(ev) {

  // A full step contains snapshots.
  if (ev.data.type === 'step') {
    for (var i = 0; i < ev.data.snapshots.length; i++) {
      var snapshot = ev.data.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    // TODO: there has to be a better way to do this?
    lastSnapshotReceivedAt = performance.now();

    rstats('phys').set(ev.data.endTime - ev.data.startTime);
    rstats().update();
    return;
  }

}, false);

function graphics(dt) {
  var now = performance.now();
  rstats('frame').start();
  rstats('FPS').frame();
  rstats('rAF').tick();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;
  var boids = boidman.all();
  for (var i = 0; i < boids.length; i++) {
    boids[i].draw(ctx, ratio);
  }
  rstats('frame').end();
  rstats().update();
}

// Call `graphics` as often as possible using `requestAnimationFrame`.
var repeaterCtl = repeater(graphics, requestAnimationFrame);
repeaterCtl.start();

scihalt(function() {
  repeaterCtl.stop();
  window.postMessage({ type: 'HALT' }, '*');
})

},{"./lib/boidmanager":2,"./lib/config":3,"./lib/repeater":5,"./lib/resizemon":6,"./lib/rstatshelper":7,"./lib/worker":8,"science-halt":10}],12:[function(require,module,exports){
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

    var element = document.createElement('link');
    element.href = 'http://fonts.googleapis.com/css?family=Roboto+Condensed:400,700,300';
    element.rel = 'stylesheet';
    element.type = 'text/css';
    document.getElementsByTagName('head')[0].appendChild(element)

    var _settings = settings || {},
        _colours = [ '#850700', '#c74900', '#fcb300', '#284280', '#4c7c0c' ];

    if( !_settings.values ) _settings.values = {};
    
    function Graph( _dom, _id ) {

        var _canvas = document.createElement( 'canvas' ),
            _ctx = _canvas.getContext( '2d' ),
            _max = 0,
            _current = 0;

        var _dotCanvas = document.createElement( 'canvas' ),
            _dotCtx = _dotCanvas.getContext( '2d' );
        _dotCanvas.width = 1;
        _dotCanvas.height = 20;
        _dotCtx.fillStyle = '#444444';
        _dotCtx.fillRect( 0, 0, 1, 20 );
        _dotCtx.fillStyle = '#666666';
        _dotCtx.fillRect( 0, 10, 1, 10 );
        _dotCtx.fillStyle = '#ffffff';
        _dotCtx.fillRect( 0, 10, 1, 1 );

        var _alarmCanvas = document.createElement( 'canvas' ),
            _alarmCtx = _alarmCanvas.getContext( '2d' );
        _alarmCanvas.width = 1;
        _alarmCanvas.height = 20;
        _alarmCtx.fillStyle = '#444444';
        _alarmCtx.fillRect( 0, 0, 1, 20 );
        _alarmCtx.fillStyle = '#b70000';
        _alarmCtx.fillRect( 0, 10, 1, 10 );
        _alarmCtx.fillStyle = '#ffffff';
        _alarmCtx.fillRect( 0, 10, 1, 1 );

        function _init() {

            _canvas.width = 200;
            _canvas.height = 10;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.style.position = 'absolute';
            _canvas.style.right = 0;
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
                _ctx.drawImage( _alarmCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - 10 );
            } else {
                _ctx.drawImage( _dotCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - 10 );
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

            _canvas.width = 200;
            _canvas.height = 10 * _num;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.style.position = 'absolute';
            _canvas.style.right = 0;
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
            _dom = document.createElement( 'div' ),
            _spanId = document.createElement( 'span' ),
            _spanValue = document.createElement( 'span' ),
            _graph = new Graph( _dom, _id ),
            _def = _settings?_settings.values[ _id.toLowerCase() ]:null;

        _dom.style.position = 'relative';
        _dom.style.margin = '2px 0';
        _dom.style.height = '10px';

        _spanId.style.position = 'absolute';
        _spanId.style.left = 0;
        _spanId.style.top = 0;
        _spanId.textContent = ( _def && _def.caption )?_def.caption:_id;

        _spanValue.style.position = 'absolute';
        _spanValue.style.right = '210px';
        _spanValue.style.top = 0;
        _spanValue.style.textAlign = 'right';
        
        _dom.appendChild( _spanId );
        _dom.appendChild( _spanValue );
        if( group ) group.div.appendChild( _dom );
        else _div.appendChild( _dom );

        _time = performance.now();


        function _start(){
            _time = performance.now();
        }

        function _end() {
            _value = performance.now() - _time;
        }

        function _tick() {
            _end();
            _start();
        }

        function _draw() {
            _spanValue.textContent = Math.round( _value * 100 ) / 100;
            var a = ( _def && ( ( _def.below && _value < _def.below ) || ( _def.over && _value > _def.over ) ) );
            _graph.draw( _value, a );
            _dom.style.color = a?'#b70000':'#ffffff';
        }

        function _frame() {
            var t = performance.now();
            var e = t - _time;
            _total++;
            if( e > 1000 ) {
                _value = _total * 1000 / e;
                _total = 0;
                _time = t;
            }
        }

        function _set( v ) {
            _value = v;
        }

        return {
            set: _set,
            start: _start,
            tick: _tick,
            end: _end,
            frame: _frame,
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

    var _div;

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

        _div = document.createElement( 'div' );
        _div.style.position = 'absolute';
        _div.style.zIndex = 10000;
        _div.style.padding = '10px';
        _div.style.backgroundColor = '#222';
        _div.style.fontSize = '10px';
        _div.style.lineHeight = '1.2em';
        _div.style.width = '350px';
        _div.style.fontFamily = 'Roboto Condensed, tahoma, sans-serif';
        _div.style.left = _div.style.top = 0;
        document.body.appendChild( _div );

        if( !_settings ) return;

        if( _settings.groups ) {
            for( var j in _settings.groups ) {
                var g = _settings.groups[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                g.div = div;
                var h1 = document.createElement( 'h1' );
                h1.textContent = g.caption;
                h1.style.margin = h1.style.padding = 0;
                h1.style.marginBottom = '5px';
                div.style.marginBottom = '10px';
                h1.style.fontSize = '14px';
                h1.style.color = '#fff'
                _div.appendChild( h1 );
                _div.appendChild( div );
            }
        }

        if( _settings.fractions ) {
            for( var j in _settings.fractions ) {
                var f = _settings.fractions[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                var legend = document.createElement( 'div' );
                legend.style.position = 'absolute';
                legend.style.lineHeight = '10px';

                var h = 0;
                for( var k in _settings.fractions[ j ].steps ) {
                    var p = document.createElement( 'p' );
                    p.textContent = _settings.fractions[ j ].steps[ k ];
                    p.style.color = _colours[ h ];
                    p.style.width = '120px';
                    p.style.textAlign = 'right';
                    p.style.margin = 0;
                    p.style.padding = 0;
                    legend.appendChild( p );
                    h++;
                }
                div.appendChild( legend );
                div.style.height = h * 10 + 'px';
                div.style.position = 'relative';
                div.style.marginBottom = '5px';
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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9ib2lkLmpzIiwiL1VzZXJzL2RyZXdwL0Ryb3Bib3gvanMvbXVsdGl0aHJlYWRlZC9saWIvYm9pZG1hbmFnZXIuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9jb25maWcuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9maXhlZHN0ZXAuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9yZXBlYXRlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3Jlc2l6ZW1vbi5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3JzdGF0c2hlbHBlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3dvcmtlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbm9kZV9tb2R1bGVzL2FsZWEvYWxlYS5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbm9kZV9tb2R1bGVzL3NjaWVuY2UtaGFsdC9pbmRleC5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvc2luZ2xlLmpzIiwiL1VzZXJzL2RyZXdwL0Ryb3Bib3gvanMvbXVsdGl0aHJlYWRlZC92ZW5kb3IvcnN0YXRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJvaWQ7XG5cbmZ1bmN0aW9uIEJvaWQoeCwgeSwgcmFkaXVzKSB7XG4gIHRoaXMuaWQgPSBudWxsO1xuICB0aGlzLmNwb3MgPSB7IHg6IHgsIHk6IHkgfVxuICB0aGlzLnBwb3MgPSB7IHg6IHgsIHk6IHkgfVxuICB0aGlzLmFjZWwgPSB7IHg6IDAsIHk6IDAgfVxuICB0aGlzLnJhZGl1cyA9IHJhZGl1cztcbn1cblxuQm9pZC5EQU1QSU5HID0gY29uZmlnLkJPSURfREFNUElORztcblxuQm9pZC5wcm90b3R5cGUuYWNjZWxlcmF0ZSA9IGZ1bmN0aW9uKGR0KSB7XG4gIHRoaXMuY3Bvcy54ICs9IHRoaXMuYWNlbC54ICogZHQgKiBkdCAqIDAuMDAxO1xuICB0aGlzLmNwb3MueSArPSB0aGlzLmFjZWwueSAqIGR0ICogZHQgKiAwLjAwMTtcbiAgdGhpcy5hY2VsLnggPSAwO1xuICB0aGlzLmFjZWwueSA9IDA7XG59XG4gXG5Cb2lkLnByb3RvdHlwZS5pbmVydGlhID0gZnVuY3Rpb24oZHQpIHtcbiAgdmFyIHggPSB0aGlzLmNwb3MueCoyIC0gdGhpcy5wcG9zLnhcbiAgICAsIHkgPSB0aGlzLmNwb3MueSoyIC0gdGhpcy5wcG9zLnk7XG4gIHRoaXMucHBvcy54ID0gdGhpcy5jcG9zLng7XG4gIHRoaXMucHBvcy55ID0gdGhpcy5jcG9zLnk7XG4gIHRoaXMuY3Bvcy54ID0geDtcbiAgdGhpcy5jcG9zLnkgPSB5O1xufVxuXG5Cb2lkLnByb3RvdHlwZS5jb2xsaWRlV2l0aCA9IGZ1bmN0aW9uKG90aGVyLCBwcmVzZXJ2ZUluZXJ0aWEpIHtcbiAgdmFyIHhkaWZmID0gb3RoZXIuY3Bvcy54IC0gdGhpcy5jcG9zLnhcbiAgICAsIHlkaWZmID0gb3RoZXIuY3Bvcy55IC0gdGhpcy5jcG9zLnlcbiAgICAsIHIgPSB0aGlzLnJhZGl1cyArIG90aGVyLnJhZGl1cztcbiAgXG4gIC8vIFRlc3QgZm9yIG92ZXJsYXBcbiAgaWYgKHhkaWZmKnhkaWZmICsgeWRpZmYqeWRpZmYgPiByKnIpIHJldHVybjtcbiAgXG4gIC8vIFNob3J0Y3V0c1xuICB2YXIgYSA9IHRoaXM7XG4gIHZhciBiID0gb3RoZXI7XG4gIFxuICAvLyBDYWxjdWxhdGUgWCB2ZWxvY2l0aWVzLlxuICB2YXIgdjF4ID0gYS5jcG9zLnggLSBhLnBwb3MueDtcbiAgdmFyIHYyeCA9IGIuY3Bvcy54IC0gYi5wcG9zLng7XG5cbiAgLy8gQ2FsY3VsYXRlIFkgdmVsb2NpdGllcy5cbiAgdmFyIHYxeSA9IGEuY3Bvcy55IC0gYS5wcG9zLnk7XG4gIHZhciB2MnkgPSBiLmNwb3MueSAtIGIucHBvcy55O1xuXG4gIHZhciB4ID0gYS5jcG9zLnggLSBiLmNwb3MueDtcbiAgdmFyIHkgPSBhLmNwb3MueSAtIGIuY3Bvcy55O1xuXG4gIHZhciBsZW5ndGgyID0geCp4ICsgeSp5O1xuICB2YXIgbGVuZ3RoID0gTWF0aC5zcXJ0KGxlbmd0aDIpO1xuICB2YXIgdGFyZ2V0ID0gYS5yYWRpdXMgKyBiLnJhZGl1cztcbiAgdmFyIGZhY3RvciA9IChsZW5ndGggLSB0YXJnZXQpIC8gbGVuZ3RoO1xuXG4gIC8vIE1vdmUgYSBhd2F5LlxuICBhLmNwb3MueCAtPSB4ICogZmFjdG9yICogMC41O1xuICBhLmNwb3MueSAtPSB5ICogZmFjdG9yICogMC41O1xuXG4gIC8vIE1vdmUgYiBhd2F5LlxuICBiLmNwb3MueCArPSB4ICogZmFjdG9yICogMC41O1xuICBiLmNwb3MueSArPSB5ICogZmFjdG9yICogMC41O1xuXG4gIGlmIChwcmVzZXJ2ZUluZXJ0aWEpIHtcblxuICAgIC8vIENvcnJlY3QgdGhlIHByZXZpb3VzIHBvc2l0aW9uIHRvIGNvbXBlbnNhdGUuXG4gICAgdmFyIGYxID0gKEJvaWQuREFNUElORyAqICh4ICogdjF4ICsgeSAqIHYxeSkpIC8gbGVuZ3RoMjtcbiAgICB2YXIgZjIgPSAoQm9pZC5EQU1QSU5HICogKHggKiB2MnggKyB5ICogdjJ5KSkgLyBsZW5ndGgyO1xuXG4gICAgdjF4ICs9IGYyICogeCAtIGYxICogeDtcbiAgICB2MnggKz0gZjEgKiB4IC0gZjIgKiB4O1xuICAgIHYxeSArPSBmMiAqIHkgLSBmMSAqIHk7XG4gICAgdjJ5ICs9IGYxICogeSAtIGYyICogeTtcblxuICAgIGEucHBvcy54ID0gYS5jcG9zLnggLSB2MXg7XG4gICAgYS5wcG9zLnkgPSBhLmNwb3MueSAtIHYxeTtcbiAgICBiLnBwb3MueCA9IGIuY3Bvcy54IC0gdjJ4O1xuICAgIGIucHBvcy55ID0gYi5jcG9zLnkgLSB2Mnk7XG4gIH1cbn1cblxuLyoqXG4gKiBUaGlzIG1ldGhvZCBjYW4gc2V0IHRoZSBzdGF0ZSBvZiBhIGJvaWQgdmlhIGEgXCJzbmFwc2hvdFwiLCB3aGljaCBpcyBzaW1wbHlcbiAqIGEgZmxhdCBvYmplY3QuIFRoZSBvYmplY3QsIGluIHRoaXMgZGVtbywgaXMgZW1pdHRlZCB2aWEgcG9zdE1lc3NhZ2UgZnJvbVxuICogdGhlIHdvcmtlciBhbmQgaXMgZ2VuZXJhdGVkIHZpYSBgd3JpdGVUb1NuYXBzaG90YC5cbiAqL1xuQm9pZC5wcm90b3R5cGUucmVhZEZyb21TbmFwc2hvdCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgdGhpcy5wcG9zLnggPSBkYXRhLnB4O1xuICB0aGlzLnBwb3MueSA9IGRhdGEucHk7XG4gIHRoaXMuY3Bvcy54ID0gZGF0YS5jeDtcbiAgdGhpcy5jcG9zLnkgPSBkYXRhLmN5O1xuICB0aGlzLnJhZGl1cyA9IGRhdGEucmFkaXVzO1xuICB0aGlzLmlkID0gdGhpcy5pZCB8fCBkYXRhLmlkO1xufVxuXG4vKipcbiAqIEdpdmVuIGFuIG9iamVjdCwgd3JpdGUgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhpcyBib2lkLiBUaGUgcHJvcGVydHkgbmFtZXNcbiAqIGFyZSBjaGFuZ2VkIHNsaWdodGx5IHRvIGVuc3VyZSB0aGUgb2JqZWN0IGlzIGZsYXQuIFRoaXMgYXR0ZW1wdHMgdG8gYmUgYXNcbiAqIGZhc3QgYXMgcG9zc2libGUsIHNpbmNlIGluIENocm9tZSBuZXN0ZWQgb2JqZWN0cyBzZWVtIHRvIHNlcmlhbGl6ZSBtb3JlXG4gKiBzbG93bHkgdGhhbiBpbiBGRi5cbiAqL1xuQm9pZC5wcm90b3R5cGUud3JpdGVUb1NuYXBzaG90ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgZGF0YS5weCA9IHRoaXMucHBvcy54O1xuICAgZGF0YS5weSA9IHRoaXMucHBvcy55O1xuICAgZGF0YS5jeCA9IHRoaXMuY3Bvcy54O1xuICAgZGF0YS5jeSA9IHRoaXMuY3Bvcy55O1xuICAgZGF0YS5yYWRpdXMgPSB0aGlzLnJhZGl1cztcbiAgIGRhdGEuaWQgPSB0aGlzLmlkO1xuICAgcmV0dXJuIGRhdGE7XG59XG5cbi8qKlxuICogVGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSB3aXRoaW4gdGhlIHJlbmRlcmVyIHByb2Nlc3MsIGUuZy5cbiAqIHRoZSBtYWluIHRocmVhZC4gSXQgcmVxdWlyZXMgYW4gaW50ZXJwb2xhdGlvbiByYXRpbyB0byBhY2N1cmF0ZWx5XG4gKiBkcmF3IHdoaWxlIGF3YWl0aW5nIGEgbmV3IHNuYXBzaG90IGZyb20gdGhlIHdvcmtlciBwcm9jZXNzLlxuICovXG5Cb2lkLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oY3R4LCByYXRpbykge1xuICB2YXIgb25lTWludXNSYXRpbyA9IDEgLSByYXRpbztcbiAgdmFyIHggPSAodGhpcy5jcG9zLnggKiByYXRpbykgKyAodGhpcy5wcG9zLnggKiBvbmVNaW51c1JhdGlvKTtcbiAgdmFyIHkgPSAodGhpcy5jcG9zLnkgKiByYXRpbykgKyAodGhpcy5wcG9zLnkgKiBvbmVNaW51c1JhdGlvKTtcbiAgY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDAsMCwyNTUsIDAuMyknO1xuICBjdHguYmVnaW5QYXRoKCk7XG4gIGN0eC5hcmMoeCwgeSwgdGhpcy5yYWRpdXMsIDAsIE1hdGguUEkqMiwgZmFsc2UpO1xuICBjdHguZmlsbCgpO1xufSIsIlxudmFyIEJvaWQgPSByZXF1aXJlKCcuL2JvaWQnKTtcblxuLyoqXG4gKiBCb2lkcyBhcmUgbWFuYWdlZCB2aWEgYW4gZW50aXR5LWxpa2Ugc3lzdGVtLiBUaGlzIGlzIHRvIGVuc3VyZVxuICogdGhhdCBpbiBzaW5nbGUgdGhyZWFkZWQgb3IgbXVsdGkgdGhyZWFkZWQgbW9kZSB1cGRhdGluZyBhIGJvaWRcbiAqIGlzIGV4YWN0bHkgdGhlIHNhbWUuIFRoaXMgZG9lcyBtZWFuIHRoYXQgaW4gbXVsdGkgdGhyZWFkZWQgbW9kZVxuICogX3R3b18gQm9pZE1hbmFnZXJzIHdpbGwgZWFjaCBoYXZlIGNvcGllcyBvZiBhbGwgdGhlIGJvaWRzLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gQm9pZE1hbmFnZXI7XG5mdW5jdGlvbiBCb2lkTWFuYWdlcigpIHtcbiAgdGhpcy5rbm93bkJvaWRzID0ge307XG59XG5cbi8qKlxuICogR2VuZXJhdGUgYSB1bmlxdWUgaWQgaWYgbmVlZGVkLiBUaGVzZSBhcmUgb25seSBndWFyYW50ZWVkIHRvIGJlIHVuaXF1ZVxuICogd2l0aGluIHRoZSBzYW1lIGV4ZWN1dGlvbiBjb250ZXh0IChlLmcuIG5vdCB1bmlxdWUgZm9yIHdvcmtlciB2cyBtYWluKS5cbiAqL1xuXG5Cb2lkTWFuYWdlci51aWQgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBpZCA9IDA7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gJ2JvaWRfJyArICgrK2lkKTtcbiAgfVxufSgpKTtcblxuLyoqXG4gKiBFaXRoZXIgZ2V0IG9yIGluc3RhbnRpYXRlIGFuZCBnZXQgYSBCb2lkIGJ5IGlkLiBpZCBjYW4gYmUgdW5kZWZpbmVkLCBhbmRcbiAqIGEgbmV3IEJvaWQgd2lsbCBzdGlsbCBiZSBjcmVhdGVkIGFuZCByZXR1cm5lZC4gb3B0X2N0b3JBcmdzIHdpbGwgY2F1c2VcbiAqIHRoZSBCb2lkIGNvbnN0cnVjdG9yIHRvIGJlIGNhbGxlZCBhZ2FpbiB2aWEgYGFwcGx5YC5cbiAqL1xuXG5Cb2lkTWFuYWdlci5wcm90b3R5cGUuZ2V0aW5hdGUgPSBmdW5jdGlvbihvcHRfaWQsIG9wdF9jdG9yQXJncykge1xuICB2YXIgYm9pZCA9IHRoaXMua25vd25Cb2lkc1tvcHRfaWRdO1xuICBpZiAoIWJvaWQpIHtcbiAgICBib2lkID0gbmV3IEJvaWQoKTtcbiAgICBpZiAob3B0X2N0b3JBcmdzKSB7XG4gICAgICBCb2lkLmFwcGx5KGJvaWQsIG9wdF9jdG9yQXJncyk7XG4gICAgfVxuICAgIGJvaWQuaWQgPSBvcHRfaWQgfHwgQm9pZE1hbmFnZXIudWlkKCk7XG4gICAgdGhpcy5rbm93bkJvaWRzW2JvaWQuaWRdID0gYm9pZDtcbiAgfVxuXG4gIHJldHVybiBib2lkO1xufVxuXG4vKipcbiAqIFJldHVybiBhbiBhcnJheSBjb250YWluaW5nIHRoZSBjdXJyZW50IGtub3duIGJvaWRzIGF0IGNhbGwgdGltZS5cbiAqIFRoZSBhcnJheSB3aWxsIG5vdCBiZSB1cGRhdGVkIGlmIGJvaWRzIGFyZSBjcmVhdGVkIG9yIGRlc3Ryb3llZC5cbiAqL1xuXG5Cb2lkTWFuYWdlci5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMua25vd25Cb2lkcykubWFwKGZ1bmN0aW9uKGlkKSB7XG4gICAgcmV0dXJuIHNlbGYua25vd25Cb2lkc1tpZF07XG4gIH0pO1xufVxuXG4vKipcbiAqIFBlcmZvcm0gYSBjYWxsYmFjayBvbiBlYWNoIGtub3duIGJvaWQuXG4gKi9cblxuQm9pZE1hbmFnZXIucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYikge1xuICB2YXIgYm9pZElkcyA9IE9iamVjdC5rZXlzKHRoaXMua25vd25Cb2lkcylcbiAgICAsIGJvaWRcbiAgICAsIGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IGJvaWRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICBib2lkID0gdGhpcy5rbm93bkJvaWRzW2JvaWRJZHNbaV1dO1xuICAgIGNiKGJvaWQsIGkpO1xuICB9XG59XG4iLCJcbm1vZHVsZS5leHBvcnRzID0ge1xuXG4gICAgLy8gSG93IG9mdGVuIHNob3VsZCB0aGUgcGh5c2ljcyBiZSBjYWxjdWxhdGVkP1xuICAgIFBIWVNJQ1NfSFo6IDMwXG5cbiAgICAvKipcbiAgICAgKiBIb3cgbWFueSBib2lkcyBzaG91bGQgd2UgZ2VuZXJhdGU/XG4gICAgICovXG4gICwgQk9JRF9DT1VOVDogNzAwXG5cbiAgICAvKipcbiAgICAgKiBIb3cgbXVjaCBlbmVyZ3kgc2hvdWxkIGJlIGxvc3Qgd2hlbiBjb2xsaWRpbmc/IFRoaXMgaXMgZmFpcmx5IGxvd1xuICAgICAqIHNvIHRoZSBib2lkcyBjb2FsZXNjZSBxdWlja2x5LlxuICAgICAqL1xuICAsIEJPSURfREFNUElORzogMC45NVxuXG4gICAgLyoqXG4gICAgICogSG93IGZhciBhd2F5IHNob3VsZCB0aGUgYm9pZHMgYmUgZ2VuZXJhdGVkIGZyb20gdGhlIGF0dHJhY3Rpb24gcG9pbnQ/XG4gICAgICovXG4gICwgQk9JRF9JTklUSUFMX0RJU1RBTkNFOiA2MDBcblxuICAgIC8qKlxuICAgICAqIFdoZXJlIGJvaWRzIGJlIGF0dHJhY3RpbmcuXG4gICAgICovXG4gICwgQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1g6IDQwMFxuICAsIEJPSURfQVRUUkFDVElPTl9QT0lOVF9ZOiAyMDBcblxuICAgIC8qKlxuICAgICAqIEJvaWQgcmFpZHVzIGlzIHJhbmRvbWx5IGdlbmVyYXRlZCB1c2luZyBhIHNlZWRhYmxlIGdlbmVyYXRvci4gTWVhbmluZ1xuICAgICAqIHdoaWxlIHRoZSBnZW5lcmF0aW9uIGlzIHJhbmRvbSwgaXQncyByZXByb2R1Y2libGUgYmV0d2VlbiBydW5zIGlmIHRoZVxuICAgICAqIHNhbWUgc2VlZCBpcyB1c2VkLlxuICAgICAqL1xuICAsIEJPSURfTUlOX1JBRElVUzogNFxuICAsIEJPSURfTUFYX1JBRElVUzogOFxuXG4gICAgLyoqXG4gICAgICogSG93IHBvdGVudCBpcyB0aGUgYXR0cmFjdGlvbj9cbiAgICAgKi9cbiAgLCBDRU5URVJfQVRUUkFDVElPTjogMC4xXG59IiwiXG5tb2R1bGUuZXhwb3J0cyA9IEZpeGVkU3RlcDtcblxuLyoqXG4gKiBHaXZlbiBhIHRhcmdldCBkZWx0YSB0aW1lLCBleGVjdXRlIGEgY2FsbGJhY2sgb25seSB3aGVuIHRoYXQgdGFyZ2V0XG4gKiBkZWx0YSB0aW1lIGhhcyBiZWVuIGV4ZWNlZWRlZC4gSWYgbW9yZSB0aW1lIHRoYW4gdGhlIHRhcmdldCBkZWx0YVxuICogaGFzIGVsYXBzZWQgc2luY2UgdGhlIGxhc3QgY2FsbCB0byBgdXBkYXRlYCwgdGhlbiBleGVjdXRlIHRoZSBjYWxsYmFja1xuICogbXVsdGlwbGUgdGltZXMgc3luY2hyb25vdXNseSB0byBjb21wZW5zYXRlLlxuICpcbiAqIEEgY29tbW9uIHVzZSBmb3IgdGhpcyBpcyBpZiB5b3UgcHV0IGEgdGFiIGludG8gdGhlIGJhY2tncm91bmQuIFdoZW4gZm9jdXNcbiAqIHJldHVybnMgcGh5c2ljcyB3aWxsIHN0aWxsIGJlIHVwIHRvIGRhdGUsIGV2ZW4gdGhvdWdoIHRoZXkgd2VyZSBub3QgYmVpbmdcbiAqIGNhbGN1bGF0ZWQgaW4gcmVhbCB0aW1lLlxuICpcbiAqIFRoaXMgb2JqZWN0IGRvZXMgbm8gdGltZSBjYWxjdWxhdGlvbnMgaXRzZWxmLCBzbyBpdCByZWxpZXMgb24gYWNjdXJhdGVcbiAqIGVsYXBzZWQgdGltZXMgYmVpbmcgcGFzc2VkIGludG8gYHVwZGF0ZWAuXG4gKi9cblxuZnVuY3Rpb24gRml4ZWRTdGVwKHRhcmdldERULCBvblN0ZXApIHtcbiAgdGhpcy5hY2N1bXVsYXRvciA9IDA7XG4gIHRoaXMuYWNjdW11bGF0b3JSYXRpbyA9IDA7XG4gIHRoaXMub25TdGVwID0gb25TdGVwO1xuICB0aGlzLnRhcmdldERUID0gdGFyZ2V0RFQgfHwgMzMuMzMzMztcbn1cblxuRml4ZWRTdGVwLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkdCkge1xuXG4gIHRoaXMuYWNjdW11bGF0b3IgKz0gZHQ7XG5cbiAgLy8gdGFrZSB0aGUgY3VycmVudCBkZWx0YSwgcGx1cyB3aGF0IHJlbWFpbnMgZnJvbSBsYXN0IHRpbWUsXG4gIC8vIGFuZCBkZXRlcm1pbmUgaG93IG1hbnkgbG9naWNhbCBzdGVwcyBmaXQuXG4gIHZhciBzdGVwcyA9IE1hdGguZmxvb3IodGhpcy5hY2N1bXVsYXRvciAvIHRoaXMudGFyZ2V0RFQpO1xuXG4gIC8vIFJlbW92ZSB3aGF0IHdpbGwgYmUgY29uc3VtZWQgdGhpcyB0aWNrLlxuICBpZiAoc3RlcHMgPiAwKSB0aGlzLmFjY3VtdWxhdG9yIC09IHN0ZXBzICogdGhpcy50YXJnZXREVDtcblxuICB0aGlzLmFjY3VtdWxhdG9yUmF0aW8gPSB0aGlzLmFjY3VtdWxhdG9yIC8gdGhpcy50YXJnZXREVDtcblxuICAvL2NvbnNvbGUubG9nKCdzdGVwcyB0aGlzIHVwZGF0ZScsIHN0ZXBzKTtcblxuICB3aGlsZShzdGVwcyA+IDApIHtcbiAgICB0aGlzLm9uU3RlcCh0aGlzLnRhcmdldERUKTtcbiAgICBzdGVwcy0tO1xuICB9XG59XG4iLCJcbi8qKlxuICogQ2FsbCBhIGZ1bmN0aW9uIGFzIG9mdGVuIGFzIHBvc3NpYmxlIHVzaW5nIGVpdGhlciB0aGUgcHJvdmlkZWRcbiAqIGBpbW1lZGlhdGVJbXBsZW1lbnRhdGlvbmAgZnVuY3Rpb24gb3IgYHNldFRpbWVvdXRgLiBZb3UgY291bGQgcGFzcyxcbiAqIGZvciBleGFtcGxlLCBgcmVxdWVzdEFuaW1hdGlvbkZyYW1lYCBvciBzb21ldGhpbmcgbGlrZSBgcHJvY2Vzcy5uZXh0VGlja2AuXG4gKiBUaGUgY2FsbGJhY2sgaXMgZ2l2ZW4gdGhlIGRlbHRhIG9mIHRpbWUgZnJvbSB3aGVuIHRoZSBjYWxsYmFjayB3YXMgbGFzdFxuICogY2FsbGVkICh0aGlzIGluY2x1ZGVzIHRoZSBjYWxsYmFjaydzIHByZXZpb3VzIGV4ZWN1dGlvbiB0aW1lKS5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGNiLCBpbW1lZGlhdGVJbXBsKSB7XG4gIHZhciBsYXN0ID0gbnVsbFxuICAgICwgcnVubmluZyA9IHRydWU7XG5cbiAgLy8gVXNlIHdoYXRldmVyIGlzIHBhc3NlZCBpbiB0byBhZGQgdG8gdGhlIHJ1biBsb29wLlxuICBpbW1lZGlhdGVJbXBsID0gaW1tZWRpYXRlSW1wbCB8fCBzZXRUaW1lb3V0O1xuXG4gIGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgaWYgKHJ1bm5pbmcpIGltbWVkaWF0ZUltcGwobmV4dCk7XG4gICAgdmFyIG5vdyA9IERhdGUubm93KCk7XG4gICAgY2Iobm93IC0gbGFzdCk7XG4gICAgbGFzdCA9IG5vdztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24oKSB7IHJ1bm5pbmcgPSBmYWxzZTsgfSxcbiAgICBzdGFydDogZnVuY3Rpb24oKSB7XG4gICAgICBsYXN0ID0gRGF0ZS5ub3coKTtcbiAgICAgIG5leHQoKTtcbiAgICB9XG4gIH1cbn1cbiIsIlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjdnMpIHtcbiAgZnVuY3Rpb24gcmVzaXplKGUpIHtcbiAgICBjdnMud2lkdGggPSBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoO1xuICAgIGN2cy5oZWlnaHQgPSBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodDtcbiAgfVxuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCByZXNpemUsIGZhbHNlKTtcbiAgcmVzaXplKCk7XG5cbiAgcmV0dXJuIHJlc2l6ZTtcbn07IiwidmFyIFJTdGF0cyA9IHJlcXVpcmUoJy4uL3ZlbmRvci9yc3RhdHMnKTtcbnZhciByc3RhdHMgPSBuZXcgUlN0YXRzKHtcbiAgdmFsdWVzOiB7XG4gICAgcGh5czogeyBjYXB0aW9uOiAnVGltZSBwZXIgcGh5c2ljcyB1cGRhdGUgKG1zKScsIG92ZXI6IDMwIH0sXG4gICAgZnBzOiB7IGNhcHRpb246ICdGcmFtZSByYXRlJywgYmVsb3c6IDU4IH0sXG4gICAgZnJhbWU6IHsgY2FwdGlvbjogJ1RpbWUgc3BlbnQgZHJhd2luZyAobXMpJyB9LFxuICAgIHJBRjogeyBjYXB0aW9uOiAnVGltZSBzaW5jZSBsYXN0IHJBRiAobXMpJyB9XG4gIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGlkKSB7XG4gIGlmIChlbmFibGVkKSByZXR1cm4gcnN0YXRzKGlkKTtcbiAgZWxzZSByZXR1cm4gZmFjYWRlO1xufVxuXG52YXIgZW5hYmxlZCA9IHRydWU7XG52YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XG52YXIgZmFjYWRlID0ge1xuICB1cGRhdGU6IG5vb3AsXG4gIHNldDogbm9vcCxcbiAgc3RhcnQ6IG5vb3AsXG4gIGVuZDogbm9vcCxcbiAgZnJhbWU6IG5vb3AsXG4gIHRpY2s6IG5vb3Bcbn1cblxubW9kdWxlLmV4cG9ydHMudG9nZ2xlID0gZnVuY3Rpb24oKSB7XG4gIGVuYWJsZWQgPSAhZW5hYmxlZDtcbn0iLCJcbnZhciBBbGVhID0gcmVxdWlyZSgnYWxlYScpO1xudmFyIHJhbmRvbSA9IG5ldyBBbGVhKCdOT1QgRU5PVUdIIFNUT05FJyk7XG5cbnZhciBCb2lkTWFuYWdlciA9IHJlcXVpcmUoJy4vYm9pZG1hbmFnZXInKTtcbnZhciBGaXhlZFN0ZXAgPSByZXF1aXJlKCcuL2ZpeGVkc3RlcCcpO1xudmFyIHJlcGVhdGVyID0gcmVxdWlyZSgnLi9yZXBlYXRlcicpO1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9jb25maWcnKTtcblxuLy8gQWxsIHdvcmtlciBjb2RlIG11c3QgYmUgd2l0aGluIHRoaXMgZnVuY3Rpb24gZm9yIHdlYndvcmtpZnlcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG5cbiAgLy8gQWxsb3cgdGhpcyBjb2RlIHRvIGJlIHVzZWQgZWl0aGVyIGFzIGEgdHJ1ZSB3b3JrZXIgb3JcbiAgLy8gc2luZ2xlIHRocmVhZGVkIHdpdGhvdXQgYSB3b3JrZXIuXG4gIHZhciBwb3N0TXNnO1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBXZSdyZSBydW5uaW5nIGluIHNpbmdsZSB0aHJlYWRlZCBtb2RlLCBzbyBlbnN1cmUgdGhhdCBtZXNzYWdlcyBhcmVcbiAgICAvLyBhbHdheXMgcG9zdGVkIG9uIHRoZSBuZXh0IHRpY2suXG4gICAgcG9zdE1zZyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgLy8gTk9URTogd2UncmUgcG9zdGluZyB0byAqIGRvbWFpbiBmb3Igc2ltcGxpY2l0eSBoZXJlLCBidXQgdG8gYmVcbiAgICAgIC8vIHNlY3VyZSB3ZSBzaG91bGQgYmUgZXhwbGljaXQgZm9yIHByb2R1Y3Rpb24gY29kZS5cbiAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShvYmosICcqJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIFdlJ3JlIHJ1bm5pbmcgaW4gYSB3b3JrZXIsIHNvIGp1c3QgdXNlIHRoZSBkZWZhdWx0IHNlbWFudGljcy5cbiAgICBwb3N0TXNnID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICBwb3N0TWVzc2FnZShvYmopO1xuICAgIH1cbiAgfVxuXG4gIC8vIE9ubHkgY2FsbCB0aGUgc2ltdWxhdGlvbiBhdCAzMCBIei5cbiAgdmFyIHN0ZXBwZXIgPSBuZXcgRml4ZWRTdGVwKDEwMDAgLyBjb25maWcuUEhZU0lDU19IWiwgdXBkYXRlKTtcblxuICAvLyBUaGUgd29ya2VyIHdpbGwgbWFuYWdlIGl0cyBvd24gbGlzdCBvZiBib2lkcy5cbiAgdmFyIGJvaWRtYW4gPSBuZXcgQm9pZE1hbmFnZXI7XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgZ2FtZSB3b3JsZFxuXG4gIHZhciBtYXhCb2lkcyA9IGNvbmZpZy5CT0lEX0NPVU5UXG4gICAgLCBkaXN0YW5jZSA9IGNvbmZpZy5CT0lEX0lOSVRJQUxfRElTVEFOQ0VcbiAgICAsIG1pblJhZGl1cyA9IGNvbmZpZy5CT0lEX01JTl9SQURJVVNcbiAgICAsIG1heFJhZGl1cyA9IGNvbmZpZy5CT0lEX01BWF9SQURJVVNcbiAgICAsIHRoZXRhXG4gICAgLCB4XG4gICAgLCB5XG4gICAgLCByYWRpdXNcbiAgICAsIGJvaWRcblxuICAvLyBNYWtlIGEgYnVuY2ggb2YgYm9pZHMgZXZlbmx5IHNwYWNlZCBpbiBhIGNpcmNsZS5cbiAgZm9yKHZhciBpID0gMDsgaSA8IG1heEJvaWRzOyBpKyspIHtcbiAgICB0aGV0YSA9IChpL21heEJvaWRzKSAqIE1hdGguUEkqMjtcbiAgICB4ID0gY29uZmlnLkJPSURfQVRUUkFDVElPTl9QT0lOVF9YICsgKE1hdGguY29zKHRoZXRhKSAqIGRpc3RhbmNlKTtcbiAgICB5ID0gY29uZmlnLkJPSURfQVRUUkFDVElPTl9QT0lOVF9ZICsgKE1hdGguc2luKHRoZXRhKSAqIGRpc3RhbmNlKTtcbiAgICByYWRpdXMgPSBtaW5SYWRpdXMgKyAobWF4UmFkaXVzIC0gbWluUmFkaXVzKSAqIHJhbmRvbSgpO1xuICAgIGJvaWQgPSBib2lkbWFuLmdldGluYXRlKG51bGwsIFt4LCB5LCByYWRpdXNdKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZShkdCkge1xuICAgIHZhciBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIHZhciBpLCBib2lkO1xuXG4gICAgdmFyIGJvaWRzID0gYm9pZG1hbi5hbGwoKTtcblxuICAgIGF0dHJhY3RBbGwoXG4gICAgICBjb25maWcuQ0VOVEVSX0FUVFJBQ1RJT04sXG4gICAgICBjb25maWcuQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1gsXG4gICAgICBjb25maWcuQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1kpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGJvaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBib2lkID0gYm9pZHNbaV07XG4gICAgICBib2lkLmFjY2VsZXJhdGUoZHQpO1xuICAgIH1cblxuICAgIGNvbGxpZGVBbGwoZmFsc2UpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGJvaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBib2lkID0gYm9pZHNbaV07XG4gICAgICBib2lkLmluZXJ0aWEoZHQpO1xuICAgIH1cblxuICAgIGNvbGxpZGVBbGwodHJ1ZSk7XG5cbiAgICAvLyBOb3RpZnkgdGhlIG1haW4gdGhyZWFkIHRoYXQgYWxsIGJvaWRzIGhhdmUgYSBuZXcgcG9zaXRpb25cbiAgICB2YXIgc25hcHNob3RzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IGJvaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBXZSBwYXNzIGluIGFuIGVtcHR5IG9iamVjdC4gQXMgYSBmdXR1cmUgb3B0aW1pemF0aW9uLCB0aGVzZSBvYmplY3RzXG4gICAgICAvLyBjb3VsZCBiZSBPYmplY3QuY3JlYXRlKG51bGwpIG9yIG9iamVjdCBwb29sZWQuXG4gICAgICBzbmFwc2hvdHMucHVzaChib2lkc1tpXS53cml0ZVRvU25hcHNob3Qoe30pKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBJZiB1cGRhdGUgaXMgY2FsbGVkIG11bHRpcGxlIHRpbWVzIHZpYSBGaXhlZFRpbWUsIGl0IHdpbGwgZW1pdFxuICAgIC8vIG11bHRpcGxlIHNuYXBzaG90cy4gSWYgdGhlIHJlbmRlciB0aHJlYWQgaXMgYmVoaW5kLCB0aGF0IHdpbGwgbG9va1xuICAgIC8vIGV4dHJlbWVseSBqYXJyaW5nIChidW1wIG1heCBib2lkcyB0byBhIGhpZ2ggbnVtYmVyIHRvIHNlZSkuXG5cbiAgICB2YXIgZW5kVGltZSA9IERhdGUubm93KCk7XG4gICAgcG9zdE1zZyh7XG4gICAgICB0eXBlOiAnc3RlcCcsXG4gICAgICBzbmFwc2hvdHM6IHNuYXBzaG90cyxcbiAgICAgIHN0YXJ0VGltZTogc3RhcnRUaW1lLFxuICAgICAgZW5kVGltZTogZW5kVGltZVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY29sbGlkZUFsbChwcmVzZXJ2ZUluZXJ0aWEpIHtcbiAgICB2YXIgaSwgaiwgYm9pZEEsIGJvaWRCO1xuXG4gICAgdmFyIGJvaWRzID0gYm9pZG1hbi5hbGwoKTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBib2lkcy5sZW5ndGg7IGkrKykge1xuICAgICAgYm9pZEEgPSBib2lkc1tpXVxuICAgICAgZm9yIChqID0gaSArIDE7IGogPCBib2lkcy5sZW5ndGg7IGorKykge1xuICAgICAgICBib2lkQiA9IGJvaWRzW2pdO1xuICAgICAgICBib2lkQS5jb2xsaWRlV2l0aChib2lkQiwgcHJlc2VydmVJbmVydGlhKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhdHRyYWN0QWxsKGFtb3VudCwgeCwgeSkge1xuICAgIHZhciBpLCBib2lkLCBkaXJYLCBkaXJZLCBtYWc7XG5cbiAgICB2YXIgYm9pZHMgPSBib2lkbWFuLmFsbCgpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGJvaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBib2lkID0gYm9pZHNbaV07XG4gICAgICBkaXJYID0geCAtIGJvaWQuY3Bvcy54O1xuICAgICAgZGlyWSA9IHkgLSBib2lkLmNwb3MueTtcblxuICAgICAgLy8gbm9ybWFsaXplXG4gICAgICBtYWcgPSBNYXRoLnNxcnQoZGlyWCpkaXJYICsgZGlyWSpkaXJZKTtcbiAgICAgIGRpclggLz0gbWFnO1xuICAgICAgZGlyWSAvPSBtYWc7XG5cbiAgICAgIGJvaWQuYWNlbC54ICs9IGRpclggKiBhbW91bnQ7XG4gICAgICBib2lkLmFjZWwueSArPSBkaXJZICogYW1vdW50O1xuICAgIH1cbiAgfVxuXG4gIHZhciByZXBlYXRlckN0bCA9IHJlcGVhdGVyKGZ1bmN0aW9uKGR0KSB7XG4gICAgLy8gQ2FsbCB0aGUgc3RlcHBlciBhcyBvZnRlbiBhcyBwb3NzaWJsZS5cbiAgICBzdGVwcGVyLnVwZGF0ZShkdCk7XG4gIH0pXG5cbiAgcmVwZWF0ZXJDdGwuc3RhcnQoKTtcblxuICAvLyBsaXN0ZW4gZm9yIG1lc3NhZ2VzIGZyb20gdGhlIFwibWFpblwiIHRocmVhZFxuICBhZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXYpIHtcbiAgICBpZiAoZXYuZGF0YS50eXBlID09PSAnSEFMVCcpIHtcbiAgICAgIHJlcGVhdGVyQ3RsLnN0b3AoKTtcbiAgICAgIC8vIFRoaXMgd2lsbCBlcnJvciBpbiBhIEZGIHdvcmtlciwgYnV0IGl0J3Mgb2sgc2luY2Ugd2UnbGwgc3RpbGwgc2VlIGl0LlxuICAgICAgLy8gSXQganVzdCBoYXMgdG8gYmUgdGhlIGxhc3QgbGluZSwgb3RoZXJ3aXNlIG90aGVyIHN0dWZmIHdpbGwgYnJlYWtcbiAgICAgIC8vIChhbHNvLCB3ZSdyZSBub3Qgc3RhcnRpbmcgdGhpcyB1cCBhZ2Fpbiwgc28gaXQncyBmaW5lKS5cbiAgICAgIGNvbnNvbGUubG9nKCdoYWx0aW5nIGZyb20gd29ya2VyJyk7XG4gICAgfVxuICB9KTtcbn1cbiIsIihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIGRlZmluZShmYWN0b3J5KTtcbiAgfSBlbHNlIHtcbiAgICAgIHJvb3QuQWxlYSA9IGZhY3RvcnkoKTtcbiAgfVxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XG5cbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8vIEZyb20gaHR0cDovL2JhYWdvZS5jb20vZW4vUmFuZG9tTXVzaW5ncy9qYXZhc2NyaXB0L1xuXG4gIC8vIGltcG9ydFN0YXRlIHRvIHN5bmMgZ2VuZXJhdG9yIHN0YXRlc1xuICBBbGVhLmltcG9ydFN0YXRlID0gZnVuY3Rpb24oaSl7XG4gICAgdmFyIHJhbmRvbSA9IG5ldyBBbGVhKCk7XG4gICAgcmFuZG9tLmltcG9ydFN0YXRlKGkpO1xuICAgIHJldHVybiByYW5kb207XG4gIH07XG5cbiAgcmV0dXJuIEFsZWE7XG5cbiAgZnVuY3Rpb24gQWxlYSgpIHtcbiAgICByZXR1cm4gKGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgIC8vIEpvaGFubmVzIEJhYWfDuGUgPGJhYWdvZUBiYWFnb2UuY29tPiwgMjAxMFxuICAgICAgdmFyIHMwID0gMDtcbiAgICAgIHZhciBzMSA9IDA7XG4gICAgICB2YXIgczIgPSAwO1xuICAgICAgdmFyIGMgPSAxO1xuXG4gICAgICBpZiAoYXJncy5sZW5ndGggPT0gMCkge1xuICAgICAgICBhcmdzID0gWytuZXcgRGF0ZV07XG4gICAgICB9XG4gICAgICB2YXIgbWFzaCA9IE1hc2goKTtcbiAgICAgIHMwID0gbWFzaCgnICcpO1xuICAgICAgczEgPSBtYXNoKCcgJyk7XG4gICAgICBzMiA9IG1hc2goJyAnKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHMwIC09IG1hc2goYXJnc1tpXSk7XG4gICAgICAgIGlmIChzMCA8IDApIHtcbiAgICAgICAgICBzMCArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHMxIC09IG1hc2goYXJnc1tpXSk7XG4gICAgICAgIGlmIChzMSA8IDApIHtcbiAgICAgICAgICBzMSArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHMyIC09IG1hc2goYXJnc1tpXSk7XG4gICAgICAgIGlmIChzMiA8IDApIHtcbiAgICAgICAgICBzMiArPSAxO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtYXNoID0gbnVsbDtcblxuICAgICAgdmFyIHJhbmRvbSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdCA9IDIwOTE2MzkgKiBzMCArIGMgKiAyLjMyODMwNjQzNjUzODY5NjNlLTEwOyAvLyAyXi0zMlxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBzMSA9IHMyO1xuICAgICAgICByZXR1cm4gczIgPSB0IC0gKGMgPSB0IHwgMCk7XG4gICAgICB9O1xuICAgICAgcmFuZG9tLnVpbnQzMiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcmFuZG9tKCkgKiAweDEwMDAwMDAwMDsgLy8gMl4zMlxuICAgICAgfTtcbiAgICAgIHJhbmRvbS5mcmFjdDUzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiByYW5kb20oKSArIFxuICAgICAgICAgIChyYW5kb20oKSAqIDB4MjAwMDAwIHwgMCkgKiAxLjExMDIyMzAyNDYyNTE1NjVlLTE2OyAvLyAyXi01M1xuICAgICAgfTtcbiAgICAgIHJhbmRvbS52ZXJzaW9uID0gJ0FsZWEgMC45JztcbiAgICAgIHJhbmRvbS5hcmdzID0gYXJncztcblxuICAgICAgLy8gbXkgb3duIGFkZGl0aW9ucyB0byBzeW5jIHN0YXRlIGJldHdlZW4gdHdvIGdlbmVyYXRvcnNcbiAgICAgIHJhbmRvbS5leHBvcnRTdGF0ZSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBbczAsIHMxLCBzMiwgY107XG4gICAgICB9O1xuICAgICAgcmFuZG9tLmltcG9ydFN0YXRlID0gZnVuY3Rpb24oaSl7XG4gICAgICAgIHMwID0gK2lbMF0gfHwgMDtcbiAgICAgICAgczEgPSAraVsxXSB8fCAwO1xuICAgICAgICBzMiA9ICtpWzJdIHx8IDA7XG4gICAgICAgIGMgPSAraVszXSB8fCAwO1xuICAgICAgfTtcbiBcbiAgICAgIHJldHVybiByYW5kb207XG5cbiAgICB9IChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gIH1cblxuICBmdW5jdGlvbiBNYXNoKCkge1xuICAgIHZhciBuID0gMHhlZmM4MjQ5ZDtcblxuICAgIHZhciBtYXNoID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgZGF0YSA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBuICs9IGRhdGEuY2hhckNvZGVBdChpKTtcbiAgICAgICAgdmFyIGggPSAwLjAyNTE5NjAzMjgyNDE2OTM4ICogbjtcbiAgICAgICAgbiA9IGggPj4+IDA7XG4gICAgICAgIGggLT0gbjtcbiAgICAgICAgaCAqPSBuO1xuICAgICAgICBuID0gaCA+Pj4gMDtcbiAgICAgICAgaCAtPSBuO1xuICAgICAgICBuICs9IGggKiAweDEwMDAwMDAwMDsgLy8gMl4zMlxuICAgICAgfVxuICAgICAgcmV0dXJuIChuID4+PiAwKSAqIDIuMzI4MzA2NDM2NTM4Njk2M2UtMTA7IC8vIDJeLTMyXG4gICAgfTtcblxuICAgIG1hc2gudmVyc2lvbiA9ICdNYXNoIDAuOSc7XG4gICAgcmV0dXJuIG1hc2g7XG4gIH1cbn0pKTtcbiIsIlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvbmhhbHQsIG9wdF9tc2csIG9wdF9rZXljb2RlKSB7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihlKSB7XG4gICAgaWYgKGUud2hpY2ggPT0gKG9wdF9rZXljb2RlIHx8IDI3KSkge1xuICAgICAgb25oYWx0KCk7XG4gICAgICBjb25zb2xlLmxvZyhvcHRfbXNnIHx8ICdIQUxUIElOIFRIRSBOQU1FIE9GIFNDSUVOQ0UhJyk7XG4gICAgfVxuICB9KVxufSIsIlxuY29uc29sZS5sb2coJ3J1bm5pbmcgaW4gU0lOR0xFIFRIUkVBREVEIE1PREUnKTtcblxudmFyIHNjaWhhbHQgPSByZXF1aXJlKCdzY2llbmNlLWhhbHQnKTtcblxudmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vbGliL2NvbmZpZycpO1xuXG52YXIgY3ZzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3N0YWdlJylcbiAgLCBjdHggPSBjdnMuZ2V0Q29udGV4dCgnMmQnKVxuICAsIHJlc2l6ZW1vbiA9IHJlcXVpcmUoJy4vbGliL3Jlc2l6ZW1vbicpKGN2cyk7XG5cbnZhciByc3RhdHMgPSByZXF1aXJlKCcuL2xpYi9yc3RhdHNoZWxwZXInKTtcblxudmFyIHJlcGVhdGVyID0gcmVxdWlyZSgnLi9saWIvcmVwZWF0ZXInKTtcblxudmFyIHdvcmtlciA9IHJlcXVpcmUoJy4vbGliL3dvcmtlcicpKCk7XG5cbnZhciBCb2lkTWFuYWdlciA9IHJlcXVpcmUoJy4vbGliL2JvaWRtYW5hZ2VyJyk7XG52YXIgYm9pZG1hbiA9IG5ldyBCb2lkTWFuYWdlcjtcbnZhciBsYXN0U25hcHNob3RSZWNlaXZlZEF0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXYpIHtcblxuICAvLyBBIGZ1bGwgc3RlcCBjb250YWlucyBzbmFwc2hvdHMuXG4gIGlmIChldi5kYXRhLnR5cGUgPT09ICdzdGVwJykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXYuZGF0YS5zbmFwc2hvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzbmFwc2hvdCA9IGV2LmRhdGEuc25hcHNob3RzW2ldO1xuICAgICAgdmFyIGJvaWQgPSBib2lkbWFuLmdldGluYXRlKHNuYXBzaG90LmlkKTtcbiAgICAgIGJvaWQucmVhZEZyb21TbmFwc2hvdChzbmFwc2hvdCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdGhlcmUgaGFzIHRvIGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGlzP1xuICAgIGxhc3RTbmFwc2hvdFJlY2VpdmVkQXQgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuICAgIHJzdGF0cygncGh5cycpLnNldChldi5kYXRhLmVuZFRpbWUgLSBldi5kYXRhLnN0YXJ0VGltZSk7XG4gICAgcnN0YXRzKCkudXBkYXRlKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbn0sIGZhbHNlKTtcblxuZnVuY3Rpb24gZ3JhcGhpY3MoZHQpIHtcbiAgdmFyIG5vdyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICByc3RhdHMoJ2ZyYW1lJykuc3RhcnQoKTtcbiAgcnN0YXRzKCdGUFMnKS5mcmFtZSgpO1xuICByc3RhdHMoJ3JBRicpLnRpY2soKTtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjdnMud2lkdGgsIGN2cy5oZWlnaHQpO1xuICB2YXIgcmF0aW8gPSAobm93IC0gbGFzdFNuYXBzaG90UmVjZWl2ZWRBdCkgLyAxMDAwIC8gY29uZmlnLlBIWVNJQ1NfSFo7XG4gIHZhciBib2lkcyA9IGJvaWRtYW4uYWxsKCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYm9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICBib2lkc1tpXS5kcmF3KGN0eCwgcmF0aW8pO1xuICB9XG4gIHJzdGF0cygnZnJhbWUnKS5lbmQoKTtcbiAgcnN0YXRzKCkudXBkYXRlKCk7XG59XG5cbi8vIENhbGwgYGdyYXBoaWNzYCBhcyBvZnRlbiBhcyBwb3NzaWJsZSB1c2luZyBgcmVxdWVzdEFuaW1hdGlvbkZyYW1lYC5cbnZhciByZXBlYXRlckN0bCA9IHJlcGVhdGVyKGdyYXBoaWNzLCByZXF1ZXN0QW5pbWF0aW9uRnJhbWUpO1xucmVwZWF0ZXJDdGwuc3RhcnQoKTtcblxuc2NpaGFsdChmdW5jdGlvbigpIHtcbiAgcmVwZWF0ZXJDdGwuc3RvcCgpO1xuICB3aW5kb3cucG9zdE1lc3NhZ2UoeyB0eXBlOiAnSEFMVCcgfSwgJyonKTtcbn0pXG4iLCIvLyBwZXJmb3JtYW5jZS5ub3coKSBwb2x5ZmlsbCBmcm9tIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC81NDM4NjUwXG5cbihmdW5jdGlvbigpe1xuIFxuICAvLyBwcmVwYXJlIGJhc2UgcGVyZiBvYmplY3RcbiAgaWYgKHR5cGVvZiB3aW5kb3cucGVyZm9ybWFuY2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcbiAgfVxuIFxuICBpZiAoIXdpbmRvdy5wZXJmb3JtYW5jZS5ub3cpe1xuICAgIFxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xuIFxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XG4gICAgICBub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XG4gICAgfVxuIFxuIFxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xuICAgIH1cbiBcbiAgfVxuIFxufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByU3RhdHMoIHNldHRpbmdzICkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gICAgZWxlbWVudC5ocmVmID0gJ2h0dHA6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3M/ZmFtaWx5PVJvYm90bytDb25kZW5zZWQ6NDAwLDcwMCwzMDAnO1xuICAgIGVsZW1lbnQucmVsID0gJ3N0eWxlc2hlZXQnO1xuICAgIGVsZW1lbnQudHlwZSA9ICd0ZXh0L2Nzcyc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXS5hcHBlbmRDaGlsZChlbGVtZW50KVxuXG4gICAgdmFyIF9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9LFxuICAgICAgICBfY29sb3VycyA9IFsgJyM4NTA3MDAnLCAnI2M3NDkwMCcsICcjZmNiMzAwJywgJyMyODQyODAnLCAnIzRjN2MwYycgXTtcblxuICAgIGlmKCAhX3NldHRpbmdzLnZhbHVlcyApIF9zZXR0aW5ncy52YWx1ZXMgPSB7fTtcbiAgICBcbiAgICBmdW5jdGlvbiBHcmFwaCggX2RvbSwgX2lkICkge1xuXG4gICAgICAgIHZhciBfY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKSxcbiAgICAgICAgICAgIF9jdHggPSBfY2FudmFzLmdldENvbnRleHQoICcyZCcgKSxcbiAgICAgICAgICAgIF9tYXggPSAwLFxuICAgICAgICAgICAgX2N1cnJlbnQgPSAwO1xuXG4gICAgICAgIHZhciBfZG90Q2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKSxcbiAgICAgICAgICAgIF9kb3RDdHggPSBfZG90Q2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcbiAgICAgICAgX2RvdENhbnZhcy53aWR0aCA9IDE7XG4gICAgICAgIF9kb3RDYW52YXMuaGVpZ2h0ID0gMjA7XG4gICAgICAgIF9kb3RDdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICBfZG90Q3R4LmZpbGxSZWN0KCAwLCAwLCAxLCAyMCApO1xuICAgICAgICBfZG90Q3R4LmZpbGxTdHlsZSA9ICcjNjY2NjY2JztcbiAgICAgICAgX2RvdEN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEwICk7XG4gICAgICAgIF9kb3RDdHguZmlsbFN0eWxlID0gJyNmZmZmZmYnO1xuICAgICAgICBfZG90Q3R4LmZpbGxSZWN0KCAwLCAxMCwgMSwgMSApO1xuXG4gICAgICAgIHZhciBfYWxhcm1DYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApLFxuICAgICAgICAgICAgX2FsYXJtQ3R4ID0gX2FsYXJtQ2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcbiAgICAgICAgX2FsYXJtQ2FudmFzLndpZHRoID0gMTtcbiAgICAgICAgX2FsYXJtQ2FudmFzLmhlaWdodCA9IDIwO1xuICAgICAgICBfYWxhcm1DdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICBfYWxhcm1DdHguZmlsbFJlY3QoIDAsIDAsIDEsIDIwICk7XG4gICAgICAgIF9hbGFybUN0eC5maWxsU3R5bGUgPSAnI2I3MDAwMCc7XG4gICAgICAgIF9hbGFybUN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEwICk7XG4gICAgICAgIF9hbGFybUN0eC5maWxsU3R5bGUgPSAnI2ZmZmZmZic7XG4gICAgICAgIF9hbGFybUN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEgKTtcblxuICAgICAgICBmdW5jdGlvbiBfaW5pdCgpIHtcblxuICAgICAgICAgICAgX2NhbnZhcy53aWR0aCA9IDIwMDtcbiAgICAgICAgICAgIF9jYW52YXMuaGVpZ2h0ID0gMTA7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLndpZHRoID0gX2NhbnZhcy53aWR0aCArICdweCc7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLmhlaWdodCA9IF9jYW52YXMuaGVpZ2h0ICsgJ3B4JztcbiAgICAgICAgICAgIF9jYW52YXMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS5yaWdodCA9IDA7XG4gICAgICAgICAgICBfZG9tLmFwcGVuZENoaWxkKCBfY2FudmFzICk7XG5cbiAgICAgICAgICAgIF9jdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICAgICAgX2N0eC5maWxsUmVjdCggMCwgMCwgX2NhbnZhcy53aWR0aCwgX2NhbnZhcy5oZWlnaHQgKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2RyYXcoIHYsIGFsYXJtICkge1xuICAgICAgICAgICAgX2N1cnJlbnQgKz0gKCB2IC0gX2N1cnJlbnQgKSAqIC4xO1xuICAgICAgICAgICAgX21heCAqPSAuOTk7XG4gICAgICAgICAgICBpZiggX2N1cnJlbnQgPiBfbWF4ICkgX21heCA9IF9jdXJyZW50O1xuICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9jYW52YXMsIDEsIDAsIF9jYW52YXMud2lkdGggLSAxLCBfY2FudmFzLmhlaWdodCwgMCwgMCwgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0ICk7XG4gICAgICAgICAgICBpZiggYWxhcm0gKSB7XG4gICAgICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9hbGFybUNhbnZhcywgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0IC0gX2N1cnJlbnQgKiBfY2FudmFzLmhlaWdodCAvIF9tYXggLSAxMCApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfY3R4LmRyYXdJbWFnZSggX2RvdENhbnZhcywgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0IC0gX2N1cnJlbnQgKiBfY2FudmFzLmhlaWdodCAvIF9tYXggLSAxMCApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgX2luaXQoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHJhdzogX2RyYXdcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gU3RhY2tHcmFwaCggX2RvbSwgX251bSApIHtcblxuICAgICAgICB2YXIgX2NhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICksXG4gICAgICAgICAgICBfY3R4ID0gX2NhbnZhcy5nZXRDb250ZXh0KCAnMmQnICksXG4gICAgICAgICAgICBfbWF4ID0gMCxcbiAgICAgICAgICAgIF9jdXJyZW50ID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBfaW5pdCgpIHtcblxuICAgICAgICAgICAgX2NhbnZhcy53aWR0aCA9IDIwMDtcbiAgICAgICAgICAgIF9jYW52YXMuaGVpZ2h0ID0gMTAgKiBfbnVtO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS53aWR0aCA9IF9jYW52YXMud2lkdGggKyAncHgnO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS5oZWlnaHQgPSBfY2FudmFzLmhlaWdodCArICdweCc7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICAgIF9jYW52YXMuc3R5bGUucmlnaHQgPSAwO1xuICAgICAgICAgICAgX2RvbS5hcHBlbmRDaGlsZCggX2NhbnZhcyApO1xuXG4gICAgICAgICAgICBfY3R4LmZpbGxTdHlsZSA9ICcjNDQ0NDQ0JztcbiAgICAgICAgICAgIF9jdHguZmlsbFJlY3QoIDAsIDAsIF9jYW52YXMud2lkdGgsIF9jYW52YXMuaGVpZ2h0ICk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9kcmF3KCB2ICkge1xuICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9jYW52YXMsIDEsIDAsIF9jYW52YXMud2lkdGggLSAxLCBfY2FudmFzLmhlaWdodCwgMCwgMCwgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0ICk7XG4gICAgICAgICAgICB2YXIgdGggPSAwO1xuICAgICAgICAgICAgZm9yKCB2YXIgaiBpbiB2ICkge1xuICAgICAgICAgICAgICAgIHZhciBoID0gdlsgaiBdICogX2NhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgX2N0eC5maWxsU3R5bGUgPSBfY29sb3Vyc1sgaiBdO1xuICAgICAgICAgICAgICAgIF9jdHguZmlsbFJlY3QoIF9jYW52YXMud2lkdGggLSAxLCB0aCwgMSwgaCApO1xuICAgICAgICAgICAgICAgIHRoICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBfaW5pdCgpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkcmF3OiBfZHJhd1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBQZXJmQ291bnRlciggaWQsIGdyb3VwICkge1xuXG4gICAgICAgIHZhciBfaWQgPSBpZCxcbiAgICAgICAgICAgIF90aW1lLFxuICAgICAgICAgICAgX3ZhbHVlID0gMCxcbiAgICAgICAgICAgIF90b3RhbCA9IDAsXG4gICAgICAgICAgICBfZG9tID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKSxcbiAgICAgICAgICAgIF9zcGFuSWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKSxcbiAgICAgICAgICAgIF9zcGFuVmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKSxcbiAgICAgICAgICAgIF9ncmFwaCA9IG5ldyBHcmFwaCggX2RvbSwgX2lkICksXG4gICAgICAgICAgICBfZGVmID0gX3NldHRpbmdzP19zZXR0aW5ncy52YWx1ZXNbIF9pZC50b0xvd2VyQ2FzZSgpIF06bnVsbDtcblxuICAgICAgICBfZG9tLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICAgICAgX2RvbS5zdHlsZS5tYXJnaW4gPSAnMnB4IDAnO1xuICAgICAgICBfZG9tLnN0eWxlLmhlaWdodCA9ICcxMHB4JztcblxuICAgICAgICBfc3BhbklkLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgX3NwYW5JZC5zdHlsZS5sZWZ0ID0gMDtcbiAgICAgICAgX3NwYW5JZC5zdHlsZS50b3AgPSAwO1xuICAgICAgICBfc3BhbklkLnRleHRDb250ZW50ID0gKCBfZGVmICYmIF9kZWYuY2FwdGlvbiApP19kZWYuY2FwdGlvbjpfaWQ7XG5cbiAgICAgICAgX3NwYW5WYWx1ZS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIF9zcGFuVmFsdWUuc3R5bGUucmlnaHQgPSAnMjEwcHgnO1xuICAgICAgICBfc3BhblZhbHVlLnN0eWxlLnRvcCA9IDA7XG4gICAgICAgIF9zcGFuVmFsdWUuc3R5bGUudGV4dEFsaWduID0gJ3JpZ2h0JztcbiAgICAgICAgXG4gICAgICAgIF9kb20uYXBwZW5kQ2hpbGQoIF9zcGFuSWQgKTtcbiAgICAgICAgX2RvbS5hcHBlbmRDaGlsZCggX3NwYW5WYWx1ZSApO1xuICAgICAgICBpZiggZ3JvdXAgKSBncm91cC5kaXYuYXBwZW5kQ2hpbGQoIF9kb20gKTtcbiAgICAgICAgZWxzZSBfZGl2LmFwcGVuZENoaWxkKCBfZG9tICk7XG5cbiAgICAgICAgX3RpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuXG4gICAgICAgIGZ1bmN0aW9uIF9zdGFydCgpe1xuICAgICAgICAgICAgX3RpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9lbmQoKSB7XG4gICAgICAgICAgICBfdmFsdWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIF90aW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3RpY2soKSB7XG4gICAgICAgICAgICBfZW5kKCk7XG4gICAgICAgICAgICBfc3RhcnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9kcmF3KCkge1xuICAgICAgICAgICAgX3NwYW5WYWx1ZS50ZXh0Q29udGVudCA9IE1hdGgucm91bmQoIF92YWx1ZSAqIDEwMCApIC8gMTAwO1xuICAgICAgICAgICAgdmFyIGEgPSAoIF9kZWYgJiYgKCAoIF9kZWYuYmVsb3cgJiYgX3ZhbHVlIDwgX2RlZi5iZWxvdyApIHx8ICggX2RlZi5vdmVyICYmIF92YWx1ZSA+IF9kZWYub3ZlciApICkgKTtcbiAgICAgICAgICAgIF9ncmFwaC5kcmF3KCBfdmFsdWUsIGEgKTtcbiAgICAgICAgICAgIF9kb20uc3R5bGUuY29sb3IgPSBhPycjYjcwMDAwJzonI2ZmZmZmZic7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfZnJhbWUoKSB7XG4gICAgICAgICAgICB2YXIgdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgdmFyIGUgPSB0IC0gX3RpbWU7XG4gICAgICAgICAgICBfdG90YWwrKztcbiAgICAgICAgICAgIGlmKCBlID4gMTAwMCApIHtcbiAgICAgICAgICAgICAgICBfdmFsdWUgPSBfdG90YWwgKiAxMDAwIC8gZTtcbiAgICAgICAgICAgICAgICBfdG90YWwgPSAwO1xuICAgICAgICAgICAgICAgIF90aW1lID0gdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9zZXQoIHYgKSB7XG4gICAgICAgICAgICBfdmFsdWUgPSB2O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNldDogX3NldCxcbiAgICAgICAgICAgIHN0YXJ0OiBfc3RhcnQsXG4gICAgICAgICAgICB0aWNrOiBfdGljayxcbiAgICAgICAgICAgIGVuZDogX2VuZCxcbiAgICAgICAgICAgIGZyYW1lOiBfZnJhbWUsXG4gICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24oKXsgcmV0dXJuIF92YWx1ZTsgfSxcbiAgICAgICAgICAgIGRyYXc6IF9kcmF3XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhbXBsZSgpIHtcblxuICAgICAgICB2YXIgX3ZhbHVlID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBfc2V0KCB2ICkge1xuICAgICAgICAgICAgX3ZhbHVlID0gdjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXQ6IF9zZXQsXG4gICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24oKXsgcmV0dXJuIF92YWx1ZTsgfVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICB2YXIgX2RpdjtcblxuICAgIHZhciBfcGVyZkNvdW50ZXJzID0ge30sXG4gICAgICAgIF9zYW1wbGVzID0ge307XG5cbiAgICBmdW5jdGlvbiBfcGVyZiggaWQgKSB7XG5cbiAgICAgICAgaWQgPSBpZC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiggaWQgPT09IHVuZGVmaW5lZCApIGlkID0gJ2RlZmF1bHQnO1xuICAgICAgICBpZiggX3BlcmZDb3VudGVyc1sgaWQgXSApIHJldHVybiBfcGVyZkNvdW50ZXJzWyBpZCBdO1xuXG4gICAgICAgIHZhciBncm91cCA9IG51bGw7XG4gICAgICAgIGlmKCBfc2V0dGluZ3MgJiYgX3NldHRpbmdzLmdyb3VwcyApIHtcbiAgICAgICAgICAgIGZvciggdmFyIGogaW4gX3NldHRpbmdzLmdyb3VwcyApIHtcbiAgICAgICAgICAgICAgICB2YXIgZyA9IF9zZXR0aW5ncy5ncm91cHNbIHBhcnNlSW50KCBqLCAxMCApIF07XG4gICAgICAgICAgICAgICAgaWYoIGcudmFsdWVzLmluZGV4T2YoIGlkLnRvTG93ZXJDYXNlKCkgKSAhPSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAgPSBnO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcCA9IG5ldyBQZXJmQ291bnRlciggaWQsIGdyb3VwICk7XG4gICAgICAgIF9wZXJmQ291bnRlcnNbIGlkIF0gPSBwO1xuICAgICAgICByZXR1cm4gcDtcblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pbml0KCkge1xuXG4gICAgICAgIGlmKCBfc2V0dGluZ3MucGx1Z2lucyApIHtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLnZhbHVlcyApIF9zZXR0aW5ncy52YWx1ZXMgPSB7fTtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLmdyb3VwcyApIF9zZXR0aW5ncy5ncm91cHMgPSBbXTtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLmZyYWN0aW9ucyApIF9zZXR0aW5ncy5mcmFjdGlvbnMgPSBbXTtcbiAgICAgICAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgX3NldHRpbmdzLnBsdWdpbnMubGVuZ3RoOyBqKysgKSB7XG4gICAgICAgICAgICAgICAgX3NldHRpbmdzLnBsdWdpbnNbIGogXS5hdHRhY2goIF9wZXJmICk7XG4gICAgICAgICAgICAgICAgZm9yKCB2YXIgayBpbiBfc2V0dGluZ3MucGx1Z2luc1sgaiBdLnZhbHVlcyApIHtcbiAgICAgICAgICAgICAgICAgICAgX3NldHRpbmdzLnZhbHVlc1sgayBdID0gX3NldHRpbmdzLnBsdWdpbnNbIGogXS52YWx1ZXMgWyBrIF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF9zZXR0aW5ncy5ncm91cHMgPSBfc2V0dGluZ3MuZ3JvdXBzLmNvbmNhdCggX3NldHRpbmdzLnBsdWdpbnNbIGogXS5ncm91cHMgKTtcbiAgICAgICAgICAgICAgICBfc2V0dGluZ3MuZnJhY3Rpb25zID0gX3NldHRpbmdzLmZyYWN0aW9ucy5jb25jYXQoIF9zZXR0aW5ncy5wbHVnaW5zWyBqIF0uZnJhY3Rpb25zICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfc2V0dGluZ3MucGx1Z2lucyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgIF9kaXYuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICBfZGl2LnN0eWxlLnpJbmRleCA9IDEwMDAwO1xuICAgICAgICBfZGl2LnN0eWxlLnBhZGRpbmcgPSAnMTBweCc7XG4gICAgICAgIF9kaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMyMjInO1xuICAgICAgICBfZGl2LnN0eWxlLmZvbnRTaXplID0gJzEwcHgnO1xuICAgICAgICBfZGl2LnN0eWxlLmxpbmVIZWlnaHQgPSAnMS4yZW0nO1xuICAgICAgICBfZGl2LnN0eWxlLndpZHRoID0gJzM1MHB4JztcbiAgICAgICAgX2Rpdi5zdHlsZS5mb250RmFtaWx5ID0gJ1JvYm90byBDb25kZW5zZWQsIHRhaG9tYSwgc2Fucy1zZXJpZic7XG4gICAgICAgIF9kaXYuc3R5bGUubGVmdCA9IF9kaXYuc3R5bGUudG9wID0gMDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggX2RpdiApO1xuXG4gICAgICAgIGlmKCAhX3NldHRpbmdzICkgcmV0dXJuO1xuXG4gICAgICAgIGlmKCBfc2V0dGluZ3MuZ3JvdXBzICkge1xuICAgICAgICAgICAgZm9yKCB2YXIgaiBpbiBfc2V0dGluZ3MuZ3JvdXBzICkge1xuICAgICAgICAgICAgICAgIHZhciBnID0gX3NldHRpbmdzLmdyb3Vwc1sgcGFyc2VJbnQoIGosIDEwICkgXTtcbiAgICAgICAgICAgICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcbiAgICAgICAgICAgICAgICBnLmRpdiA9IGRpdjtcbiAgICAgICAgICAgICAgICB2YXIgaDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaDEnICk7XG4gICAgICAgICAgICAgICAgaDEudGV4dENvbnRlbnQgPSBnLmNhcHRpb247XG4gICAgICAgICAgICAgICAgaDEuc3R5bGUubWFyZ2luID0gaDEuc3R5bGUucGFkZGluZyA9IDA7XG4gICAgICAgICAgICAgICAgaDEuc3R5bGUubWFyZ2luQm90dG9tID0gJzVweCc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcxMHB4JztcbiAgICAgICAgICAgICAgICBoMS5zdHlsZS5mb250U2l6ZSA9ICcxNHB4JztcbiAgICAgICAgICAgICAgICBoMS5zdHlsZS5jb2xvciA9ICcjZmZmJ1xuICAgICAgICAgICAgICAgIF9kaXYuYXBwZW5kQ2hpbGQoIGgxICk7XG4gICAgICAgICAgICAgICAgX2Rpdi5hcHBlbmRDaGlsZCggZGl2ICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiggX3NldHRpbmdzLmZyYWN0aW9ucyApIHtcbiAgICAgICAgICAgIGZvciggdmFyIGogaW4gX3NldHRpbmdzLmZyYWN0aW9ucyApIHtcbiAgICAgICAgICAgICAgICB2YXIgZiA9IF9zZXR0aW5ncy5mcmFjdGlvbnNbIHBhcnNlSW50KCBqLCAxMCApIF07XG4gICAgICAgICAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgICAgICAgICAgdmFyIGxlZ2VuZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgICAgICAgICAgbGVnZW5kLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICAgICAgICBsZWdlbmQuc3R5bGUubGluZUhlaWdodCA9ICcxMHB4JztcblxuICAgICAgICAgICAgICAgIHZhciBoID0gMDtcbiAgICAgICAgICAgICAgICBmb3IoIHZhciBrIGluIF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwcyApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAncCcgKTtcbiAgICAgICAgICAgICAgICAgICAgcC50ZXh0Q29udGVudCA9IF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwc1sgayBdO1xuICAgICAgICAgICAgICAgICAgICBwLnN0eWxlLmNvbG9yID0gX2NvbG91cnNbIGggXTtcbiAgICAgICAgICAgICAgICAgICAgcC5zdHlsZS53aWR0aCA9ICcxMjBweCc7XG4gICAgICAgICAgICAgICAgICAgIHAuc3R5bGUudGV4dEFsaWduID0gJ3JpZ2h0JztcbiAgICAgICAgICAgICAgICAgICAgcC5zdHlsZS5tYXJnaW4gPSAwO1xuICAgICAgICAgICAgICAgICAgICBwLnN0eWxlLnBhZGRpbmcgPSAwO1xuICAgICAgICAgICAgICAgICAgICBsZWdlbmQuYXBwZW5kQ2hpbGQoIHAgKTtcbiAgICAgICAgICAgICAgICAgICAgaCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoIGxlZ2VuZCApO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5oZWlnaHQgPSBoICogMTAgKyAncHgnO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLm1hcmdpbkJvdHRvbSA9ICc1cHgnO1xuICAgICAgICAgICAgICAgIGYuZGl2ID0gZGl2O1xuICAgICAgICAgICAgICAgIHZhciBncmFwaCA9IG5ldyBTdGFja0dyYXBoKCBkaXYsIGggKTtcbiAgICAgICAgICAgICAgICBmLmdyYXBoID0gZ3JhcGg7XG4gICAgICAgICAgICAgICAgX2Rpdi5hcHBlbmRDaGlsZCggZGl2ICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF91cGRhdGUoKSB7XG4gICAgICAgIFxuICAgICAgICBmb3IoIHZhciBqIGluIF9zZXR0aW5ncy5wbHVnaW5zICkge1xuICAgICAgICAgICAgX3NldHRpbmdzLnBsdWdpbnNbIGogXS51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciggdmFyIGogaW4gX3BlcmZDb3VudGVycyApIHtcbiAgICAgICAgICAgIF9wZXJmQ291bnRlcnNbIGogXS5kcmF3KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiggX3NldHRpbmdzICYmIF9zZXR0aW5ncy5mcmFjdGlvbnMgKSB7XG4gICAgICAgICAgICBmb3IoIHZhciBqIGluIF9zZXR0aW5ncy5mcmFjdGlvbnMgKSB7XG4gICAgICAgICAgICAgICAgdmFyIGYgPSBfc2V0dGluZ3MuZnJhY3Rpb25zWyBwYXJzZUludCggaiwgMTAgKSBdO1xuICAgICAgICAgICAgICAgIHZhciB2ID0gW107XG4gICAgICAgICAgICAgICAgdmFyIGJhc2UgPSBfcGVyZkNvdW50ZXJzWyBmLmJhc2UudG9Mb3dlckNhc2UoKSBdO1xuICAgICAgICAgICAgICAgIGlmKCBiYXNlICkge1xuICAgICAgICAgICAgICAgICAgICBiYXNlID0gYmFzZS52YWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICBmb3IoIHZhciBrIGluIF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwcyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzID0gX3NldHRpbmdzLmZyYWN0aW9uc1sgaiBdLnN0ZXBzWyBwYXJzZUludCggaywgMTAgKSBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0gX3BlcmZDb3VudGVyc1sgcyBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIHZhbCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2LnB1c2goIHZhbC52YWx1ZSgpIC8gYmFzZSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGYuZ3JhcGguZHJhdyggdiApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBfaW5pdCgpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCBpZCApIHtcbiAgICAgICAgaWYoIGlkICkgcmV0dXJuIF9wZXJmKCBpZCApO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdXBkYXRlOiBfdXBkYXRlXG4gICAgICAgIH1cbiAgICB9XG5cbn07Il19
