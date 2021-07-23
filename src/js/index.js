import {Extension, EditorState} from "@codemirror/state"
import {EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine} from "@codemirror/view"
import {Text} from "@codemirror/text"
import {history, historyKeymap} from "@codemirror/history"
import {lineNumbers, highlightActiveLineGutter} from "@codemirror/gutter"
import {defaultKeymap} from "@codemirror/commands"
import {HighlightStyle, defaultHighlightStyle} from "@codemirror/highlight"
import {basicSetup} from "@codemirror/basic-setup"

import * as osmd from "opensheetmusicdisplay"

import {ABC} from "./abc_language.js"

import {ScoreHandler} from "./score_handler.js";

// Variables
const starterABC = 'X: 1\nT: Sketch\nK: C\nL: 1/4\nM: 4/4\n|ABcd|]';
const scoreHandler = new ScoreHandler();

let timer; // Only send to flask server at a max interval

// Editor
// use parser syntaxTree
const abcThing = ABC();
let startState = EditorState.create({
    doc: starterABC,
    extensions: [
        // lineNumbers(),
        // history(),
        // keymap.of(defaultKeymap, historyKeymap),
        // highlightActiveLineGutter(),
        // highlightActiveLine(),
        basicSetup,
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
            if ((v.changes.inserted.length == 2)) {
                let inserted = v.changes.inserted[1].text[0];
                if (inserted.length == 1 &&
                "abcdefgABCDEFG,'_^0123456789".split("").includes(inserted)) {
                    scoreHandler.playNote();
                }
            }
        }),
        // keymap.of(
        //     "abcdefgABCDEFG".split("").map(l => {
        //         return {
        //             key: l,
        //             run() {
        //                 scoreHandler.playNote();
        //                 return false;
        //             }
        //         }
        //     })
        // )
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

// Functions
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
sendABC(starterABC);

const showPosition = function(currentPosition) {
    let outputString = "";

    if (currentPosition.measures.length) {
        let m = currentPosition.measures[0];
        outputString += `Measure ${m.measure} (${m.comment}) -- `;
    }
    if (currentPosition.events.length) {
        let ev = currentPosition.events[0];
        let note = ev.scientificNotation.note ? ev.scientificNotation.note : 'rest';
        let ticks = ev.scientificNotation.tick
        outputString += `Note ${note}, ${ticks} tick(s).`;
    }
    document.getElementById('info').innerHTML = outputString;
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
