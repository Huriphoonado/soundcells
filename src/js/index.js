import 'bootstrap';
import '../scss/custom.scss';

import {Extension, EditorState} from "@codemirror/state"
import {EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine} from "@codemirror/view"
import {Text} from "@codemirror/text"
import {history, historyKeymap} from "@codemirror/history"
import {lineNumbers, highlightActiveLineGutter} from "@codemirror/gutter"
import {defaultKeymap} from "@codemirror/commands"
import {HighlightStyle, defaultHighlightStyle} from "@codemirror/highlight"
import {bracketMatching} from "@codemirror/matchbrackets"
import {closeBrackets, closeBracketsKeymap} from "@codemirror/closebrackets"

import * as osmd from "opensheetmusicdisplay"

import {ABC} from "./abc_language.js"

import { ScoreHandler } from "./score_handler.js";

// import { Midi } from '@tonejs/midi';

// Variables
const starterABC = 'X: 1\nT: Sketch\nK: C\nL: 1/4\nM: 4/4\n| A B c d |]';
const scoreHandler = new ScoreHandler();

let timer; // Only send to flask server at a max interval

// Editor
// use parser syntaxTree
const abcThing = ABC();
let startState = EditorState.create({
    doc: starterABC,
    extensions: [
        lineNumbers(),
        history(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        drawSelection(),
        defaultHighlightStyle.fallback,
        bracketMatching(),
        closeBrackets(),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap
        ]),
        playback(scoreHandler),
        toggleLoop(scoreHandler),
        ABC(),
        EditorView.updateListener.of((v) => {
            let treeCursor = view.state.tree.cursor();
            if(v.docChanged) {
                let output = scoreHandler.generateScoreStructure(treeCursor, view.state);

                // Only post after groups of changes
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => sendABC(output.abc), 500 );
            }

            // Functions to be called after generateScoreStructure
            let currentPosition = scoreHandler.updatePosition(view.state.selection);
            showPosition(currentPosition);

            // Better way to do this? Keymap functions are called before the
            // view is updated so this checks the insertion
            playNoteWhenTyped(scoreHandler, v);
        }),
    ],
});

let view = new EditorView({
  state: startState,
  parent: document.getElementById('editor')
});

// Open Sheet Music Display
const visualScore = new osmd.OpenSheetMusicDisplay("score", {
  autoResize: true,
  backend: "svg",
  drawTitle: true,
  drawSubtitle: false,
  drawPartNames: false
});

// UI Visuals
function showPosition(currentPosition) {
    let outputString = "";
    //console.log(currentPosition);

    if (currentPosition.measures.length) {
        let m = currentPosition.measures[0];
        outputString += `Measure ${m.measure} (${m.comment}) -- `;
    }
    if (currentPosition.events.length) {
        let ev = currentPosition.events[0];
        let note = ev.scientificNotation.note ? ev.scientificNotation.note : 'rest';
        let dur = ev.scientificNotation.relativeDur;
        outputString += `Note ${note}, ${dur}`;
    }
    document.getElementById('info').innerHTML = outputString;
    return outputString;
}

// UI Sound
const playNoteWhenTyped = function(scoreHandler, v) {
    let pbState = scoreHandler.getPlaybackState();

    // Don't play notes if piece is looping
    if (pbState.state == 'started') return;

    if ((v.changes.inserted.length == 2)) {
        let inserted = v.changes.inserted[1].text[0];
        if (inserted.length == 1 &&
        "abcdefgABCDEFG,'_^0123456789".split("").includes(inserted)) {
            scoreHandler.playNote();
        }
    }
}

// Special Keys = "Shift-Ctrl-"
function playback(scoreHandler) {
  return keymap.of([{
    key: "Shift-Ctrl-" + "Space",
    run() { scoreHandler.playPause(); return true }
  }])
}

function toggleLoop(scoreHandler) {
  return keymap.of([{
    key: "Shift-Ctrl-" + "l",
    run() { scoreHandler.toggleLoop(); return true }
  }])
}

// GET/POST Functions
const sendABC = (abcCode) => {
    postData('/data', { userdata: abcCode })
    .then(data => {
        document.getElementById('braille').innerHTML = data.braille || "";
        if (data.musicxml) {
            visualScore.load(data.musicxml)
            .then( visualScore.render() )
        }
    })
}
//sendABC(starterABC);

async function postData(url = '', data = {}) {
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'same-origin', // no-cors, *cors, same-origin
    cache: 'default', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response.json(); // parses JSON response into native JavaScript objects
}

// A little hacky?? - This sets up the internal data structure before any
// input - Maybe store musicxml/braille defaults
scoreHandler.generateScoreStructure(view.state.tree.cursor(), view.state)
