// Some basic music theory constructs that are useful here
// Also, ABC notation specific constants and checkers

const numSharp = {
    'c' : 0,  'am': 0,
    'g' : 1,  'em': 1,
    'd' : 2,  'bm': 2,
    'a' : 3, 'f#m': 3,
    'e' : 4, 'c#m': 4,
    'b' : 5, 'g#m': 5,
    'f#': 6, 'd#m': 6,
    'c#': 7, 'a#m': 7,
};
const sharpList = ["f", "c", "g", "d", "a", "e", "b"];

const numFlats = {
    'c' : 0,  'am': 0,
    'f' : 1,  'dm': 1,
    'bb': 2,  'gm': 2,
    'eb': 3,  'cm': 3,
    'ab': 4,  'fm': 4,
    'db': 5, 'bbm': 5,
    'gb': 6, 'ebm': 6,
    'cb': 7, 'abm': 7,
};
const flatsList = ["b", "e", "a", "d", "g", "c", "f"];

// 1 could be valid, but the music21 parser seems to break
const unitNoteLengths = ["1/1", "1/2", "1/4", "1/8", "1/16",
                         "1/32", "1/64", "1/128", "1/256", "1/512"];

// Add more and implement in parser
// https://abcnotation.com/wiki/abc:standard:v2.2#information_fields
const supportedHeaders = ['C', 'K', 'L', 'M', 'Q', 'T', 'X'];

let getAccidentalByKey = function(pitch, key) {
    return (key in numFlats) ? (flatsList.slice(0, numFlats[key]).includes(pitch) * -1)
         : (key in numSharp) ? (sharpList.slice(0, numSharp[key]).includes(pitch) * 1)
         : 0
}

// Converts the information parsed from abce note text into scientific notation
// human readable and readable by tone
let calculatePitchNotation = function(node, md) {
    if (node.name != 'Note') return null;
    let octave = 4
        + (node.pitch.toLowerCase() == node.pitch)
        - (node.octave.split(",").length - 1)
        + (node.octave.split("'").length - 1);

    let ac;
    if (node.accidental == "=") ac = 0;
    else ac = getAccidentalByKey(node.pitch.toLowerCase(), md.K.toLowerCase())
        - (node.accidental.split("_").length - 1)
        + (node.accidental.split("^").length - 1);
    let accidental = ['bb', 'b', '', '#', 'x'][Math.min(Math.max(ac, -2), 2) + 2];

    return node.pitch.toUpperCase() + accidental + octave;
}

// Converts a note in ABC to a more standard version
// "c" => "C5"
let abcToScientific = function(node, md={K:'c', L:'1/4', M:'4/4'}, tone) {
    let scientificNotation = {};

    // Calculate duration values
    let [mNum, mDenum] = md.M.replace(/\s/g, "").split('/');
    let tick = eval(`${extractDur(node.duration)} * ${md.L} * ${mDenum}`);

    // Deal with dotted durations
    if ((node.preText != undefined) && (node.postText != undefined)) {
        let dots = Math.max(node.preText.length, node.postText.length);
        if (node.preText[0] == '<' || node.postText[0] == '>') {
            tick = tick + (tick * (1 - Math.pow(2, -dots)))
        }
        else if (node.preText[0] == '>' || node.postText[0] == '<') {
            tick = (tick * (Math.pow(2, -dots)))
        }
    }

    let measureFrac = tick / mNum; // fraction of the measure
    let sec = tick * (4 / mDenum) * (60 / tone.Transport.bpm.value);

    scientificNotation['tick'] = tick;
    scientificNotation['measureFrac'] = measureFrac;
    scientificNotation['seconds'] = sec;
    scientificNotation['relativeDur'] = tone.Time(sec).toNotation();
    scientificNotation['note'] = null; // Rests are null

    if (node.name == 'Chord') {
        scientificNotation.note = [];
        node.notes.forEach(n => {
            scientificNotation['note'].push(calculatePitchNotation(n, md));
        })
    }
    else if (node.name == 'Note') scientificNotation['note'] = calculatePitchNotation(node, md);

    return scientificNotation;
}

// if first character != '/' return
// if length == 1 return 1/2
// if second character == '/' return '1/' + 2**dur.length
// else return '1'+dur
let extractDur = function(dur) {
    if (dur[0] != '/') return dur; // 1, 1/2, 2/6
    if (dur.length == 1) return '1/2'; //  /
    if (dur[1] == '/') return '1/' + 2**dur.length; // //
    return '1'+ dur; // /2 /4
}

// Naive approach that filters out fractions and integers and checks their order
// It ignores equal signs and strings
// Could be extended to support descriptive strings, e.g. "Andante"
// May want to support string cleanup
// Valid Examples:
// 50 | 1/4=50 | 1/4 1/8=50 | 1/4 1/8=120 "Moving"
let extractTempo = function(q) {
    // Extract fractions
    let extraction = q.match(/(?:[1-9][0-9]*|0)(?:\/[1-9][0-9]*)?/g);
    if (extraction == null) return false;

    // Ensure only the final number is an integer and everything before are fractions
    // Creates a group of f for fraction i for int.
    // Valid: 0001, 001, 1 | Invalid: 10, 0, 0101
    let vals = extraction.map(s => s.includes('/') ? 0 : 1);
    if (vals.reduce((a, b) => a + b, 0) != 1) return false;
    if (vals.slice(-1)[0] != 1) return false;

    let bpm = eval(extraction.pop());
    let beat = extraction.reduce( (a, b) => eval(a) + eval(b), 0 ) || 0.25;

    let qpm = bpm * beat * 4;
    return qpm;
}

// Metadata validations/handlers
let isValidKey = function(key) {
    return (key.toLowerCase() in numFlats) ? true
         : (key.toLowerCase() in numSharp) ? true
         : false
}

let isValidUnitNoteLength = function(l) { return unitNoteLengths.includes(l); }

// Imperfect since there can be extra info:
// "sdfsdfs 4/4" returns true
let isValidTimeSig = function(ts) {
    let tsReg = /[1-9][0-9]*\/[1-9][0-9]*/; // Fraction Regular Expression
    return tsReg.test(ts);
}

let isValidTempo = function(q) {
    return extractTempo(q) ? true : false;
}

// This function doesn't appear necessary, since unsupported metadata
// get parsed as errors...
let isValidMetaData = function(h) { return supportedHeaders.includes(h); }

const TinyTheory = {
    abcToScientific: abcToScientific,
    extractTempo: extractTempo,
    isValidKey: isValidKey,
    isValidUnitNoteLength: isValidUnitNoteLength,
    isValidTimeSig: isValidTimeSig,
    isValidMetaData: isValidMetaData,
    isValidTempo: isValidTempo
}

export default TinyTheory;
