/*
 * IIIF Curation Player v2.0
 * http://codh.rois.ac.jp/software/iiif-curation-player/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see iiif-curation-player/acknowledgements.txt
 */
var iiifPlayer = (function() {
    var configExample = {
        generic_jsonKeeper: {
            trustedUrlPrefixes: ['https://', 'http://'], //無制限
            service: {
                curationJsonExportUrl: 'https://mp.ex.nii.ac.jp/api/curation/json'
            },
            descriptionDialog: {
                //整数＋単位で指定（ピクセル単位であれば'px'、マップの大きさに対する相対指定であれば'%'）
                defaultWidth: '50%',
                defaultHeight: '95px'
            }
        }
    };
    return IIIFCurationPlayer(configExample.generic_jsonKeeper);
})();