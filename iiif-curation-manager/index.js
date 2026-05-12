/*
 * IIIF Curation Manager v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-manager/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see iiif-curation-manager/acknowledgements.txt
 */
var iiifManager = (function() {
    var configExample = {
        generic: {
            service: {
                curationJsonExportUrl: 'https://jsonkeeper.na-kamura-1263.workers.dev/api',
                curationViewerUrl: '../iiif-curation-viewer/',
                curationEditorUrl: '../iiif-curation-editor/',
                curationPlayerUrl: '../iiif-curation-player/',
                curationBoardUrl: '../iiif-curation-board/'
            }
        }
    };
    return IIIFCurationManager(configExample.generic);
})();