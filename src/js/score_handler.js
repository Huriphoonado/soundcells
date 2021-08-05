import * as Tone from 'tone';

import TinyTheory from './tiny_theory';

// Data structure that tracks the state of the document and represents the score
// Contains a synthesizer for playback
class ScoreHandler {
    constructor() {
        this.default = {
            metadata: {
                X: "1",
                T: "Sketch",
                K: "C",
                L: "1/4",
                M: "4/4",
                Q: "120"
            },
            music: "| z4 |]"
        }

        this.scoreStructure = [];
        this.errorList = [];

        this.currentPosition = {measures: [], events: []};

        this.synth = setupSynth();
        this.audioStarted = false;
        this.playback = {
            score: [],
            duration: 0
        }

        let self = this;
        this.playback.part = new Tone.Part(((time, ev) => {
            self.synth.triggerAttackRelease(ev.note, ev.duration, time);
        }), this.playback[this.playback.mode]);
    }

    // Iterates through a syntax tree and generates an event list
    // with useful information
    // 1. Create a flat list extracting the nodes we care about
    // 2. Structure it by grouping notes by measure and metadata
    // 3. Add local music information and convert to scientific notation
    generateScoreStructure(treeCursor, editorState) {
        let flatList = []; // list of nodes and some information
        this.errorList = []; // Reset error list

        let newStructure = [
            {
                metadata: {...this.default.metadata},
                // measures: [] // to be added later
            }
        ];

        // ------------------ 1. ------------------

        treeCursor.firstChild(); // Enter the tree
        do {
            let syntaxNode = treeCursor.node;
            console.log(syntaxNode.type.name);

            // Filter out errors (keep separate) and comments (throw away)
            // Create a flat list of top-level nodes that we care about
            if (!['Comment', 'Program'].includes(syntaxNode.type.name)) {
                let newElems = handleNode(syntaxNode, treeCursor, editorState);
                newElems.forEach(el => {
                    if (el.name == '⚠') this.addError(el)
                    else {
                        if ('⚠' in el) this.addError(el, 'warning');
                        flatList.push(el)
                    };
                });
            }
        } while (treeCursor.nextSibling());

        // ------------------ 2. ------------------

        let unfinishedMeasure = false;
        let section = 0;
        let measureCount = 0;
        let currentMeasure;
        //console.log(flatList);
        flatList.forEach((o, i) => {

            // Metadata
            if (o.name == 'Metadata') {
                // If there is already music, create a new section
                if (newStructure[section].measures != undefined) {
                    // Can't add metadata in middle of a measure
                    if (newStructure[section].measures.slice(-1)[0].position != undefined &&
                    newStructure[section].measures.slice(-1)[0].position.length == 1) {
                        unfinishedMeasure = newStructure[section].measures.pop();
                    }

                    newStructure.push({ metadata: {} });
                    section += 1;
                }
                // Add the metadata
                let { k, v } = handleMetadata(o);
                newStructure[section]['metadata'][k] = v;
            }

            // Music
            else {
                // No notes at all - Create an optional pickup measure
                if (newStructure[0].measures == undefined) {
                    newStructure[section].measures = [];
                    newStructure[section].measures.push({
                        measure: 0,
                        barlines: [],
                        position: [0],
                        events: [],
                    });
                }
                // No notes in the current section
                else if (newStructure[section].measures == undefined) {
                    newStructure[section].measures = [];
                    if (unfinishedMeasure) {
                        newStructure[section].measures.push(unfinishedMeasure);
                        unfinishedMeasure = false;
                    }
                    else {
                        newStructure[section].measures.push({
                            measure: measureCount,
                            barlines: [],
                            position: [],
                            events: [],
                        });
                    }
                }
                currentMeasure = newStructure[section].measures.slice(-1)[0];

                if (o.name == 'Barline') {
                    currentMeasure.barlines.push(o.rawText);
                    currentMeasure.position.push(o.position[0]);
                    if (!(measureCount == 0 &&
                          currentMeasure.position.length == 0)) {
                          measureCount += 1;
                          newStructure[section].measures.push({
                              measure: measureCount,
                              barlines: [o.rawText],
                              position: [o.position[1] - 1],
                              events: [],
                          });
                      }
                }
                // The first measure may not have a left barline so use
                // the position of the first element
                else {
                    if (measureCount == 0 &&
                        currentMeasure.position.length == 0) {
                        currentMeasure.position.push(o.position[0]);
                    }
                    currentMeasure.events.push(o);
                }
            }
        });

        // If there is any hanging music at the end, add it in
        if (unfinishedMeasure) {
            newStructure.slice(-1)[0].measures = [unfinishedMeasure];
        }

        // Algorithm Limitation - Each barline starts a new measure
        // Meaning, the final barline comes with a new empty measure
        // If the last list of events is empty - remove it
        if (newStructure.slice(-1)[0].measures) {
            let lastMeasure = newStructure.slice(-1)[0].measures.slice(-1)[0];
            if (!lastMeasure.events.length) newStructure.slice(-1)[0].measures.pop();
        }
        // ------------------ 3. ------------------

        // Finally, add music context and create standard note strings
        let runningMetadata = {};

        let runningDuration = 0;
        let newPlaybackScore = [];

        newStructure.forEach(s => {
            runningMetadata = {
                ...runningMetadata,
                ...s.metadata
            }

            // Used for calculating the timing of typed events
            Tone.Transport.timeSignature = runningMetadata.M.split("/").map(n => +n);
            Tone.Transport.bpm.value = TinyTheory.extractTempo(runningMetadata.Q);

            if (s.measures) {
                s.measures.forEach(m => {
                    m.duration = 0;
                    m.events.forEach(e => {
                        if (["Note", "Chord", "Rest"].includes(e.name)) {
                            e.scientificNotation = TinyTheory.abcToScientific(e, runningMetadata, Tone);
                            m.duration += e.scientificNotation.measureFrac; // Total Measure duration

                            // Audio Playback objects
                            e.scientificNotation.time = runningDuration;
                            newPlaybackScore.push({
                                note: e.scientificNotation.note,
                                duration: e.scientificNotation.seconds,
                                time: e.scientificNotation.time
                            });
                            runningDuration += e.scientificNotation.seconds;
                        }
                    });
                    m.isComplete = (Math.abs(m.duration - 1) < 0.01 ||
                                    m.measure == 0);
                    m.comment = m.measure == 0 ? 'Pickup'
                              : m.duration - 1 > 0.01 ? 'Overfilled'
                              : m.duration - 1 < -0.01 ? 'Underfilled'
                              : m.position.length < 2 ? 'No right barline'
                              : 'Valid'
                });
            }
        });

        this.scoreStructure = newStructure;
        console.log(this.scoreStructure);

        // Audio Playback objects
        this.playback.duration = runningDuration;
        this.playback.score = newPlaybackScore;
        this.scheduleEvents();

        return { abc: this.getABCOutput(), errorList: this.errors };
    }

