# Sound Cells
Rendering braille music and sheet music in the web with abc notation.

The app is deployed to Heroku at [https://soundcells.herokuapp.com/](https://soundcells.herokuapp.com/)

## Setup
This project is a Flask app meaning there are both Python and web dependencies to install.

### Python
We are using a virtual environment `venv` to ensure that the Python version and dependencies are consistent. So to use, you'll need to create a virtual environment and then install all the dependencies listed in requirements.txt.

```bash
$ python3 -m venv venv
$ . venv/bin/activate
$ pip install -r requirements.txt
```

### Web
To install web dependencies, use npm.

```bash
$ npm install
```

## Development
To run the Flask app locally in development/debug mode:

```bash
$ export FLASK_ENV=development
$ python -m flask run
```

This app uses [webpack](https://webpack.js.org) to bundle and output js code. First, ensure that we are in development mode by updating the mode in webpack.config.js.

Then run the following command in a separate terminal window (while the flask command above is running).

```bash
$ npm run watch
```

This combines the code written in the source folder with modules installed to the file bundle.js which ends up in the Flask static directory.

### Parser
The editor for this app uses [CodeMirror 6](https://codemirror.net/6/). We wrote a custom abc grammar using the [Lezer system](https://lezer.codemirror.net) which can be easily integrated into the CodeMirror. It is incomplete covering many of ABC's basic features, but not all of its [standard syntax](https://abcnotation.com/wiki/abc:standard:v2.2).

The parser was developed and tested separately - a TODO is to merge that code. If you make changes to the included parser, you can run the following code within the parser folder.

```bash
$ ../node_modules/.bin/lezer-generator abc.grammar -o ../src/js/abc_grammar.js
```

## Deploy
Currently, we are using Heroku to deploy. First, ensure that the main branch is using a production build. Then, use the following:

```bash
$ git push heroku main
$ heroku ps:scale web=1
$ heroku open   
```

## Tools
### Python
* [Flask](https://flask.palletsprojects.com/en/2.0.x/)
* [music21](https://web.mit.edu/music21/)

### Web
* [CodeMirror 6](https://codemirror.net/6/)
* [Lezer](https://lezer.codemirror.net)
* [Bootstrap 5](https://getbootstrap.com)
* [Tone](https://tonejs.github.io)
* [Open Sheet Music Display](https://opensheetmusicdisplay.org)
* [JSZip](https://stuk.github.io/jszip/)
* [FileSaver](https://github.com/eligrey/FileSaver.js/)
* [jsPDF](https://github.com/MrRio/jsPDF)
* [svg2pdf](https://github.com/yWorks/svg2pdf.js/)

### Dev
* [Heroku](https://www.heroku.com)
* [Webpack](https://webpack.js.org)

## Notes

### Bundling JS in Flask app
I could not figure out a clean way to use ES5 require statements and modules installed with npm along with Flask (hence the need for two processes running during development). I tried using [Flask-Assets](https://flask-assets.readthedocs.io/en/latest/), but there was only support for minification and not for bundling files included with require. I looked into creating a [custom filter](https://webassets.readthedocs.io/en/latest/custom_filters.html) and found an [example with esbuild that looked promising](https://haliphax.dev/2020/09/minifying-javascript-using-esbuild-with-flask-assets/), but it kept repeatedly getting an error message. The current solution is based on this [2017 blog post](https://github.com/jrybicki-jsc/flasknpm).

### Parsing ABC
ABC notation has some strange characteristics, notably that header/metadata statements behave differently than music statements, but the only thing separating the two categories are newlines. Header statements ignore space and must end in a newline, while for our purposes, we don't want space and newlines to affect output. (In some abc examples, they affect measures per line and stemming.) This [Lezer forum on line-oriented grammars](https://discuss.codemirror.net/t/how-to-match-end-of-file-in-line-oriented-grammars/3186) helped get the current solution started.
