/*
 * IIIF Curation Editor v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-editor/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see iiif-curation-editor/acknowledgements.txt
 */
var iiifEditor = (function() {
    var configExample = {
        generic: {
            service: {
                curationJsonExportUrl: 'https://jsonkeeper.na-kamura-1263.workers.dev/api'
            }
        },
        curation: {
            service: {
                curationJsonExportUrl: 'https://jsonkeeper.na-kamura-1263.workers.dev/api'
            },
            jsonEditorOptions: {
                schema: curationSchema
            }
        }
    };
    return IIIFCurationEditor(configExample.curation);
})();