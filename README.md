

Thread Communication
--------------------


Current Architecture (Single)
-----------------------------

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

Things I created while creating this:

http://jsperf.com/postmessage-debugging-in-ff/2
http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/2
http://jsperf.com/postmessage-from-worker-many-small-msgs-or-single-large/3 (nested vs not)