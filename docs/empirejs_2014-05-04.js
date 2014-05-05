/*















Siphoning energy out of a pocket universe...
In JS.

Drew Petersen
@KirbySaysHi











































  ad8888ba,     ,a8888a,     88888888888  88888888ba    ad88888ba
 8P'    "Y8   ,8P"'  `"Y8,   88           88      "8b  d8"     "8b
d8           ,8P        Y8,  88           88      ,8P  Y8,
88,dd888bb,  88          88  88aaaaa      88aaaaaa8P'  `Y8aaaaa,
88P'    `8b  88          88  88"""""      88""""""'      `"""""8b,
88       d8  `8b        d8'  88           88                   `8b
88a     a8P   `8ba,  ,ad8'   88           88           Y8a     a8P
 "Y88888P"      "Y8888P"     88           88            "Y88888P"





































This means 16ms per frame!



    88    ad8888ba,         ad8888ba,    ad8888ba,    ad8888ba,
  ,d88   8P'    "Y8        8P'    "Y8   8P'    "Y8   8P'    "Y8
888888  d8                d8           d8           d8
    88  88,dd888bb,       88,dd888bb,  88,dd888bb,  88,dd888bb,  88,dPYba,,adPYba,   ,adPPYba,
    88  88P'    `8b       88P'    `8b  88P'    `8b  88P'    `8b  88P'   "88"    "8a  I8[    ""
    88  88       d8       88       d8  88       d8  88       d8  88      88      88   `"Y8ba,
    88  88a     a8P  888  88a     a8P  88a     a8P  88a     a8P  88      88      88  aa    ]8I
    88   "Y88888P"   888   "Y88888P"    "Y88888P"    "Y88888P"   88      88      88  `"YbbdP"'





































        Ideal GameLoop

        Hardware says GO!
 0 ms - ┬
      - │ Process Input (keyboard, mouse, gamepad, network)
      - ┴
      - ┬
      - │ Update Everything
      - │
      - │
      - │
      - │
      - │
      - ┴
      - ┬
      - │ Draw everything
      - │
      - │
16 ms - ┴
        Hardware says TIME'S UP, SCANLINES ARE LEAVING THE STATION!



P.S. The NES (released in the US in 1985) ran at 60fps.
P.P.S. Some games, like God of War, render in HD but at 30fps.













































        What Actually Happens In A Browser

        requestAnimationFrame GO
 0 ms - ┬
      - │ BROWSER STUFF (Major GC Cycle, Network stuff, Add-Ons, and MORE!)
      - | Also deliver browser events, like postMessage, keypress, etc.
      - | Just sprinkle this stuff everywhere. It's delicious.
      - ┴
      - ┬
      - │ Process Input (keyboard, mouse, gamepad, network)
      - | Minor GC
      - ┴
      - ┬
      - │ Update
      - | Minor GC (Possibly Major if you're not careful in FF!)
      - |
      - |
      - │
      - │
16 ms - │
      - ┴
      - ┬
      - │ "Draw" everything
      - | Tell the browser you want to do canvas stuff.
      - │ If you touch the DOM, get ready for layout!
      - │
      - ┴
      - ┬
      - │ MORE BROWSER STUFF
      - | Recalculate Style
      - | Layout (in)validation
      - | Compositing / Painting
      - ┴
      -
33 ms -




























Current State: COMPROMISE



Make your game less complex (fewer things to manage, fewer things to draw).

Or

Implicit exlusion of users on low to mid range hardware.




The only things within your control here are the contents of the game
itself. The JS runtime / browser does not expose things like:

- GC Tuning (how much memory to use)
- Microtask / HTML Task semantics (delivery of events)
- Execution scheduling (estimating how long something will take to compute)






























If you're making a game,
it's like you're creating a whole new world.

Modern computers have multiple cores,
meaning it's a bit like computing in parallel universes.

































88        88    ,ad8888ba,   I8,        8        ,8I   ad88888ba
88        88   d8"'    `"8b  `8b       d8b       d8'  d8"     "8b
88        88  d8'        `8b  "8,     ,8"8,     ,8"   ""      a8P
88aaaaaaaa88  88          88   Y8     8P Y8     8P         ,a8P"
88""""""""88  88          88   `8b   d8' `8b   d8'        d8"
88        88  Y8,        ,8P    `8a a8'   `8a a8'         ""
88        88   Y8a.    .a8P      `8a8'     `8a8'          aa
88        88    `"Y8888Y"'        `8'       `8'           88











































__          __  _      __          __        _
\ \        / / | |     \ \        / /       | |
 \ \  /\  / /__| |__    \ \  /\  / /__  _ __| | _____ _ __ ___
  \ \/  \/ / _ \ '_ \    \ \/  \/ / _ \| '__| |/ / _ \ '__/ __|
   \  /\  /  __/ |_) |    \  /\  / (_) | |  |   <  __/ |  \__ \
    \/  \/ \___|_.__/      \/  \/ \___/|_|  |_|\_\___|_|  |___/




*/
var worker = new Worker('path/to/some.js');

