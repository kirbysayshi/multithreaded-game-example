Multithreaded Game Engine Experiment
====================================

This is an experiment to see how practical running parts of typical game logic (physics) in a web worker can be. This project is in progress, but currently hosts two demos that share nearly the exact same code:

* http://kirbysayshi.github.com/multithreaded-game-example/index-single.html
* http://kirbysayshi.github.com/multithreaded-game-example/index-multi.html

Aside from separate entry files ([single.js](single.js) and [multi.js](multi.js), respectively), they share the exact same library code (located in [lib](lib)). single runs on the main thread, while multi spawns a web worker to calculate physics and entity updates.

Please note: the point of this experiment is not to create the fastest physics simulation or rendering engine. Thus physics are definitely unoptimized, and rendering uses simple 2D canvas apis. These are both known, purposeful bottlenecks. They provide a common ground to test out the overhead (cpu, memory, and GC) of the "multithreaded machinery".

Running It Yourself
===================

- Clone this repo
- `npm install`
- `npm bundle` (or `npm bundle-debug` for source maps)
- Load up index-single.html or index-multi.html in a browser.

For a quicker iteration time, use [beefy][]:

- `npm install -g beefy`
- `beefy single.js:bundle-single.js 1234` (for index-single.html)
- `beefy multi.js:bundle-multi.js 1234` (for index-multi.html)
- Visit http://localhost:1234/index-multi.html in your browser.

[beefy]: https://github.com/chrisdickinson/beefy

How This Works
==============

There are a few main components that power these demos, aside from the base platform of [browserify][] and [webworkify][].

Interpolated Rendering
----------------------

The primary thread renders at 60 frames per second (e.g. every 16ms), while the web worker renders at 30 ticks per second (e.g. every 33ms). Therefore, the most recent and prior states emitted from the web worker are stored in the main thread, and time is interpolated between these two states when rendering. This allows for smooth movement with fewer physics updates. For more information, visit [Interpolated Physics Rendering][]. This technique also decouples rendering from physics updating, making even single threaded applications more resilient across hardware.


                                                              Worker is here
    Worker Time                                               | (0 + ratio*30ms)
    -30ms                 -16ms                   0           |
    --|---------------------|---------------------|-----------|---------
    Snapshot A                                  Snapshot B
    
    
                  Rendering is here
    Main Thread   | (A time + ratio*30ms)
    Snapshot A    |                             Snapshot B
    --|-----------|---------|---------------------|----------------------------

[Interpolated Physics Rendering]: http://kirbysayshi.com/2013/09/24/interpolated-physics-rendering.html

A Single Definition for an Entity
---------------------------------

Web Workers often necessitate a split of logic: visual things go into one file, and then non-visual things go into a file to be included by the worker. This is tricky and makes code harder to follow. Instead, entities are defined by one file, and included by both the worker and main thread. Then certain methods are only called within each context. For example `draw` would only be called within the main thread, while `update` would be called in the web worker.

This also means that the game world and state is effectively duplicated between the web worker and the main thread. While this increases memory consumption, the goal of this experiment is to prove that the CPU gains (more effective time) outweigh.

A Very Simple Entity System
---------------------------

Otherwise known as a factory or record system. The idea is that given a string id, an entity should either be returned, or constructed and returned. It maintains an internal map of constructed entities. In this experiment, the system is also responsible for [creating the ids](lib/boidmanager.js) itself.

```js
// Instead of:
var boid = new Boid(x, y, radius);

// Do this once...
var boidman = new BoidManager;

// And then make a new boid:
var x = 10;
var y = 10;
var radius = 2;
var boid = boidman.getinate(null, [x, y, radius]);
console.log(boid.id);
// => "boid_1"

// And then somewhere else in your code...
var boid = boidman.getinate("boid_1");
console.log(boid.x);
// => 10
```

A Standard Protocol for Communication (Snapshots)
-------------------------------------------------

If an entity needs to be in both the main thread and worker thread at once, it is expected that it will conform to two constraints:

