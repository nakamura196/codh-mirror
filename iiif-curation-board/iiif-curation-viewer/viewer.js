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
var IIIFCurationBoard = function(config) {
    'use strict';

    var APP_NAME = 'IIIF Curation Board';
    var VERSION  = '1.0.0+20210528';
    console.log(APP_NAME + ' ' + VERSION); // eslint-disable-line no-console

    //リテラルはさほど多くないので、i18n用のフレームワークは用いず、直接記述する。
    var lng = String(window.navigator.language || window.navigator.userLanguage || 'ja').substr(0, 2) !== 'ja' ? 'en' : 'ja';

    var map; //Leaflet

    var bookInfos = [];
    var pageInfos = [];
    var curationInfo = {};

    var err;

    var enableCurationEdit = true;
    var storage;
    try {
        storage = localStorage;
    } catch (e) {
        enableCurationEdit = false;
    }
    var storageSession;
    try {
        storageSession = sessionStorage;
    } catch (e) {
        //
    }

    var STICKY_LAYER_NAME = 'stickies';
    var MARKER_LAYER_NAME = 'annotations';
    var SHEET_LAYER_NAME = 'sheets';

    var THUMBNAIL_WIDTH = 100;
    var THUMBNAIL_HEIGHT = 100;

    var CONTEXT_CURATION = 'http://codh.rois.ac.jp/iiif/curation/1/context.json';

    var ICV_ERROR = {
        SILENT: -1,
        NO_ERROR: 0,            //エラー表示不要（ナビゲーション要素を隠すのみ）
        DOWNLOAD_FAIL: 1,       //データを取得できない
        UNSUPPORTED_VERSION: 2, //対応していないバージョンのIIIFデータ
        INCORRECT_DATA: 3,      //データ異常
        WEB_STORAGE: 4          //Web Storageに問題（QuotaExceededErrorなど）
    };

    var defaultConfig = {
        service: {
            croppedImageExportUrl: '', //関連： getCroppedImageExportHtml()
            curationJsonExportUrl: ''  //関連： exportCurationJson()
        }
    };
    var conf = configure(config, defaultConfig);

    var params = getParams(location.search);
    if (params) {
        if ('lang' in params) { //表示言語指定
            if (params.lang !== 'ja') {
                lng = 'en'; //ja以外は全てenにfallback
            } else {
                lng = 'ja';
            }
        }
    }

    setupCurationDroppableArea(); //キュレーションのドラッグ＆ドロップ受け入れ準備
    setupUILang(); //UI表示言語切り替え

    var tnsize;
    var wrapThumbnail = false;
    if (params) {
        if ('tnsize' in params) { //サムネイル表示サイズ指定（IIIF Image API非対応リソースに対しては無効）
            tnsize = String(params.tnsize).toLowerCase();
            if (tnsize === 'full' || tnsize === 'sizebyw' || tnsize === 'sizebyh') {
                wrapThumbnail = true;
            }
        }
        if ('curation' in params) { //curation.jsonのURLによる表示対象指定
            if (params.curation) {
                processCurationUrl(params.curation);
            } else {
                err = new Error(); showError(ICV_ERROR.DOWNLOAD_FAIL, err.lineNumber); //curationパラメータの値異常
            }
        } else {
            err = new Error(); showError(ICV_ERROR.NO_ERROR, err.lineNumber); //表示対象指定パラメータなし
        }
    } else {
        err = new Error(); showError(ICV_ERROR.NO_ERROR, err.lineNumber); //GET引数なし
    }
    function setupUILang() {
        $('html').attr('lang', lng);
        //コンテンツを表示していない（setupNavigations()が呼ばれない）時点での表示言語切り替え等
        if ($('.nav_lang_ja').length && $('.nav_lang_en').length) {
            if (lng !== 'ja') {
                var $ja = $('<a>').attr('href', '?lang=ja').text('日本語');
                $('.nav_lang_ja').html($ja);
                $('.nav_lang_en').text('English');
            } else {
                var $en = $('<a>').attr('href', '?lang=en').text('English');
                $('.nav_lang_ja').text('日本語');
                $('.nav_lang_en').html($en);
            }
        }
        //タイトル
        if ('title' in conf) { //設定がある場合だけ、HTMLでの指定を上書き
            var title = getPropertyValueI18n(conf.title);
            $('#navbar_brand').html(title);
            document.title = $('#navbar_brand').text();
        }
        //ヘッダ
        var $navbar_brand_link = $('a#navbar_brand');
        if (!$navbar_brand_link.attr('data-href-orig')) { //オリジナルのhrefを待避
            $navbar_brand_link.attr('data-href-orig', $navbar_brand_link.attr('href'));
        }
        var hrefOrig = $navbar_brand_link.attr('data-href-orig');
        var hrefNew = hrefOrig + ((String(hrefOrig).indexOf('?') > -1) ? '&' : '?') + 'lang=' + lng;
        $navbar_brand_link.attr('href', hrefNew);
    }

    //----------------------------------------------------------------------
    function configure(config, defaultConfig) {
        var conf_ = defaultConfig;
        if ($.isPlainObject(config)) {
            if ($.type(config.title) === 'string' || $.type(config.title) === 'array') {
                conf_.title = config.title;
            }
            if ($.isPlainObject(config.service)) {
                if ($.type(config.service.croppedImageExportUrl) === 'string') {
                    conf_.service.croppedImageExportUrl = config.service.croppedImageExportUrl;
                }
                if ($.type(config.service.curationJsonExportUrl) === 'string') {
                    conf_.service.curationJsonExportUrl = config.service.curationJsonExportUrl;
                }
            }
        }
        conf_.service.croppedImageExport = conf_.service.croppedImageExportUrl;
        conf_.service.curationJsonExport = conf_.service.curationJsonExportUrl;
        return conf_;
    }
    function setupCurationDroppableArea() {
        // curation drag and drop
        var $droppable = $('#image_canvas');
        $droppable.on('dragover', function(e) {
            e.stopPropagation();
            e.preventDefault();
        });
        $droppable.on('dragenter', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $(this).addClass('manifest_dragging');
        });
        $droppable.on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('manifest_dragging');
            var url = e.originalEvent.dataTransfer.getData('URL');
            if (!url) {
                var text = e.originalEvent.dataTransfer.getData('text/plain');
                var anchor = document.createElement('a');
                anchor.href = text;
                var href = anchor.href;
                if (href) {
                    var curationJsonExportUrl = getCurationJsonExportUrl();
                    if (/^https?:\/\//.test(href) && /curation(\.json)?$/.test(href)) {
                        //URLだけからcurationであることは判断できないので、
                        //curation または curation.json で終了している場合のみを対象とする。
                        url = href;
                    } else if (curationJsonExportUrl && href.indexOf(curationJsonExportUrl) === 0) {
                        //curationエクスポート先URLから始まっていれば、curationである可能性は高い
                        url = href;
                    } else if (href.indexOf('?') > -1) {
                        var params__ = getParams(href.substring(href.indexOf('?')));
                        if (params__ && params__.curation) {
                            url = params__.curation;
                        }
                    }
                }
            }
            if (url) {
                var curationUrl;
                if (url.indexOf('?') > -1) {
                    var search = url.substring(url.indexOf('?'));
                    var params_ = getParams(search);
                    if (params_) {
                        curationUrl = params_.curation;
                    }
                }
                params = {};
                params.curation = curationUrl || url;
                bookInfos = [];
                pageInfos = [];
                curationInfo = {};
                enableCurationEdit = true;
                showError(ICV_ERROR.NO_ERROR);
                updateHistory();
                processCurationUrl(params.curation);
            }
        });
        $(document).on('dragenter', function(e) {
            e.stopPropagation();
            e.preventDefault();
            $droppable.removeClass('manifest_dragging');
        });
        $(document).on('dragover drop', function(e) {
            e.stopPropagation();
            e.preventDefault();
        });
    }

    function getParams(search) {
        var query = search.substring(1);
        if (query !== '') {
            var params = query.split('&');
            var paramsObj = {};
            for (var i = 0; i < params.length; i++) {
                var elems = params[i].split('=');
                if (elems.length > 1) {
                    var key = decodeURIComponent(elems[0]);
                    var val = decodeURIComponent(elems[1]);
                    paramsObj[key] = val;
                }
            }
            return paramsObj;
        } else {
            return null;
        }
    }

    //----------------------------------------------------------------------
    //---------- curation関係 ----------
    //curationパラメータで指定されたcurationの取得 → preprocessManifestsまたはpreprocessTimelinesで内容処理
    function processCurationUrl(curationUrl) {
        $('#book_title').text((lng !== 'ja') ? 'Loading...' : '読み込み中です...');
        // $('#page_navigation').hide();
        $.getJSON(curationUrl, function(curation_) {
            if (isValidCurationFalseTrue(curation_)) {
                //var isAnnotationViewMode = false;
                //IIIF Cutation Boardでは、アノテーションビューモードは区別しない
                //selectionsプロパティ
                var bookParams = [];
                for (var i = 0; i < curation_.selections.length; i++) {
                    var range = curation_.selections[i];
                    // http://iiif.io/api/presentation/2.1/#range
                    if ($.isPlainObject(range) && range['@type'] === 'sc:Range') {
                        if (range.within) { //withinプロパティ
                            var manifestUrl = '';
                            var within = range.within;
                            if ($.type(within) === 'string') {
                                manifestUrl = within;
                            } else if ($.isPlainObject(within) && within['@id'] && within['@type'] && $.type(within['@id']) === 'string') {
                                if (within['@type'] === 'sc:Manifest') {
                                    manifestUrl = within['@id'];
                                }
                            }
                            if (manifestUrl) {
                                var canvasIds = [];
                                var j;
                                if ($.isArray(range.canvases)) { //Rangeのcanvasesプロパティによる表示対象指定
                                    //キュレーションビューモード扱い
                                    canvasIds = range.canvases; //canvasの@idの配列
                                } else if ($.isArray(range.members)) { //membersプロパティによる表示対象指定
                                    //membersプロパティ内では、sc:Canvasのみ対応。membersプロパティ内のsc:Rangeは未対応。
                                    for (j = 0; j < range.members.length; j++) {
                                        var member = range.members[j];
                                        if ($.isPlainObject(member) && member['@id'] && member['@type']) {
                                            if (member['@type'] === 'sc:Canvas') {
                                                //キュレーションビューモード扱い
                                                canvasIds.push(member['@id']);
                                            }
                                        }
                                    }
                                }
                                if (canvasIds.length > 0) {
                                    var bookParam = {
                                        manifestUrl : manifestUrl,
                                        canvasIds   : canvasIds,
                                        isFiltered  : true //結果的に元資料と同じ順番で全ページ表示されることになったとしても、ページ絞り込みありとして扱う。
                                    };
                                    bookParams.push(bookParam);
                                }
                            }
                        }
                    }
                }
                if (bookParams.length > 0) {
                    curationInfo = {
                        curation: curation_,
                        curationUrl: curationUrl
                    };
                    preprocessManifests(bookParams);
                } else {
                    err = new Error(); showError(ICV_ERROR.INCORRECT_DATA, err.lineNumber); //selectionsプロパティ記載異常
                }
            } else {
                err = new Error(); showError(ICV_ERROR.INCORRECT_DATA, err.lineNumber); //json異常（invalidもしくは対応外の内容）(curation)
            }
        }).fail(function(jqxhr, textStatus, error) {
            err = new Error(); showError(ICV_ERROR.DOWNLOAD_FAIL, err.lineNumber, textStatus + ', ' + error); //jsonの取得に失敗(curation)
        });
    }

    //---------- manifest関係 ----------
    //curation.json内で指定されたmanifest(s)の取得 → processManifestsで内容処理
    function preprocessManifests(bookParams) {
        $('#book_title').text((lng !== 'ja') ? 'Loading...' : '読み込み中です...');
        // $('#page_navigation').hide();
        var i;
        var manifestUrls = [];
        for (i = 0; i < bookParams.length; i++) {
            if ($.inArray(bookParams[i].manifestUrl, manifestUrls) === -1) {
                manifestUrls.push(bookParams[i].manifestUrl);
            }
        }
        var deferreds = [];
        for (i = 0; i < manifestUrls.length; i++) {
            deferreds.push($.getJSON(manifestUrls[i]));
        }
        $.when.apply($, deferreds).done(function() {
            //全てのmanifest.json取得に成功してから
            var manifests = [];
            if (deferreds.length === 1 && arguments[1] === 'success') {
                manifests.push(arguments[0]);
            } else {
                for (i = 0; i < deferreds.length; i++) {
                    if (arguments[i][1] === 'success') {
                        manifests.push(arguments[i][0]);
                    }
                }
            }
            if (deferreds.length === manifests.length) {
                processManifests(manifests, manifestUrls, bookParams);
            } else {
                err = new Error(); showError(ICV_ERROR.DOWNLOAD_FAIL, err.lineNumber); //jsonの取得時に'success'でないものがある(manifest)
            }
        }).fail(function(jqxhr, textStatus, error) {
            err = new Error(); showError(ICV_ERROR.DOWNLOAD_FAIL, err.lineNumber, textStatus + ', ' + error); //jsonの取得に失敗(manifests)
        });
    }

    //manifest(s)の内容処理
    function processManifests(manifests, manifestUrls, bookParams) {
        $('#book_title').text('').hide();
        function getCanvasSummary(canvas) {
            var imageApiVersion = '0.0';
            var imageComplianceLevel = -1;
            var imageInfoUrl;
            if (canvas.images[0].resource.service) {
                //The service must have the @context, @id and profile keys
                //https://iiif.io/api/annex/services/#image-information

                //Image API Version
                imageApiVersion = '1.0';
                var context = canvas.images[0].resource.service['@context'];
                var contextStrings = {
                    'http://iiif.io/api/image/2/context.json': '2.0',
                    'http://library.stanford.edu/iiif/image-api/1.1/context.json': '1.1'
                };
                if ($.type(context) === 'string') {
                    imageApiVersion = contextStrings[context] || imageApiVersion;
                } else if ($.isArray(context)) {
                    $.each(context, function(key, context_) {
                        if ($.type(context_) === 'string') {
                            imageApiVersion = contextStrings[context_] || imageApiVersion;
                        }
                    });
                }

                //service base URI
                imageInfoUrl = canvas.images[0].resource.service['@id'] + '/info.json';

                //Image API Compliance Level
                var profile = canvas.images[0].resource.service.profile;
                if ($.type(profile) === 'string') {
                    var match;
                    //IIIFの仕様では、Compliance Levelの記述は次のように指定することとなっている。
                    //Image API 2.x：http://iiif.io/api/image/2/level0.json
                    //Image API 1.1：http://library.stanford.edu/iiif/image-api/1.1/compliance.html#level0
                    //Image API 1.0：http://library.stanford.edu/iiif/image-api/compliance.html#level0
                    if (profile.indexOf('http://iiif.io/api/image/2/') === 0) {
                        match = profile.match(/level([0-2])\.json$/);
                        if (match) {
                            imageComplianceLevel = parseInt(match[1], 10);
                        }
                    } else if (profile.indexOf('http://library.stanford.edu/iiif/image-api/') === 0) {
                        //例えば Harvard Art Museumsの manifestでは、仕様に反して
                        //http://library.stanford.edu/iiif/image-api/1.1/conformance.html#level1
                        //と記載している。こうしたサイトにも対応するため、判定基準を甘くする。
                        match = profile.match(/#level([0-2])$/);
                        if (match) {
                            imageComplianceLevel = parseInt(match[1], 10);
                        }
                    }
                }
            }

            //サムネイル
            var thumbnail;
            if ($.type(canvas.thumbnail) === 'string') {
                thumbnail = canvas.thumbnail;
            } else if ($.isPlainObject(canvas.thumbnail) && canvas.thumbnail['@id']) {
                thumbnail = canvas.thumbnail['@id'];
            }

            //Canvasオブジェクトの抜粋
            var canvasSummary = {
                id: canvas['@id'],
                label: canvas.label,
                imageInfoUrl: imageInfoUrl,
                imageApiVersion: imageApiVersion,
                imageComplianceLevel: imageComplianceLevel, //IIIF Image API非対応リソースの場合は-1
                imageResourceId: canvas.images[0].resource['@id'], //Compliance Levelの低いサイトで画像全体を取得するために利用
                thumbnail: thumbnail,
                height: (typeof canvas.height === 'number') ? canvas.height : void 0,
                width: (typeof canvas.width === 'number') ? canvas.width : void 0
            };
            return canvasSummary;
        }
        var i, j;
        for (i = 0; i < manifests.length; i++) {
            var manifest = manifests[i];
            if (isValidManifestFalseTrue(manifest)) {
                try {
                    var canvasesSummary = [];
                    for (j = 0; j < manifest.sequences[0].canvases.length; j++) {
                        var summary = getCanvasSummary(manifest.sequences[0].canvases[j]);
                        if (summary) {
                            canvasesSummary.push(summary);
                        }
                    }
                    var bookInfo = {
                        manifestUrl     : manifestUrls[i],
                        manifest        : manifest,
                        canvases        : canvasesSummary,
                        totalPagesNum   : canvasesSummary.length
                    };
                    bookInfos.push(bookInfo);
                } catch (e) {
                    //
                }
            }
        }
        manifestUrls = [];
        for (i = 0; i < bookInfos.length; i++) {
            manifestUrls.push(bookInfos[i].manifestUrl);
        }
        for (i = 0; i < bookParams.length; i++) {
            var bookParam = bookParams[i];
            var bookIndex = $.inArray(bookParam.manifestUrl, manifestUrls);
            if (bookIndex > -1) {
                if (bookInfos[bookIndex].totalPagesNum > 0) {
                    var pageInfo = {};
                    var pageInfosLocal = [];
                    if (bookParam.canvasIds) {
                        //curation.json内の"selections"で表示範囲が指定されている場合
                        for (j = 0; j < bookParam.canvasIds.length; j++) {
                            var canvasIdElems = bookParam.canvasIds[j].split('#');
                            var idx = $.inArray(canvasIdElems[0], getCanvasIds(bookIndex));
                            var fragment = void 0; //undefined
                            if (canvasIdElems.length > 1) {
                                fragment = canvasIdElems[1];
                            }
                            if (idx > -1) {
                                pageInfo = {
                                    bookIndex : bookIndex,
                                    pageLocal : idx + 1, //1-based（元資料でのページ番号）
                                    fragment  : fragment
                                };
                                pageInfosLocal.push(pageInfo);
                            }
                        }
                    }
                    if (pageInfosLocal.length > 0) {
                        pageInfos = pageInfos.concat(pageInfosLocal);
                    }
                }
            }
        }
        if (pageInfos.length === 0) {
            err = new Error(); showError(ICV_ERROR.INCORRECT_DATA, err.lineNumber); //データ異常（表示すべきコマがない（見つけられない））
            return;
        }
        //curationパラメータで指定された外部キュレーションを表示するときは、編集用にsessionStorageへ格納する
        if (getBrowsingCurationUrl()) {
            var externalFavData = getBrowsingCurationFavs();
            setFavs(externalFavData, true); //キュレーション対象のcanvasとURLが格納される
            if (storageSession) {
                //上書きエクスポート時にも、キュレーションのlabel等（selections以外）を維持するため、元の値を格納しておく
                var browsingCurationJson = JSON.parse(JSON.stringify(getBrowsingCurationJson()));
                //browsingCurationJson.selections = []; //キュレーションリスト画面の内容で差し替えるので保存不要 → 部分エクスポートに利用するので保存する
                try {
                    storageSession.setItem('curationJson', JSON.stringify(browsingCurationJson));
                } catch (e) {
                    enableCurationEdit = false;
                    err = new Error(); showError(ICV_ERROR.WEB_STORAGE, err.lineNumber, e);
                }
            }
            if (curationInfo.curation.label) {
                var curationLabel = getPropertyValueI18n(curationInfo.curation.label);
                document.title = curationLabel + ' | ' + (getPropertyValueI18n(conf.title) || APP_NAME);
                $('#book_title').text(curationLabel).hide();
            }
        }
        //GETパラメータによる明示的なサムネイル表示サイズ指定がないときは、キュレーション内の指定を探す
        if (!tnsize && getBrowsingCurationUrl()) {
            var thumbnailsProps = getThumbnailsPropsFromCurationMetadata();
            if (thumbnailsProps) {
                if ('thumbnailSizeHint' in thumbnailsProps) {
                    tnsize = String(thumbnailsProps.thumbnailSizeHint).toLowerCase();
                    if (tnsize === 'full' || tnsize === 'sizebyw' || tnsize === 'sizebyh') {
                        wrapThumbnail = true;
                    }
                }
            }
        }
        function getThumbnailsPropsFromCurationMetadata() {
            var curation = getBrowsingCurationJson();
            if ('metadata' in curation && $.isArray(curation.metadata)) {
                for (var i = 0; i < curation.metadata.length; i++) {
                    var metadatum = curation.metadata[i];
                    if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isArray(metadatum.value)) {
                        var mda = metadatum.value;
                        for (var j = 0; j < mda.length; j++) {
                            var metadatum_ = mda[j];
                            if (metadatum_ && String(metadatum_.label).toLowerCase() === 'thumbnails' && $.isPlainObject(metadatum_.value)) {
                                var thumbnailsProps = metadatum_.value;
                                return thumbnailsProps;
                            }
                        }
                    }
                }
            }
            return;
        }

        //---------------------------------------------------------------------
        var attributions = [];
        for (i = 0; i < bookInfos.length; i++) {
            var attr = bookInfos[i].manifest.attribution;
            if (attr) {
                attr = getPropertyValueI18n(attr);
                if ($.inArray(attr, attributions) === -1) {
                    attributions.push(attr);
                }
            }
        }
        var attribution = $('<span>').text(attributions.join(' | ')).prop('outerHTML');
        attribution = unescapeLimitedHtmlTag(attribution);

        //---------------------------------------------------------------------
        showExportButtons();

        //---------------------------------------------------------------------
        var zoom = 0;
        var center = [0, 0];
        var fullscreenOptions = {
            pseudoFullscreen: true
        };
        var MIN_ZOOM = -2;
        var MAX_ZOOM = 2;
        var mapOptions = {
            crs: L.CRS.Simple,
            fullscreenControl: fullscreenOptions,
            center: center,
            zoom: zoom,
            //minZoom: MIN_ZOOM,
            //maxZoom: MAX_ZOOM,
            boxZoom: false,
            contextmenu: true
        };
        map = L.map('image_canvas', mapOptions);
        if (map.attributionControl) {
            map.attributionControl.setPrefix('<a href="http://codh.rois.ac.jp/software/iiif-curation-board/">ICBoard</a>');
        }
        //Pane: Z-index
        //tilePane: 200
        map.createPane('sheet').style.zIndex = 300;
        //overlayPane: 400
        //shadowPane: 500
        //markerPane: 600（切り取り画像はここに表示される）
        //tooltipPane: 650
        map.createPane('sticky').style.zIndex = 650;
        map.createPane('sheet-hover').style.zIndex = 675;
        //popupPane: 700

        //---------------------------------------------------------------------
        //背景
        var tileDebug = (params && params.tiledebug);
        L.GridLayer.DebugCoords = L.GridLayer.extend({
            createTile: function(coords, done) {
                var tile = document.createElement('div');
                if (tileDebug) {
                    tile.innerHTML = [coords.x, coords.y, coords.z].join(', ');
                    tile.style.outline = '1px solid gray';
                } else {
                    tile.innerHTML = '<img src="./texture/seamless-1910566_256.jpg"></img>';
                }
                setTimeout(function() { done(null, tile); }, 0);
                return tile;
            }
        });
        L.gridLayer.debugCoords = function(opts) {
            return new L.GridLayer.DebugCoords(opts);
        };
        map.addLayer(L.gridLayer.debugCoords({
            attribution: attribution,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM
        }));

        //---------------------------------------------------------------------
        //切り取り画像・付箋・下敷き
        function itemMousedown(e) {
            var layer = e.target;
            var shiftKey = e.originalEvent.shiftKey;
            if (layer.options && 'markerId' in layer.options) {
                var i = layer.options.markerId;
                var markerType = layer.options.name;
                if (!shiftKey) {
                    //shiftなし
                    if (layer.options.selected) {
                        //クリックしたものが選択状態であれば、何もしない。
                    } else {
                        //他に選択されているものがあれば解除され、クリックしたものが選択される。
                        //既に選択状態にあるものをクリックしても変化なし
                        unselectAllItem();
                        selectItem(i, markerType);
                    }
                } else {
                    //shiftあり
                    //他に選択されているものがあっても解除されない。
                    //クリックしたものが未選択であれば選択状態に、選択状態であれば未選択状態に。
                    selectItemToggle(i, markerType);
                }
            }
        }
        function itemDragStart(e) {
            var layer = e.target;
            var origMarkerId;
            var origMarkerType;
            if (layer.options) {
                origMarkerId = layer.options.markerId;
                origMarkerType = layer.options.name;
            }
            var classNames = {};
            classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-dragging';
            classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-dragging';
            classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-dragging';
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                        var dragging_;
                        if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                            layer.options.dragStartPos = layer.getLatLng();
                            dragging_ = true;
                        } else {
                            dragging_ = false;
                        }
                        var className = classNames[layer.options.name];
                        if (className) {
                            var $elem = $(layer._icon);
                            if (dragging_) {
                                $elem.addClass(className);
                            } else {
                                $elem.removeClass(className);
                            }
                        }
                    }
                }
            });
        }
        function itemDragging(e) {
            var layer = e.target;
            var origMarkerId;
            var origMarkerType;
            var offset;
            if (layer.options) {
                origMarkerId = layer.options.markerId;
                origMarkerType = layer.options.name;
                var currentPos = layer.getLatLng();
                var startPos = layer.options.dragStartPos;
                offset = L.latLng(currentPos.lat - startPos.lat, currentPos.lng - startPos.lng);
            }
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                        if (layer.options.selected && !(i === origMarkerId && layer.options.name === origMarkerType)) {
                            var startPos = layer.options.dragStartPos;
                            var currentPos = L.latLng(startPos.lat + offset.lat, startPos.lng + offset.lng);
                            layer.setLatLng(currentPos);
                        }
                    }
                }
            });
        }
        function itemDragEnd(e) {
            var layer = e.target;
            var origMarkerId;
            var origMarkerType;
            if (layer.options) {
                origMarkerId = layer.options.markerId;
                origMarkerType = layer.options.name;
            }
            var favDataModified;
            var favData = getFavs();
            var classNames = {};
            classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-dragging';
            classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-dragging';
            classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-dragging';
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                        if (layer.options.name === MARKER_LAYER_NAME) {
                            var latlng = layer.getLatLng();
                            var fav = favData[i];
                            if (updateMarkerPositionInFav(fav, latlng)) { //fav自体が更新される
                                favDataModified = true; //更新されたものが一つでもあれば、あとでsetFavsする
                            }
                        }
                        var className = classNames[layer.options.name];
                        if (className) {
                            $(layer._icon).removeClass(className);
                        }
                    }
                }
            });
            if (favDataModified) {
                setFavs(favData);
            }
        }
        function itemClick() {
            map.dragging.enable(); //念のため（なくても良い）
        }
        function unselectAllItem() {
            var classNames = {};
            classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-selected';
            classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-selected';
            classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-selected';
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                        var $elem = $(layer._icon);
                        if (layer.options.name === SHEET_LAYER_NAME) {
                            updateSheetSelectedState(layer, false);
                        }
                        var className = classNames[layer.options.name];
                        if (className) {
                            $elem.removeClass(className);
                        }
                        layer.options.selected = false;
                    }
                }
            });
        }
        function selectItem(markerId, markerType) {
            var classNames = {};
            classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-selected';
            classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-selected';
            classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-selected';
            map.eachLayer(function(layer) {
                if (layer.options && layer.options.name === markerType && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (i === markerId) {
                        var $elem = $(layer._icon);
                        if (layer.options.name === SHEET_LAYER_NAME) {
                            layer.dragging.enable();
                            $elem.appendTo($('.leaflet-sheet-hover-pane'));
                        }
                        var className = classNames[layer.options.name];
                        if (className) {
                            $elem.addClass(className);
                        }
                        layer.options.selected = true;
                    }
                }
            });
        }
        function selectItemToggle(markerId, markerType) {
            var classNames = {};
            classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-selected';
            classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-selected';
            classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-selected';
            map.eachLayer(function(layer) {
                if (layer.options && layer.options.name === markerType && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (i === markerId) {
                        var selected = !(layer.options.selected || false); //toggle
                        var $elem = $(layer._icon);
                        if (layer.options.name === SHEET_LAYER_NAME) {
                            updateSheetSelectedState(layer, selected);
                        }
                        var className = classNames[layer.options.name];
                        if (className) {
                            if (selected) {
                                $elem.addClass(className);
                            } else {
                                $elem.removeClass(className);
                            }
                        }
                        layer.options.selected = selected;
                    }
                }
            });
        }
        //グリッドに整列
        function alignItemsToGrid(e) {
            var origMarkerId;
            var origMarkerType;
            if (e) {
                var layer = e.relatedTarget;
                if (layer.options) {
                    origMarkerId = layer.options.markerId;
                    origMarkerType = layer.options.name;
                }
            }
            var GRID_X_INTERVAL = 21;
            var GRID_Y_INTERVAL = 28;
            var favDataModified;
            var favData = getFavs();
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                        if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                            var latlng_ = layer.getLatLng();
                            var x = Math.round(latlng_.lng / GRID_X_INTERVAL) * GRID_X_INTERVAL;
                            var y = Math.round(latlng_.lat / GRID_Y_INTERVAL) * GRID_Y_INTERVAL;
                            var latlng = L.latLng(y, x);
                            layer.setLatLng(latlng);
                            //切り取り画像
                            if (layer.options.name === MARKER_LAYER_NAME) {
                                var fav = favData[i];
                                if (updateMarkerPositionInFav(fav, latlng)) { //fav自体が更新される
                                    favDataModified = true; //更新されたものが一つでもあれば、あとでsetFavsする
                                }
                            }
                        }
                    }
                }
            });
            if (favDataModified) {
                setFavs(favData);
            }
        }
        //アイテムの整列
        function alignItems(e, basePosType) {
            var origMarkerId;
            var origMarkerType;
            var origMarkerLatlng;
            if (e) {
                var layer = e.relatedTarget;
                if (layer.options) {
                    origMarkerId = layer.options.markerId;
                    origMarkerType = layer.options.name;
                }
            }
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                        if (i === origMarkerId && layer.options.name === origMarkerType) {
                            origMarkerLatlng = layer.getLatLng(); //基準位置
                        }
                    }
                }
            });
            if (origMarkerLatlng) {
                var favDataModified;
                var favData = getFavs();
                map.eachLayer(function(layer) {
                    if (layer.options && 'markerId' in layer.options) {
                        var i = layer.options.markerId;
                        if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                            if (layer.options.selected && !(i === origMarkerId && layer.options.name === origMarkerType)) {
                                var latlng_ = layer.getLatLng();
                                var x = latlng_.lng;
                                var y = latlng_.lat;
                                if (basePosType === 'top') {
                                    y = origMarkerLatlng.lat;
                                } else if (basePosType === 'left') {
                                    x = origMarkerLatlng.lng;
                                }
                                var latlng = L.latLng(y, x);
                                layer.setLatLng(latlng);
                                //切り取り画像
                                if (layer.options.name === MARKER_LAYER_NAME) {
                                    var fav = favData[i];
                                    if (updateMarkerPositionInFav(fav, latlng)) { //fav自体が更新される
                                        favDataModified = true; //更新されたものが一つでもあれば、あとでsetFavsする
                                    }
                                }
                            }
                        }
                    }
                });
                if (favDataModified) {
                    setFavs(favData);
                }
            }
        }
        //アイテムの分布
        function distributeItems(e, direction, basePosType) {
            var origMarkerId;
            var origMarkerType;
            if (e) {
                var layer_ = e.relatedTarget;
                if (layer_.options) {
                    origMarkerId = layer_.options.markerId;
                    origMarkerType = layer_.options.name;
                }
            }
            var zoom = map.getZoom();
            var scale = Math.pow(2, zoom);
            var sortedItems = [];
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME) {
                        if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                            var latlng = layer.getLatLng();
                            var w = 0;
                            var h = 0;
                            if (basePosType === 'spacing') {
                                if (layer.options.name === MARKER_LAYER_NAME) {
                                    var $img = $(layer._icon).find('img');
                                    if ($img) {
                                        w = $img.width() / scale;
                                        h = $img.height() / scale;
                                    }
                                } else if (layer.options.name === STICKY_LAYER_NAME) {
                                    var $div = $(layer._icon).find('.icv-annotation-div-sticky');
                                    var $span = $div.find('span');
                                    if ($span) {
                                        w = $div.outerWidth();
                                        h = $div.outerHeight();
                                    }
                                }
                            }
                            var length = 0;
                            if (direction === 'horizontally') {
                                length = w;
                            } else if (direction === 'vertically') {
                                length = h;
                            }
                            var obj = {
                                layer: layer,
                                lat: latlng.lat,
                                lng: latlng.lng,
                                width: w,
                                height: h,
                                length: length
                            };
                            sortedItems.push(obj);
                        }
                    }
                }
            });
            var selectedItemsNum = sortedItems.length;
            if (selectedItemsNum > 2) {
                var min, max;
                if (direction === 'horizontally') {
                    sortedItems.sort(function(a, b) {
                        return a.lng - b.lng;
                    });
                    min = sortedItems[0].lng;
                    max = sortedItems[selectedItemsNum - 1].lng;
                } else if (direction === 'vertically') {
                    sortedItems.sort(function(a, b) {
                        return a.lat - b.lat;
                    });
                    min = sortedItems[0].lat;
                    max = sortedItems[selectedItemsNum - 1].lat;
                }
                var j;
                var lengthSum = 0;
                for (j = 0; j < selectedItemsNum - 1; j++) {
                    lengthSum += sortedItems[j].length;
                }
                var distance = (max - min - lengthSum) / (selectedItemsNum - 1);
                var tempPos = min + sortedItems[0].length + distance;
                var favDataModified;
                var favData = getFavs();
                for (j = 1; j < selectedItemsNum; j++) {
                    var item = sortedItems[j];
                    var layer = item.layer;
                    if (layer.options && 'markerId' in layer.options) {
                        var i = layer.options.markerId;
                        var x = item.lng;
                        var y = item.lat;
                        if (direction === 'horizontally') {
                            x = tempPos;
                        } else if (direction === 'vertically') {
                            y = tempPos;
                        }
                        tempPos += item.length + distance;
                        var latlng = L.latLng(y, x);
                        layer.setLatLng(latlng);
                        //切り取り画像
                        if (layer.options.name === MARKER_LAYER_NAME) {
                            var fav = favData[i];
                            if (updateMarkerPositionInFav(fav, latlng)) { //fav自体が更新される
                                favDataModified = true; //更新されたものが一つでもあれば、あとでsetFavsする
                            }
                        }
                    }
                }
                if (favDataModified) {
                    setFavs(favData);
                }
            }
        }

        //コンテクストメニュー
        var contextmenuItems = [
            {
                text: ((lng !== 'ja') ? 'Align Left' : '左揃え'),
                icon: 'oxygen-icons/16x16/actions/align-horizontal-left.png',
                retinaIcon: 'oxygen-icons/32x32/actions/align-horizontal-left.png',
                callback: function(e) {
                    alignItems(e, 'left');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Align Top' : '上揃え'),
                icon: 'oxygen-icons/16x16/actions/align-vertical-top.png',
                retinaIcon: 'oxygen-icons/32x32/actions/align-vertical-top.png',
                callback: function(e) {
                    alignItems(e, 'top');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Align on Grid' : 'グリッドに整列'),
                icon: 'oxygen-icons/16x16/actions/view-grid.png',
                retinaIcon: 'oxygen-icons/32x32/actions/view-grid.png',
                callback: alignItemsToGrid
            },
            {
                text: ((lng !== 'ja') ? 'Distribute Vertically' : '垂直方向上に分布'),
                icon: 'oxygen-icons/16x16/actions/distribute-vertical-top.png',
                retinaIcon: 'oxygen-icons/32x32/actions/distribute-vertical-top.png',
                callback: function(e) {
                    distributeItems(e, 'vertically', 'top');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Distribute Horizontally' : '水平方向左に分布'),
                icon: 'oxygen-icons/16x16/actions/distribute-horizontal-left.png',
                retinaIcon: 'oxygen-icons/32x32/actions/distribute-horizontal-left.png',
                callback: function(e) {
                    distributeItems(e, 'horizontally', 'left');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Distribute Spacing Vertically' : '垂直方向等間隔に分布'),
                icon: 'oxygen-icons/16x16/actions/distribute-vertical-equal.png',
                retinaIcon: 'oxygen-icons/32x32/actions/distribute-vertical-equal.png',
                callback: function(e) {
                    distributeItems(e, 'vertically', 'spacing');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Distribute Spacing Horizontally' : '水平方向等間隔に分布'),
                icon: 'oxygen-icons/16x16/actions/distribute-horizontal-equal.png',
                retinaIcon: 'oxygen-icons/32x32/actions/distribute-horizontal-equal.png',
                callback: function(e) {
                    distributeItems(e, 'horizontally', 'spacing');
                }
            },
            {
                separator: true
            },
            {
                text: ((lng !== 'ja') ? 'Put Seal ' : 'シールを貼る ') + '<i class="fas fa-circle uni-red"></i>',
                callback: function(e) {
                    putSeal(e, 'red');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Put Seal ' : 'シールを貼る ') + '<i class="fas fa-circle uni-yellow"></i>',
                callback: function(e) {
                    putSeal(e, 'yellow');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Put Seal ' : 'シールを貼る ') + '<i class="fas fa-circle uni-green"></i>',
                callback: function(e) {
                    putSeal(e, 'green');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Put Seal ' : 'シールを貼る ') + '<i class="fas fa-circle uni-blue"></i>',
                callback: function(e) {
                    putSeal(e, 'blue');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Put Seal ' : 'シールを貼る ') + '<i class="fas fa-circle uni-sky"></i>',
                callback: function(e) {
                    putSeal(e, 'sky');
                }
            },
            {
                separator: true
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal All' : 'シールを剥がす 全色'),
                callback: function(e) {
                    removeSeal(e, 'all');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal ' : 'シールを剥がす ') + '<i class="fas fa-circle uni-red"></i>',
                callback: function(e) {
                    removeSeal(e, 'red');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal ' : 'シールを剥がす ') + '<i class="fas fa-circle uni-yellow"></i>',
                callback: function(e) {
                    removeSeal(e, 'yellow');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal ' : 'シールを剥がす ') + '<i class="fas fa-circle uni-green"></i>',
                callback: function(e) {
                    removeSeal(e, 'green');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal ' : 'シールを剥がす ') + '<i class="fas fa-circle uni-blue"></i>',
                callback: function(e) {
                    removeSeal(e, 'blue');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Remove Seal ' : 'シールを剥がす ') + '<i class="fas fa-circle uni-sky"></i>',
                callback: function(e) {
                    removeSeal(e, 'sky');
                }
            },
            {
                separator: true
            },
            {
                text: ((lng !== 'ja') ? 'Export Selected Items' : '部分エクスポート（新規タブ）'),
                callback: exportSelectedItems
            }
        ];
        var contextmenuItemsMarker = contextmenuItems.slice();
        contextmenuItemsMarker.splice(contextmenuItems.length - 2, 0,
            {
                separator: true
            },
            {
                text: ((lng !== 'ja') ? 'Set Metadata' : 'メタデータ付与'),
                callback: prepareMetadataEditing
            }
        );
        var contextmenuItemsSheet = [
            {
                text: ((lng !== 'ja') ? 'Align Left' : '左揃え'),
                icon: 'oxygen-icons/16x16/actions/align-horizontal-left.png',
                retinaIcon: 'oxygen-icons/32x32/actions/align-horizontal-left.png',
                callback: function(e) {
                    alignItems(e, 'left');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Align Top' : '上揃え'),
                icon: 'oxygen-icons/16x16/actions/align-vertical-top.png',
                retinaIcon: 'oxygen-icons/32x32/actions/align-vertical-top.png',
                callback: function(e) {
                    alignItems(e, 'top');
                }
            },
            {
                text: ((lng !== 'ja') ? 'Align on Grid' : 'グリッドに整列'),
                icon: 'oxygen-icons/16x16/actions/view-grid.png',
                retinaIcon: 'oxygen-icons/32x32/actions/view-grid.png',
                callback: alignItemsToGrid
            },
            {
                separator: true
            },
            {
                text: ((lng !== 'ja') ? 'Export Selected Items' : '部分エクスポート（新規タブ）'),
                callback: exportSelectedItems
            }
        ];

        //---------------------------------------------------------------------
        //付箋
        var stickyCount = 0;
        $.fn.editable.defaults.mode = 'inline';
        function addSticky(e, text, sealColors) {
            stickyCount++;
            var text_ = text || ((lng !== 'ja') ? 'Click to edit' : 'クリックして編集');
            var $text = $('<span>').attr({'data-type': 'text', 'id': 'sticky-text-' + stickyCount}).text(text_);
            var $removeButton = $('<button>').attr({'type': 'button', 'id': 'sticky-close-' + stickyCount})
                .addClass('close icv-annotation-div-sticky-close').html('&#0215');
            var $sticky = $('<div>').addClass('icv-annotation-div-sticky').attr({'id': 'sticky' + stickyCount}).append($text).append($removeButton);
            updateStickyScale($sticky);
            var divIconOptions = {
                iconSize: [0, 0],
                html: $sticky.prop('outerHTML'),
                className: 'icv-annotation-div-icon'
            };
            var myIcon = L.divIcon(divIconOptions);
            var markerOptions = {
                icon: myIcon,
                draggable: true,
                name: STICKY_LAYER_NAME,
                markerId: stickyCount,
                pane: 'sticky', //'overlayPane'はz-index 400、'shadowPane'はz-index 500
                contextmenu: true,
                contextmenuItems: contextmenuItems,
            };
            if ($.isArray(sealColors) && sealColors.length > 0) {
                markerOptions.seals = sealColors;
            }
            //付箋
            var marker = L.marker(e.latlng, markerOptions);
            marker.on('mousedown touchstart', itemMousedown);
            marker.on('dragstart', itemDragStart);
            marker.on('drag', itemDragging);
            marker.on('dragend', itemDragEnd);
            marker.on('click', itemClick);
            marker.addTo(map);
            if ($.isArray(sealColors) && sealColors.length > 0) {
                updateSealDisplay(marker, sealColors);
            }
            $('#sticky' + stickyCount).on('keydown', function(e) {
                e.stopPropagation();
            });
            $('.icv-annotation-div-sticky > span#sticky-text-' + stickyCount).editable({
                showbuttons: false,
                clear: false
            }).on('shown', function(/*e, editable*/) {
                map.dragging.disable();
                marker.dragging.disable();
            }).on('hidden', function(/*e, reason*/) {
                map.dragging.enable();
                marker.dragging.enable();
            });
            $('.icv-annotation-div-sticky > #sticky-close-' + stickyCount).on('click', function(e) {
                e.stopPropagation();
                map.removeLayer(marker);
            });
        }
        function getDummySticky() {
            var $sticky = $('<div>').addClass('icv-annotation-div-sticky');
            updateStickyScale($sticky);
            var divIconOptions = {
                iconSize: [0, 0],
                html: $sticky.prop('outerHTML'),
                className: 'icv-annotation-div-icon'
            };
            return L.divIcon(divIconOptions);
        }
        function updateStickyScale($sticky) {
            var zoom = map.getZoom();
            var scale = Math.pow(2, zoom);
            if (zoom < 0) {
                $sticky.css({
                    'transform-origin': 'top left',
                    'transform': 'scale(' + scale + ',' + scale + ')',
                    width: '16.5em'
                });
            } else {
                $sticky.css({
                    'transform-origin': '',
                    'transform': '',
                    width: 'calc(16.5em * ' + scale + ')'
                });
            }
            return $sticky;
        }
        function showStickies() {
            //読み込んだキュレーションデータに基づいて付箋を表示
            if (!getBrowsingCurationUrl()) {
                return;
            }
            if (storageSession) {
                var curation = getBrowsingCurationJson();
                if ('metadata' in curation && $.isArray(curation.metadata)) {
                    for (var i = 0; i < curation.metadata.length; i++) {
                        var metadatum = curation.metadata[i];
                        if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isArray(metadatum.value)) {
                            var mda = metadatum.value;
                            for (var j = 0; j < mda.length; j++) {
                                var metadatum_ = mda[j];
                                if (metadatum_ && String(metadatum_.label).toLowerCase() === 'stickies' && $.isArray(metadatum_.value)) {
                                    var stickies = metadatum_.value;
                                    for (var k = 0; k < stickies.length; k++) {
                                        var sticky = stickies[k];
                                        if (sticky && 'x' in sticky && 'y' in sticky) {
                                            var e = {};
                                            e.latlng = L.latLng(sticky.y, sticky.x);
                                            addSticky(e, sticky.text, sticky.seals);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        showStickies();

        //---------------------------------------------------------------------
        //下敷き
        var sheetCount = 0;
        function sheetClick(e) {
            var id = $(e.originalEvent.target).attr('id');
            if (id && id.indexOf('sheet-move-') > -1 || (e.target.options && e.target.options.selected)) {
                //
            } else {
                if (Date.now() - lastTimestamp > MIN_TIME_INTERVAL_FOR_UNSELECT_ALL) {
                    unselectAllItem();
                }
            }
        }
        function updateSheetSelectedState(layer, selected) {
            var $elem = $(layer._icon);
            if (selected) {
                layer.dragging.enable();
                $elem.appendTo($('.leaflet-sheet-hover-pane'));
            } else {
                layer.dragging.disable();
                $elem.appendTo($('.leaflet-sheet-pane'));
            }
            if (layer.options) {
                layer.options.selected = selected;
            }
        }
        function addSheet(e, size) {
            sheetCount++;
            var $removeIcon = $('<span>').addClass('glyphicon glyphicon-remove');
            var $removeButton = $('<div>').attr({'id': 'sheet-close-' + sheetCount })
                .addClass('close icv-annotation-div-sheet-close').append($removeIcon);
            var $resizeIcon = $('<span>').addClass('glyphicon glyphicon-resize-full icon-flipped');
            var $resizeDiv = $('<div>').attr({'id': 'sheet-resize-' + sheetCount})
                .addClass('close icv-annotation-div-sheet-resizer').append($resizeIcon);
            var $moveDiv = $('<div>').attr({'id': 'sheet-move-' + sheetCount})
                .addClass('close icv-annotation-div-sheet-mover');
            var $sheet = $('<div>').attr({'id': 'sheet-' + sheetCount, 'data-sheet-no': sheetCount })
                .addClass('icv-annotation-div-sheet').append($removeButton).append($resizeDiv).append($moveDiv);
            updateSheetScale($sheet);
            if (size && 'w' in size & 'h' in size) {
                $sheet.width(size.w).height(size.h);
            }
            var $resizeTarget;
            var resizeStartSize = {};
            var resizeStartPos = {};
            function resizeStart(e) {
                //resize start
                //ブラウザによってはmap自体がパンしてしまう点に対処
                map.dragging.disable();
                map.dragging.enable();
                $resizeTarget = $(e.target).parent().parent();
                if ($resizeTarget) {
                    var origMarkerId = parseInt($resizeTarget.attr('data-sheet-no'), 10);
                    map.eachLayer(function(layer) {
                        if (layer.options && 'markerId' in layer.options &&
                            layer.options.name === SHEET_LAYER_NAME && layer.options.markerId === origMarkerId) {
                            //updateSheetSelectedState() と似ているが異なる処理
                            layer.dragging.disable();
                            $(layer._icon).appendTo($('.leaflet-sheet-hover-pane'));
                        }
                    });
                    resizeStartSize = {
                        width: $resizeTarget.width(),
                        height: $resizeTarget.height()
                    };
                }
                resizeStartPos.x = e.clientX;
                resizeStartPos.y = e.clientY;
                $(map).on('mousemove.resizesheet', resizeMouseMove);
                $(map).on('mouseup.resizesheet', resizeMouseUp);
            }
            function resizeMouseMove(e) {
                var zoom = map.getZoom();
                var scale = Math.pow(2, zoom);
                var diffX = e.originalEvent.originalEvent.clientX - resizeStartPos.x;
                var diffY = e.originalEvent.originalEvent.clientY - resizeStartPos.y;
                if (scale !== 0) {
                    diffX /= scale;
                    diffY /= scale;
                }
                if ($resizeTarget) {
                    $resizeTarget.width(resizeStartSize.width + diffX).height(resizeStartSize.height + diffY);
                }
            }
            function resizeMouseUp() {
                //resize end
                $(map).off('.resizesheet');
                if ($resizeTarget) {
                    var w = $resizeTarget.width();
                    var h = $resizeTarget.height();
                    var origMarkerId = parseInt($resizeTarget.attr('data-sheet-no'), 10);
                    map.eachLayer(function(layer) {
                        if (layer.options && 'markerId' in layer.options &&
                            layer.options.name === SHEET_LAYER_NAME && layer.options.markerId === origMarkerId) {
                            layer.options.w = w;
                            layer.options.h = h;
                            //updateSheetSelectedState() と似ているが異なる処理
                            layer.dragging.enable();
                            if (!layer.options.selected) {
                                $(layer._icon).appendTo($('.leaflet-sheet-pane'));
                            }
                        }
                    });
                    $resizeTarget = null;
                }
            }
            var divIconOptions = {
                iconSize: [0, 0],
                html: $sheet.prop('outerHTML'),
                className: 'icv-annotation-div-icon'
            };
            var myIcon = L.divIcon(divIconOptions);
            var markerOptions = {
                icon: myIcon,
                draggable: false, //あえてfalse
                name: SHEET_LAYER_NAME,
                markerId: sheetCount,
                pane: 'sheet',
                contextmenu: true,
                contextmenuItems: contextmenuItemsSheet
            };
            if (size && 'w' in size & 'h' in size) {
                markerOptions.w = size.w;
                markerOptions.h = size.h;
            }

            //下敷き
            var marker = L.marker(e.latlng, markerOptions);
            marker.on('dragstart', itemDragStart);
            marker.on('drag', itemDragging);
            marker.on('dragend', itemDragEnd);
            marker.on('click', sheetClick);
            marker.on('contextmenu', function(e) {
                if ($(e.originalEvent.target).attr('id').indexOf('sheet-move-') > -1 ||
                    (marker.options && marker.options.selected)) {
                    //コンテクストメニュー表示可
                } else {
                    //コンテクストメニュー表示不可
                    map.contextmenu.hide();
                }
            });
            marker.addTo(map);
            $('.icv-annotation-div-sheet > #sheet-close-' + sheetCount).on('click', function(e) {
                e.stopPropagation();
                map.removeLayer(marker);
            });
            $('.icv-annotation-div-sheet > #sheet-resize-' + sheetCount).on('mousedown', function(e) {
                e.stopPropagation();
                resizeStart(e);
            });
            $('.icv-annotation-div-sheet > #sheet-move-' + sheetCount).on('mousedown touchstart', function(e) {
                //ブラウザによってはmap自体がパンしてしまう点に対処
                map.dragging.disable();
                map.dragging.enable();
                e.target = marker;
                itemMousedown(e);
            });
        }
        function getDummySheet() {
            var $sheet = $('<div>').addClass('icv-annotation-div-sheet');
            updateSheetScale($sheet);
            var divIconOptions = {
                iconSize: [0, 0],
                html: $sheet.prop('outerHTML'),
                className: 'icv-annotation-div-icon'
            };
            return L.divIcon(divIconOptions);
        }
        function updateSheetScale($sheet) {
            var zoom = map.getZoom();
            var scale = Math.pow(2, zoom);
            return $sheet.css({
                'transform-origin': 'top left',
                'transform': 'scale(' + scale + ',' + scale + ')'
            });
        }
        function showSheets() {
            //読み込んだキュレーションデータに基づいて下敷きを表示
            if (!getBrowsingCurationUrl()) {
                return;
            }
            if (storageSession) {
                var curation = getBrowsingCurationJson();
                if ('metadata' in curation && $.isArray(curation.metadata)) {
                    for (var i = 0; i < curation.metadata.length; i++) {
                        var metadatum = curation.metadata[i];
                        if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isArray(metadatum.value)) {
                            var mda = metadatum.value;
                            for (var j = 0; j < mda.length; j++) {
                                var metadatum_ = mda[j];
                                if (metadatum_ && String(metadatum_.label).toLowerCase() === 'sheets' && $.isArray(metadatum_.value)) {
                                    var sheets = metadatum_.value;
                                    for (var k = 0; k < sheets.length; k++) {
                                        var sheet = sheets[k];
                                        if (sheet && 'x' in sheet && 'y' in sheet) {
                                            var e = {};
                                            e.latlng = L.latLng(sheet.y, sheet.x);
                                            var size;
                                            if ('w' in sheet & 'h' in sheet) {
                                                size = {
                                                    w: sheet.w,
                                                    h: sheet.h
                                                };
                                            }
                                            addSheet(e, size);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        showSheets();

        //---------------------------------------------------------------------
        //切り取り画像
        L.IcvMarker = L.Marker.extend({});
        L.IcvMarker.include({
            // Based on
            // "L.Marker" (2-clause BSD License, Copyright (c) 2010-2013, Vladimir Agafonkin, Copyright (c) 2010-2011, CloudMade)
            // https://github.com/Leaflet/Leaflet/blob/master/src/layer/marker/Marker.js
            // _animateZoom: function (opt) {
            //     var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();
            //     this._setPos(pos);
            // }
            // "L.ImageOverlay" (2-clause BSD License, Copyright (c) 2010-2013, Vladimir Agafonkin, Copyright (c) 2010-2011, CloudMade)
            // https://github.com/Leaflet/Leaflet/blob/master/src/layer/ImageOverlay.js
            // _animateZoom: function (e) {
            //     var scale = this._map.getZoomScale(e.zoom),
            //         offset = this._map._latLngBoundsToNewLayerBounds(this._bounds, e.zoom, e.center).min;
            //     DomUtil.setTransform(this._image, offset, scale);
            // },
            _animateZoom: function (e) {
                var scale = this._map.getZoomScale(e.zoom);
                var offset = this._map._latLngToNewLayerPoint(this._latlng, e.zoom, e.center).round();
                L.DomUtil.setTransform(this._icon, offset, scale);
            }
        });
        function getBoardDataFromFav(fav) {
            if (fav && 'metadata' in fav) {
                if ($.isArray(fav.metadata)) {
                    for (var m = 0; m < fav.metadata.length; m++) {
                        var metadatum = fav.metadata[m];
                        if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isPlainObject(metadatum.value)) {
                            return metadatum.value;
                        }
                    }
                }
            }
            return null;
        }
        function updateMarkerPositionInFav(fav, latlng) {
            var modified = false;
            if (fav && 'metadata' in fav) {
                if ($.isArray(fav.metadata)) {
                    for (var m = 0; m < fav.metadata.length; m++) {
                        var metadatum = fav.metadata[m];
                        if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isPlainObject(metadatum.value)) {
                            if (metadatum.value.x !== latlng.lng || metadatum.value.y !== latlng.lat) {
                                modified = true;
                            }
                            metadatum.value.x = latlng.lng;
                            metadatum.value.y = latlng.lat;
                        }
                    }
                }
            } else {
                fav.metadata = [{ label: 'board', value: { x: latlng.lng, y: latlng.lat }}];
                modified = true;
            }
            return modified;
        }
        function getMarkerMetadataAsHtml(layer) {
            var contents;
            if (layer.options && layer.options.name === MARKER_LAYER_NAME) {
                var i = layer.options.markerId;
                var favData = getFavs();
                var fav = favData[i];
                var metadataString;
                var $metadata;
                if ('metadata' in fav) {
                    var tmpMetadata = JSON.parse(JSON.stringify(fav.metadata));
                    var tmpMetadata2 = [];
                    if ($.isArray(tmpMetadata)) {
                        for (var m = 0; m < tmpMetadata.length; m++) {
                            var metadatum = tmpMetadata[m];
                            if (metadatum) {
                                if (String(metadatum.label).toLowerCase() === 'board') {
                                    //
                                } else {
                                    tmpMetadata2.push(metadatum);
                                }
                            }
                        }
                    }
                    metadataString = getLabelValuePair(tmpMetadata2);
                    if (metadataString) {
                        $metadata = $('<span>').html(metadataString).prop('outerHTML');
                    }
                }
                if (!$metadata) {
                    var no_metadata = (lng !== 'ja') ? 'No metadata' : 'メタデータなし';
                    $metadata = $('<span>').html(no_metadata).prop('outerHTML');
                }
                var region = getRegeionFromFragment(fav.fragment);
                var miniThumbnailSize = '!' + THUMBNAIL_WIDTH + ',' + THUMBNAIL_HEIGHT;
                var miniThumbnailUrl = fav.canvasThumbnail || fav.canvas.replace('/info.json', '/' + region + '/' + miniThumbnailSize + '/0/default.jpg');
                var $img = null;
                if (!fav.canvas) {
                    //IIIF Image API非対応リソース
                    $img = getPsuedoIIIFThumbnail($('<img>').attr({ src: miniThumbnailUrl }), fav.fragment, 100, 100);
                }
                if ($img === null) {
                    $img = $('<img>').attr('src', miniThumbnailUrl);
                    var regionElems = region.split(',');
                    if (regionElems.length === 4) { //regionが'full'のときは除く
                        var width = parseInt(regionElems[2], 10);
                        var height = parseInt(regionElems[3], 10);
                        if (width > height) {
                            $img.css({ width: '100%', height: 'auto' });
                        } else {
                            $img.css({ width: 'auto', height: '100%' });
                        }
                    }
                }
                var $wrapper = $('<div>').css({width: '100px', height: '100px', 'margin-top': '16px'});
                $wrapper.append($img);
                var icvBaseUrl = 'http://codh.rois.ac.jp/software/iiif-curation-viewer/demo/';
                var icvUrl = icvBaseUrl + '?curation=' + encodeURIComponentForQuery(params.curation) + '&pos=' + String(i + 1) + '&lang=' + lng;
                var $link = $('<a>').attr({href: icvUrl,  target: '_blank'}).text('Open in Curation');
                var icvUrl2 = icvBaseUrl + '?manifest=' + encodeURIComponentForQuery(fav.manifestUrl) + '&pos=' + fav.pageLocal;
                if (fav.fragment && region.indexOf(',') > -1) {
                    icvUrl2 += '&xywh=' + region + '&xywh_highlight=border';
                }
                icvUrl2 += '&lang=' + lng;
                var $link2 = $('<a>').attr({href: icvUrl2, target: '_blank'}).text('Open in Manifest');
                var $croplink = '';
                if (fav.canvas) { //IIIF Image API非対応リソースのときは、fav.canvas（info.jsonのURL）が未定義
                    $croplink = $('<a>').attr({href: fav.canvas.replace('/info.json', '/' + region + '/full/0/default.jpg'), target: '_blank'}).text(region);
                }
                contents = $('<div>').append($wrapper).append('<hr>').append($metadata).
                    append('<hr>').append($link).append('<br>').append($link2).append('<br>').append($croplink).prop('outerHTML');
            }
            return contents;
        }
        function markerClick(e) {
            itemClick(e);
            showMarkerMetadataOnSidebar(e, true); //サイドバーに情報表示
        }
        function showMarkers() {
            //読み込んだキュレーションデータに基づいて切り取り画像を表示
            if (storage) {
                var favData = getFavs();
                var MAX_FAVS_IN_CURATION_LIST_WINDOW = 1000; //安全装置。あまり多いとブラウザが固まったようになってしまう。
                var ENABLE_LAZY_LOAD_FAVS_THRESHOLD = 100; //このしきい値を超えたらlazyloadを有効にする
                var boardDataFound = false;
                for (i = 0; i < favData.length && i < MAX_FAVS_IN_CURATION_LIST_WINDOW; i++) {
                    if (getBoardDataFromFav(favData[i])) {
                        boardDataFound = true;
                        break;
                    }
                }
                var hasPosData = false;
                var xmin = 0;
                var ymin = 0;
                var xmax = 0;
                var ymax = 0;
                conf.lazyload = (favData.length >= ENABLE_LAZY_LOAD_FAVS_THRESHOLD);
                for (i = 0; i < favData.length && i < MAX_FAVS_IN_CURATION_LIST_WINDOW; i++) {
                    if (favData[i]) {
                        var fav = favData[i];
                        var region = getRegeionFromFragment(fav.fragment);
                        var miniThumbnailSize = '!' + THUMBNAIL_WIDTH + ',' + THUMBNAIL_HEIGHT;
                        var miniThumbnailUrl = fav.canvasThumbnail || fav.canvas.replace('/info.json', '/' + region + '/' + miniThumbnailSize + '/0/default.jpg');
                        var $img = null;
                        if (!fav.canvas) {
                            //IIIF Image API非対応リソース
                            $img = getPsuedoIIIFThumbnail($('<img>').attr({ src: miniThumbnailUrl }), fav.fragment, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
                        }
                        if ($img === null) {
                            if (conf.lazyload) {
                                $img = $('<img>').attr('data-src', miniThumbnailUrl).addClass('lazyload');
                            } else {
                                $img = $('<img>').attr('src', miniThumbnailUrl);
                            }
                            var regionElems = region.split(',');
                            if (regionElems.length === 4 && !wrapThumbnail) { //regionが'full'のときは除く
                                var width = parseInt(regionElems[2], 10);
                                var height = parseInt(regionElems[3], 10);
                                if (width > height) {
                                    $img.css({ width: '100%', height: 'auto' });
                                } else {
                                    $img.css({ width: 'auto', height: '100%' });
                                }
                            }
                        }
                        $img.attr({ 'data-manifest-url': fav.manifestUrl, 'data-canvas-id': fav.canvasId, 'data-marker-id': i });
                        if (fav.fragment) {
                            $img.attr('data-fragment', fav.fragment);
                        }
                        if (fav.indexInBrowsingCuration) {
                            $img.attr('data-index-in-browsing-curation', fav.indexInBrowsingCuration);
                        }
                        var $wrapper = $('<div>').addClass('icv-annotation-div-icon-thumbnail');
                        $wrapper.append($img);
                        var markerPos = L.latLng(0, 0);
                        var seals = [];
                        if (boardDataFound) {
                            var boardData = getBoardDataFromFav(fav);
                            if (boardData) {
                                if ('x' in boardData && 'y' in boardData) {
                                    markerPos = L.latLng(boardData.y, boardData.x);
                                    hasPosData = true;
                                }
                                if ($.isArray(boardData.seals)) {
                                    seals = boardData.seals;
                                }
                            }
                        } else {
                            //配置情報がないときは、タイル状に並べて初期状態とする
                            var col_num = 10;
                            //本来はCSSで指定しているサイズと整合する仕組みが必要
                            var zabuton_width = 102;
                            var x_interval = 105;
                            var y_interval = 140;
                            var x = (i % col_num) * x_interval;
                            var y = -Math.floor(i / col_num) * y_interval;
                            markerPos = L.latLng(y, x);
                            if ('metadata' in fav) {
                                if ($.isArray(fav.metadata)) {
                                    fav.metadata.push({ label: 'board', value: { x: x, y: y }});
                                }
                            } else {
                                fav.metadata = [{ label: 'board', value: { x: x, y: y }}];
                            }
                            if (x < xmin) { xmin = x; }
                            if (x + zabuton_width > xmax) { xmax = x + zabuton_width; }
                            //y座標(lat)は上向きなので、ymaxが上端、yminが下端となる
                            if (y > ymax) { ymax = y; }
                            if (y - y_interval < ymin) { ymin = y - y_interval; }
                        }
                        var divIconOptions = {
                            iconSize: [0, 0],
                            html: $wrapper.prop('outerHTML'),
                            className: 'icv-annotation-div-icon'
                        };
                        var myIcon = L.divIcon(divIconOptions);
                        var markerOptions = {
                            icon: myIcon,
                            draggable: true,
                            name: MARKER_LAYER_NAME,
                            markerId: i,
                            title: getPropertyValueI18n(fav.manifestLabel) + '/' + fav.pageLocal,
                            contextmenu: true,
                            contextmenuItems: contextmenuItemsMarker,
                        };
                        //切り取り画像
                        var marker = new L.IcvMarker(markerPos, markerOptions);
                        marker.on('mousedown touchstart', itemMousedown);
                        marker.on('dragstart', itemDragStart);
                        marker.on('drag', itemDragging);
                        marker.on('dragend', itemDragEnd);
                        marker.on('click', markerClick);
                        marker.on('mouseover', showMarkerMetadataOnSidebar);
                        marker.addTo(map);
                        if (marker._icon) {
                            var $zabu = $('<div>').addClass('icv-annotation-div-icon-zabuton').hide();
                            if (wrapThumbnail) {
                                $zabu.addClass('icv-annotation-div-icon-zabuton-wrap');
                            }
                            var $maker_label = $('<div>').addClass('icv-annotation-div-icon-label').text(markerOptions.title).hide();
                            $zabu.append($maker_label);
                            $(marker._icon).append($zabu);
                            if (wrapThumbnail) {
                                $(marker._icon).find('.icv-annotation-div-icon-thumbnail').prependTo($zabu);
                            }
                        }
                        if (seals.length > 0) {
                            updateSealDisplay(marker, seals);
                        }
                    }
                }
                if (!boardDataFound) {
                    setFavs(favData);
                }
                if (wrapThumbnail) {
                    $('.icv-annotation-div-icon-zabuton').css({ width: 'auto', height: 'auto', 'padding': '1px' }).show();
                    $('.icv-annotation-div-icon-thumbnail').css({ width: 'auto', height: 'auto' });
                    $('.icv-annotation-div-icon-label').css({ position: 'relative', bottom: 'auto', 'margin-top': '0.2em' });
                    $('.seals-container.seals-container-marker').css({ position: 'relative', bottom: 'auto' });
                }

                map.on('zoomend', function() {
                    var zoom = map.getZoom();
                    var scale = Math.pow(2, zoom);
                    var zoom_clamp = (zoom < 0) ? 0 : zoom;
                    var scale_clamp = Math.pow(2, zoom_clamp);
                    map.eachLayer(function(layer) {
                        if (layer.options && layer.options.name === MARKER_LAYER_NAME) {
                            if ('markerId' in layer.options) {
                                var i = layer.options.markerId;
                                var fav = favData[i];
                                var w = THUMBNAIL_WIDTH * scale_clamp;
                                var h = THUMBNAIL_HEIGHT * scale_clamp;
                                var options = {};
                                if (scale > 1) {
                                    options.pct = scale * 100;
                                }
                                var miniThumbnailUrl = getThumbnailUrl(i, getRegeionFromFragment(fav.fragment), w, h, options);
                                var $img = $('.icv-annotation-div-icon-thumbnail > img[data-marker-id="' + layer.options.markerId + '"]');
                                if (conf.lazyload) {
                                    $img.attr('data-src', miniThumbnailUrl).addClass('lazyload');
                                } else {
                                    $img.attr('src', miniThumbnailUrl);
                                }
                            }
                        }
                    });
                    if (wrapThumbnail) {
                        //切り取り画像の座布団
                        if (zoom < 0) {
                            //全体縮小
                            $('.icv-annotation-div-icon-zabuton').css({
                                'transform-origin': 'top left',
                                'transform': 'scale(' + scale + ',' + scale + ')'
                            });
                        } else {
                            $('.icv-annotation-div-icon-zabuton').css({
                                'transform-origin': '',
                                'transform': ''
                            });
                        }
                    } else {
                        //切り取り画像の座布団
                        if (zoom < 0) {
                            //全体縮小
                            $('.icv-annotation-div-icon-zabuton').css({
                                'transform-origin': 'top left',
                                'transform': 'scale(' + scale + ',' + scale + ')',
                                width: (THUMBNAIL_WIDTH + 2) + 'px',
                                height: 'calc(' + (THUMBNAIL_HEIGHT) + 'px + 3em)'
                            });
                        } else {
                            //ラベルとシール部分は固定高さを維持
                            $('.icv-annotation-div-icon-zabuton').css({
                                'transform-origin': '',
                                'transform': '',
                                width: (THUMBNAIL_WIDTH * scale + 2) + 'px',
                                height: 'calc(' + (THUMBNAIL_HEIGHT * scale) + 'px + 3em)'
                            });
                        }
                        //切り取り画像
                        $('.icv-annotation-div-icon-thumbnail').css({
                            width: (THUMBNAIL_WIDTH * scale) + 'px',
                            height: (THUMBNAIL_HEIGHT * scale) + 'px'
                        });
                    }
                    //下敷き
                    updateSheetScale($('.icv-annotation-div-sheet'));
                    //付箋
                    updateStickyScale($('.icv-annotation-div-sticky'));
                    //SVG出力ボタン
                    $('#curation_list_export_svg').prop('disabled', (zoom !== 0));
                });

                //hasPosData: 少なくとも一つは位置情報が設定されている＝素のキュレーションではない
                return {hasPosData: hasPosData, xmin: xmin, xmax: xmax, ymin: -ymax, ymax: -ymin};
            }
            return {};
        }
        var markersInfo = showMarkers();

        //初期表示位置へのパン
        var panby = {};
        if (params.xy) {
            var match = String(params.xy).match(/(?:pixel:)?(-?[0-9]+),(-?[0-9]+)/);
            if (match) {
                panby.x = parseInt(match[1], 10);
                panby.y = parseInt(match[2], 10);
            }
        }
        if ('x' in panby && 'y' in panby) {
            //指定の座標にパンする
        } else {
            var mapSize = map.getSize();
            if (markersInfo.hasPosData === false) {
                //素のキュレーションを表示して、自動的にタイル状に並べたケース
                var markersInfo_ = {
                    width:  markersInfo.xmax - markersInfo.xmin,
                    height: markersInfo.ymax - markersInfo.ymin
                };
                if (markersInfo_.width < mapSize.x && markersInfo_.height < mapSize.y) {
                    //全体がmap内に収まるときのみ、切り取り画像群の中央にパンする
                    panby.x = markersInfo.xmin + Math.floor(markersInfo_.width / 2);
                    panby.y = markersInfo.ymin + Math.floor(markersInfo_.height / 2);
                }
            }
            if (!('x' in panby && 'y' in panby)) {
                //map左上隅から100, 100pxの場所に原点が来るようにパンする
                var mapOffset = {x: 100, y: 100};
                panby.x = Math.floor(mapSize.x / 2) - mapOffset.x;
                panby.y = Math.floor(mapSize.y / 2) - mapOffset.y;
            }
        }
        map.panBy([panby.x, panby.y]);

        //---------------------------------------------------------------------
        //Leaflet.drawを用いたツールバー
        L.Draw.AreaSelect = L.Draw.Rectangle.extend({
            initialize: function(map, options) {
                this.type = 'areaselect';
                L.Draw.SimpleShape.prototype.initialize.call(this, map, options);
                this._endLabelText = ''; //L.drawLocal.draw.handlers.simpleshape.tooltip.end
            }
        });
        L.Draw.Sticky = L.Draw.Marker.extend({
            initialize: function(map, options) {
                this.type = 'sticky';
                L.Draw.Feature.prototype.initialize.call(this, map, options);
            },
            addHooks: function() {
                this.options.icon = getDummySticky(); //表示時点のスケールで作り直し
                L.Draw.Marker.prototype.addHooks.call(this);
            }
        });
        L.Draw.Sheet = L.Draw.Marker.extend({
            initialize: function(map, options) {
                this.type = 'sheet';
                L.Draw.Feature.prototype.initialize.call(this, map, options);
            },
            addHooks: function() {
                this.options.icon = getDummySheet(); //表示時点のスケールで作り直し
                L.Draw.Marker.prototype.addHooks.call(this);
            }
        });
        L.DrawToolbar.include({
            getModeHandlers: function(map) {
                return [
                    {
                        enabled: this.options.polyline,
                        handler: new L.Draw.Polyline(map, this.options.polyline),
                        title: L.drawLocal.draw.toolbar.buttons.polyline
                    },
                    {
                        enabled: this.options.polygon,
                        handler: new L.Draw.Polygon(map, this.options.polygon),
                        title: L.drawLocal.draw.toolbar.buttons.polygon
                    },
                    {
                        enabled: this.options.rectangle,
                        handler: new L.Draw.Rectangle(map, this.options.rectangle),
                        title: L.drawLocal.draw.toolbar.buttons.rectangle
                    },
                    {
                        enabled: this.options.circle,
                        handler: new L.Draw.Circle(map, this.options.circle),
                        title: L.drawLocal.draw.toolbar.buttons.circle
                    },
                    {
                        enabled: this.options.marker,
                        handler: new L.Draw.Marker(map, this.options.marker),
                        title: L.drawLocal.draw.toolbar.buttons.marker
                    },
                    {
                        enabled: this.options.circlemarker,
                        handler: new L.Draw.CircleMarker(map, this.options.circlemarker),
                        title: L.drawLocal.draw.toolbar.buttons.circlemarker
                    },
                    {
                        enabled: this.options.areaselect,
                        handler: new L.Draw.AreaSelect(map, this.options.areaselect),
                        title: L.drawLocal.draw.toolbar.buttons.areaselect
                    },
                    {
                        enabled: this.options.sticky,
                        handler: new L.Draw.Sticky(map, this.options.sticky),
                        title: L.drawLocal.draw.toolbar.buttons.sticky
                    },
                    {
                        enabled: this.options.sheet,
                        handler: new L.Draw.Sheet(map, this.options.sheet),
                        title: L.drawLocal.draw.toolbar.buttons.sheet
                    }
                ];
            }
        });
        var drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        if (lng === 'ja') {
            L.drawLocal.draw.toolbar.actions.text = 'キャンセル';
            L.drawLocal.draw.toolbar.actions.title = 'キャンセル';

            L.drawLocal.draw.toolbar.buttons.areaselect = '範囲を選択（sキー）';
            L.drawLocal.draw.toolbar.buttons.sticky = '付箋を貼る';
            L.drawLocal.draw.toolbar.buttons.sheet = '下敷きを置く';
        } else {
            L.drawLocal.draw.toolbar.buttons.areaselect = 'Select area';
            L.drawLocal.draw.toolbar.buttons.sticky = 'Sticky';
            L.drawLocal.draw.toolbar.buttons.sheet = 'Sheet';
        }
        var drawControlDrawOnly = new L.Control.Draw({
            draw: {
                polyline: false,
                polygon: false,
                rectangle: false,
                circle: false,
                marker: false,
                circlemarker: false,
                areaselect: {
                    showArea: false,
                    shapeOptions: {
                        stroke: true,
                        color: '#3388ff',
                        weight: 3,
                        opacity: 0.5,
                        dashArray: '5, 5',
                        fill: false,
                        fillColor: null,
                        fillOpacity: 0.2,
                        clickable: true
                    },
                },
                sticky: {
                    icon: getDummySticky()
                },
                sheet: {
                    icon: getDummySheet()
                }
            },
            //edit: false
            edit: {
                featureGroup: drawnItems
            }
        });
        map.addControl(drawControlDrawOnly);
        $('.leaflet-draw-edit-edit').parent().parent().hide();

        var shiftKey; //この方法はロバストではない
        var lastTimestamp = Date.now();
        var MIN_TIME_INTERVAL_FOR_UNSELECT_ALL = 500; //msec
        map.on('keydown', function(e) {
            shiftKey = e.originalEvent.shiftKey;
        });
        map.on('keyup', function(e) {
            shiftKey = e.originalEvent.shiftKey;
        });
        map.on('click', function() {
            if (Date.now() - lastTimestamp > MIN_TIME_INTERVAL_FOR_UNSELECT_ALL) {
                //領域選択のために矩形を描画後、
                //L.Draw.Event.CREATED → mapのclick の順番でイベントが発火することがあり、
                //そのケースでは選択直後に選択解除となってしまう。
                //（矩形描画のためにマウスをドラッグし、描画中の矩形の枠線上にカーソルを乗せた
                //（カーソルがクロスヘアになった）状態でマウスボタンをリリースすると再現する。）
                //問題回避のため、ここでは簡単に対処する。
                unselectAllItem();
            }
        });
        map.on(L.Draw.Event.DRAWSTART, function() {
            $('.icv-annotation-div-sheet').css('cursor', 'crosshair');
        });
        map.on(L.Draw.Event.DRAWSTOP, function() {
            $('.icv-annotation-div-sheet').css('cursor', 'grab');
        });
        map.on(L.Draw.Event.CREATED, function(e) {
            lastTimestamp = Date.now();
            if (e.layerType === 'sticky') {
                //付箋作成
                e.layer.latlng = e.layer._latlng;
                addSticky(e.layer);
            } else if (e.layerType === 'sheet') {
                //下敷き作成
                e.layer.latlng = e.layer._latlng;
                addSheet(e.layer);
            } else if (e.layerType === 'areaselect') {
                //選択した矩形の中にある切り取り画像等を選択する処理
                var layer = e.layer;
                var bounds = layer.getBounds(); //LatLngBounds型
                var classNames = {};
                classNames[MARKER_LAYER_NAME] = 'icv-annotation-div-icon-selected';
                classNames[STICKY_LAYER_NAME] = 'icv-annotation-div-sticky-selected';
                classNames[SHEET_LAYER_NAME]  = 'icv-annotation-div-sheet-selected';
                map.eachLayer(function(layer) {
                    if (layer.options && 'markerId' in layer.options) {
                        if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                            var $elem = $(layer._icon);
                            var className = classNames[layer.options.name];
                            var inArea = false;
                            var pos = layer.getLatLng();
                            if (bounds.contains(pos)) { //とりあえず左上隅基準
                                inArea = true;
                            }
                            if (!shiftKey) {
                                //shiftなし
                                //他に選択されているものがあれば解除され、範囲内のものが選択される。
                                //既に選択状態にあるものをクリックしても変化なし
                                if (layer.options.name === SHEET_LAYER_NAME) {
                                    updateSheetSelectedState(layer, inArea);
                                }
                                if (className) {
                                    if (inArea) {
                                        $elem.addClass(className);
                                    } else {
                                        $elem.removeClass(className);
                                    }
                                }
                                layer.options.selected = inArea;
                            } else {
                                //shiftあり
                                //他に選択されているものがあっても解除されない。
                                //範囲内のものが未選択であれば選択状態に、選択状態であれば未選択状態に。
                                if (inArea) {
                                    var selected = !(layer.options.selected || false); //toggle
                                    if (layer.options.name === SHEET_LAYER_NAME) {
                                        updateSheetSelectedState(layer, selected);
                                    }
                                    if (className) {
                                        if (selected) {
                                            $elem.addClass(className);
                                        } else {
                                            $elem.removeClass(className);
                                        }
                                    }
                                    layer.options.selected = selected;
                                }
                            }
                        }
                    }
                });
            }
        });
        map.on(L.Draw.Event.DELETED, function() {
            var count = 0;
            drawnItems.eachLayer(function() {
                count++;
            });
            if (count === 0) {
                $('.leaflet-draw-edit-edit').parent().parent().hide();
            }
        });

        //---------------------------------------------------------------------
        //Leaflet.EasyButtonを用いた情報表示ボタン
        var isInfoShown = false;
        var toggleInfo = L.easyButton({
            states: [{
                stateName: 'show-info',
                icon: 'fas fa-info',
                title: (lng !== 'ja') ? 'Show info' : '情報を表示',
                onClick: function(control) {
                    $('.icv-annotation-div-icon-zabuton').show();
                    $('.icv-annotation-div-icon-label').show();
                    $('.seals-container').show();
                    if (sidebar) {
                        sidebar.show();
                    }
                    control.state('hide-info');
                    isInfoShown = true;
                }
            }, {
                stateName: 'hide-info',
                icon: 'glyphicon-remove',
                title: 'Hide info',
                onClick: function(control) {
                    if (!wrapThumbnail) {
                        $('.icv-annotation-div-icon-zabuton').hide();
                    }
                    $('.icv-annotation-div-icon-label').hide();
                    $('.seals-container').hide();
                    if (sidebar) {
                        sidebar.hide();
                    }
                    control.state('show-info');
                    isInfoShown = false;
                }
            }]
        });
        toggleInfo.addTo(map);
        function _fixEasyButtonSize(button) {
            //https://github.com/CliffCloud/Leaflet.EasyButton/issues/48#issuecomment-236178764
            var buttonElement = button.button;
            buttonElement.style.padding = '0px';
            //buttonElement.style.width = '26px';
            //buttonElement.style.height = '26px';
            buttonElement.style.minWidth = '26px';
            buttonElement.style.minHeight = '26px';
        }
        _fixEasyButtonSize(toggleInfo);

        //---------------------------------------------------------------------
        //leaflet-sidebarを用いた情報表示
        if (document.getElementById('sidebar') === null) {
            var sidebarDiv = '<div id="sidebar"></div>';
            $('#image_canvas').after(sidebarDiv);
        }
        var sidebar = L.control.sidebar('sidebar', {
            position: 'right',
            autoPan: false,
            closeButton: true
        });
        sidebar.setContent((lng !== 'ja') ? 'Mouse over the image to show the information.' : '画像にマウスを重ねると、ここに情報が表示されます。');
        map.addControl(sidebar);

        function showMarkerMetadataOnSidebar(e, forceUpdate) {
            if (forceUpdate) {
                //forceUpdateがtrueのときは、サイドバーの内容を強制的に更新
            } else {
                //forceUpdateがtrueでないときは、選択中の切り取り画像がないときのみサイドバーの内容を更新
                var selectedMarkerCount = 0;
                map.eachLayer(function(layer) {
                    if (layer.options && layer.options.name === MARKER_LAYER_NAME && layer.options.selected) {
                        selectedMarkerCount++;
                    }
                });
                if (selectedMarkerCount > 0) {
                    return;
                }
            }
            var layer = e.target;
            var contents = getMarkerMetadataAsHtml(layer);
            if (sidebar && contents !== void 0) {
                sidebar.setContent(contents);
            }
        }

        //---------------------------------------------------------------------
        //メタデータ付与
        if (document.getElementById('edit_metadata_win') === null) {
            var title = (lng !== 'ja') ? 'Set Metadata' : 'メタデータ付与';
            var labelMetadataLabel = 'Label';
            var labelMetadataValue = 'Value';
            //
            var textApply = (lng !== 'ja') ? 'Apply' : '適用';
            var textClose = (lng !== 'ja') ? 'Close' : '閉じる';
            var editMetadataModal =
                '<div class="modal fade" tabindex="-1" id="edit_metadata_win">' +
                '  <div class="modal-dialog modal-sm" id="edit_metadata_dialog">' +
                '    <div class="modal-content">' +
                '      <div class="modal-body">' +
                '        <h4 id="edit_metadata_title" class="curation_list_title" style="margin-bottom: 20px;">' + title + '</h4>' +
                '        <form id="edit_metadata_form" onsubmit="return false;">' +
                '          <div>' +
                '            <fieldset id="edit_metadata_filedset">' +
                '              <div class="form-group">' +
                '                <label for="edit_metadata_label" class="control-label">' + labelMetadataLabel + '</label>' +
                '                <input class="form-control" id="edit_metadata_label" type="text">' +
                '                <label for="edit_metadata_value" class="control-label">' + labelMetadataValue + '</label>' +
                '                <input class="form-control" id="edit_metadata_value" type="text">' +
                '                <div class="help-block with-errors"></div>' +
                '              </div>' +
                '            </fieldset>' +
                '          </div>' +
                '        </form>' +
                '      </div>' +
                '      <div class="modal-footer modal-footer-custom">' +
                '        <button type="button" class="btn btn-default" id="edit_metadata_apply">'+ textApply + '</button>' +
                '        <button type="button" class="btn btn-default" data-dismiss="modal" id="edit_metadata_close">' + textClose + '</button>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>';
            $('#image_canvas').after(editMetadataModal);
            $('#edit_metadata_win').on('keydown', function(e) {
                e.stopPropagation();
            });
            $('#edit_metadata_apply').on('click', function(e) {
                var label = $('#edit_metadata_label').val();
                var value = $('#edit_metadata_value').val();
                setMarkerMetadata(metadataEditingTarget , label, value);
                $('#edit_metadata_win').modal('hide');
                e.stopPropagation();
            });
        }
        var metadataEditingTarget;
        function prepareMetadataEditing(e) {
            metadataEditingTarget = e;
            showMetadataEditDialog();
        }
        function setMarkerMetadata(e, label, value) {
            var origMarkerId;
            if (e) {
                var layer = e.relatedTarget;
                if (layer.options && layer.options.name === MARKER_LAYER_NAME) {
                    origMarkerId = layer.options.markerId;
                }
            }
            var favData = getFavs();
            map.eachLayer(function(layer) {
                if (layer.options && layer.options.name === MARKER_LAYER_NAME) {
                    var i = layer.options.markerId;
                    if (layer.options.selected || i === origMarkerId) {
                        var fav = favData[i];
                        if ('metadata' in fav) {
                            if ($.isArray(fav.metadata)) {
                                var updated;
                                for (var m = 0; m < fav.metadata.length; m++) {
                                    var metadatum = fav.metadata[m];
                                    if (metadatum && metadatum.label === label) {
                                        metadatum.value = value;
                                        updated = true;
                                    }
                                }
                                if (!updated) {
                                    fav.metadata.push({
                                        label: label,
                                        value: value
                                    });
                                }
                            }
                        } else {
                            fav.metadata = [
                                {
                                    label: label,
                                    value: value
                                }
                            ];
                        }
                    }
                }
            });
            setFavs(favData);
        }
        //シール
        function setSealMetadata(e, action, colorName) {
            var layer = e.relatedTarget;
            var origMarkerId;
            var origMarkerType;
            if (layer.options) {
                origMarkerId = layer.options.markerId;
                origMarkerType = layer.options.name;
            }
            if (action) {
                action = action.toLowerCase();
            }
            var favData = getFavs();
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                        var seals = [];
                        var index;
                        if (layer.options.name === MARKER_LAYER_NAME) {
                            var fav = favData[i];
                            if ('metadata' in fav) {
                                if ($.isArray(fav.metadata)) {
                                    for (var m = 0; m < fav.metadata.length; m++) {
                                        var metadatum = fav.metadata[m];
                                        if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isPlainObject(metadatum.value)) {
                                            if ($.isArray(metadatum.value.seals)) {
                                                index = $.inArray(colorName, metadatum.value.seals);
                                                if (action === 'put') {
                                                    if (index === -1) {
                                                        metadatum.value.seals.push(colorName);
                                                    }
                                                } else if (action === 'remove') {
                                                    if (index >= 0) { //重複して含まれていないことを前提とする
                                                        metadatum.value.seals.splice(index, 1);
                                                    } else if (colorName === 'all') {
                                                        metadatum.value.seals = [];
                                                    }
                                                }
                                            } else {
                                                if (action === 'put') {
                                                    metadatum.value.seals = [colorName];
                                                }
                                            }
                                            seals = metadatum.value.seals || [];
                                        }
                                    }
                                }
                            } else {
                                if (action === 'put') {
                                    seals = [colorName];
                                    fav.metadata = [{ label: 'board', value: { seals: seals }}];
                                }
                            }
                            //シール表示を更新
                            updateSealDisplay(layer, seals);
                        } else if (layer.options.name === STICKY_LAYER_NAME) {
                            if ($.isArray(layer.options.seals)) {
                                index = $.inArray(colorName, layer.options.seals);
                                if (action === 'put') {
                                    if (index === -1) {
                                        layer.options.seals.push(colorName);
                                    }
                                } else if (action === 'remove') {
                                    if (index >= 0) { //重複して含まれていないことを前提とする
                                        layer.options.seals.splice(index, 1);
                                    } else if (colorName === 'all') {
                                        layer.options.seals = [];
                                    }
                                }
                            } else {
                                if (action === 'put') {
                                    layer.options.seals = [colorName];
                                }
                            }
                            seals = layer.options.seals || [];
                            //シール表示を更新
                            updateSealDisplay(layer, seals);
                        }
                    }
                }
            });
            setFavs(favData);
        }
        function updateSealDisplay(layer, sealColors) {
            if (layer._icon) {
                var $seales = $('<div>').addClass('seals-container');
                for (var i = 0; i < sealColors.length; i++) {
                    var className = 'uni-' + sealColors[i];
                    var $seal = $('<i>').addClass('fas fa-circle seal').addClass(className).css('display', 'inline');
                    $seales.append($seal);
                }
                $(layer._icon).find('.seals-container').remove();
                if (layer.options) {
                    if (layer.options.name === STICKY_LAYER_NAME) {
                        $seales.addClass('seals-container-sticky');
                    } else if (layer.options.name === MARKER_LAYER_NAME) {
                        $seales.addClass('seals-container-marker');
                    }
                }
                if (!isInfoShown) {
                    $seales.hide();
                }
                if (layer.options.name === STICKY_LAYER_NAME) {
                    $(layer._icon).find('.icv-annotation-div-sticky').append($seales);
                } else if (layer.options.name === MARKER_LAYER_NAME) {
                    $(layer._icon).find('.icv-annotation-div-icon-zabuton').append($seales);
                }
            }
        }
        function putSeal(e, colorName) {
            setSealMetadata(e, 'put', colorName);
        }
        function removeSeal(e, colorName) {
            setSealMetadata(e, 'remove', colorName);
        }

        //---------------------------------------------------------------------
        //キーボードショートカット
        $(document.body).off('.processManifests');
        $(document.body).on('keydown.processManifests', function(event) {
            if (map === undefined) { return; }
            if (event.ctrlKey) { return; }
            if (event.keyCode === 83) { //'s'
                var $button = $('.leaflet-draw-draw-areaselect');
                if ($button.length === 1) {
                    $button[0].click();
                }
            }
        });

        //---------------------------------------------------------------------
        //キュレーションのエクスポート（ヘッダ部ボタンから利用）
        if (enableCurationEdit) {
            $('#curation_list_export').html('<span class="glyphicon glyphicon-export"></span> ' + ((lng !== 'ja') ? 'Export' : 'エクスポート'));
            $('#curation_list_export').off('.curationList');
            $('#curation_list_export').on('click.curationList', function() {
                if (storage && getCurationJsonExport()) {
                    var curationJson = getCurationListJson();
                    exportCurationJson(curationJson, { method: 'POST' });
                }
            });
        } else {
            $('#curation_list_export').hide();
            $('#curation_list_export_container').hide();
        }

        //キュレーションの部分エクスポート（コンテクストメニューから利用）
        function exportSelectedItems(e) {
            if (!enableCurationEdit) {
                return;
            }
            var layer = e.relatedTarget;
            var origMarkerId;
            var origMarkerType;
            if (layer.options) {
                origMarkerId = layer.options.markerId;
                origMarkerType = layer.options.name;
            }
            var favData = getFavs();
            var favDataSelected = [];
            map.eachLayer(function(layer) {
                if (layer.options && 'markerId' in layer.options) {
                    var i = layer.options.markerId;
                    if (layer.options.selected || (i === origMarkerId && layer.options.name === origMarkerType)) {
                        if (layer.options.name === MARKER_LAYER_NAME) {
                            favDataSelected.push(favData[i]);
                        }
                    }
                }
            });
            var curationJson_ = getCurationListJson(favDataSelected);
            var curationJson = updateStationeryData(curationJson_, true); //選択されているものだけ
            var windowName = 'selectedItems' + Date.now();
            window.open('', windowName);
            exportCurationJson(curationJson, { method: 'POST', target: windowName });
        }

        //SVGエクスポート
        if (enableCurationEdit) {
            $('#curation_list_export_svg').off('.curationList');
            $('#curation_list_export_svg').on('click.curationList', function() {
                if (storage && getCurationJsonExport()) {
                    $(this).spin();
                    preprocessBoardImagesPhase1();
                }
            });
        } else {
            $('#curation_list_export_svg').hide();
        }

        //表示言語切り替え
        if ($('.nav_lang_ja').length && $('.nav_lang_en').length) {
            if (lng !== 'ja') {
                var $ja = $('<a>').attr('href', getPageLink('ja')).text('日本語');
                $('.nav_lang_ja').html($ja);
                $('.nav_lang_en').text('English');
            } else {
                var $en = $('<a>').attr('href', getPageLink('en')).text('English');
                $('.nav_lang_ja').text('日本語');
                $('.nav_lang_en').html($en);
            }
        }

        //エクスポートせずに終了する場合の注意喚起
        $(window).on('beforeunload.board', function(e) {
            function isEqualSelectionMembers(data1, data2) {
                if ($.isPlainObject(data1) && $.isArray(data1.selections) &&
                    $.isPlainObject(data2) && $.isArray(data2.selections) &&
                    data1.selections.length === data2.selections.length) {
                    for (var i = 0; i < data1.selections.length; i++) {
                        var sel1 = data1.selections[i];
                        var sel2 = data2.selections[i];
                        if ($.isPlainObject(sel1) && $.isPlainObject(sel2)) {
                            if (!_.isEqual(sel1.members, sel2.members)) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }
                    return true;
                } else {
                    return false;
                }
            }
            if (storage && storageSession && getCurationJsonExport()) {
                var curationJsonOrig = JSON.parse(storageSession.getItem('curationJson'));
                var curationJson = getCurationListJson();
                if (_ && _.isEqual(curationJsonOrig.metadata, curationJson.metadata) &&
                    isEqualSelectionMembers(curationJsonOrig, curationJson)) {
                    //変更なし
                } else {
                    e.preventDefault();
                    return '';
                }
            }
        });
    }

    //curationメタデータにおける付箋・下敷き情報の更新
    function updateStationeryData(curation_, selectedOnly) {
        var curation = JSON.parse(JSON.stringify(curation_));
        var stickies = [];
        var sheets = [];
        map.eachLayer(function(layer) {
            if (layer.options) {
                var extCondition;
                if (selectedOnly) {
                    extCondition = layer.options.selected;
                } else {
                    extCondition = true;
                }
                if (layer.options.name === STICKY_LAYER_NAME && extCondition) {
                    var text = $(layer._icon).find('.editable').text();
                    var latlng = layer.getLatLng();
                    var seals = layer.options.seals || [];
                    var stckie = {
                        x: latlng.lng,
                        y: latlng.lat,
                        text: text
                    };
                    if (seals.length > 0) {
                        stckie.seals = seals;
                    }
                    stickies.push(stckie);
                } else if (layer.options.name === SHEET_LAYER_NAME && extCondition) {
                    var latlng_ = layer.getLatLng();
                    var sheet = {
                        x: latlng_.lng,
                        y: latlng_.lat,
                        w: layer.options.w,
                        h: layer.options.h
                    };
                    sheets.push(sheet);
                }
            }
        });
        var boardMetadataValue = [];
        if (stickies.length > 0) {
            boardMetadataValue.push({
                label: 'stickies',
                value: stickies
            });
        }
        if (sheets.length > 0) {
            boardMetadataValue.push({
                label: 'sheets',
                value: sheets
            });
        }
        var boardMetadata = {
            label: 'board',
            value: boardMetadataValue
        };
        var foundBoardMetadata = false;
        var foundStickiesAnnotationInMetadata = false;
        var foundSheetsAnnotationInMetadata = false;
        if ('metadata' in curation) {
            if ($.isArray(curation.metadata)) {
                for (var m = 0; m < curation.metadata.length; m++) {
                    var metadatum = curation.metadata[m];
                    if (metadatum && String(metadatum.label).toLowerCase() === 'board' && $.isArray(metadatum.value)) {
                        foundBoardMetadata = true;
                        var mda = metadatum.value;
                        for (var n = 0; n < mda.length; n++) {
                            var metadatum_ = mda[n];
                            if (metadatum_) {
                                if (String(metadatum_.label).toLowerCase() === 'stickies' && $.isArray(metadatum_.value)) {
                                    //metadatum_.valueを差し替えれば良い
                                    metadatum_.value = stickies;
                                    foundStickiesAnnotationInMetadata = true;
                                } else if (String(metadatum_.label).toLowerCase() === 'sheets' && $.isArray(metadatum_.value)) {
                                    //metadatum_.valueを差し替えれば良い
                                    metadatum_.value = sheets;
                                    foundSheetsAnnotationInMetadata = true;
                                }
                            }
                        }
                        if (!foundStickiesAnnotationInMetadata && stickies.length > 0) {
                            mda.push({
                                label: 'stickies',
                                value: stickies
                            });
                            foundStickiesAnnotationInMetadata = true;
                        }
                        if (!foundSheetsAnnotationInMetadata && sheets.length > 0) {
                            mda.push({
                                label: 'sheets',
                                value: sheets
                            });
                            foundSheetsAnnotationInMetadata = true;
                        }
                    }
                }
                if (!foundBoardMetadata && boardMetadataValue.length > 0) {
                    //curation.metadata配列にデータ追加
                    curation.metadata.push(boardMetadata);
                }
            }
        } else {
            if (boardMetadataValue.length > 0) {
                curation.metadata = [boardMetadata];
            }
        }
        return curation;
    }

    //ボードをSVGで書き出す下準備（第1段階）
    function preprocessBoardImagesPhase1() {
        function getData(url) {
            var deferred = $.Deferred();
            var xhr = new XMLHttpRequest();
            xhr.addEventListener('load', function() {
                if (xhr.status === 200) {
                    deferred.resolve(xhr.response);
                } else {
                    deferred.reject(xhr.status);
                }
            }, false);
            xhr.addEventListener('error', function() {
                deferred.reject(xhr.status);
            });
            xhr.addEventListener('timeout', function() {
                deferred.reject(xhr.status);
            });
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.send();
            return deferred.promise();
        }
        var deferreds = [];
        var markerIds = [];
        map.eachLayer(function(layer) {
            if (layer.options && 'markerId' in layer.options) {
                var i = layer.options.markerId;
                if (layer.options.name === MARKER_LAYER_NAME) {
                    var $img = $(layer._icon).find('img');
                    if ($img) {
                        var src = $img.attr('src');
                        deferreds.push(getData(src));
                        markerIds.push(i);
                    }
                }
            }
        });
        $.when.apply($, deferreds).done(function() {
            var imageBlobs = [];
            for (var i = 0; i < deferreds.length; i++) {
                imageBlobs.push(arguments[i]);
            }
            preprocessBoardImagesPhase2(imageBlobs, markerIds);
        }).fail(function(jqxhr, textStatus, error) {
            //画像取得時にCORSヘッダがない場合はエラーになる
            err = new Error(); showError(ICV_ERROR.SILENT, err.lineNumber, textStatus + ', ' + error);
            exportBoardAsSvg(); //フォールバック
        });
    }
    //ボードをSVGで書き出す下準備（第2段階）
    function preprocessBoardImagesPhase2(imageBlobs, markerIds) {
        function getDataUrl(xhrResponse) {
            var deferred = $.Deferred();
            var reader = new FileReader();
            reader.addEventListener('loadend', function() {
                deferred.resolve(reader.result);
            }, false);
            reader.readAsDataURL(xhrResponse);
            return deferred.promise();
        }
        var deferreds = [];
        for (var i = 0; i < imageBlobs.length; i++) {
            deferreds.push(getDataUrl(imageBlobs[i]));
        }
        $.when.apply($, deferreds).done(function() {
            var imageDataUrls = {};
            for (var i = 0; i < deferreds.length; i++) {
                imageDataUrls[markerIds[i]] = arguments[i];
            }
            exportBoardAsSvg(true, imageDataUrls);
        }).fail(function(jqxhr, textStatus, error) {
            err = new Error(); showError(ICV_ERROR.SILENT, err.lineNumber, textStatus + ', ' + error);
            $('#curation_list_export_svg').spin(false);
        });
    }
    //ボードをSVGでエクスポート
    function exportBoardAsSvg(embedImages, imageDataUrls) {
        function addSeals(paper, sealColors, x, y, pos) {
            var seal_r = 5;
            var seal_margin = 2;
            var seal_center_x = x + seal_r;
            var seal_center_y = y;
            if (pos === 'up') {
                seal_center_y -= (seal_margin + seal_r);
            } else {
                seal_center_y += (seal_margin + seal_r);
            }
            if (sealColors.length > 0) {
                for (var i = 0; i < sealColors.length; i++) {
                    var className = 'uni-' + sealColors[i];
                    var $seal_temp = $('<i>').addClass(className).text('o').css('display', 'none');
                    $('#iiif-curation-viewer').append($seal_temp); //実際にappendしないとChromeでは次行でcolorが取得できない
                    var color = $seal_temp.css('color');
                    $seal_temp.remove();
                    paper.circle(seal_center_x, seal_center_y, seal_r).attr({ fill: color, 'stroke-width': 0.5 });
                    seal_center_x += seal_r * 2 + seal_margin;
                }
            }
        }
        var $svg = $('<svg>').attr('id', 'svg_canvas').css('display', 'none');
        $('#iiif-curation-viewer').append($svg);
        var paper = Raphael('svg_canvas');

        //<title>（非表示要素）にURLを設定
        var curationUrl = getBrowsingCurationUrl();
        var el = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        el.appendChild(document.createTextNode(curationUrl));
        paper.canvas.appendChild(el);

        var xmin = 0;
        var ymin = 0;
        var xmax = 0;
        var ymax = 0;
        var favData = getFavs();
        map.eachLayer(function(layer) {
            if (layer.options && 'markerId' in layer.options) {
                var i = layer.options.markerId;
                if (layer.options.name === MARKER_LAYER_NAME || layer.options.name === STICKY_LAYER_NAME || layer.options.name === SHEET_LAYER_NAME) {
                    var src;
                    var x, y, w, h;
                    var drawn;
                    var latlng = layer.getLatLng();
                    x = latlng.lng;
                    y = -latlng.lat; //座標系の向きが逆
                    if (layer.options.name === MARKER_LAYER_NAME) {
                        var $img = $(layer._icon).find('img');
                        if ($img) {
                            src = $img.attr('src');
                            w = $img.width();
                            h = $img.height();
                            if (embedImages) {
                                var dataUrl = imageDataUrls[layer.options.markerId];
                                if (dataUrl) {
                                    src = dataUrl;
                                }
                            }
                            paper.image(src, x, y, w, h);
                            drawn = true;
                            //シール
                            var fav = favData[i];
                            if ('metadata' in fav && $.isArray(fav.metadata)) {
                                for (var m = 0; m < fav.metadata.length; m++) {
                                    var metadatum = fav.metadata[m];
                                    if (metadatum && String(metadatum.label).toLowerCase() === 'board' &&
                                        $.isPlainObject(metadatum.value) && $.isArray(metadatum.value.seals)) {
                                        addSeals(paper, metadatum.value.seals, x, y + h);
                                    }
                                }
                            }
                        }
                    } else if (layer.options.name === STICKY_LAYER_NAME) {
                        var $div = $(layer._icon).find('.icv-annotation-div-sticky');
                        var $span = $div.find('span');
                        if ($span) {
                            var text = $span.text();
                            w = $div.outerWidth();
                            h = $div.outerHeight();
                            var textLeft = $span.position().left || 18;
                            paper.rect(x, y, w, h).attr({ fill: $div.css('background-color'), 'stroke-width': 0 });
                            paper.text(x + textLeft, y + h / 2, text).attr({ 'text-anchor': 'start' });
                            drawn = true;
                            //シール
                            if ($.isArray(layer.options.seals)) {
                                addSeals(paper, layer.options.seals, x, y + h, 'up');
                            }
                        }
                    } else if (layer.options.name === SHEET_LAYER_NAME) {
                        var $div_ = $(layer._icon).find('.icv-annotation-div-sheet');
                        if ($div_) {
                            w = $div_.outerWidth();
                            h = $div_.outerHeight();
                            var sheetOpts = {
                                fill: '#999',
                                'fill-opacity': 0.1,
                                'stroke-width': 0
                            };
                            paper.rect(x, y, w, h).attr(sheetOpts).toBack();
                            drawn = true;
                        }
                    }
                    if (drawn) {
                        if (x < xmin) { xmin = x; }
                        if (y < ymin) { ymin = y; }
                        if (x + w > xmax) { xmax = x + w; }
                        if (y + h > ymax) { ymax = y + h; }
                    }
                }
            }
        });
        //キュレーション名・URLの表示
        ymin -= 28;
        var title_link = (curationInfo.curation.label) ? getPropertyValueI18n(curationInfo.curation.label) : curationUrl;
        paper.text(xmin, ymin + 5, title_link).attr({ 'text-anchor': 'start', href: getPageLink() });
        paper.text(xmin, ymin + 16, curationUrl).attr({ 'text-anchor': 'start', href: curationUrl });

        var border = 10;
        paper.setSize(xmax - xmin + border * 2, ymax - ymin + border * 2);
        paper.setViewBox(xmin - border, ymin - border, xmax - xmin + border * 2, ymax - ymin + border * 2, false);
        var svg = $svg.prop('innerHTML');
        $svg.remove();

        var blob = new Blob([svg], { type: 'text/plain' });
        var filename = 'curation.svg';
        try {
            var curationUrl_ = new URL(curationUrl);
            var fn = curationUrl_.pathname.split('/').pop();
            if (fn) {
                filename = 'curation_board_' + fn + '.svg';
            }
        } catch(e) {
            //
        }
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(blob, filename);
        } else if (window.URL.createObjectURL || window.webkitURL.createObjectURL) {
            var url;
            if (window.URL.createObjectURL) {
                url = window.URL.createObjectURL(blob);
            } else {
                url = window.webkitURL.createObjectURL(blob);
            }
            var anchorElem = document.createElement('a');
            anchorElem.href = url;
            anchorElem.download = filename;
            document.body.appendChild(anchorElem);
            anchorElem.click();
            document.body.removeChild(anchorElem);
        }
        $('#curation_list_export_svg').spin(false);
    }

    //エクスポートボタン・SVG書き出しボタンの表示
    function showExportButtons() {
        $('.nav_export').show();
    }
    function hideExportButtons() {
        $('.nav_export').hide();
    }

    //----------------------------------------------------------------------
    function updateHistory() {
        if (history.replaceState && history.state !== undefined) {
            var newUrl = getPageLink();
            history.replaceState(null, document.title, newUrl);
        }
    }
    function getPageLink(lang) {
        var localLang = lang || lng;
        var newUrl = location.protocol + '//' + location.host + location.pathname;
        var params_ = [];
        //表示対象指定
        if ('curation' in params) {
            params_.push('curation=' + encodeURIComponentForQuery(params.curation));
            if (params.mode) {
                params_.push('mode=' + encodeURIComponentForQuery(params.mode));
            }
        }
        //表示言語指定
        params_.push('lang=' + localLang);
        //サムネイル表示サイズ指定
        if ('tnsize' in params) {
            params_.push('tnsize=' + encodeURIComponentForQuery(params.tnsize));
        }
        if (params_.length > 0) {
            newUrl += '?' + params_.join('&');
        }
        return newUrl;
    }
    function encodeURIComponentForQuery(str) {
        //encodeURIComponentでエスケープされる文字の一部をアンエスケープする
        /*
            URI           = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
            query         = *( pchar / "/" / "?" )
            pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
            unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
            sub-delims    = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
            https://www.ietf.org/rfc/rfc3986.txt
        */
        //query部分では、":", "@", "/", "?" と sub-delimsは許されている
        //可読性のため、ここでは ":", "/", "," はアンエスケープする
        var result = encodeURIComponent(str).replace(/%(?:3A|2F|2C)/g, function(c) {
            return decodeURIComponent(c);
        });
        return result;
    }

    //エラー表示
    function showError(errtype, lineNumber, message) {
        switch (errtype) {
        case ICV_ERROR.NO_ERROR:
        case ICV_ERROR.DOWNLOAD_FAIL:
        case ICV_ERROR.UNSUPPORTED_VERSION:
        case ICV_ERROR.INCORRECT_DATA:
            if (map !== undefined) {
                map.off();
                map.remove();
                map = undefined;
            }
            hideExportButtons();
            $('#image_canvas').removeClass().empty();
        }
        var msg;
        switch (errtype) {
        case ICV_ERROR.DOWNLOAD_FAIL:
            msg = (lng !== 'ja') ? 'Unable to download IIIF data' : 'IIIFデータを取得できませんでした';
            break;
        case ICV_ERROR.UNSUPPORTED_VERSION:
            msg = (lng !== 'ja') ? 'Unsupported version of IIIF data' : '対応していないバージョンのIIIFデータです';
            break;
        case ICV_ERROR.INCORRECT_DATA:
            msg = (lng !== 'ja') ? 'Incorrect IIIF data' : 'IIIFデータに問題があります';
            break;
        }
        if (msg) {
            $('#book_title').html('<div class="alert alert-warning">' + msg + '</div>').show();
        }
        if (window.console) {
            var msg_ = APP_NAME + ' Error';
            var details = [];
            if (lineNumber) {  //行番号を取得できるのはFirefoxのみ
                details.push('line: ' + lineNumber);
            }
            if (msg) {
                details.push(msg);
            }
            if (message) {
                details.push(message);
            }
            if (details.length > 0) {
                msg_ += ' (' + details.join(', ') + ')';
            }
            console.log(msg_); // eslint-disable-line no-console
        }
    }

    //----------------------------------------------------------------------
    //modal表示関係
    var extraSubWindows = {};
    function resetSubWindows(optCallback) {
        //modal表示を解除した後で実行する処理を optCallback で指定する
        var needNotWait = false;
        if (isFullscreen()) {
            exitFullscreen();
            needNotWait = true;
        } else {
            $.each(extraSubWindows, function(key, callback) {
                if ($.isFunction(callback)) {
                    callback();
                }
            });
            var $dropdowns = $('.dropdown-menu:visible');
            if ($dropdowns.length) {
                $dropdowns.each(function() {
                    $(this).dropdown('toggle');
                });
            }
            var $modals = $('.modal:visible');
            if ($modals.length) {
                $modals.each(function() {
                    $(this).modal('hide');
                    $(this).one('hidden.bs.modal', function() {
                        var $modalVisible = $('.modal:visible');
                        if (optCallback && $.isFunction(optCallback) && $modalVisible.length === 0) {
                            optCallback();
                        }
                    });
                });
            } else {
                needNotWait = true;
            }
        }
        if (optCallback && $.isFunction(optCallback) && needNotWait) {
            optCallback();
        }
    }
    //フルスクリーン表示
    function viewFullscreen() {
        if (!isFullscreen()) {
            toggleFullscreen();
        }
    }
    function exitFullscreen() {
        if (isFullscreen()) {
            toggleFullscreen();
        }
    }
    function toggleFullscreen() {
        if (map !== undefined) {
            if (!isFullscreen()) {
                resetSubWindows(); //高速に切り替えたいのでcallbackは使わない
            }
            map.toggleFullscreen({ pseudoFullscreen: true });
        }
    }
    function isFullscreen() {
        return map !== undefined && map.isFullscreen();
    }
    //メタデータ編集表示
    function showMetadataEditDialog() {
        if (isMetadataEditDialogHidden()) {
            toggleMetadataEditDialog();
        }
    }
    function toggleMetadataEditDialog() {
        if (isMetadataEditDialogHidden()) {
            resetSubWindows(function() { $('#edit_metadata_win').modal('toggle'); });
        } else {
            resetSubWindows();
        }
    }
    function isMetadataEditDialogHidden() {
        return $('#edit_metadata_win').is(':hidden');
    }

    //----------------------------------------------------------------------
    //キュレーションリスト登録関係
    //・curationパラメータで外部キュレーションが指定され、その内容を表示するとき、
    //  sessionStorageへ外部キュレーション内容を格納する。
    //・sessionStorageにキュレーション内容が格納されていれば sessionStorageの内容を、
    //  格納されていなければ localStorageの内容を、キュレーションリスト画面の編集対象とする。
    function getFavs() {
        var favs;
        //sessionStorageにキュレーションデータがあれば、そちらを優先し、
        //なければ localStorageのキュレーションデータを返す。
        if (storageSession) {
            try {
                favs = JSON.parse(storageSession.getItem('favs'));
            } catch (e) {
                try {
                    favs = JSON.parse(LZString.decompressFromUTF16(storageSession.getItem('favs')));
                } catch (e) {
                    //console.log(e);
                }
            }
        }
        if (!favs) {
            if (storage) {
                favs = JSON.parse(storage.getItem('favs'));
            }
        }
        return favs || [];
    }
    function setFavs(favs, optForceUseSessionStorage) { //optForceSessionStorage: 省略可能
        if (storageSession) {
            var hasCurationData;
            if (storageSession.getItem('favsCompressed') === 'true') {
                try {
                    hasCurationData = JSON.parse(LZString.decompressFromUTF16(storageSession.getItem('favs')));
                } catch (e) {
                    //console.log(e);
                }
            } else {
                try {
                    hasCurationData = JSON.parse(storageSession.getItem('favs'));
                } catch (e) {
                    //console.log(e);
                }
            }
            if (optForceUseSessionStorage || hasCurationData) {
                //明示的に sessionStorage利用を指定された場合、または sessionStorageに
                //キュレーションデータがある場合
                if (optForceUseSessionStorage) {
                    try {
                        storageSession.setItem('curationUrl', getBrowsingCurationUrl());
                    } catch (e) {
                        enableCurationEdit = false;
                        err = new Error(); showError(ICV_ERROR.WEB_STORAGE, err.lineNumber, e);
                    }
                }
                try {
                    storageSession.setItem('favs', JSON.stringify(favs));
                    storageSession.setItem('favsCompressed', 'false');
                } catch (e) {
                    try {
                        storageSession.setItem('favs', LZString.compressToUTF16(JSON.stringify(favs)));
                        storageSession.setItem('favsCompressed', 'true');
                    } catch (e) {
                        enableCurationEdit = false;
                        err = new Error(); showError(ICV_ERROR.WEB_STORAGE, err.lineNumber, e);
                    }
                }
                return;
            }
        }
        if (storage) {
            try {
                storage.setItem('favs', JSON.stringify(favs));
            } catch (e) {
                err = new Error(); showError(ICV_ERROR.WEB_STORAGE, err.lineNumber, e);
            }
        }
    }
    function makeFav(page_, options) {
        var bookIndex = pageInfos[page_].bookIndex;
        var pageLocal = pageInfos[page_].pageLocal;
        var fragment  = pageInfos[page_].cropFragment || pageInfos[page_].fragment;
        var manifestUrl   = bookInfos[bookIndex].manifestUrl;
        var manifestLabel = bookInfos[bookIndex].manifest.label;
        var canvasInfoUrl = getCanvasImageInfoUrl(page_);
        var canvasId      = getCanvasId(page_);
        var canvasIndex   = getCanvasCursorIndex(page_);
        var canvasLabel   = getCanvasLabel(page_);
        var canvasThumbnail = getThumbnailUrl(page_, getRegeionFromFragment(fragment), THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        var fav = {
            manifestUrl   : manifestUrl,
            manifestLabel : manifestLabel,
            canvas        : canvasInfoUrl, //info.jsonのURL
            canvasId      : canvasId,
            canvasIndex   : canvasIndex, //cursorIndex
            canvasLabel   : canvasLabel,
            canvasThumbnail : canvasThumbnail, //サムネイルのURL
            pageLocal     : pageLocal,
            fragment      : fragment
        };
        if (options) {
            if (options.indexInBrowsingCuration) { //1-based
                fav.indexInBrowsingCuration = options.indexInBrowsingCuration;
            }
            if (options.metadata) {
                fav.metadata = options.metadata;
            }
            if (options.description) {
                fav.description = options.description;
            }
            if (options.durationHint) {
                fav.durationHint = options.durationHint;
            }
        }
        return fav;
    }

    function getCurationListSelections(favData) {
        var selections = [];
        var manifestUrl = '';
        var manifestUrlPrev = '';
        var scRange;
        for (var i = 0; i < favData.length; i++) {
            if (favData[i]) {
                var fav = favData[i];
                manifestUrl = fav.manifestUrl;
                var assumedBaseUrl = manifestUrl.replace(/\/manifest(\.json)?$/i, ''); //よくあるパターンのみ対応
                var manifestLabel = fav.manifestLabel;
                var canvasId = fav.canvasId;
                if (fav.fragment) {
                    canvasId += '#' + fav.fragment;
                }
                var canvas = {
                    '@id': canvasId,
                    '@type': 'sc:Canvas',
                    'label': fav.canvasLabel
                };
                if (fav.metadata !== undefined) {
                    canvas.metadata = fav.metadata;
                }
                if (fav.description !== undefined) {
                    canvas.description = fav.description;
                } else {
                    canvas.description = ''; //未設定の場合、後日、JSONエディタで修正しやすいように''で項目を生成しておく
                }
                if (fav.durationHint !== undefined) {
                    canvas.durationHint = fav.durationHint;
                }
                if (manifestUrl !== manifestUrlPrev) {
                    scRange = {
                        '@id': assumedBaseUrl + '/range/r' + String(i + 1),
                        '@type': 'sc:Range',
                        'label': 'Manual curation by ' + APP_NAME,
                        'members': [canvas],
                        'within': {
                            '@id': manifestUrl,
                            '@type': 'sc:Manifest',
                            'label': manifestLabel
                        }
                    };
                    selections.push(scRange);
                    manifestUrlPrev = manifestUrl;
                } else {
                    if (selections.length > 0) {
                        scRange = selections[selections.length - 1];
                        if (scRange && $.isArray(scRange.members)) {
                            scRange.members.push(canvas);
                        }
                    }
                }
            }
        }
        return selections;
    }
    function getCurationJsonFromFavs(favData) {
        var id = 'http://example.org/iiif/curation/curation.json';
        var label = 'Curating list';
        var selections = getCurationListSelections(favData);
        var codhCuration = {
            '@context': [
                'http://iiif.io/api/presentation/2/context.json',
                CONTEXT_CURATION
            ],
            '@type': 'cr:Curation', //codh:Curation
            '@id': id,
            label: label,
            selections: selections
        };
        return codhCuration;
    }
    function getCurationListJson(favs) {
        var curationJson;
        if (storageSession) {
            //storageSessionに'curationJson'がない場合 curationJsonは nullになる
            curationJson = JSON.parse(storageSession.getItem('curationJson'));
        }
        var favData = favs || getFavs();
        if (isValidCurationFalseTrue(curationJson)) {
            //外部キュレーションを編集中の場合、新規エクスポート、上書きエクスポート、JSONファイル保存の
            //いずれのケースでも、外部キュレーションのselections部分のみを差し替えた内容にする。
            //（外部キュレーションに設定されていた label等は引き継がれる。）
            curationJson.selections = getCurationListSelections(favData);
        } else {
            //外部キュレーションを編集中ではない場合、デフォルトの設定内容をもったCuration JSONを生成
            curationJson = getCurationJsonFromFavs(favData);
        }
        if (favs) {
            return curationJson; //curation.metadataの更新は呼び出し側の責任で行う
        } else {
            return updateStationeryData(curationJson);
        }
    }
    function exportCurationJson(curationJson, options) {
        $(window).off('beforeunload.board');
        var jsonExport = getCurationJsonExport(); //function or url
        if (jsonExport) {
            if ($.isFunction(jsonExport)) {
                jsonExport(curationJson, options);
            } else {
                var curationString = JSON.stringify(curationJson, null, '\t');
                $('<form>').attr({ action: jsonExport, method: 'post', target: '_blank' })
                    .append($('<input>').attr({ type: 'hidden', name: 'curation', value: encodeURIComponent(curationString) }))
                    .append($('<input>').attr({ type: 'hidden', name: 'lang', value: lng }))
                    .appendTo(document.body)
                    .submit()
                    .remove();
            }
        }
    }

    function getCanvasMetadataFromCuration(curation) {
        //curationでCanvasに付与されている付加情報（metadata, description, durationHint）の配列を返す
        var metadataList = [];
        var i, j;
        if ($.isPlainObject(curation)) {
            for (i = 0; i < curation.selections.length; i++) {
                var range = curation.selections[i];
                // http://iiif.io/api/presentation/2.1/#range
                if ($.isPlainObject(range) && range['@type'] === 'sc:Range') {
                    if (range.within) { //withinプロパティ
                        var manifestUrl = '';
                        var within = range.within;
                        if ($.type(within) === 'string') {
                            manifestUrl = within;
                        } else if ($.isPlainObject(within) && within['@id'] && within['@type'] && $.type(within['@id']) === 'string') {
                            if (within['@type'] === 'sc:Manifest') {
                                manifestUrl = within['@id'];
                            }
                        }
                        if (manifestUrl) {
                            if ($.isArray(range.canvases)) { //Rangeのcanvasesプロパティによる表示対象指定
                                for (j = 0; j < range.canvases.length; j++) {
                                    metadataList.push({}); //各要素は undefined
                                }
                            } else if ($.isArray(range.members)) { //membersプロパティによる表示対象指定
                                //membersプロパティ内では、sc:Canvasのみ対応。membersプロパティ内のsc:Rangeは未対応。
                                for (j = 0; j < range.members.length; j++) {
                                    var member = range.members[j];
                                    if ($.isPlainObject(member)) {
                                        metadataList.push({
                                            metadata: member.metadata,
                                            description: member.description,
                                            durationHint: member.durationHint
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return metadataList;
    }
    function getBrowsingCurationFavs() {
        //外部キュレーションを表示しているとき、外部キュレーションに基づくfav配列を返す
        var favData = [];
        if (getBrowsingCurationUrl()) {
            var metadata = getCanvasMetadataFromCuration(getBrowsingCurationJson());
            for (var i = 0; i < pageInfos.length; i++) {
                var options;
                if (metadata.length === pageInfos.length) {
                    var metadatum = metadata[i];
                    options = {
                        indexInBrowsingCuration: String(i + 1), //1-based
                        metadata: metadatum.metadata,
                        description: metadatum.description,
                        durationHint: metadatum.durationHint
                    };
                }
                favData.push(makeFav(i, options));
            }
        }
        return favData;
    }

    //----------------------------------------------------------------------
    //IIIF Presentation API関係
    function unescapeLimitedHtmlTag(htmlEscapedString) {
        // http://iiif.io/api/presentation/2.1/#html-markup-in-property-values
        // In order to avoid HTML or script injection attacks, clients must remove:
        //  - All attributes other than href on the a tag, src and alt on the img tag.
        // Clients should allow only a, b, br, i, img, p, and span tags.
        // Clients may choose to remove any and all tags
        // ここでは、aタグとbタグ、brタグ、iタグ、pタグ、spanタグのみ許可する
        function allowHtmlTag(string, tag) {
            var reg1 = new RegExp('&lt;' + tag + '(?:\\s.*?)?&gt;', 'gi');
            var reg2 = new RegExp('&lt;/' + tag + '\\s*&gt;', 'gi');
            return string.replace(reg1, '<' + tag + '>').replace(reg2, '</' + tag + '>');
        }
        function allowHtmlTagVoidElement(string, tag) {
            var reg = new RegExp('&lt;' + tag + '(?:\\s.*?)?/?&gt;', 'gi');
            return string.replace(reg, '<' + tag + '>');
        }
        var reg = new RegExp(/(&lt;a\s.+?&gt;)(.+?)(&lt;\/a\s*&gt;)/gi); //aタグ
        var result = htmlEscapedString.replace(reg,
            function(match, p1, p2, p3 /*, offset, string*/) {
                var result = match;
                if (p1 && p2 && p3) {
                    var hrefUrl = $('<span>').append(p1.replace(/^&lt;/i, '<').replace(/&gt;$/i, '>') + p2 + '</a>').children('a').attr('href');
                    if (hrefUrl) {
                        var anchor = document.createElement('a');
                        anchor.href = hrefUrl;
                        var href = anchor.href;
                        if (/^https?:\/\//.test(href)) {
                            result = $('<a>').attr('href', hrefUrl).html(p2).prop('outerHTML');
                        }
                    }
                }
                return result;
            }
        );
        result = allowHtmlTag(result, 'b');
        result = allowHtmlTag(result, 'i');
        result = allowHtmlTag(result, 'p');
        result = allowHtmlTag(result, 'span');
        result = allowHtmlTagVoidElement(result, 'br');
        return result;
    }
    function getKeyValuesShallow(obj, key, option) {
        // plain string または key属性値 の配列を返す（浅い探索のみ）
        var opt = option || {};
        var result;
        if ($.isArray(obj)) {
            return $.map(obj, function(element) {
                if ($.isPlainObject(element)) {
                    return element[key];
                } else if ($.type(element) === 'string') {
                    return element;
                } else if (opt.allowNumber === true && $.type(element) === 'number') {
                    return String(element);
                } else if (opt.allowBoolean === true && $.type(element) === 'boolean') {
                    return String(element);
                } else if (opt.allowNull === true && $.type(element) === 'null') {
                    return String(element);
                } else {
                    return null; //elementがArrayの場合は無視
                }
            });
        }
        if ($.isPlainObject(obj)) {
            result = obj[key] || '';
        } else {
            result = obj;
        }
        if ($.type(result) === 'string') {
            return [result];
        } else if (opt.allowNumber === true && $.type(result) === 'number') {
            return [String(result)];
        } else if (opt.allowBoolean === true && $.type(result) === 'boolean') {
            return [String(result)];
        } else if (opt.allowNull === true && $.type(result) === 'null') {
            return [String(result)];
        } else {
            return []; //入れ子を降りていって探すことはしない
        }
    }
    function getPropertyValuesI18n(prop, lang, option) {
        // @languageを考慮した属性値の配列を返す
        // http://iiif.io/api/presentation/2.1/#language-of-property-values
        // This pattern may be used in label, description, attribution and 
        // the label and value fields of the metadata construction.
        var opt = option || {};
        function getElementsI18n(arr, lang) {
            if ($.isArray(arr)) {
                return arr.filter(function(element) {
                    return $.isPlainObject(element) && '@value' in element && (element['@language'] === lang || !lang);
                });
            } else {
                return [];
            }
        }
        var result = prop;
        var key = '@value';
        if ($.isArray(prop)) {
            result = getElementsI18n(prop, lang);
            if (result.length > 0) {
                //言語設定に一致するものがある → 一致したものを表示
            } else {
                var propNum = prop.filter(function(element) {
                    return ($.isPlainObject(element) && key in element) || $.type(element) === 'string';
                }).length;
                var langPropNum = getElementsI18n(prop).length;
                if (langPropNum === 0) {
                    //一つも'@language'が設定されていない → 全て表示
                    result = prop;
                } else if (langPropNum === propNum) {
                    //全ての要素に'@language'が設定されているが、言語設定に一致するものはない
                    //→ 表示すべき言語を決めて、それに一致したものを表示
                    result = getElementsI18n(prop, 'en'); //fallback
                    if (result.length === 0) {
                        result = getElementsI18n(prop);
                        if (result.length > 0) {
                            result = getElementsI18n(prop, result[0]['@language']);
                        }
                    }
                } else {
                    //一部の要素に'@language'が設定されているが、言語設定に一致するものはない
                    //→ '@language'が設定されていないものを全て表示
                    result = prop.filter(function(element) {
                        if ($.isPlainObject(element)) {
                            return !element['@language'];
                        } else if ($.type(element) === 'string') {
                            return element;
                        } else {
                            return false; //elementがArrayの場合は無視
                        }
                    });
                }
            }
        }
        return getKeyValuesShallow(result, key, opt);
    }
    function getPropertyValueI18n(prop, lang, option) {
        // @languageを考慮した属性値のコンマ区切り文字列を返す
        if (!lang) {
            lang = lng;
        }
        return getPropertyValuesI18n(prop, lang, option).join(', ');
    }
    function getRegeionFromFragment(fragment) {
        var region = 'full';
        if (fragment) {
            //https://www.w3.org/TR/media-frags/#naming-space
            var match = fragment.match(/xywh=(?:pixel:)?([0-9]+),([0-9]+),([0-9]+),([0-9]+)/); //「percent:」は未対応
            if (match) {
                var x = parseInt(match[1], 10);
                var y = parseInt(match[2], 10);
                var w = parseInt(match[3], 10);
                var h = parseInt(match[4], 10);
                region = [x, y, w, h].join(',');
            }
        }
        return region;
    }
    function getMajorVersionNumberFromSemVer(semVer) {
        var major = parseInt((semVer.split('.'))[0], 10);
        if (isNaN(major)) {
            return -1;
        } else {
            return major;
        }
    }
    function getLabelValuePair(object) {
        var string = '';
        if (object) {
            var delimiter = (lng !== 'ja') ? ': ' : '：';
            $.each(object, function(key, val) {
                if (val && 'label' in val && 'value' in val) {
                    var facetLabel = getPropertyValueI18n(val.label, lng);
                    var facetValue = getPropertyValueI18n(val.value, lng, { allowNumber: true, allowBoolean: true });
                    //アノテーションビューモード用のメタデータ記載については個別対応する
                    if (String(val.label).toLowerCase() === 'annotation' && $.isArray(val.value)) {
                        for (var n = 0; n < val.value.length; n++) {
                            var annotation = val.value[n];
                            if ($.isPlainObject(annotation) && annotation['@id'] && annotation['@type'] === 'oa:Annotation' &&
                                annotation.motivation === 'sc:painting' && $.isPlainObject(annotation.resource)) {
                                var resource = annotation.resource;
                                var resourceChars;
                                if (resource.format === 'text/html') {
                                    resourceChars = getPropertyValueI18n(resource.chars, lng);
                                } else { // text/plainなど
                                    if (resource.chars) {
                                        var resourceChars_ = getPropertyValueI18n(resource.chars, lng);
                                        if (resourceChars_) {
                                            resourceChars = $('<span>').text(resourceChars_).prop('outerHTML');
                                        }
                                    }
                                }
                                if (resourceChars) {
                                    facetValue = resourceChars;
                                }
                            }
                        }
                    }
                    string += facetLabel + delimiter + facetValue + '<br>';
                }
            });
        }
        return string;
    }

    //オブジェクトの最低限の妥当性チェック
    //（この結果がfalseであるものは必ずinvalidだが、この結果がtrueであってもvalidとは限らない）
    function isValidCurationFalseTrue(curation) {
        //最低限のチェック（この結果のみをもってvalidと判断してはならない）
        //selections内の必須プロパティ未チェックなので、この結果のみをもってvalidと判断してはならない
        return ($.isPlainObject(curation) && $.isArray(curation['@context']) &&
            curation['@context'][0] === 'http://iiif.io/api/presentation/2/context.json' &&
            curation['@context'][1] === CONTEXT_CURATION &&
            (curation['@type'] === 'cr:Curation' || curation['@type'] === 'codh:Curation') &&
            $.isArray(curation.selections));
    }
    function isValidManifestFalseTrue(manifest) {
        //最低限のチェック（この結果のみをもってvalidと判断してはならない）
        return (checkManifestData(manifest) === ICV_ERROR.NO_ERROR);
    }
    function checkManifestData(manifest) {
        //最低限のチェック（この結果のみをもってvalidと判断してはならない）
        if ($.isPlainObject(manifest)) {
            var context = manifest['@context'];
            var contexts;
            if ($.type(context) === 'string') {
                contexts = [context];
            } else if ($.isArray(context)) {
                contexts = context;
            } else {
                contexts = [];
            }
            if (contexts.indexOf('http://iiif.io/api/presentation/2/context.json') > -1) {
                //IIIF Presentation API 2.0/2.1
                if (manifest['@type'] === 'sc:Manifest' && 'label' in manifest) {
                    //仕様上は@idも必須プロパティだが、ここではなくても可とする
                    return ICV_ERROR.NO_ERROR;
                }
            } else if (contexts.indexOf('http://www.shared-canvas.org/ns/context.json') > -1 ||
                contexts.indexOf('http://iiif.io/api/presentation/1/context.json') > -1) {
                //IIIF Presentation API 0.9/1.0
                return ICV_ERROR.UNSUPPORTED_VERSION;
            } else if (contexts.indexOf('http://iiif.io/api/presentation/3/context.json') > -1) {
                //IIIF Presentation API 3.0
                return ICV_ERROR.UNSUPPORTED_VERSION;
            }
        }
        return ICV_ERROR.INCORRECT_DATA;
    }

    function getRegeion(page) {
        return getRegeionFromFragment(pageInfos[page].fragment);
    }
    function getQuality(page) {
        var semVer = getCanvasImageApiVersion(page);
        var major = getMajorVersionNumberFromSemVer(semVer);
        if (major < 2) {
            return 'native';
        } else {
            return 'default';
        }
    }
    function getThumbnailUrl(page, region, width, height, options) {
        var complianceLevel = getCanvasImageComplianceLevel(page);
        if (complianceLevel === 0) {
            //Compliance Level 0 の場合は、Sizeにfull以外を指定しての取得は未対応と考える。
            //また、Regionにfull以外（x,y,w,hなど）を指定しての取得は期待できない上に、
            //Getty Museum のように、/full/full/ では画像を返してくれないサイトもあるので、
            //明示的にサムネイルの設定があれば、そちらを利用する。
            //https://iiif.io/api/image/2.1/compliance/#size
            var thumbnailUrl = getCanvasThumbnailUrl(page);
            if (thumbnailUrl) {
                return thumbnailUrl;
            }
        }
        var canvasImageInfoUrl = getCanvasImageInfoUrl(page);
        if (canvasImageInfoUrl) {
            var region_ = region || getRegeion(page);
            var w = width || 200;
            var h = height || 200;
            var size;
            if (complianceLevel >= 2) {
                size = '!' + w + ',' + h; //'!200,200';
            } else if (complianceLevel === 1) {
                size = w + ','; //'200,';
            } else if (complianceLevel === 0) {
                size = 'full';
            } else {
                size = '!' + w + ',' + h; //complianceLevel不明
            }
            if (wrapThumbnail) {
                if (tnsize === 'full') {
                    size = 'full';
                    if (options && $.isPlainObject(options)) {
                        if ('pct' in options) {
                            if (complianceLevel >= 1) {
                                size = 'pct:' + options.pct;
                            }
                        }
                    }
                } else if (tnsize === 'sizebyw') {
                    if (complianceLevel >= 1) {
                        size = w + ','; //'200,';
                    } else if (complianceLevel === 0) {
                        size = 'full';
                    } else {
                        size = w + ','; //complianceLevel不明
                    }
                } else if (tnsize === 'sizebyh') {
                    if (complianceLevel >= 1) {
                        size = ',' + h; //',200';
                    } else if (complianceLevel === 0) {
                        size = 'full';
                    } else {
                        size = ',' + h; //complianceLevel不明
                    }
                }
            }
            var rotation = 0;
            var quality = getQuality(page);
            var format = 'jpg';
            var imageReqParams = [region_, size, rotation, quality + '.' + format].join('/');
            return canvasImageInfoUrl.replace('/info.json', '/' + imageReqParams);
        } else {
            //IIIF Image API非対応リソース
            return getCanvasImageResourceId(page);
        }
    }
    function getPsuedoIIIFThumbnail($image, fragment, width, height) {
        //サムネイルを取得（IIIF Image API非対応リソース用）
        var regionElems = getRegeionFromFragment(fragment).split(',');
        if (regionElems.length === 4) {
            var x = parseInt(regionElems[0], 10);
            var y = parseInt(regionElems[1], 10);
            var w = parseInt(regionElems[2], 10);
            var h = parseInt(regionElems[3], 10);
            var targetW = width || 100;
            var targetH = height || 90;
            if (w < 1) { w = 1; }
            if (h < 1) { h = 1; }
            var ratioW = targetW / w;
            var ratioH = targetH / h;
            var ratio = Math.min(ratioW, ratioH, 1);
            var $psuedo_iiif_thumbnail = $('<div>').addClass('psuedo_iiif_thumbnail').css({ width: (w * ratio) + 'px', height: (h * ratio) + 'px' });
            $image.addClass('psuedo_iiif').css({ 'transform': 'scale(' + ratio + ') translate(' + (-x) + 'px,' + (-y) + 'px)' });
            return $psuedo_iiif_thumbnail.append($image);
        } else {
            return null;
        }
    }

    //bookInfos[].canvases[]要素へのアクセスヘルパー
    function getCanvasImageInfoUrl(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].imageInfoUrl; //info.jsonのURL
    }
    function getCanvasId(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].id;
    }
    function getCanvasIds(bookIndex) {
        var canvasIds = [];
        for (var i = 0; i < bookInfos[bookIndex].totalPagesNum; i++) {
            canvasIds.push(bookInfos[bookIndex].canvases[i].id);
        }
        return canvasIds;
    }
    function getCanvasCursorIndex(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].cursorIndex;
    }
    function getCanvasLabel(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].label;
    }
    function getCanvasImageApiVersion(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].imageApiVersion;
    }
    function getCanvasImageComplianceLevel(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].imageComplianceLevel; //IIIF Image API非対応リソースの場合は-1
    }
    function getCanvasImageResourceId(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].imageResourceId;
    }
    function getCanvasThumbnailUrl(page) {
        var bookIndex = pageInfos[page].bookIndex;
        var pageLocal = pageInfos[page].pageLocal;
        return bookInfos[bookIndex].canvases[pageLocal - 1].thumbnail; //undefinedもありうる
    }

    //getter/setter
    function getLang() {
        return lng;
    }
    function getBrowsingCurationJson() {
        return curationInfo.curation || {};
    }
    function getBrowsingCurationUrl() {
        return curationInfo.curationUrl || '';
    }
    function getCurationJsonExportUrl() {
        return conf.service.curationJsonExportUrl || '';
    }
    function getCurationJsonExport() {
        return conf.service.curationJsonExport;
    }
    function setCurationJsonExport(arg) { //arg: callback function or url or null
        if ($.isFunction(arg)) {
            conf.service.curationJsonExport = arg;
        } else if ($.type(arg) === 'string') {
            conf.service.curationJsonExport = arg;
            conf.service.curationJsonExportUrl = arg;
        } else {
            conf.service.curationJsonExport = '';
        }
    }
    return {
        getLang: getLang, //'en' or 'ja'
        getBrowsingCurationUrl: getBrowsingCurationUrl,   //現在表示している外部curationのURLを取得
        getEditingCurationJson: getCurationListJson,  //現在編集している外部または内部curationの内容を取得
        getCurationJsonExportUrl: getCurationJsonExportUrl, //curationのエクスポート先URLを取得
        getCurationJsonExport: getCurationJsonExport, //curationのエクスポートコールバック関数またはエクスポート先URLを取得
        setCurationJsonExport: setCurationJsonExport, //curationのエクスポートコールバック関数またはエクスポート先URLを設定
        exportCurationJson: exportCurationJson, //引数で指定されたjsonをエクスポートする
    };
};