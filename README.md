

Thread Communication
--------------------


Original Architecture (Single)
------------------------------

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

This caused huge jitter artifacts from needing to wait for the message roundtrip from the client to server to client. Oftentimes, the boid updates would arrive before the interpolation message would arrive, causing a really gross jitter.




Client:
(unfortunately) Rendering
Input handling/buffering (quit, pause, etc)

Server:
Game timing
Physics
Entity Management
Game Logic



Client                      msgqueue                          Server
                                                              <--- "tick"
                            "tick"
> "tick" => 


Both client and server use same Boid, each calls ReadFromSnapshot and WriteToSnapshot respectively

Server  -> ticks along using setTimeout + ssi...
        -> computes entity/physics tick
        -> emits "tick" containing:
        {
           frameNumber: 0
           frameTime: (end of tick - start of tick)
           clientAheadTime: (last input received time - current game engine time?)
           entities: []
        }
        -> continues ticking...
        -> if more than X ticks emitted with no ack, stop or something

Client  -> receives "tick"
        -> for each in entities
          if not exists, create
          store current properties in update as previous
          apply update
        -> posts ack to Server == "tick processed"

        -> ticks along using rAF + interpolatedAccumulator
        -> renders as often as possible

        -> receives input
        -> immediately posts input to Server


Future Options:

Implement the canvas api to operate on a raw array or ImageData, which can then be directly transported to the main thread for putImageData.


It's Easy to DOS Your Render Thread
-----------------------------------

While transitioning to above-ish, I discovered that it's easy to overwhelm the rendering (main) thread by having the working constantly emit messages. This was especially true in Firefox. I was relying on the "server" to emit a `tick` message that contained the newest interpolation value for rendering, but it was completely destroying FF's (and sometimes Chrome's, depending on hardware) ability to process the main thread in time.

TODOS:
======

- How should this sim handle physics steps taking too long? Right now they are still processed but build up.


Resources
=========

Things I read while creating this.

http://www.gamasutra.com/view/feature/3094/ (Age of Empires)
http://www.gamasutra.com/view/feature/3374/the_internet_sucks_or_what_i_.php (X-Wing vs TIE Fighter)
http://fabiensanglard.net/quake3/network.php
http://fabiensanglard.net/doom3_documentation/The-DOOM-III-Network-Architecture.pdf
http://fabiensanglard.net/doomIphone/index.php
http://fabiensanglard.net/doom3_documentation/DOOM-3-BFG-Technical-Note.pdf
http://s09.idav.ucdavis.edu/talks/05-JP_id_Tech_5_Challenges.pdf
http://fd.fabiensanglard.net/doom3/pdfs/johnc-plan_1998.pdf#page56

http://code.google.com/p/chromium/issues/detail?id=85686
http://code.google.com/p/chromium/issues/detail?id=169318 (high resolution timers in workers)

FF Worker RunLoop: https://github.com/mozilla/gecko-dev/blob/e11313960c3b17b4b846af34288722795ec2f260/dom/workers/WorkerPrivate.cpp#L3968

Things I created while creating this:

http://jsperf.com/postmessage-debugging-in-ff/2
http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/2
http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/3 (nested vs not)