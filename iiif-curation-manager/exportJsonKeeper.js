/*
 * IIIF Curation Manager - JSONkeeper export plugin
 * http://codh.rois.ac.jp/software/iiif-curation-manager/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 */
var icmExportJsonKeeper = (function() {
    var jsonKeeperConfig = {
        accessControl: 'firebase',
        allowAnonymousPost: true
    };
    return ICMExportJsonKeeper(jsonKeeperConfig);
})();