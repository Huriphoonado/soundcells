import {parser} from "./abc_grammar.js"
import {LezerLanguage, LanguageSupport,} from "@codemirror/language"
import {styleTags, tags as t} from "@codemirror/highlight"

export const ABCLanguage = LezerLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
          Note: t.variableName,
          Barline: t.bool,
          Comment: t.comment,
          "Metadata/...": t.keyword,
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
