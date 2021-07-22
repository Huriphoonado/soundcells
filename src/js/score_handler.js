import TinyTheory from './tiny_theory';

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
            music: "z4 |]"
        }

        this.scoreStructure = [];
        this.errorList = [];
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
        while (treeCursor.nextSibling()) {
            let syntaxNode = treeCursor.node;
            console.log(syntaxNode.type.name);

            // Filter out errors (keep separate) and comments (throw away)
            // Create a flat list of top-level nodes that we care about
            if (syntaxNode.type.name != 'Comment') {
                let newElems = handleNode(syntaxNode, treeCursor, editorState);
                newElems.forEach(el => {
                    if (el.name == '⚠') this.addError(el)
                    else flatList.push(el);
                });
            }
        }

        // ------------------ 2. ------------------

        let unfinishedMeasure = false;
        let section = 0;
        let measureCount = 1;
        let currentMeasure;
        console.log(flatList);
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
                // No notes yet - create a new measure list
                if (newStructure[section].measures == undefined) {
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
                    if (!(measureCount == 1 &&
                          currentMeasure.position.length == 0)) {
                          measureCount += 1;
                          newStructure[section].measures.push({
                              measure: measureCount,
                              barlines: [o.rawText],
                              position: [o.position[1]],
                              events: [],
                          });
                      }
                }
                // The first measure may not have a left barline so use
                // the position of the first element
                else {
                    if (measureCount == 1 &&
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

        // Algorithm Limitation - Each barline adds an empty measure
        // Meaning, the final barline
        // If the last list of events is empty - remove it
        if (newStructure.slice(-1)[0].measures) {
            let lastMeasure = newStructure.slice(-1)[0].measures.slice(-1)[0];
            if (!lastMeasure.events.length) newStructure.slice(-1)[0].measures.pop();
        }
        // ------------------ 3. ------------------
        // Finally, add music context and create standard note strings
        let runningMetadata = {};
        newStructure.forEach(s => {
            runningMetadata = {
                ...runningMetadata,
                ...s.metadata
            }
            if (s.measures) {
                s.measures.forEach(m => {
                    m.duration = 0;
                    m.events.forEach(e => {
                        e.scientificNotation = TinyTheory.abcToScientific(e, runningMetadata);
                        m.duration += e.scientificNotation.measureFrac;
                    })
                    m.isComplete = (m.duration == 1);
                    m.comment = m.duration > 1 ? 'Too many events.'
                              : m.duration < 1 ? 'Too few events.'
                              : m.position.length < 2 ? 'Missing right barline.'
                              : 'Valid.'
                });
            }
        });

        // If any music arrays are empty add the default blank line

        this.scoreStructure = newStructure;
        console.log(this.getABCOutput());
        return {abc: this.getABCOutput(), errorList: this.errors};
    }

    addError(obj) { this.errorList.push(obj); }

    getElementByPosition(selection) {
        let result = {measures: [], events: []};
        if (!this.scoreStructure) return result;

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

        let measures = allMeasures.filter(m => {
            let start = m.position[0];
            let end = m.position[1] ? m.position[1]
                    : m.events.slice(-1)[0].position[1];
            return (from > start && to <= end);
        })

        let events = allEvents.filter(ev => {
            let start = ev.position[0];
            let end = ev.position[1];
            return (from > start && to <= end); // Does not work for highlighting
        });
        result.measures = measures;
        result.events = events;

        return result;
    }

    // Iterate through the store structure and generate an error-free
    // score string
    getABCOutput() {
        if (!this.scoreStructure) return false;

        let abcOutput = "";

        this.scoreStructure.filter((s, i) =>  (i == 0 || s.measures) )
        .forEach(s => {
            for (const k in s.metadata) { abcOutput += `${k}:${s.metadata[k]}\n` };
            if (s.measures) {
                s.measures.forEach(m => {
                    m.events.forEach(ev => abcOutput += ev.rawText.replace(/\s+/g, ''));
                    if (m.barlines[1]) abcOutput += m.barlines[1];
                    else if (m.position.length == 2) abcOutput += m.barlines[0];
                });
            }
            abcOutput += '\n';
        });

        if (!this.hasNotes()) abcOutput += this.default.music;

        return abcOutput;
    }

    // Check if the user has written any notes or barlines
    hasNotes() {
        if (!this.scoreStructure) return false;
        if (!this.scoreStructure[0].measures) return false;
        return (this.scoreStructure)
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

    return (Array.isArray(res) ? res : [res]); // ensure list
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

    // Merge so that the included music info overwrites the defaults
    return {
        ...noteObj,
        ...includedMusicInfo
    };
}

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
                if (newNote.pitch == undefined) throw "Empty or incorrect chord.";
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
// Example Group: _A4 >> [bde]
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
        console.log(dottedGroup[0]);
        dottedGroup[0].postText = dottedNode.rawText;
        dottedGroup[0].rawText += dottedNode.rawText;
        dottedGroup[0].position[1] = dottedNode.position[1];
        console.log(dottedGroup[0]);

        dottedGroup[1].preText = dottedNode.rawText;

    }
    catch (e) {
        console.log(e)
        dottedGroup = extractGenericInfo(node,treeCursor, editorState);
        dottedGroup.name = '⚠';
    }
    finally { return dottedGroup; }
}

// Takes a metadata string and returns a keyvalue pair
let handleMetadata = function(md) {
    let newMetadata = md.rawText.split(":");
    let k = newMetadata.shift();
    let v = newMetadata.join('').trim();

    return {k, v}
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
