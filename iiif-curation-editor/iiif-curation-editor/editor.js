/*
 * IIIF Curation Editor v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-editor/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see acknowledgements.txt
 */
var IIIFCurationEditor = function(config) {
    'use strict';

    var APP_NAME = 'IIIF Curation Editor';
    //var VERSION = '1.0.0+20190620';

    var editor;
    var jsonUrl;

    //リテラルはさほど多くないので、i18n用のフレームワークは用いず、直接記述する。
    var lng = String(window.navigator.language || window.navigator.userLanguage || 'ja').substr(0, 2) !== 'ja' ? 'en' : 'ja';

    var err;

    var defaultConfig = {
        //タイトル
        //title: APP_NAME, //HTML側に直接記述しているケースを考慮し、デフォルト値は設けない
        service: {
            curationJsonExportUrl: ''
        },
        doc: {
            //言語を分けない場合は、
            // aboutUrl: 'http://codh.rois.ac.jp/software/iiif-curation-editor/'
            //のように記述しても良い
            aboutUrl: [
                {
                    '@language': 'en',
                    '@value': 'http://codh.rois.ac.jp/software/iiif-curation-editor/'
                },
                {
                    '@language': 'ja',
                    '@value': 'http://codh.rois.ac.jp/software/iiif-curation-editor/'
                }
            ]
        },
        jsonEditorOptions: {}
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

    setupUi();

    if (params) {
        if (params.curation || params.json) {
            processJsonUrl(params.curation || params.json);
        }
    }

    //----------------------------------------------------------------------
    function configure(config, defaultConfig) {
        var conf_ = defaultConfig;
        if ($.isPlainObject(config)) {
            if ($.type(config.title) === 'string' || $.type(config.title) === 'array') {
                conf_.title = config.title;
            }
            if ($.isPlainObject(config.service)) {
                if ($.type(config.service.curationJsonExportUrl) === 'string') {
                    conf_.service.curationJsonExportUrl = config.service.curationJsonExportUrl;
                }
            }
            if ($.isPlainObject(config.doc)) {
                if ($.type(config.doc.aboutUrl) === 'string' || $.type(config.doc.aboutUrl) === 'array') {
                    conf_.doc.aboutUrl = config.doc.aboutUrl;
                }
            }
            if ($.isPlainObject(config.jsonEditorOptions)) {
                conf_.jsonEditorOptions = config.jsonEditorOptions;
            }
            if ($.type(config.enableDeleteButton) === 'boolean') {
                conf_.enableDeleteButton = config.enableDeleteButton;
            }
        }
        conf_.service.curationJsonExport = conf_.service.curationJsonExportUrl;
        return conf_;
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
                    if (paramsObj[key]) {
                        paramsObj[key] = paramsObj[key] + ',' + val;
                    } else {
                        paramsObj[key] = val;
                    }
                }
            }
            return paramsObj;
        } else {
            return null;
        }
    }

    //----------------------------------------------------------------------
    function processJsonUrl(jsonUrl_) {
        $.getJSON(jsonUrl_, function(json_) {
            if (editor) {
                jsonUrl = jsonUrl_;
                editor.set(json_);
                updateUi();
                $('#editor_container').show();
                $('#json_url_form_container').hide();
            } else {
                err = new Error(); showError(1, err.lineNumber);
            }
        }).fail(function(jqxhr, textStatus, error) {
            err = new Error(); showError(1, err.lineNumber, textStatus + ', ' + error); //jsonの取得に失敗
        });
    }

    //----------------------------------------------------------------------
    function setupUi() {
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
        var aboutUrl = getPropertyValuesI18n(conf.doc.aboutUrl)[0];
        if (aboutUrl) {
            $('#navbar_help_link').attr('href', aboutUrl).text((lng !== 'ja') ? 'Help' : 'ヘルプ');
        } else {
            $('#navbar_help_li').hide();
        }

        //エディタ
        var container = document.getElementById('jsoneditor');
        var options = {
            mode: 'tree',
            modes: ['code', 'tree'],
            onError: function(err_) {
                err = new Error(); showError(0, err.lineNumber, err_.toString());
            }
        };
        $.extend(options, conf.jsonEditorOptions);
        editor = new JSONEditor(container, options);

        updateUi();
        $('#json_export').on('click', function() {
            if (getJsonExport()) {
                var json = getEditedJson();
                if (json) {
                    if (editor && editor.validateSchema !== null && editor.validateSchema.errors !== null) {
                        showAlert($('#editor_container'), 'danger', 'Not match the JSON schema', 3000);
                    } else {
                        var method = jsonUrl ? 'PUT' : 'POST';
                        exportJson(json, { method: method, forceRedirect: true });
                    }
                } else {
                    showAlert($('#editor_container'), 'danger', 'Not a valid JSON', 3000);
                }
            }
        });
        if (conf.enableDeleteButton) {
            var $delete = $('<button>').attr('id', 'json_delete').attr('type', 'button').addClass('btn btn-default btn-icv-export')
                .html('<span class="glyphicon glyphicon-remove"></span> ' + ((lng !== 'ja') ? 'Delete' : '削除'))
                .on('click', function() {
                    exportJson(null, { method: 'DELETE',
                        callback: function() {
                            jsonUrl = null;
                            updateUi();
                        }
                    });
                });
            $('#jsoneditor_footer_buttons').prepend($delete);
        }

        $('#editor_container').hide();
        $('#json_url').attr('placeholder', 'Curation URL' + ((lng !== 'ja') ? ' (starts with "' + getJsonExportUrl() + '")' : '（"' + getJsonExportUrl() + '"で始まるもの）'));
        if (lng !== 'ja') {
            var $lang = $('<input>').attr('name', 'lang').attr('value', lng).attr('type', 'hidden');
            $('#json_url_form').append($lang);
        }
        $('#json_url_form_submit').text((lng !== 'ja') ? 'Go!' : '編集');
        $('#json_url_form_container').show();

        setupNavigations();
    }
    function updateUi() {
        var button = '<span class="glyphicon glyphicon-export"></span> ';
        var buttonSave = button + ((lng !== 'ja') ? 'Save' : '上書き保存');
        var buttonSaveAs = button + ((lng !== 'ja') ? 'Save As' : '新規保存');
        $('#json_export').html(jsonUrl ? buttonSave : buttonSaveAs);

        var jsonExport = getJsonExport(); //function or url
        if (jsonExport && $.isFunction(jsonExport)) {
            $('.btn-icv-export').show();
        } else {
            $('.btn-icv-export').hide();
        }
    }
    function setupNavigations() {
        //表示言語切り替え
        if ($('.nav_lang_ja').length && $('.nav_lang_en').length) {
            if (lng !== 'ja') {
                var $ja = $('<a>').attr('href', '?lang=ja').text('日本語');
                $('.nav_lang_ja').html($ja).attr('title', '日本語');
                $('.nav_lang_en').text('English');
            } else {
                var $en = $('<a>').attr('href', '?lang=en').text('English');
                $('.nav_lang_ja').text('日本語');
                $('.nav_lang_en').html($en).attr('title', 'in English');
            }
        }
    }

    //----------------------------------------------------------------------
    //エラー表示
    function showError(errtype, lineNumber, message) {
        if (errtype === 1) {
            $('#book_title').html('<div class="alert alert-warning">' + ((lng !== 'ja') ? 'Unable to download data' : 'データ取得に失敗しました') + '</div>');
        }
        if (errtype && window.console) {
            var msg = APP_NAME + ' Error';
            var details = [];
            if (lineNumber) {  //行番号を取得できるのはFirefoxのみ
                details.push('line: ' + lineNumber);
            }
            if (message) {
                details.push(message);
            }
            if (details.length > 0) {
                msg += ' (' + details.join(', ') + ')';
            }
            console.log(msg); // eslint-disable-line no-console
        }
    }
    function showAlert($appendTo, context, text, duration) {
        if ($appendTo && $appendTo.length === 1) {
            var alertId = 'export_json_keeper_alert';
            var modifierClass = 'alert-' + context;
            $('#' + alertId).remove();
            $('<div>').addClass('alert').addClass(modifierClass).attr('role', 'alert').attr('id', alertId).text(text).appendTo($appendTo);
            setTimeout(function() {
                $('#' + alertId).alert('close').remove();
            }, duration);
        }
    }

    //----------------------------------------------------------------------
    function getEditedJson() {
        try {
            return editor.get();
        } catch (e) {
            //
        }
        return null;
    }
    function exportJson(json, options) {
        var jsonExport = getJsonExport(); //function or url
        if (jsonExport && $.isFunction(jsonExport)) {
            jsonExport(json, options);
        }
    }

    //----------------------------------------------------------------------
    function getKeyValuesShallow(obj, key) {
        // plain string または key属性値 の配列を返す（浅い探索のみ）
        var result;
        if ($.isArray(obj)) {
            return $.map(obj, function(element) {
                if ($.isPlainObject(element)) {
                    return element[key];
                } else if ($.type(element) === 'string') {
                    return element;
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
        } else {
            return []; //入れ子を降りていって探すことはしない
        }
    }
    function getPropertyValuesI18n(prop, lang) {
        // @languageを考慮した属性値の配列を返す
        // http://iiif.io/api/presentation/2.1/#language-of-property-values
        // This pattern may be used in label, description, attribution and 
        // the label and value fields of the metadata construction.
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
        return getKeyValuesShallow(result, key);
    }
    function getPropertyValueI18n(prop, lang) {
        // @languageを考慮した属性値のコンマ区切り文字列を返す
        if (!lang) {
            lang = lng;
        }
        return getPropertyValuesI18n(prop, lang).join(', ');
    }

    //----------------------------------------------------------------------
    //getter/setter
    function getName() {
        return APP_NAME;
    }
    function getLang() {
        return lng;
    }
    function getBrowsingJsonUrl() {
        return jsonUrl || '';
    }
    function getJsonExportUrl() {
        return conf.service.curationJsonExportUrl || '';
    }
    function getJsonExport() {
        return conf.service.curationJsonExport;
    }
    function setJsonExport(arg) { //arg: callback function or url or null
        if ($.isFunction(arg)) {
            conf.service.curationJsonExport = arg;
        } else if ($.type(arg) === 'string') {
            conf.service.curationJsonExport = arg;
            conf.service.curationJsonExportUrl = arg;
        } else {
            conf.service.curationJsonExport = '';
        }
        updateUi();
    }
    return {
        getName: getName,
        getLang: getLang, //'en' or 'ja'
        getBrowsingCurationUrl: getBrowsingJsonUrl,   //現在表示している外部JSONのURLを取得
        getCurationJsonExportUrl: getJsonExportUrl,
        setCurationJsonExport: setJsonExport
    };
};