    addError(obj, severity="error") {
        if (obj.position[0] == obj.position[1]) return; // ignore no-character errors
        let newError = {
            from: obj.position[0],
            to: obj.position[1],
            severity: severity,
        };
        let errType = obj.name == '⚠' ? `ABC ${severity}:` : `${obj.name} ${severity}:`;
        let errSourceText = obj.rawText;

        // case where broken text in the middle of a node
        if ('⚠' in obj) {
            let errText = obj['⚠'];
            let rawText = obj['rawText'];

            // substring error
            // Example assss2 => ssss is the error, while a2 is valid note
            let errIndex = rawText.indexOf(errText);
            if (errIndex != -1) {
                newError.from = obj.position[0] + errIndex;
                newError.to = obj.position[0] + errIndex + errText.length;
                errSourceText = errText;

                // Modifies the raw text to improve output!! (Maybe not great?)
                obj['rawText'] = rawText.replace(errText, '');
            }
        }
        newError.message = `${errType} '${errSourceText}' can't be processed and is ignored.`;
        this.errorList.push(newError);
    }

    // Returns an object containing the current measure and event that the
    // cursor is on - both properties may be empty
    // Does not support highlighting or multiselect yet
    updatePosition(selection) {
        this.currentPosition = {measures: [], events: []};
        if (!this.hasNotes()) return this.currentPosition;

        try {
            let from = selection.ranges[0].from; // works only for single range
            let to = selection.ranges[0].to;
            let allMeasures = [];
            let allEvents = [];
            let allNotes = this.scoreStructure.forEach(section => {
                section.measures.forEach(measure => {
                    allMeasures.push(measure);
                    measure.events.forEach(ev => allEvents.push(ev));
                });
            });

            this.currentPosition.measures = allMeasures.filter(m => {
                let start = m.position[0];
                let end = (typeof m.position[1] !== "undefined") ? m.position[1]
                        : m.events.slice(-1)[0].position[1];
                return (from > start && to <= end);
            })

            this.currentPosition.events = allEvents.filter(ev => {
                let start = ev.position[0];
                let end = ev.position[1];
                return (from > start && to <= end); // Does not work for highlighting
            });

            this.setLoopPoints();

        }
        catch(e) { console.log(e); }
        finally { return this.currentPosition; }
    }