- It contains an `id` property that can be used to easily retrieve an instance of it, either by an Entity system or other, and that `id` is the same in both contexts
- It implements two methods: `readFromSnapshot(snapshot)` and `writeToSnapshot(out)`

For an example of the `id`, see [boid.js](lib/boid.js) and [boidmanager.js](lib/boidmanager.js).

The two snapshot methods are basically a way for a entity to serialize and deserialize itself to a plain object and back. For example, if an entity requires that it maintain a position:

```js
function Something() {
  this.x = 20;
  this.y = 10;
  this.id = 'someid_01'; // Should be assigned by entity system
}
```

It is expected that those properties will be read and written to when writing and reading a snapshot respectively:

```js
Something.prototype.readFromSnapshot(snapshot) {
  this.x = snapshot.x;
  this.y = snapshot.y;
  this.id = this.id || snapshot.id;
}

Something.prototype.writeToSnapshot(snapshot) {
  snapshot.x = this.x;
  snapshot.y = this.y;
  snapshot.id = this.id;
  return snapshot;
}
```

`readFromSnapshot` can be thought of an initializer function. In both cases, `snapshot` is expected to be a flat data structure that can be easily cloned or serialized to JSON. This is to ensure that eventually object pooling can reduce the amount of garbage generated by creating new snapshots. In addition, during [benchmarking][] I found that Firefox and Chrome both _generally_ performed better with simple objects vs complex ones.

By implementing these methods, an object can be logically thought of as a single entity whether in a separate thread or not (hopefully).

[benchmarking]: http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/3
[browserify]: https://github.com/substack/node-browserify
[webworkify]: https://github.com/substack/webworkify

Addendum
========

Inspiration and Reading List
----------------------------

Great inspiration for the current conventions of this engine came from reading about [id Tech][] engines, especially 2 (Quake 1 and 2), 3 (Quake 3), and 4 (Doom 3). Special thanks goes out to [Fabien Sanglard][] who made great writeups on the high-level ideas behind the id Tech engines.

Here are most of the articles I've read while creating this experiment:

* Age of Empires Networking challenges on a dial up modem
  * http://www.gamasutra.com/view/feature/3094/

* X-Wing vs TIE Fighter networking on dial up (4v4!)
  * http://www.gamasutra.com/view/feature/3374/the_internet_sucks_or_what_i_.php

* Several articles from Fabien Sanglard about id Tech
  * http://fabiensanglard.net/quake3/network.php
  * http://fabiensanglard.net/doom3_documentation/The-DOOM-III-Network-Architecture.pdf
  * http://fabiensanglard.net/doomIphone/index.php
  * http://fabiensanglard.net/doom3_documentation/DOOM-3-BFG-Technical-Note.pdf

* id Tech 5 Technical challenges paper
  * http://s09.idav.ucdavis.edu/talks/05-JP_id_Tech_5_Challenges.pdf

* John Carmack's .plan archive from 1998, discussing input journaling
  * http://fd.fabiensanglard.net/doom3/pdfs/johnc-plan_1998.pdf#page56

* Bugs from Chromium discussing Web Workers' lack of hi-res time and semantics
  * http://code.google.com/p/chromium/issues/detail?id=85686
  * http://code.google.com/p/chromium/issues/detail?id=169318

It turns out that a client/server model maps fairly well to the web, even when not implementing multiplayer or servers in the web sense!

[id Tech]: http://en.wikipedia.org/wiki/Id_Tech
[Fabien Sanglard]: http://fabiensanglard.net/

Benchmarks
----------

So far I've created a few benchmarks to attempt to understand the black box that is the Web Worker [postMessage][].

This attempts to discern how Chrome and Firefox handle serializing and deserializing objects vs strings using the structured clone algorithm:

> http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/2

This next revision adds in a nested object to compare:

> http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/3

[postMessage]: https://developer.mozilla.org/en-US/docs/Web/API/Worker.postMessage
[structured clone algorithm]: https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/The_structured_clone_algorithm


It's Easy to DOS Your Render Thread
-----------------------------------

