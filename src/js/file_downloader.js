import { saveAs } from 'file-saver';
import * as JSZip from 'jszip';

import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

import { addAlert } from './dom_manip'
import { state } from "./index";

class FileDownloader {
    constructor() {
        this.title = 'Sketch';
        this.notifications;
        this.score;

        this.files = {
            abc: { content: '', ext: '.abc', el: '' },
            brf: { content: '', ext: '.brf', el: '' },
            pdf: { content: '', ext: '.pdf', el: '' },
            xml: { content: '', ext: '.xml', el: '' },
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

        // Zip all the text files
        f2d.filter(f => (f.ext != '.pdf')).forEach(f => {
            zip.file(`${this.title}${f.ext}`, f.content)
        });

        let pdfFile = f2d.filter(f => (f.ext == '.pdf'))[0];
        if (pdfFile != undefined) {
            createPdf(this.score).then((r) => {
                zip.file(`${this.title}${pdfFile.ext}`, r.output('blob'))
                this._zipAsync(zip);
            })
        }
        else this._zipAsync(zip);
    }

    attachHTML(fileType, htmlElem) {
        if (!(fileType in this.files)) return false;
        this.files[fileType].el = htmlElem;
    }

    setContent(fileType, content) { this.files[fileType].content = content; }

    setTitle(title) { this.title = title || 'Sketch'; }

    _zipAsync(zip) {
        zip.generateAsync({type:"blob"})
        .then(blob => {
            saveAs(blob, `${this.title}.zip`);
            addAlert(`Downloading folder with ${Object.keys(zip.files).length} file(s)!`,
                    {alertType: 'success', location: this.notifications});
            }, err => {
                console.log(err);
                addAlert(`Download failed.`, {alertType: 'error', location: this.notifications});
            }
        );
    }
}

// Some original source code
// https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/792
// 1. Resize the svg to a standard (not based on browser window)
// 2. Set page layout settings
// 3. Create PDF - for each page add the svg
// 4. Change the svg back to responsive web mode
async function createPdf(score) {
    if (!score.drawer) {console.log("no score yet."); return false;}

    state.orientation = (document.getElementById('paperOrient1').checked) ? "P" : "L";
    state.pageFormat = (document.getElementById('paperSize1').checked) ? "A4" : "A3";
    let pageFormat = `${state.pageFormat} ${state.orientation}`;

    standardSVGSize(score, pageFormat, state.orientation);

    const backends = score.drawer.Backends;
    let svgElement = backends[0].getSvgElement();

    let pageWidth = pageFormat === "A4 P" ? 210 : pageFormat === "A4 L" ? 297 : pageFormat === "A3 P" ? 297 : 420;
    let pageHeight = pageFormat === "A4 P" ? 297 : pageFormat === "A4 L" ? 210 : pageFormat === "A3 P" ? 420 : 297;

    const orientation = pageHeight > pageWidth ? "portrait" : "landscape";
    // create a new jsPDF instance
    const pdf = new jsPDF({
        orientation: orientation,
        unit: "mm",
        format: [pageWidth, pageHeight]

    });
    const scale = pageWidth / svgElement.clientWidth;

    for (let i = 0; i < backends.length; i++) {
        if (i > 0) pdf.addPage();
        let svgPage = backends[i].getSvgElement();

        // Fixes broken Tempo text node
        // This changes the font family and uses pixels for font size
        // May need more testing if other text breaks in PDF output!
        svgPage.childNodes.forEach((nd, i) => {
            if (nd.tagName == 'text') {
                nd.setAttribute("font-family", "Times New Roman");
                nd.setAttribute("font-size",
                (Math.round(nd.getAttribute("font-size").split("p")[0] / 3 * 4) + 'px'));
            };
        });

        await pdf.svg(svgPage, {
            width: svgPage.clientWidth * scale,
            height: svgPage.clientHeight * scale,
            x: 0,
            y: 0
        });
    }

    responsiveSVGSize(score);
    return pdf;
}

// Prepares an svg for printing
function standardSVGSize(score, pageFormat, orientation) {
    let sz = `${1200 * (orientation == 'L' ? 1.41 : 1)}px`

    score.autoResize = false;
    score.setPageFormat(pageFormat);
    document.getElementById('score').style.minWidth = sz;
    score.render();
}

// Returns the svg to responsive web layout
function responsiveSVGSize(score) {
    score.autoResize = true;
    score.setPageFormat("Endless");
    document.getElementById('score').style.minWidth = null;
    score.render();
}

export { FileDownloader };
