/*
 * IIIF Curation Editor - JSONkeeper export plugin
 * http://codh.rois.ac.jp/software/iiif-curation-editor/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see iiif-curation-editor/acknowledgements.txt
 */
var iceExportJsonKeeper = (function() {
    var jsonKeeperConfig = {
        accessControl: 'firebase',
        allowAnonymousPost: true,
        redirectUrl: '.'
    };
    return ICEExportJsonKeeper(jsonKeeperConfig);
})();