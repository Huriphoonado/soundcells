# Sound Cells
Rendering braille music in the web with abc notation.

## Setup
This project is Flask app meaning there are both Python and web dependencies to install.

### Python
We are using a virtual environment `venv` to ensure that Python dependencies are consistent. So to use, you'll need to create a virtual environment and then install all the dependencies listed in requirements.txt.

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

## Run
To run the Flask app locally in development/debug mode:

```bash
$ export FLASK_ENV=development
$ python -m flask run
```

To watch for changes in Javascript source and bundle all of the packages that we are using, using the following command in a separate terminal (while the flask command above is running).

```bash
$ npm run watch
```

This combines the code written in the source folder with modules installed to all to one file `bundle.js` which ends up in the Flask static directory. In `webpack.config.js` make sure that we are in development mode while making changes and in production mode when deploying.

## Resources
I could not figure out a clean way to use ES5 require statements and modules installed with npm along with Flask (hence the need for two calls during development). I tried using [Flask-Assets](https://flask-assets.readthedocs.io/en/latest/), but there was only support for minification and not for bundling files included with require. I looked into creating a [custom filter](https://webassets.readthedocs.io/en/latest/custom_filters.html) and found an [example with esbuild that looked promising](https://haliphax.dev/2020/09/minifying-javascript-using-esbuild-with-flask-assets/), but kept repeatedly getting an error message. The current solution is based on this [2017 blog post](https://github.com/jrybicki-jsc/flasknpm).
