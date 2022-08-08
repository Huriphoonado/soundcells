function getReducedXML(args) {
    let xml = args.xml || undefined;
    let measure_num = args.measure_num || 3;
    let curr_measure = (args.curr_measure != undefined) ? args.curr_measure : 1;
    let hasPickup = args.hasPickup || false;
    let measureLength = args.measureLength || 1;

    // BUG - this is breaking when there is no pickup and cursor is in front of first measure

    let parser = new DOMParser();
    let miniScore = parser.parseFromString(xml,"text/xml");
    // IF this ever breaks, we need to add a fallback return, perhaps of xml itself

    // console.log(xml)

    let measures = miniScore.getElementsByTagName("measure");

    let attributes = measures[0].getElementsByTagName("attributes")[0].cloneNode(true);

    // console.log(attributes.childNodes)

    for (let i = 1; i < curr_measure; i++) {
        let new_attr = measures[i].getElementsByTagName("attributes")[0];
        if (new_attr) {
            // childNodes has strange "text" nodes at the beginning/end/between the nodes we care about, so
            // we are skipping them by starting at index 1 and incrementing by 2 
            for (let j = 1; j < new_attr.childNodes.length; j += 2) {
                let nName = new_attr.childNodes[j].nodeName;
                let existing_node = attributes.getElementsByTagName(nName)[0];
                if (existing_node) {
                    attributes.replaceChild(new_attr.childNodes[j].cloneNode(true), existing_node);
                }
                else {
                    attributes.appendChild(new_attr.childNodes[j].cloneNode(true));
                }
            }
        }
    }

    // for idx = curr - (meas_num // 2), idx <= curr + meas_num // 2, idx ++, array.push(idx)
    let measure_slice = [...Array(measure_num) ].map((v, i) => i - Math.trunc(measure_num / 2) + curr_measure)
        .filter(v => v > !hasPickup - 1 && v <= measureLength);
    /* for (let idx = (curr_measure - Math.floor(measure_num / 2)); idx <= (curr_measure + Math.floor(measure_num / 2)); idx++) {
        measure_slice.push(idx)
    } */
    console.log(measure_slice);

    let idx = 0;
    while (measures.length > measure_slice.length) {
        /* if (measures[idx].getAttribute("number") != curr_measure) {
            measures[idx].parentNode.removeChild(measures[idx])
        }
        else idx++ */
        // console.log("Checking measure slice:", measure_slice)
        // console.log("Checking current measure number", measures[idx].getAttribute("number"))
        // console.log("Checking if measure number is in measure slice", measure_slice.includes(Number(measures[idx].getAttribute("number"))))
        if (measure_slice.includes(Number(measures[idx].getAttribute("number")))) {
            idx++
        }
        else {
            measures[idx].parentNode.removeChild(measures[idx])
        }
    }

    let existing_attr = measures[0].getElementsByTagName("attributes")[0];
    if (existing_attr) measures[0].removeChild(existing_attr);

    measures[0].insertBefore(attributes, measures[0].getElementsByTagName("note")[0]);

    return miniScore;
}

export { getReducedXML };