    getCurrentPosition() { return this.currentPosition }

    // Iterate through the store structure and generate an error-free
    // score string
    getABCOutput() {
        if (!this.scoreStructure) return false;

        let abcOutput = "";

        this.scoreStructure.filter((s, i) =>  (i == 0 || s.measures.length || s.metadata.W || s.metadata.w) )
        .forEach(s => {
            for (const k in s.metadata) { abcOutput += `${k}:${s.metadata[k]}\n` };
            if (s.measures) {
                s.measures.forEach(m => {
                    m.events.forEach(ev => abcOutput += ev.rawText.replace(/\s+/g, ''));
                    if (m.barlines[1]) abcOutput += m.barlines[1];
                    else if (m.position.length == 2) abcOutput += m.barlines[0];
                });
            }
            abcOutput += '\n'; // abc scores terminate with newlines
        });

        if (!this.hasNotes()) abcOutput += this.default.music += '\n';

        return abcOutput;
    }

    // Check if the user has written any notes
    hasNotes() {
        if (!this.scoreStructure) return hasANote;

        // This is sweet - fix some of the other nested places with this!
        return this.scoreStructure
            .map(s => s.measures).filter(m => typeof m !== "undefined").flat() // list of measures
            .map(m => m.events).filter(e => typeof e !== "undefined").flat() // list of events
            .filter(n => ["Note", "Chord", "Rest"].includes(n.name))
            .length ? true : false;
    }


    // Audio Playback functions
    playNote() {
        if (!this.audioStarted) return this.startAudio().then(this.playNote());
        let evList = this.getCurrentPosition().events;
        if (evList.length == 0) return;
        let ev = evList[0]; // Could support higlighted group

        if (ev.name == 'Note' || ev.name == 'Chord') {
            let note = ev.scientificNotation.note;
            let duration = ev.scientificNotation.seconds;
            this.synth.triggerAttackRelease(note, duration);
        }
    }

    playPause() {
        if (Tone.Transport.state == "started") this.pause();
        else {
            if (Tone.Transport.loop) this.play(Tone.Transport.loopStart);
            else this.play();
        }

        return this.getPlaybackState();
    }

    play(startTime) {
        if (!this.audioStarted) return this.startAudio().then(this.play(startTime));

        if (!startTime) Tone.Transport.start("+0.01"); // undefined or 0
        else Tone.Transport.start("+0.01", startTime);
    }

    pause() { Tone.Transport.pause(); this.synth.releaseAll(); }
    stop() { Tone.Transport.stop(); this.synth.releaseAll(); }

    getPlaybackState() {
        return {
            state: Tone.Transport.state,
            seconds: Tone.Transport.seconds,
            loopStart: Tone.Transport.loopStart,
            loopEnd: Tone.Transport.loopEnd,
            loop: Tone.Transport.loop
        }
    }

    getErrorList() { return this.errorList; }

    // Add audio playback events to the Tone timeline
    scheduleEvents() {
        Tone.Transport.cancel(0);
        let self = this;
        self.playback.score.forEach(ev => {
            Tone.Transport.schedule((time) => {
                self.synth.triggerAttackRelease(ev.note, ev.duration);
            }, ev.time);
        });
        Tone.Transport.schedule((time) => {
            Tone.Transport.stop()
        }, self.playback.duration + 0.1);

        //Tone.Transport.stop(self.playback.duration + 0.1);
    }