// OR...

var worker = new Worker('data:application/javascript,'
  + encodeURIComponent(code));

// OR
var worker = new Worker(window.URL.createObjectURL(
  new Blob([code], { type: 'text/javascript' })
));

worker.onmessage = function(ev) { }
worker.addEventListener('message', function(ev) { })

/*
Inside a worker you have some standard stuff:

setTimeout
setInterval
new Date()
postMessage

BUT NO DOM. (That will change in the future with transferrable canvas.)
ALSO NO HIGH PERFORMANCE TIMERS (window.performance.now())











































        Browser Thread                                                   Worker Thread

 0 ms - ┬                                                         0 ms - ┬
      - │ Process Browser/Message Queue                                - │ Process Message Queue
      - | Accept snapshots from worker                                 - | Accept input from main thread
      - ┴                                                              - ┴
      - ┬                                                              - ┬
      - │ Dispatch Input to Worker (keyboard, mouse, gamepad)          - │ Apply inputs to game world
      - ┴                                                              - | A.I.
      - ┬                                                              - | Physics
      - │ Draw the interpolated world between the newest snapshot      - │ Dispatch snapshot of world
      - │ and the _previous_ snapshop                                  - |
      - │                                                              - │
      - │                                                              - │
      - │                                                              - │
      - ┴                                                              - │ We'll have even more time
      - ┬                                                              - │ due to one weird trick later.
      - │ MORE BROWSER STUFF                                           - │
16 ms - ┴                                                        16 ms - ┴































        Browser Thread                                                   Worker Thread

 0 ms - ┬                                                         0 ms - ┬
      - │ Process Browser/Message Queue                                - │ Process Message Queue
      - | Accept snapshots from worker                                 - | Accept input from main thread
      - ┴                                                              - ┴
      - ┬                                                              - ┬
      - │ Dispatch Input to Worker (keyboard, mouse, gamepad)          - │ Apply inputs to game world
      - ┴                                                              - | A.I.
      - ┬                                                              - | Physics
      - │ Draw the interpolated world between the newest snapshot      - │ Dispatch snapshot of world
      - │ and the _previous_ snapshop                                  - |
      - │                                                              - │
      - │                                                              - │
      - │                                                              - │
      - ┴                                                              - │
      - ┬                                                              - │
      - │ MORE BROWSER STUFF                                           - │
16 ms - ┴                                                        16 ms - │
                                                                       - │
                                                                       - │
                                                                       - |
                                                                       - │ BEHOLD
                                                                       - │ THE
                                                                       - │ WILD
                                                                       - │ EXPANSE
                                                                       - │ OF
                                                                       - │ A
                                                                       - │ PARALLEL
                                                                       - │ UNIVERSE!
                                                                       - │ SO MUCH TIME!
                                                                       - │
                                                                  33ms - ┴























DO 900 DEMO





































A few key pieces:



































Shared Code
===========

single.js -> browserify via beefy -> bundle-single.js
multi.js  -> browserify via beefy -> bundle-multi.js


*/

// multi.js
var work = require('webworkify');
var worker = work(require('./lib/worker'));


// single.js
var worker = require('./lib/worker')();


// lib/worker.js
module.exports = function() {

  if (typeof importScripts !== 'undefined') {
    // ... WebWorker-specific transport code
    // YOU KNOW IT TO BE TRUE(ly a worker)
  }

  // ... everything else
}

/*














































Entity System (e.g a system to manage "things")
===============================================

To make a new thing, you use a string / numeric id:
*/

// Instead of:
var boid = new Boid(x, y, radius);


// Do this once...
var boidman = new BoidManager;


// And then make a new boid:
var boid = boidman.getinate(null, [x, y, radius]);
console.log(boid.id);
// => "boid_1"
console.log(boid.x);
// => 10


// And then somewhere else in your code...
var boid = boidman.getinate('boid_1');
console.log(boid.x);
// => 10

/*
Summary: A way to grab an existing instance of an object, quickly.





















































Snapshot?
=========

A simple way to represent the current state of an entity (Boid, in these examples).

An entity is "snapshottable" if it has two methods:
*/





























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

/*





























We end up with two copies of the world, one for each thread.

You write an entity so it looks like this:
*/


function Corgi() {
  this.name = 'Appa';
  this.isSeasonallyShedding = 'my apartment is swimming';
  this.furLevel = 5;
  this.id = null; // This will be assigned by the manager.
}


// These will only ever be called from the main thread or "world".
Corgi.prototype.readFromSnapshot = function(data) {
  this.name = data.name;
  this.isSeasonallyShedding = data.isSeasonallyShedding;
  this.furLevel = data.furLevel;
  this.id = this.id || data.id;
}

