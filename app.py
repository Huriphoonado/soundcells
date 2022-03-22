from io import BytesIO
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from music21 import converter, metadata, braille, tempo, midi, musicxml, abcFormat, stream

app = Flask(__name__)
CORS(app)

# Handle abc conversion using music21
@app.route("/data", methods=['GET', 'POST'])
def getuserinput():
    if request.method == 'POST':
        data = request.get_json()['userdata']
        args = request.get_json()['args']

        # Data Responses
        error = ""
        brailleFile = ""
        asciiBraille = ""
        mxml = ""
        mf = ""
        midiBytes = b''

        # ah = abcFormat.ABCHandler()
        # print(data)

        try:
            # Experiments with the raw abc notation
            # s1 = stream.Stream()
            # ah = abcFormat.ABCHandler()
            # ah.process(data)
            # bl = ah.splitByMeasure()
            # for b in bl:
            #     measure = abcFormat.translate.abcToStreamScore(b)
            #     s1.append(measure)
            # s1.show('text')
            # abcFormat.translate.abcToStreamScore(newABC)

            #ah = abcFormat.ABCHandler(abcVersion=(2, 1, 0))
            #ah.process(data)
            # print(ah.tokens)
            #abcTextSample = abcFormat.translate.abcToStreamScore(ah)

            abcTextSample = converter.parse(data, format='abc')
            for el in abcTextSample.recurse().getElementsByClass(tempo.MetronomeMark):
                el.number = int(el.number) # Decimals break braille conversion


            # Currently includes the number in the output
            # Not using so this function removes
            # braille does not include the composer
            # I think because composer is in a separate "contributors" list?
            old_m = abcTextSample.metadata.all()
            abcTextSample.removeByClass(metadata.Metadata)
            abcTextSample.insert(0, metadata.Metadata())
            for t in old_m:
                if t[0] != 'number':
                    setattr(abcTextSample.metadata, t[0], t[1])

            # Start measure number count at 1 if there is no pickup
            if not args["hasPickup"]:
                for p in abcTextSample.parts:
                    n = 1
                    for m in p.getElementsByClass('Measure'):
                        m.number = n
                        n += 1

            # abcTextSample.show('text')
            # Music XML
            mxml = musicxml.m21ToXml.GeneralObjectExporter(abcTextSample).parse().decode('utf-8').strip()

            # Braille
            brailleFile = braille.translate.objectToBraille(abcTextSample)
            asciiBraille = braille.basic.brailleUnicodeToBrailleAscii(brailleFile)

            # MIDI
            # I could not figure out how to send this to the web app
            # mf = midi.translate.streamToMidiFile(abcTextSample)
            # midiBytes = mf.writestr() # Binary String, needs to be decoded?
            # mf.close()

        except IndexError:  # Occurs when the user inputs nothing
            error = 'Converter cannot parse empty string'

        except converter.ConverterException:
            error = "Invalid syntax. Unable to convert."

        send_data = {"braille": brailleFile, "asciiBraille": asciiBraille, "musicxml": mxml, "error": error}
        return jsonify(send_data)

# Home page
@app.route("/")
def index():
    return render_template('index.html')
