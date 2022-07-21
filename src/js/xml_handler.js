function getReducedXML(args) {
    let xml = args.xml || undefined;
    let measure_num = args.measure_num || 1;
    let curr_measure = args.curr_measure || 1;

    let parser = new DOMParser();
    let miniScore = parser.parseFromString(xml,"text/xml");
    // IF this ever breaks, we need to add a fallback return, perhaps of xml itself

    // console.log(xml)

    let measures = miniScore.getElementsByTagName("measure");

    let attributes = measures[0].getElementsByTagName("attributes")[0].cloneNode(true);

    console.log(attributes.childNodes)

    for (let i = 1; i < curr_measure; i++) {
        let new_attr = measures[i].getElementsByTagName("attributes")[0];
        if (new_attr) {
            console.log(new_attr.childNodes);
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
                console.log(existing_node);
            }
        }
    }

    // console.log(measures)
    /*
    for (let idx = 0; idx < measures.length; idx++) {
        if (measures[idx].getAttribute("number") != curr_measure) {
            console.log("I'm here")
            measures[idx].parentNode.removeChild(measures[idx])
        }
        //console.log(measures[idx].getAttribute("number"))
    }
    */

    let idx = 0;
    while (measures.length > measure_num) {
        console.log(measures[idx])
        if (measures[idx].getAttribute("number") != curr_measure) {
            measures[idx].parentNode.removeChild(measures[idx])
        }
        else {
            idx++
        }
    }

    let existing_attr = measures[0].getElementsByTagName("attributes")[0];
    if (existing_attr) measures[0].removeChild(existing_attr);


    measures[0].insertBefore(attributes, measures[0].getElementsByTagName("note")[0]);

    console.log(miniScore)

    return miniScore;
}

export { getReducedXML };