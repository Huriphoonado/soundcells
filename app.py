from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from music21 import converter, musicxml, abcFormat, stream
from music21.braille import translate

app = Flask(__name__)
CORS(app)

# Handle abc conversion using music21
@app.route("/data", methods=['GET', 'POST'])
def getuserinput():
    if request.method == 'POST':
        data = request.get_json()['userdata']

        # Data Responses
        error = ""
        braille = ""
        mxml = ""

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
            # abcTextSample.show('text')

            mxml = musicxml.m21ToXml.GeneralObjectExporter(abcTextSample).parse().decode('utf-8').strip()
            braille = translate.objectToBraille(abcTextSample)

        except IndexError:  # Occurs when the user inputs nothing
            error = 'Converter cannot parse empty string'

        except converter.ConverterException:
            error = "Invalid syntax. Unable to convert."

        send_data = {"braille": braille, "musicxml": mxml, "error": error}
        return jsonify(send_data)

# Home page
@app.route("/")
def index():
    return render_template('index.html')
