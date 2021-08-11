// Custom UI functions built on Bootstrap

import { Alert } from 'bootstrap';

// Simply adds a Bootstrap alert to the page
// Optionally specify where it should be added, the time it should be displayed,
// and the type of alert (e.g. primary, warning, error, etc.)
let addAlert = function(message, options) {
    let opt = options || {};
    let location = opt.location || document.body;
    let alertType = opt.alertType || 'primary';
    let alertTime = opt.time || 3000;

    let newAlert = document.createElement("div");
    newAlert.classList.add("alert", "fade", "show", `alert-${alertType}`);
    newAlert.setAttribute("role", "alert");
    newAlert.appendChild(document.createTextNode(message));
    location.prepend(newAlert);

    let bsAlert = new Alert(newAlert);
    setTimeout(() => { bsAlert.close() }, alertTime);
}

// Screen Reader Speech
// https://a11y-guidelines.orange.com/en/web/components-examples/make-a-screen-reader-talk/
// This works fine with VoiceOver - did not seem to work with NVDA/JAWS
// https://a11ysupport.io/tests/tech__aria__aria-live#related-features
function srSpeak(text, priority) {
    let el = document.createElement("div");
    let id = "speak-" + Date.now();
    el.setAttribute("id", id);
    el.setAttribute("aria-live", priority || "polite"); // "assertive"
    //el.classList.add("sr-only");
    el.classList.add("visually-hidden");
    document.body.appendChild(el);

    window.setTimeout(function () {
        document.getElementById(id).innerHTML = text;
    }, 100);

    window.setTimeout(function () {
        document.body.removeChild(document.getElementById(id));
    }, 1000);
}

export { addAlert, srSpeak };