    // Currently works for the current measure
    setLoopPoints() {
        if (!(this.hasNotes())) {
            Tone.Transport.setLoopPoints(-1, -0.9);
            return;
        }

        // Defaults for when there are no notes in the measure
        let firstNoteTime = -1;
        let lastNoteTime = -0.9;

        try {
            firstNoteTime = this.currentPosition
                                    .measures[0]
                                    .events[0]
                                    .scientificNotation.time;
            lastNoteTime = this.currentPosition
                                    .measures.slice(-1)[0]
                                    .events.slice(-1)[0]
                                    .scientificNotation.time +
                                this.currentPosition
                                    .measures.slice(-1)[0]
                                    .events.slice(-1)[0]
                                    .scientificNotation.seconds;

        } catch (e) {
        } finally { Tone.Transport.setLoopPoints(firstNoteTime, lastNoteTime); }
    }

    toggleLoop() {
        Tone.Transport.loop = !Tone.Transport.loop;
        Tone.Transport.stop(); // Reset Playback head
        return this.getPlaybackState();
    }

    // Ensures the audio context is running, since browsers disable it by default
    // The optional callback will only be called if the context needs to be
    // turned on
    startAudio() {
        let self = this;
        if (self.audioStarted) return;

        return Tone.start().then(self.audioStarted = true);
    }
}

// Helper Functions
// Largely these convert from one form of data to another

// Grabs relevent information from a syntax node
// Returns a list because some nodes may return multiple elements
let handleNode = function(node, treeCursor, editorState) {
    let fs = {
        'Chord': handleChord,
        'Note': handleNote,
        'Rest': handleNote,
        'DottedRhythm': handleDotted
    };
    let name = node.type.name;

    let res = (name in fs) ? fs[name](node, treeCursor, editorState)
                         : extractGenericInfo(node, treeCursor, editorState);

    let resArray = Array.isArray(res) ? res : [res];
    return (resArray); // ensure list
}

// Information attached to any node we care about like what it is,
// it's content, and where it is in the editor
let extractGenericInfo = function(node, treeCursor, editorState) {
    return {
        name: node.type.name,
        rawText: editorState.sliceDoc(treeCursor.from, treeCursor.to),
        position: [treeCursor.from, treeCursor.to],
    };
}

// Notes and Rests
let handleNote = function(node, treeCursor, editorState,) {
    let noteObj = extractGenericInfo(node, treeCursor, editorState);


    noteObj['preText'] = "";  // default values
    noteObj['postText'] = ""; // Include as optional arg?
    noteObj['duration'] = "1";
    if (noteObj.name == 'Note') {
        noteObj['accidental'] = "";
        noteObj['octave'] = "";
    }

    let includedMusicInfo = {};
    let localCursor = node.cursor;
    localCursor.firstChild();
    do {
        let contentType = localCursor.node.type.name.toLowerCase();
        let content = editorState.sliceDoc(localCursor.from, localCursor.to);
        includedMusicInfo[contentType] = content;
    } while (localCursor.nextSibling());

    if (noteObj.name == 'Note' && includedMusicInfo.pitch == undefined) {
        noteObj.name = '⚠';
    }

    // Merge so that the included music info overwrites the defaults
    return {
        ...noteObj,
        ...includedMusicInfo
    };
}

