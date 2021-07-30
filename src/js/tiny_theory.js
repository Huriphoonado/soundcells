// Some basic music theory constructs that are useful here

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
    let tick = eval(`${node.duration} * ${md.L} * ${mDenum}`);

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
    let sec = measureFrac * mDenum * 60 / tone.Transport.bpm.value;

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

const TinyTheory = { abcToScientific: abcToScientific }

export default TinyTheory;
