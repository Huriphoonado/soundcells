import {EditorView} from "@codemirror/view"
import {Extension} from "@codemirror/state"
import {HighlightStyle, tags as t} from "@codemirror/highlight"

// Using One Dark Theme as starting point
// https://github.com/codemirror/theme-one-dark/blob/main/src/one-dark.ts

// Bootstrap theme colors
const white = "#FFFFFF";
const black = "#000000";
const primary = "#3D7F3D";
const secondary = "#945F10";
const success = "#5F358A";
const info = "#3CBCC3";
const danger = "#E40C2B";
const light = "#F7F4E9";
const dark = "#1D1D2C";

const rebeccaPurple = "#522D76";
const ming = "#22696D";
const firebrick = "#C20A26";
const raisinBlack = "#1D1D2C";
const navy = "#414F7C";
const orangy = "#CE3E12";

const primary_text = "#377237";
const primary_light1 = "#ecf2ec";
const primary_light2 = "#9ebf9e";

const highlightBG = "#f8f9fa"
const highlightCol = "#999999"

const chalky = "#e5c07b";
const coral = "#e06c75";
const cyan = "#56b6c2";
const invalid = "#ffffff";
const ivory = "#abb2bf";
const stone = "#7d8799"; // Brightened compared to original to increase contrast
const malibu = "#61afef";
const sage = "#98c379";
const whiskey = "#d19a66";
const violet = "#c678dd";
const darkBackground = "#21252b";
const highlightBackground = "#2c313a";
const background = "#282c34";
const tooltipBackground = "#353a42";
const selection = "#3E4451";
const cursor = "#528bff";

export const scLightGreenTheme = EditorView.theme({
  "&": {
    color: dark,
    backgroundColor: white,
    fontFamily: "M PLUS 1 Code",
    minHeight: "150px",
    maxHeight: "20vh"
  },

  ".cm-content": {
    caretColor: dark
  },

  ".cm-cursor, .cm-dropCursor": {borderLeftColor: dark},
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {backgroundColor: primary_light1},

  ".cm-panels": {backgroundColor: white, color: dark},
  ".cm-panels.cm-panels-top": {borderBottom: "2px solid black"},
  ".cm-panels.cm-panels-bottom": {borderTop: "2px solid black"},

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f"
  },

  ".cm-activeLine": {backgroundColor: highlightBG},
  ".cm-selectionMatch": {backgroundColor: "#aafe661a"},

  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847",
    outline: "1px solid #515a6b"
  },

  ".cm-gutters": {
    backgroundColor: primary_light1,
    color: primary_text,
    border: primary_light2
  },

  ".cm-activeLineGutter": {
    backgroundColor: highlightBG,
    color: highlightCol
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },

  ".cm-tooltip": {
    border: "none",
    backgroundColor: tooltipBackground,
    color: white
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBG,
      color: ivory
    }
  }
}, {dark: false})

/// The highlighting style for code in the One Dark theme.
export const scLightGreenHighlightStyle = HighlightStyle.define([
  {tag: t.keyword,
   color: rebeccaPurple},
  {tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
   color: ming},
  {tag: [t.function(t.variableName), t.labelName],
   color: firebrick},
  {tag: [t.color, t.constant(t.name), t.standard(t.name)],
   color: raisinBlack},
  {tag: [t.definition(t.name), t.separator],
   color: ivory},
  {tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
   color: orangy},
  {tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
   color: orangy},
  {tag: [t.meta, t.comment],
   color: navy},
  {tag: t.strong,
   fontWeight: "bold"},
  {tag: t.emphasis,
   fontStyle: "italic"},
  {tag: t.strikethrough,
   textDecoration: "line-through"},
  {tag: t.link,
   color: navy,
   textDecoration: "underline"},
  {tag: t.heading,
   fontWeight: "bold",
   color: ming},
  {tag: [t.atom, t.bool, t.special(t.variableName)],
   color: firebrick },
  {tag: [t.processingInstruction, t.string, t.inserted],
   color: sage},
  {tag: t.invalid,
   color: invalid},
])

/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export const scLightGreen = [scLightGreenTheme, scLightGreenHighlightStyle]
