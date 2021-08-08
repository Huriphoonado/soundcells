import { saveAs } from 'file-saver';
import * as JSZip from 'jszip';

import { Alert } from 'bootstrap';

class FileDownloader {
    constructor() {
        this.title = 'Sketch';
        this.notifications;

        this.files = {
            abc: { content: '', ext: '.abc', el: '' },
            xml: { content: '', ext: '.xml', el: '' }
        }
    }

    download() {
        let f2d = Object.values(this.files).filter(f => f.el.checked);
        // If no files selected, should show an alert.
        if (!f2d.length) {
            addAlert('No files selected!',
                    {alertType: 'warning', location: this.notifications});
            return;
        }
        let zip = new JSZip();
        //let folder = f2d.length > 1 ? `${this.title}/` : '';
        f2d.forEach(f => zip.file(`${this.title}${f.ext}`, f.content));

        zip.generateAsync({type:"blob"})
        .then(blob => {
            saveAs(blob, `${this.title}.zip`);
            addAlert(`Downloading folder with ${f2d.length} file(s)!`,
                    {alertType: 'success', location: this.notifications});
            }, err => {
                console.log(err)
                addAlert(`Download failed.`, {alertType: 'error', location: this.notifications});
            }
        );
    }

    attachHTML(fileType, htmlElem) {
        if (!(fileType in this.files)) return false;
        this.files[fileType].el = htmlElem;
    }

    setContent(fileType, content) { this.files[fileType].content = content; }

    setTitle(title) { this.title = title || 'Sketch'; }
}

function addAlert(message, options) {
    let location = options.location || document.body;
    let alertType = options.alertType || 'primary';
    let alertTime = options.time || 3000;

    let newAlert = document.createElement("div");
    newAlert.classList.add("alert", "fade", "show", `alert-${alertType}`);
    newAlert.setAttribute("role", "alert");
    newAlert.appendChild(document.createTextNode(message));
    location.appendChild(newAlert);

    let bsAlert = new Alert(newAlert);
    setTimeout(() => { bsAlert.close() }, alertTime);
}

export { FileDownloader };