While transitioning between architecture iterations 1 and 2 (discussed below) I discovered that it's easy to overwhelm the rendering (main) thread by having the working constantly emit messages. This was especially true in Firefox. I was relying on the "server" to emit a `tick` message that contained the newest interpolation value for rendering, but it was completely destroying FF's (and sometimes Chrome's, depending on hardware) ability to process the main thread in time.

For future reference, that looks like this:

```js
// worker.js
var lastTime = Date.now();
setInterval(function() {
  var now = Date.now();
  // Tell the main thread how much time has passed.
  postMessage({ type: 'tick', delta: now - lastTime });
  lastTime = now;
}, 10);


// main.js
worker.addEventListener('message', function(ev) {
  // Do something with ev.delta
})
```

Prior Architecture Attempts
===========================

I have gone through a few iterations of this experiment.

Iteration 01
------------

The first was where the main thread "controlled" the worker thread by sending messages to the worker when it was time (every 33ms) to generate the next set of physics calculations.

The code is available for browsing: https://github.com/kirbysayshi/multithreaded-game-example/tree/iteration-01.

It looked like this:

    |             Client             |           msgqueue         |          Server          |
    ------------------------------------------------------------------------------------------
    |                                |                            |                          |
    | rAF => ssi.update(trueDT)      |                            |                          |
    | ssi --->                       | "logics"                   |                          |
    | ssi --->                       | "graphics"                 |                          |
    | > "graphics" => drawAll()      |                            |                          |
    |                                |                            | > "logics" => update()   |
    |                                | "boid updates"             | <---                     |
    | > "boid updates" => updateAll()|                            |                          |
    |                                |                            |                          |

Terms:

* rAF: requestAnimationFrame
* ssi: StepStateInterpolator. Given a true elapsed time since the last, it called a single function every time (graphics) and a second function only as often as needed (physics). For more information, see [Interpolated Physics Rendering][].
* server: The worker code, not a remote server.
* msgqueue: An attempt to visualize the "stack" of `postMessage`(s) waiting to be processed by either client or "server".

This caused huge jitter artifacts from needing to wait for the message roundtrip from the client to server to client. Oftentimes, the boid updates would arrive before the interpolation message would arrive, causing a really gross jitter.

This first iteration also had an entity split between its "lightweight" [data representation][] and the [physics-enabled representation][], and did not contain an entity manager, instead relying on specific messages to be passed to [create][] or [update][] entities.

[create]: https://github.com/kirbysayshi/multithreaded-game-example/blob/01189621c72ef3ad43106d2783cb2cee04cc3fc4/single.js#L21
[update]: https://github.com/kirbysayshi/multithreaded-game-example/blob/01189621c72ef3ad43106d2783cb2cee04cc3fc4/single.js#L26
[data representation]: https://github.com/kirbysayshi/multithreaded-game-example/blob/01189621c72ef3ad43106d2783cb2cee04cc3fc4/lib/boiddata.js
[physics-enabled representation]: https://github.com/kirbysayshi/multithreaded-game-example/blob/01189621c72ef3ad43106d2783cb2cee04cc3fc4/lib/boid.js

Iteration 02
------------

This is the [current iteration][], described above. In contrast to the first iteration, this one allows the worker to drive the simulation, only emitting state changes when the next simulation step is finished, and decouples rendering from the simulation itself.

[current iteration]: https://github.com/kirbysayshi/multithreaded-game-example/tree/iteration-01

Future Iteration
----------------

Next is to separate the simulation [worker.js](lib/worker.js) from message passing, and to enable keyboard and mouse input to be proxied from the main thread to the worker.

Once [transferrable objects][] are expanded beyond typed arrays (ArrayBuffer) and MessagePorts, it's possibe that rendering could actually occur in a web worker, opening huge possibilities!

[transferrable objects]: https://developer.mozilla.org/en-US/docs/Web/API/Transferable

As a possible future future version, put the worker on a server somewhere and have it push to a simple rendering client for a shared, realtime experience. This would entail the server maintaining how many frames have passed as well as how "ahead" each client is due to latency and differences in hardware, and is much closer to the architecture of the id Tech 3 engine (Quake 3).