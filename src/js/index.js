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

import { scLightGreen } from "./editor_theme.js"
import { ABC } from "./abc_language.js"

import { ScoreHandler } from "./score_handler.js";
import { Synths } from "./synths.js";
import { FileDownloader } from "./file_downloader.js";
import { Cacher } from "./cacher.js";

import { addAlert } from "./dom_manip.js"

// import { Midi } from '@tonejs/midi';


// Variables
let play = '<i class="bi bi-play-fill" aria-label="play"></i>';
let pause = '<i class="bi bi-pause-fill" aria-label="pause"></i>';

const starterABC = 'X: 1\nT: Sketch\nK: C\nL: 1/4\nM: 4/4\n| A B c d |]';
const scoreHandler = new ScoreHandler({
    stopCallback: function() { updatePlayButtonUI(play); }
});
const synths = new Synths();

const fileDownloader = new FileDownloader();

const specialKeyCommand = "s-Mod-";

let timer; // Only send to flask server at a max interval

const cacher = new Cacher();

let textarea = document.getElementById("abctextarea");
let codeEditorOption = document.getElementById("codeEditor");
let textareaOption = document.getElementById("textEditor");
let textAreaPrevCharCount = 0; // Tell whether user added or deleted text

const abcThing = ABC();
let startState = EditorState.create({
    doc: cacher.retrieveABCText() ? cacher.retrieveABCText() : starterABC,
    extensions: [
        lineNumbers(),
        history(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        drawSelection(),
        scLightGreen,
        //defaultHighlightStyle.fallback,
        bracketMatching(),
        closeBrackets(),
        keymap.of([ // Default key commands
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...lintKeymap
        ]),
        //question(),
        readInfo(scoreHandler),
        textFontSize(),
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

export let state = {
    pageFormat: 'A4',
    orientation: 'P',
    unicodeBraille: "⠠⠝⠥⠍⠃⠑⠗⠒⠀⠼⠁ ⠠⠞⠊⠞⠇⠑⠒⠀⠠⠎⠅⠑⠞⠉⠓ ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠶⠼⠁⠃⠚⠀⠼⠙⠲⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⠼⠁⠀⠐⠪⠺⠹⠱⠣⠅",
    asciiBraille: `,NUMBER3 #A ,TITLE3 ,SKETCH ?7#ABJ #D4 #A "[W?:`,
    musicXML: "",
    zoomLevel: 1,
    errors: [],
}
// Open Sheet Music Display
const visualScore = new osmd.OpenSheetMusicDisplay("score", {
    autoResize: true,
    backend: "svg",
    drawTitle: true,
    drawSubtitle: false,
    drawPartNames: false,
    pageFormat: 'Endless'
});

// Set up file downloader
document.getElementById('downloadButton').onclick = function() {
    fileDownloader.setTitle(scoreHandler.getTitle());
    fileDownloader.download();
}
fileDownloader.score = visualScore;
fileDownloader.notifications = document.getElementById("saveNotifications");
fileDownloader.attachHTML('abc', document.getElementById('abcCheck'));
fileDownloader.attachHTML('brf', document.getElementById('brailleMusicCheck'));
fileDownloader.attachHTML('pdf', document.getElementById('printScoreCheck'));
fileDownloader.attachHTML('xml', document.getElementById('musicXMLCheck'));

// Set up braille, settings, and save modals
const modals = {};
let focusOnView = function() {
    if (view.hadFocus || view.forceFocus) {setTimeout(() => view.focus(), 10)};
    view.hadFocus = false;
    view.forceFocus = false;
}

// Set up Modal focus behaviors
let mm = [['braille', 'modal'], ['settings', 'offcanvas'], ['save', 'offcanvas']];
mm.forEach(m => {
    modals[m[0]] = document.getElementById(`${m[0]}View`);
    modals[m[0]].addEventListener(`hidden.bs.${m[1]}`, focusOnView);
});

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
    // console.log("v changes ", v.changes);
    let pbState = scoreHandler.getPlaybackState();
    let notePlaybackCheck = document.getElementById("notePlaybackCheck").checked;
    let textareaCheck = document.getElementById("textEditor").checked;

    // Don't play notes if piece is looping
    if (pbState.state == 'started' || !notePlaybackCheck || textareaCheck ) return;


    // Determine whether the note should be delayed and ensure time is within 0–1000
    let delayTime = document.getElementById('noteDelayTime').value;
    if (isNaN(delayTime) || delayTime == undefined || !delayTime.length) delayTime = 0;
    delayTime = Math.max(0, Math.min(parseInt(delayTime), 1000));

    // The very first character insertion has length 1
    if ((v.changes.inserted.length == 1 || v.changes.inserted.length == 2)) {
        let inserted = v.changes.inserted[v.changes.inserted.length - 1].text[0];
        if (inserted.length == 1 &&
        "abcdefgABCDEFG,'_^0123456789".split("").includes(inserted)) {
            scoreHandler.playNote(delayTime);
        }
    }

}

// Key Commands
// The tab toggler command  can occur outside of the editor.
function globalKeyEvents(ev) {
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.key == "9" || ev.key == "(")) {
        event.preventDefault();
        if (view.hasFocus) {
            // Update braille content
            document.getElementById('braille').innerHTML = (
                document.getElementById('brailleText1').checked ?
                state["asciiBraille"] : state["unicodeBraille"]) || "";

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
        document.getElementById("play").click();
        //scoreHandler.playPause();
        event.preventDefault();
        return true;
    }

    // Toggle Loop
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.key == "l" || ev.key == "L")) {
        let loopState = scoreHandler.toggleLoop().loop;
        let msg = `Loop ${{true: "on", false: "off"}[loopState]}`;
        addAlert(msg, {
            location: document.getElementById('editorNotify'),
        }); //srSpeak(msg);

        event.preventDefault();
        return true;
    }

    // Stop
    if ((ev.metaKey || ev.ctrlKey) && ev.shiftKey && (ev.key == "." || ev.key == ">")) {
        document.getElementById("stop").click();
        event.preventDefault();
        return true;
    }

    if (ev.key == '?' && view.hasFocus) {
        synths.playQuestion();
        console.log('question pressed');
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

function textFontSize() {
    return keymap.of([{
        key: "c-=",
        preventDefault: true,
        run() {
            let fSel = document.getElementById('fontSizeSelect');
            if (fSel.selectedIndex != fSel.options.length - 1) {
                fSel.selectedIndex += 1;
                updateEditorFontSize(fSel.value);
            };
            return true;
        }
    },
    {
        key: "c--",
        preventDefault: true,
        run() {
            let fSel = document.getElementById('fontSizeSelect');
            if (fSel.selectedIndex != 0) {
                fSel.selectedIndex -= 1;
                updateEditorFontSize(fSel.value);
            };
            return true;
        }
    }
])}

// Information Commands
function readInfo(scoreHandler) {
    return keymap.of([{
        key: "? m", // Measure Info
        preventDefault: true,
        run() {
            let measureString = currentMeasureString(scoreHandler.getCurrentPosition()) || "No measure selected";
            addAlert(measureString, {
                location: document.getElementById('editorNotify'),
            }); // srSpeak(measureString, "assertive");
            return true;
        }
    },
    {
        key: "? n", // Note Info
        run() {
            let noteString = currentNoteString(scoreHandler.getCurrentPosition()) || "No note selected";
            addAlert(noteString, {
                location: document.getElementById('editorNotify'),
            });
            //srSpeak(noteString, "assertive");
            return true;
        }
    }
])}

// GET/POST Functions
const sendABC = (abcCode) => {

    fileDownloader.setContent('abc', abcCode);
    cacher.saveABCText(view.state.doc.toString());

    postData('/data', { userdata: abcCode })
    .then(data => {
        state["unicodeBraille"] = data.braille;
        state["asciiBraille"] = data.asciiBraille;
        // document.getElementById('braille').innerHTML = data.braille || "";
        fileDownloader.setContent('brf', data.asciiBraille);
        if (data.musicxml) {
            fileDownloader.setContent('xml', data.musicxml);
            visualScore.load(data.musicxml)
            .then( v => {
                visualScore.zoom = state.zoomLevel; // zoom value not retained
                visualScore.render();
            } )
        }
    })
}

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

// UI Functionality Setup

// Change editor font size
// Annoying bug - the gutter doesn't update its spacing until the user focuses
document.getElementById("fontSizeSelect").addEventListener("change", (e) => {
    updateEditorFontSize(e.target.value);
});

document.getElementById("score-zoom").addEventListener("input", (e) => {
    let zoomSlide = parseInt(document.getElementById('score-zoom').value);
    state.zoomLevel = zoomSlide > 50 ? Math.pow(zoomSlide / 50, 2) : zoomSlide / 50;
    visualScore.zoom = state.zoomLevel;
    visualScore.render();
});

document.getElementById("score-zoom").addEventListener('dblclick', (e) => {
    document.getElementById('score-zoom').value = 50;
    state.zoomLevel = 1;
    visualScore.zoom = state.zoomLevel;
    visualScore.render();
    e.stopPropagation();
});


document.getElementById("showBraille").addEventListener("click", (e) => {
    document.getElementById('braille').innerHTML = (
        document.getElementById('brailleText1').checked ?
        state["asciiBraille"] : state["unicodeBraille"]) || "";
});


document.getElementById("play").addEventListener("click", (e) => {
    scoreHandler.playPause(
        function() { updatePlayButtonUI(pause) },
        function() { updatePlayButtonUI(play) }
    );
});

document.getElementById("stop").addEventListener("click", (e) => {
    scoreHandler.stop(function() { updatePlayButtonUI(play) });
});

function updatePlayButtonUI(value) {
    document.getElementById("play").innerHTML=value;
}

// Google Form Submissions
document.getElementById("surveyURL").addEventListener("click", (e) => {
    let rootURL = 'https://docs.google.com/forms/d/e/1FAIpQLSdgySyLvpznkSJv-NmTwE4KO03vg7rY3U7GF1Q3hHRhadPXDg/viewform?usp=pp_url';
    let prepop = '&entry.624111465='
    let abcURL = `${encodeURIComponent(view.state.doc.toString())}`;
    e.target.href = `${rootURL}${prepop}${abcURL}`.substring(0, 2040);
});


document.getElementById('submitButton').addEventListener("click", (e) => {
    let rootURL = 'https://docs.google.com/forms/d/e/1FAIpQLScD9yq9QHW-ccKEkKUc0hdGycjUsYf7sE7XbhjoQEPt-NVX2w/viewform?usp=pp_url';
    let prepop = '&entry.1348577600='
    let abcURL = `${encodeURIComponent(view.state.doc.toString())}`;
    let fullURL = `${rootURL}${prepop}${abcURL}`.substring(0, 2040);

    window.open(fullURL, "_blank");
})

// Events for Generic HTML Text Area
codeEditorOption.addEventListener("change", (e) => {
    document.getElementById("abctextarea").style.display = "none";
    document.getElementById("editor").style.display = "inline";
})

// Swap CodeMirror and default HTML text areas
textareaOption.addEventListener("change", (e) => {
    document.getElementById("editor").style.display = "none";
    textarea.style.display = "inline";

    let codeEditorText = "";
    for(let line in view.state.doc.text){
        codeEditorText += view.state.doc.text[line] + '\n';
    }
    textarea.value = codeEditorText.slice(0,-1);
    textAreaPrevCharCount = textarea.value.length;

})

textarea.addEventListener("input", (e) => {
    let lastCharAdded = e.target.value[e.target.selectionStart-1];
    let lastCharIndex = view.state.doc.length;

    view.dispatch({
        changes: {from: 0, to: lastCharIndex, insert: e.target.value},
        selection: {anchor: e.target.selectionStart},
    });

    if ("abcdefgABCDEFG,'_^0123456789".split("").includes(lastCharAdded) &&
        textarea.value.length >= textAreaPrevCharCount) {
        scoreHandler.playNote(0);
    }

    textAreaPrevCharCount = textarea.value.length;

});

// There is no universal support for "selection change" so we have to
// manually capture arrow events for tracking cursor position
textarea.addEventListener("keyup", (e) => {
    if (e.keyCode >= 37 && e.keyCode <= 40) {
        view.dispatch({ selection: {anchor: e.target.selectionStart} });
    }
});

textarea.addEventListener("click", (e) => {
    view.dispatch({ selection: {anchor: e.target.selectionStart} });
});

function updateEditorFontSize(sz) {
    view.dom.style.fontSize = `${sz}px`;
    textarea.style.fontSize = `${sz}px`;
}


// TODO - Move this code somewhere else
// Insert Excerpt Functions
let examplesDiv = document.getElementById("insertExamples");
let abcScoreExamples = [
    {
        buttonName: "Zelda's Theme",
        abcScore: `T: Princess Zelda's Theme
C: Koji Kondo
K: G
Q: 100
M: 3/4
L: 1/4
| B2 d | A2 G1/2 A1/2 | B2 d | A3 | B2 d | a2 g | d2 c1/2 B1/2 | A3 |]`
    },
    {
        buttonName: 'Bach Cello Suite',
        abcScore: `T: Cello Suite No. 1 - Prelude
M: 4/4
C: J. S. Bach
K: G
L: 1/16
Q: 1/4=76
| G,, D, B, A, B, D, B, D, G,, D, B, A, B, D, B, D, |
G,, E, C B, C E, C E, G,, E, C B, C E, C E, |
G,, F, C B, C F, C F, G,, F, C B, C F, C F, |
G,, G, B, A, B, G, B, G, G,, G, B, A, B, G, B, F, |]`
    },
    {
        buttonName: 'Mario Bros Theme',
        abcScore: `X: 1
T: Super Mario Bros. Theme
C: Koji Kondo
K: C
L: 1/4
M: 4/4
Q: 1/4=180
| e1/2 e1/2 z1/2 e1/2 z1/2 c1/2 e | g z G z
| c>G z (E | E1/2) A B _B1/2 A | G2/3 e2/3 g2/3 a f1/2 g1/2
| z1/2 e c1/2 d1/2 B z1/2 |]`
    },
    {
        buttonName: 'Starter Template',
        abcScore: `X: 1
T: Sketch
C: Me
K: C
L: 1/4
M: 4/4
| A B c d |]`
    }
];

abcScoreExamples.forEach(ex => {
    let btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.classList.add("btn", "btn-outline-primary");
    btn.innerHTML = ex.buttonName;
    btn.onclick = function() {
        let textareaChecked = document.getElementById("textEditor").checked;
        if(textareaChecked){
            document.getElementById("abctextarea").value = ex.abcScore;
        }
        else{
            let update = view.state.update({
                changes: {
                    from: 0, to: view.state.doc.length,
                    insert: ex.abcScore
                }
            });
            view.update([update]);
        }
    }
    examplesDiv.appendChild(btn);
});


// A little hacky?? - This sets up the internal data structure before any input
//  Maybe store musicxml/braille defaults
scoreHandler.generateScoreStructure(view.state.tree.cursor(), view.state)
