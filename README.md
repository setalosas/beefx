# beeFX Web Audio library & playground

beeFX is a collection of filters, audio effects, visualisers and other fun stuff for the Web Audio API.

![image](https://github.com/setalosas/beefx/blob/main/doc/dem8.jpg)

# The components of beeFX

Although most of beeFX is working, the project itslef is in development phase.

The original goal was to make an extendable library of audio effects. As these filters are quite difficult to test without an existing audio environment, it appeared a good idea to create a test app. So the Playground subproject was born as a testing tool, but then it grew beyond this original goal and became a full stand-alone interactive testing bed with small Ui widgets for the effects.

## The beeFX library

There are lots of audio effects around on the web from different sources. However, they differ in implementation, it's quite difficult to build a complex system if the elements are not standardized.

There are a few solutions which implements filters anbd effects as standardized elements, most notably Tuna, Note.js and Pizzicato. However, it's not easy to extend them with new filters or variations without tinkering the original source code.

So the most important feature of beeFX was the easy extensibility, new effects should be added easily as separate modules, using the common architecture of the library. Of course similar filters or variations can be grouped into one module.

Currently the beeFX library has over 60 effects or other Web Audio gadgets. These effects - at least the algorithm of them - are from various sources, but they were rewritten to fit the beeFX architecture. Many effects are in test phase, as there are different implementations for each filter, I tried a few variations and made a lot of experimental ones. This must be cut down to a more standard set for a release, but at this moment this set is not defined. (Also have to find out how to separate the different parts - like visualizations from effects, UIs from the core.)

In the wiki there is detailed desciption of how to create, connect and control a beeFX filter, it's basically works the same way as for every similar library.

## The beeFX Playground

![image](https://github.com/setalosas/beefx/blob/main/readme/dem8.jpg)

Starting as a testing tool, the Playground grew into an application where the user can define different audio sources and chains of effects for them in different channels (stages).

VID

## The beeFX Chrome Extension for youtube

The Playground as a site has limits in the use of copyrighted music - I of course cannot include real songs on the site. There is an option for upload and use any user files (mp3 or wav) but not too many useres have mp3s on their computer these days. 
