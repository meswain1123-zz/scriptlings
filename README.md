
### Scriptlings 

Scriptlings is an AI hobby project I've been working.  I got the idea after hearing about Screeps, but I've never actually played Screeps.  I downloaded it once, but didn't want to pay for something that I thought I'd have more fun making from scratch.  I later learned that I had done a lot of things very differently from how Screeps does it.  That's fine with me.  This is how I wanted to do it.  

As I've developed it I've experimented with a number of different programming technologies I had previously had little to no experience with.  This is a hobby project, so I haven't had the time or need to really do it right.  If you see this and want to contribute feel free to reach out to me.

### Building and Running

This uses two docker images, one for the client and one for the server.  The easiest way for me to run it is to have two terminals open to their directories and running 

npm start

in server and then in client.  I had it working in docker for a while, but I got busy with other things, and need to update my files for it.  It works with npm start.

### Current bugs

It has been having issues with dropped resources, gathering resources, movement, and possibly routing.  I think I've figured out the issues with dropped resources and some of the issues with gathering resources.
I think there may also be an issue where gathering resources is not properly pulling them out of their worldResource nodes.  I haven't verified this though.  It could just be me being paranoid.
In the 'default mind script' when I've got it going to a place close enough to a node to gather, I think it's ending up a little shy of where it's supposed to go.  This could be a problem with movement or routing, but I think it's the calculations of where to go.
LocationHash isn't properly removing scriptlings from old location when moving.  
Movement doesn't seem like it's working right.  Not always putting it in right locationHash? (Make sure it is rounding the coords) and maybe not updating db?
It looks like there must be 2 places where it's updating scriptling locations.  Look into the possibility of it being a reference issue.
I think I may have tracked down the movement issues to the RouteTo function.  I'm suspecting that the routing process is accidentally changing the location of the scriptling.  This change may not be happening in the db, maybe not immediately,or maybe it is.  Not sure.  Anyway, it looks to me like that's what's happening.
I think I've fixed that issue.  Haven't tested it yet.