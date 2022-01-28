// Object for caching
// Currently supports the abc document, but could support other settings

class Cacher {
    constructor() {
        this.stored = {};
        if (typeof(Storage) !== "undefined" && localStorage.getItem('abcText')) {
            this.stored.abcText = localStorage.getItem('abcText');
        }
    }

    // Gets called on user edits
    saveABCText(abcText) {
        this.stored.abcText = abcText;
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('abcText', abcText);
        }
    }

    // Gets called at the start
    retrieveABCText() { return this.stored.abcText; }
}

export { Cacher };
