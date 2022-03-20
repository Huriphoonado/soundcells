import {parser} from "./abc_grammar.js"
import {LRLanguage, LanguageSupport,} from "@codemirror/language"
import {styleTags, tags as t} from "@codemirror/highlight"

export const ABCLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
          Note: t.variableName,
          Barline: t.bool,
          Comment: t.comment,
          "Metadata/...": t.keyword,
          "Decoration/...": t.operator,
          "( )": t.paren,
          "[ ]": t.squareBracket
      })
    ]
  }),
  languageData: { commentTokens: {line: "%"} }
})

export function ABC() {
  return new LanguageSupport(ABCLanguage)
}