// Maybe these should be internal functions...
let handleChord = function(node, treeCursor, editorState) {
    let chordObj = extractGenericInfo(node, treeCursor, editorState);
    chordObj['preText'] = "";
    chordObj['postText'] = "";

    try {
        let notesInChord = [];
        let localCursor = node.cursor;

        localCursor.firstChild();
        do {
            let localNode = localCursor.node;
            if (localNode.type.name == "Note") {
                let newNote = handleNote(localNode, localCursor, editorState);

                // For some reason, the parser will fill in a blank note node
                // to complete the parse even if there are are no notes
                if (newNote.pitch == undefined) throw "Empty Chord.";

                // fix this - should fix text and limit to error
                // Or, handleNote should be in charge of errors
                if ('⚠' in newNote) throw "Incorrect Chord.";;
                notesInChord.push(newNote);
            }
        } while (localCursor.nextSibling());

        chordObj['notes'] = [];
        chordObj['duration'] = notesInChord[0].duration;
        notesInChord.forEach(nObj => { // pre/postText | positions here?
            chordObj.notes.push({
                pitch: nObj.pitch,
                accidental: nObj.accidental,
                octave: nObj.octave,
                duration: notesInChord[0].duration, // first note determines all
                rawText: nObj.rawText,
                name: 'Note'
            });
        });

    }
    catch (e) { chordObj.name = '⚠'; }
    finally { return chordObj; }
}

// Takes a Dotted rhythm node and returns two note or chord children
// Example ABC: _A4 >> [bde]
let handleDotted = function(node, treeCursor, editorState) {
    let localCursor = node.cursor;
    let dottedGroup = [];
    let dottedNode;
    let funcs = {
        'Chord': handleChord,
        'Note': handleNote,
        'Rest': handleNote,
    }
    // Extract the inner text and process the outer node
    try {
        localCursor.firstChild();
        do {
            let localNode = localCursor.node;
            let name = localNode.type.name;

            if (name == 'Dot')  {
                dottedNode = extractGenericInfo(localNode, localCursor, editorState);
            }

            else {
                dottedGroup.push(funcs[name](localNode, localCursor, editorState));
            }

        } while (localCursor.nextSibling());

        // The middle dot affects the two outer note/chord/rest nodes
        dottedGroup[0].postText = dottedNode.rawText;
        dottedGroup[0].rawText += dottedNode.rawText;
        dottedGroup[0].position[1] = dottedNode.position[1];

        dottedGroup[1].preText = dottedNode.rawText;

    }
    catch (e) {
        dottedGroup = extractGenericInfo(node,treeCursor, editorState);
        dottedGroup.name = '⚠';
    }
    finally { return dottedGroup; }
}

// Takes a metadata string and returns a keyvalue pair
// Certain metadata have specific
let handleMetadata = function(md, def={K:'c', L:'1/4', M:'4/4', Q: 120}) {
    let newMetadata = md.rawText.split(":");
    let k = newMetadata.shift();
    let v = newMetadata.join('').trim();

    // Special Cases - Tempo, Base Duration, Time Sig,  KeySig
    if (k == "K" && !TinyTheory.isValidKey(v)) {
        // throw error;
        v = def.K;
    }

    if (k == "L" && !TinyTheory.isValidUnitNoteLength(v)) {
        // throw error
        v = def.L;
    }

    if (k == "M" && !TinyTheory.isValidTimeSig(v)) {
        // throw error
        v = def.M;
    }

    if (k == "Q" && !TinyTheory.isValidTempo(v)) {
        // throw error
        v = def.Q;
    }

    return {k, v}
}

// Tone.js Synthesizer setup
let setupSynth = function() {
    let synth = new Tone.PolySynth(Tone.FMSynth);
    synth.set({
        "harmonicity":5,
        "modulationIndex": 10,
        "oscillator" : {
            "type": "sine"
        },
        "envelope": {
            "attack": 0.001,
            "decay": 2,
            "sustain": 0.1,
            "release": 2
        },
        "modulation" : {
            "type" : "square"
        },
        "modulationEnvelope" : {
            "attack": 0.002,
            "decay": 0.2,
            "sustain": 0,
            "release": 0.2
        }
    })

    let verb = new Tone.Reverb();

    synth.connect(verb).toDestination();

    return synth;
}

export { ScoreHandler };

/*
Event List
[
    {
        measure: 1,
        barlines: ['|', '|'],
        position: [10, 12],
        isComplete: true,
        status: 'complete' | 'missing end bar' | 'too many notes' | 'too few notes',
        events: [
            {
                type: ..., 'Note, Chord, Rest'
                position: ...,
                standard: ..., // string or list of strings
                rawABC: ...,
            }
        ]
    }
]

Errors List
[
    {
        error:
        position:
        line: ?
    }
]

*/
