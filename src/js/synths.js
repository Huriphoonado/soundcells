import * as Tone from 'tone';

class Synths {
    constructor() {
        this.qSynth = questionSynth();
    }
    playQuestion() {
        const now = Tone.now();
        this.qSynth.triggerAttackRelease("G5", ".125", now);
        this.qSynth.triggerAttackRelease("G5", ".125", now+.125);
        this.qSynth.triggerAttackRelease("D5", ".125", now+.25);
        this.qSynth.triggerAttackRelease("B4", ".125", now+.375);
    }
}

let questionSynth = function() {
    //create a synth and connect it to the main output (your speakers)
    let synth = new Tone.MonoSynth().toDestination();
    synth.set({
        "volume": 0,
        "detune": 0,
        "portamento": 0,
        "envelope": {
            "attack": 0.05,
            "attackCurve": "linear",
            "decay": 0.01,
            "decayCurve": "exponential",
            "release": .125,
            "releaseCurve": "exponential",
            "sustain": 0.01
        },
        "oscillator": {
            "partialCount": 0,
            "partials": [],
            "phase": 0,
            "type": "amtriangle",
            "harmonicity": 0.5,
            "modulationType": "sine"
        },
        "filter": {
            "Q": 1,
            "detune": 5,
            "frequency": 0,
            "gain": 0,
            "rolloff": -12,
            "type": "lowpass"
        },
        "filterEnvelope": {
            "attack": 0.001,
            "attackCurve": "linear",
            "decay": 0.7,
            "decayCurve": "exponential",
            "release": 0.8,
            "releaseCurve": "exponential",
            "sustain": 0.1,
            "baseFrequency": 300,
            "exponent": 2,
            "octaves": 4
        }
    })
    console.log("In Question Synth.")
    return synth;
}

export { Synths }