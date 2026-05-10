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
                curationJsonExportUrl: 'https://mp.ex.nii.ac.jp/api/curation/json'
            }
        },
        curation: {
            service: {
                curationJsonExportUrl: 'https://mp.ex.nii.ac.jp/api/curation/json'
            },
            jsonEditorOptions: {
                schema: curationSchema
            }
        }
    };
    return IIIFCurationEditor(configExample.curation);
})();