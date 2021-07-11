import {EditorState, EditorView, basicSetup} from "@codemirror/basic-setup"

let editor = new EditorView({
  state: EditorState.create({
    extensions: [basicSetup]
  }),
  parent: document.body
})
