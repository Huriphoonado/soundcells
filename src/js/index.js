import * as bootstrap from 'bootstrap';
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
import {linter, lintKeymap} from "@codemirror/lint"

import * as osmd from "opensheetmusicdisplay"

import {ABC} from "./abc_language.js"

import { ScoreHandler } from "./score_handler.js";

// import { Midi } from '@tonejs/midi';

// Variables
const starterABC = 'X: 1\nT: Sketch\nK: C\nL: 1/4\nM: 4/4\n| A B c d |]';
const scoreHandler = new ScoreHandler();

const specialKeyCommand = "s-Mod-";

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
        keymap.of([ // Default key commands
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...lintKeymap
        ]),
        readMeasure(scoreHandler),
        readNote(scoreHandler),
        ABC(), // Parser
        linter(lintMusic),
        EditorView.updateListener.of((v) => { // Main Event Handler
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

// Set up braille, settings, and save modals
const modals = {};
let focusOnView = function() {
    if (view.hadFocus || view.forceFocus) {setTimeout(() => view.focus(), 10)};
    view.hadFocus = false;
    view.forceFocus = false;
}

let mm = [['braille', 'modal'], ['settings', 'offcanvas'], ['save', 'offcanvas']];
mm.forEach(m => {
    modals[m[0]] = document.getElementById(`${m[0]}View`);
    modals[m[0]].addEventListener(`hidden.bs.${m[1]}`, focusOnView);
});


// modals['braille'] = document.getElementById(`brailleView`);
// modals['braille'].addEventListener('hidden.bs.modal', focusOnView);
//
// modals['settings'] = document.getElementById(`settingsView`);
// modals['settings'].addEventListener('hidden.bs.offcanvas', focusOnView);
//
// modals['save'] = document.getElementById(`saveView`);
// modals['save'].addEventListener('hidden.bs.offcanvas', (ev, forceFocus=false) => {
//     if (view.hadFocus || forceFocus) {setTimeout(() => view.focus(), 10)};
//     view.hadFocus = false;
// });

// Linter
// Called when the editor is idle after changes have been made
// Thus, assumes the score handler has finished parsing
function lintMusic(view) {
    let diagnostics = [];
    let rawErrorList = scoreHandler.getErrorList();

    rawErrorList.forEach(erNode => {
        diagnostics.push({
            from: erNode.from,
            to: erNode.to,
            severity: erNode.severity, // info | warning | error
            message: erNode.message,
            actions: [
                {
                    name: "fix",
                    apply(view, from, to) {
                        view.dispatch( { changes: {from, to, insert: ''} } );
                    }
                }
            ]
        })
    });

    console.log('lint', diagnostics);
    return diagnostics;
}

// UI Visuals
function showPosition(currentPosition) {
    let outputString = "";

    outputString += currentMeasureString(currentPosition);
    if (outputString.length) outputString += " -- ";
    outputString += currentNoteString(currentPosition);

    document.getElementById('info').innerHTML = outputString;
    return outputString;
}

function currentMeasureString(currentPosition) {
    let outputString = "";
    if (currentPosition.measures.length) {
        let m = currentPosition.measures[0];
        outputString += `Measure ${m.measure} (${m.comment})`;
    }

    return outputString;
}

function currentNoteString(currentPosition) {
    let outputString = "";
    if (currentPosition.events.length) {
        let ev = currentPosition.events[0];
        if (["Note", "Chord", "Rest"].includes(ev.name)) new Promise(function(resolve, reject) {
            let note = ev.scientificNotation.note ? ev.scientificNotation.note : '';
            let dur = ev.scientificNotation.relativeDur;
            outputString += `${ev.name} ${note}, ${dur}`;
        });
        else outputString += ev.name.match(/[A-Z][a-z]+/g).join(" ");
    }

    return outputString;
}

// UI Sound
const playNoteWhenTyped = function(scoreHandler, v) {
    let pbState = scoreHandler.getPlaybackState();

    // Don't play notes if piece is looping
    if (pbState.state == 'started') return;

    // The very first character insertion has length 1
    if ((v.changes.inserted.length == 1 || v.changes.inserted.length == 2)) {
        let inserted = v.changes.inserted[v.changes.inserted.length - 1].text[0];
        if (inserted.length == 1 &&
        "abcdefgABCDEFG,'_^0123456789".split("").includes(inserted)) {
            scoreHandler.playNote();
        }
    }
}

// Screen Reader Speech
// https://a11y-guidelines.orange.com/en/web/components-examples/make-a-screen-reader-talk/
function srSpeak(text, priority) {
    let el = document.createElement("div");
    let id = "speak-" + Date.now();
    el.setAttribute("id", id);
    el.setAttribute("aria-live", priority || "polite"); // "assertive"
    //el.classList.add("sr-only");
    el.classList.add("visually-hidden");
    document.body.appendChild(el);

    window.setTimeout(function () {
        document.getElementById(id).innerHTML = text;
    }, 100);

    window.setTimeout(function () {
        document.body.removeChild(document.getElementById(id));
    }, 1000);
}

// Key Commands
// The tab toggler command  can occur outside of the editor.
function globalKeyEvents(ev) {
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && ev.key == "0") {
        event.preventDefault();
        if (view.hasFocus) {
            bootstrap.Modal.getOrCreateInstance(modals.braille).show();
            view.hadFocus = true;
        }
        else {
            // hiding a modal may move focus, so this variable forces it
            // back to the editor.
            let active = Object.values(modals)
                        .filter(m => m.getAttribute("aria-hidden") == null);
            if (active.length) {
                view.forceFocus = true;
                active[0].classList.contains('offcanvas') ?
                    bootstrap.Offcanvas.getOrCreateInstance(active[0]).hide()
                  : bootstrap.Modal.getOrCreateInstance(active[0]).hide();
            }
            else view.focus();
        };

        return true;
    }

    // Save Menu
    if ((ev.metaKey || ev.ctrlKey) && ev.key == "s") {
        event.preventDefault();
        if (view.hasFocus) view.hadFocus = true;
        bootstrap.Offcanvas.getOrCreateInstance(modals.save).toggle();

        return true;
    }

    // Play / Pause
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.keyCode == 32)) {
        scoreHandler.playPause();
        event.preventDefault();
        return true;
    }

    // Toggle Loop
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.key == "l")) {
        let loopState = scoreHandler.toggleLoop().loop;
        let msg = `loop ${{true: "on", false: "off"}[loopState]}`;
        srSpeak(msg);

        event.preventDefault();
        return true;
    }

    // Stop
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.key == ".")) {
        scoreHandler.stop();
        event.preventDefault();
        return true;
    }
}

// Callback function that gets called after tab show event
// Automatically focusses on first focusable child element of tab target
document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(t => {
    t.addEventListener('shown.bs.tab', ev => {
        let editable = document.querySelector(`${ev.target.getAttribute("data-bs-target")} [role="textbox"], [tabindex]:not([tabindex="-1"]`);
        if (editable) editable.focus();
    })
});

document.onkeydown = globalKeyEvents;

// Information Commands
function readMeasure(scoreHandler) {
  return keymap.of([{
    key: "? m",
    preventDefault: true,
    run() {
        let measureString = currentMeasureString(scoreHandler.getCurrentPosition()) || "No measure selected";
        srSpeak(measureString, "assertive");
        return true;
    }
  }])
}

function readNote(scoreHandler) {
  return keymap.of([{
    key: "? n",
    run() {
        let noteString = currentNoteString(scoreHandler.getCurrentPosition()) || "No note selected";
        srSpeak(noteString, "assertive");
        return true;
    }
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

// A little hacky?? - This sets up the internal data structure before any input
//  Maybe store musicxml/braille defaults
scoreHandler.generateScoreStructure(view.state.tree.cursor(), view.state)
