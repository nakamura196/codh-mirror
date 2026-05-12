/*
 * IIIF Curation Board v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-board/
 *
 * Copyright 2020 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see acknowledgements.txt
 */
var iiifViewer = (function() {
    var configExample = {
        generic_jsonKeeper: {
            service: {
                curationJsonExportUrl: 'https://jsonkeeper.na-kamura-1263.workers.dev/api'
            }
        }
    };
    return IIIFCurationBoard(configExample.generic_jsonKeeper);
})();