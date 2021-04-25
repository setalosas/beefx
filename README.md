# beeFX Web Audio library & playground

beeFX is a collection of filters, audio effects, visualisers and other fun stuff for the Web Audio API.

![image](https://github.com/setalosas/beefx/blob/main/doc/dem8.jpg)

# The components of beeFX

The original goal was to make an extendable library of audio effects. As these filters are quite difficult to test without an existing audio environment, it appeared a good idea to create a test app. So the playground subproject was born to implement a testing tool, but then it grew beyond this original goal and became a full stand-alone interactive testing bed / experimenting lab with lots of Ui elements and attached components.

Although many parts of beeFX are implemented (and working), the project itself is in development phase. Thus the final architecture can change, but here are the components of the current concept:

## The beeFX library

There are lots of audio effects around on the web from different sources. However, they differ in their implementation. It's quite difficult to build a complex audio system if the elements are not standardized.

There are a few solutions which implements filters and effects as standardized elements, most notably Tuna, Note.js, Pizzicato, etc. However, I found it difficult or impossible to extend them with new filters or variations without tinkering the original source code.

So the most important feature goal of beeFX was the easy extensibility, new effects should be added easily as separate modules, using the common architecture of the library. Of course similar filters or variations can be grouped into one module.

Currently the beeFX library has over 60 effects or other Web Audio gadgets. These effects - at least the algorithm of them - are from various sources, but they were rewritten to fit the beeFX architecture. Many effects are in test phase, as there are different implementations for each filter, I tried a few variations and made a lot of experimental ones. (It's quite easy to write bad effects. However my goal is to make an audio library, not getting a PhD in DSP.) This collection must be cut down to a more standard set for a release, but at this moment this set is not defined yet. Also have to find out how to separate the different parts - like visualizations from effects, UIs from the core. Currently (almost) all effects or other audio components can be used in headless mode (just managing them from a program without UI) except of course the visualisation things for example.

The current goal here is to make a core effect library and a separate extension library for the not-so-standard elements.

Just a few examples of the current elements:

Core:
* Basic WAU filters
* IIR filters
* Equalizers
* Comvolvers (from impulse and reverb)
* BBC Ring Modulator
* Compressor
* etc.

Extensions:
* BPM detector
* Recorder
* Sampler
* Oscilloscope
* Spectrum
* etc.

In the wiki there is (or soon will be) a detailed desciption of how to create, connect and control a beeFX filter, it's basically works the same way as for every similar library.

## The beeFX Playground

![image](https://github.com/setalosas/beefx/blob/main/doc/golem.jpg)

Starting as a testing tool, the playground grew into an application where the user can define different audio sources and chains of effects for them in different channels (stages), something like a mixer board with effect modules.

The UI elements are not part of the core effect modules, they are generated automatically from the effects definition data (so the definition data containes properties which are only useful for the user interface, but this part is very thin).

The playground also contains infrastructure elements for building a multi-stage audio chain with sources (and players). This is not needed at all when using the effect library, just an option.

This repo itself is the playground at this moment, but I plan to put the components into different repos after the first development phase.

VID

## The beeFX Chrome Extension for youtube

The playground as a site has limits in the use of copyrighted music - of course I cannot include real songs with it. There is no much fun trying out a complex effect pipeline with free music or singing through the microphone, so from the beginning there was an option for upload and use any user files (mp3 or wav). However, not too many users have mp3s on their computer these days. So it seemed natural to use Youtube videos as audio sources - but here comes a wall again: embedded youtube iframes are closed, there is no way to access their audio output. Except of course if the playground runs on the youtube.com domain.

So as a very simple solution to that problem it can run on the youtube.com domain. This repo is also a Chrome extension - you have to load into Chrome with the 'Load unpacked' option on the chrome://extensions page.

There is a normal mode when you click on the bee in the bottom left corner and a full takeover mode if you click with the Shift key held down. This is useful because it kills the complete youtube page (it needs quite a lot resources).

So currently the playground can be used with local audio files, youtube videos and also with STEMs (parallel tracks for a song). For testing there is also a mock mode when it's possible to use Youtube videos if we have locally the audio files for them - there are many online downloading sites to get this files. 

# Installation

This is an unreleased library, there is no npm package yet, you can download the repo and try it (the index.html gives you a static site, the manifest allows you to use it as a Chrome extension on Youtube, the js/beefx folder contains the core library without the playground and UI elements.

Note: no dependencies, so you don't have to install anything. No external libraries, frameworks or packagers used, it's pure ES6 Javascript and this repo contains every line of code used in the library or the playground - no surprises. (Ok, there is one exception: we include the Youtube API for the Youtube embeds of course.)

# Acknowledgments
