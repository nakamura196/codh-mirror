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
                curationJsonExportUrl: 'https://mp.ex.nii.ac.jp/api/curation/json',
                curationViewerUrl: 'http://codh.rois.ac.jp/software/iiif-curation-viewer/demo/',
                curationEditorUrl: 'http://codh.rois.ac.jp/software/iiif-curation-editor/demo/',
                curationPlayerUrl: 'http://codh.rois.ac.jp/software/iiif-curation-player/demo/',
                curationBoardUrl: 'http://codh.rois.ac.jp/software/iiif-curation-board/demo/'
            }
        }
    };
    return IIIFCurationManager(configExample.generic);
})();