Corgi.prototype.draw = function(ctx, ratio) {
  ctx.doge(); // HTML9
}


// These will only ever be called from the worker thread, or "parallel universe".
Corgi.prototype.writeToSnapshot = function(data) {
  data.name = this.name;
  data.isSeasonallyShedding = this.isSeasonallyShedding;
  data.furLevel = this.furLevel;
  data.id = this.id;
  return data;
}

Corgi.prototype.update = function() {
  this.furLevel += 5;
}
























/*

The Worker Emits One Set of Snapshots every 33ms
================================================

*/

var startTime = Date.now();

// ... bunch of world update code, physics, etc...

var snapshots = [];
for (i = 0; i < boids.length; i++) {
  // We pass in an empty object. As a future optimization, these objects
  // could be Object.create(null) or object pooled.
  snapshots.push(boids[i].writeToSnapshot({}));
}

var endTime = Date.now();

// This is a standard web worker API.
postMessage({
  type: 'step',
  snapshots: snapshots,
  startTime: startTime,
  endTime: endTime
});


























/*

And the Main Thread Just Listens
================================

*/


var mm = require('./lib/messagemanager')();
worker.addEventListener('message', function(ev) {
  mm._queue(ev.data);
});

requestAnimationFrame(function graphics() {
  var total = mm.read(message);
  // ... more GFX/timing stuff too
  requestAnimationFrame(graphics);
})

function message(msg) {

  if (msg.type === 'physics:step') {
    for (var i = 0; i < msg.snapshots.length; i++) {
      var snapshot = msg.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    lastSnapshotReceivedAt = performance.now();

    return true; // mark message as received
  }
}


































/*


Wait a minute....
The worker only emits a snapshot every...



 ad888888b,   ad888888b,        ad888888b,   ad888888b,   ad888888b,
d8"     "88  d8"     "88       d8"     "88  d8"     "88  d8"     "88
        a8P          a8P               a8P          a8P          a8P
     aad8"        aad8"             aad8"        aad8"        aad8"   88,dPYba,,adPYba,   ,adPPYba,
     ""Y8,        ""Y8,             ""Y8,        ""Y8,        ""Y8,   88P'   "88"    "8a  I8[    ""
        "8b          "8b               "8b          "8b          "8b  88      88      88   `"Y8ba,
Y8,     a88  Y8,     a88  888  Y8,     a88  Y8,     a88  Y8,     a88  88      88      88  aa    ]8I
 "Y888888P'   "Y888888P'  888   "Y888888P'   "Y888888P'   "Y888888P'  88      88      88  `"YbbdP"'








































But the main thread has to render every...



    88    ad8888ba,         ad8888ba,    ad8888ba,    ad8888ba,
  ,d88   8P'    "Y8        8P'    "Y8   8P'    "Y8   8P'    "Y8
888888  d8                d8           d8           d8
    88  88,dd888bb,       88,dd888bb,  88,dd888bb,  88,dd888bb,  88,dPYba,,adPYba,   ,adPPYba,
    88  88P'    `8b       88P'    `8b  88P'    `8b  88P'    `8b  88P'   "88"    "8a  I8[    ""
    88  88       d8       88       d8  88       d8  88       d8  88      88      88   `"Y8ba,
    88  88a     a8P  888  88a     a8P  88a     a8P  88a     a8P  88      88      88  aa    ]8I
    88   "Y88888P"   888   "Y88888P"    "Y88888P"    "Y88888P"   88      88      88  `"YbbdP"'














































This makes no sense!
How can we render what is not there?
We'll just be drawing the same thing in the same place!
And it will be boring.

http://codepen.io/kirbysayshi/full/iwxvk










































INTERPOLATION! AKA WE ARE NOW TIME TRAVELERS
============================================

In the main thread, we store:

- the newest snapshot
- the snapshot before that
- how much time has passed since the newest snapshot

When everything is drawn we do this:
*/

var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;

/*
This gives a ratio (%) of how many physics ticks have passed assuming the
next snapshot arrives on time.

                                                          Worker is here
Worker Time                                               | (0 + ratio*33ms)
-33ms                 -16ms                   0           |
--|---------------------|---------------------|-----------|---------
Snapshot A                                  Snapshot B


              Rendering is here
Main Thread   | (A time + ratio*30ms)
Snapshot A    |                             Snapshot B
--|-----------|---------|---------------------|----------------------------



http://codepen.io/kirbysayshi/full/tfDmk






















BUT FUN!
========


DEMO 2000?































THANKS!


@KirbySaysHi
https://github.com/kirbysayshi/multithreaded-game-example


Libraries used:

browserify: https://github.com/substack/node-browserify
webworkify: https://github.com/substack/webworkify
rstats.js: https://github.com/spite/rstats
beefy: https://github.com/chrisdickinson/beefy
































































 */
