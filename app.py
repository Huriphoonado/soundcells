from io import BytesIO
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from music21 import converter, braille, tempo, midi, musicxml, abcFormat, stream

app = Flask(__name__)
CORS(app)

# Handle abc conversion using music21
@app.route("/data", methods=['GET', 'POST'])
def getuserinput():
    if request.method == 'POST':
        data = request.get_json()['userdata']

        # Data Responses
        error = ""
        brailleFile = ""
        asciiBraille = ""
        mxml = ""
        mf = ""
        midiBytes = b''

        ah = abcFormat.ABCHandler()

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

            abcTextSample = converter.parse(data, format='abc')
            for el in abcTextSample.recurse().getElementsByClass(tempo.MetronomeMark):
                el.number = int(el.number) # Decimals break braille conversion

            #abcTextSample.show('text')

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
