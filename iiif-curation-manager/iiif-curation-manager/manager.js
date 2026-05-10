/*
 * IIIF Curation Manager v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-manager/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see acknowledgements.txt
 */
var IIIFCurationManager = function(config) {
    'use strict';

    var APP_NAME = 'IIIF Curation Manager';
    //var VERSION = '1.0.1+20200917';

    var dataTable;

    //リテラルはさほど多くないので、i18n用のフレームワークは用いず、直接記述する。
    var lng = String(window.navigator.language || window.navigator.userLanguage || 'ja').substr(0, 2) !== 'ja' ? 'en' : 'ja';

    var err;

    var defaultConfig = {
        //タイトル
        //title: APP_NAME, //HTML側に直接記述しているケースを考慮し、デフォルト値は設けない
        service: {
            curationJsonExportUrl: '',
            curationViewerUrl: '',
            curationEditorUrl: '',
            curationPlayerUrl: '',
            curationBoardUrl: ''
        },
        doc: {
            //言語を分けない場合は、
            // aboutUrl: 'http://codh.rois.ac.jp/software/iiif-curation-manager/'
            //のように記述しても良い
            aboutUrl: [
                {
                    '@language': 'en',
                    '@value': 'http://codh.rois.ac.jp/software/iiif-curation-manager/'
                },
                {
                    '@language': 'ja',
                    '@value': 'http://codh.rois.ac.jp/software/iiif-curation-manager/'
                }
            ]
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

    setupUi();

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
                if ($.type(config.service.curationViewerUrl) === 'string') {
                    conf_.service.curationViewerUrl = config.service.curationViewerUrl;
                }
                if ($.type(config.service.curationEditorUrl) === 'string') {
                    conf_.service.curationEditorUrl = config.service.curationEditorUrl;
                }
                if ($.type(config.service.curationPlayerUrl) === 'string') {
                    conf_.service.curationPlayerUrl = config.service.curationPlayerUrl;
                }
                if ($.type(config.service.curationBoardUrl) === 'string') {
                    conf_.service.curationBoardUrl = config.service.curationBoardUrl;
                }
            }
            if ($.isPlainObject(config.doc)) {
                if ($.type(config.doc.aboutUrl) === 'string' || $.type(config.doc.aboutUrl) === 'array') {
                    conf_.doc.aboutUrl = config.doc.aboutUrl;
                }
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
    //ユーザドキュメント一覧の取得と処理
    function processUserdocsList() {
        var endpointUrl = config.service.curationJsonExportUrl;
        if (endpointUrl) {
            var userdocsUrl = endpointUrl + '/userdocs';
            $('#guide_container').hide();
            $('#dt-header,#dt-main,#dt-footer').hide();
            if (dataTable) {
                dataTable.clear().draw();
            }
            manageJsonStore(null, {method: 'GET', endpointUrl: userdocsUrl, callback: processUserdocsListCore });
        }
    }
    function processUserdocsListCore(jqxhr) {
        var userdocsList;
        if (jqxhr) {
            userdocsList = jqxhr.responseJSON;
            if (!userdocsList && jqxhr.responseText) {
                userdocsList = JSON.parse(jqxhr.responseText);
            }
        }
        if (userdocsList) {
            var endpointUrl = config.service.curationJsonExportUrl;
            $('#userdocs_container').show();
            $('#dt-header,#dt-main,#dt-footer').show();
            if (!dataTable) {
                $.fn.dataTable.ext.order['dom-checkbox'] = function(settings, col) {
                    return this.api().column(col, { order: 'index' }).nodes().map(function(td) {
                        return $('input', td).prop('checked') ? '1' : '0';
                    });
                };

                var dataTableConfig = {
                    columns: [
                        { data: 'label', title: (lng !== 'ja') ? 'Title' : 'タイトル' },
                        { data: 'created_at', title: (lng !== 'ja') ? 'Date created' : '作成日時' },
                        { data: 'updated_at', title: (lng !== 'ja') ? 'Date updated' : '更新日時' },
                        { data: 'unlisted', title: (lng !== 'ja') ? 'Listed' : 'リスト掲載' }
                    ],
                    columnDefs: [
                        {
                            //タイトル
                            render: function(data, type, row) {
                                var docUrl = endpointUrl + '/' + row.id;
                                var params_ = [];
                                params_.push('curation=' + docUrl);
                                params_.push('lang=' + lng);
                                var joinedParams = params_.join('&');
                                var linkUrl = conf.service.curationViewerUrl ? conf.service.curationViewerUrl + '?' + joinedParams : docUrl;
                                var docLink = $('<a>').addClass('userdocs_url').attr('href', linkUrl).attr('target', '_blank').text(getPropertyValueI18n(data)).prop('outerHTML');
                                //ホワイトボード
                                var boardLink = '';
                                if (config.service.curationBoardUrl) {
                                    var boardUrl = config.service.curationBoardUrl + '?' + joinedParams;
                                    boardLink = $('<a>').addClass('userdocs_boardLink pull-right').attr('href', boardUrl).attr('target', '_blank').attr('title', (lng !== 'ja') ? 'Board' : 'ホワイトボード').html('<span class="glyphicon glyphicon-blackboard"></span>').prop('outerHTML');
                                }
                                //再生
                                var playerLink = '';
                                if (config.service.curationPlayerUrl) {
                                    var playerUrl = config.service.curationPlayerUrl + '?' + joinedParams;
                                    playerLink = $('<a>').addClass('userdocs_playLink pull-right').attr('href', playerUrl).attr('target', '_blank').attr('title', (lng !== 'ja') ? 'Play' : '再生').html('<span class="glyphicon glyphicon-play"></span>').prop('outerHTML');
                                }
                                //ダウンロード
                                var downloadLink = $('<a>').addClass('userdocs_download pull-right').attr('href', docUrl).attr('target', '_blank').attr('title', (lng !== 'ja') ? 'Download' : 'ダウンロード').html('<span class="glyphicon glyphicon-download-alt"></span>').prop('outerHTML');
                                return docLink + downloadLink + playerLink + boardLink;
                            },
                            targets: 0
                        },
                        {
                            //作成日時・更新日時
                            render: function(data, type) {
                                if (!data) {
                                    return null;
                                }
                                if (window.moment !== undefined) {
                                    return window.moment(data).format((type === 'sort' || type === 'type') ? 'x' : 'YYYY/MM/DD HH:mm:ss');
                                } else {
                                    return data;
                                }
                            },
                            targets: [1, 2]
                        },
                        {
                            //リスト掲載
                            render: function(data, type, row) {
                                var $checkbox;
                                if (data) {
                                    $checkbox = $('<input class="listed" data-toggle="toggle" type="checkbox">');
                                } else {
                                    $checkbox = $('<input class="listed" checked data-toggle="toggle" type="checkbox">');
                                }
                                $checkbox.attr('data-url', endpointUrl + '/' + row.id + '/status');
                                return $checkbox.prop('outerHTML');
                            },
                            orderDataType: 'dom-checkbox',
                            targets: 3
                        },
                        {
                            title: (lng !== 'ja') ? 'Edit' : '編集',
                            orderable: false,
                            searchable: false,
                            visible: config.service.curationEditorUrl ? true : false,
                            render: function(data, type, row) {
                                var curationEditorUrl = config.service.curationEditorUrl;
                                if (curationEditorUrl) {
                                    var docUrl = endpointUrl + '/' + row.id;
                                    var params_ = [];
                                    params_.push('curation=' + docUrl);
                                    params_.push('lang=' + lng);
                                    var joinedParams = params_.join('&');
                                    var editorUrl = curationEditorUrl + '?' + joinedParams;
                                    return $('<a>').addClass('userdocs_editLink').attr('href', editorUrl).attr('target', '_blank').attr('title', (lng !== 'ja') ? 'Edit' : '編集').html('<span class="glyphicon glyphicon-edit"></span>').prop('outerHTML');
                                } else {
                                    return '';
                                }
                            },
                            targets: 4
                        },
                        {
                            title: (lng !== 'ja') ? 'Delete' : '削除',
                            orderable: false,
                            searchable: false,
                            render: function(data, type, row) {
                                var docUrl = endpointUrl + '/' + row.id;
                                var content = (lng !== 'ja') ? 'This operation can not be undone.' : '本当に削除しますか？';
                                return $('<a>').addClass('userdocs_delete').attr('data-url', docUrl).attr('data-toggle', 'confirmation').attr('data-popout', true).attr('data-singleton', true).attr('data-btn-ok-label', 'OK').attr('data-btn-ok-class', 'btn-xs btn-default').attr('data-btn-cancel-label', 'Cancel').attr('data-content', content).attr('href', 'javascript:void("Delete");').attr('title', (lng !== 'ja') ? 'Delete' : '削除').html('<span class="glyphicon glyphicon-remove"></span>').prop('outerHTML');
                            },
                            targets: 5
                        }
                    ],
                    order: [[1, 'desc']],
                    buttons: [
                        {
                            text: ((lng !== 'ja') ? 'Reload' : '再読み込み'),
                            className: 'userdocs_reload',
                            action: function() {
                                processUserdocsList();
                            }
                        }
                    ],
                    //dom: 'Bfrtip',
                    dom:
                        'B' +
                        '<"#dt-header.row"<"col-sm-6"l><"col-sm-6"f>>' +
                        '<"#dt-main.row"<"col-sm-12"tr>>' +
                        '<"#dt-footer.row"<"col-sm-5"i><"col-sm-7"p>>',
                    deferRender: userdocsList.length > 500 ? true : false
                };
                if (lng === 'ja') {
                    dataTableConfig.language = {
                        emptyTable:     'キュレーションがありません',
                        info:           '_TOTAL_ 件中 _START_ から _END_ まで表示',
                        infoEmpty:      '0 件中 0 から 0 まで表示',
                        infoFiltered:   '（全 _MAX_ 件から抽出）',
                        lengthMenu:     '_MENU_ 件表示',
                        loadingRecords: '読み込み中...',
                        processing:     '処理中...',
                        search:         '検索:',
                        zeroRecords:    '一致するキュレーションがありません',
                        paginate: {
                            first:      '先頭',
                            last:       '最終',
                            next:       '次',
                            previous:   '前'
                        },
                        aria: {
                            sortAscending:  ': クリックで昇順に並び替え',
                            sortDescending: ': クリックで降順に並び替え'
                        }
                    };
                }
                dataTable = $('#datatable').DataTable(dataTableConfig);
                $('#datatable').on('draw.dt', function() {
                    $('.listed').bootstrapToggle({
                        on: ((lng !== 'ja') ? 'Listed' : '掲載'),
                        off: ((lng !== 'ja') ? 'Unlisted' : '非掲載'),
                        size: 'mini'
                    });
                    $('[data-toggle=confirmation]').confirmation({
                        rootSelector: '[data-toggle=confirmation]'
                    });
                });
                $('#datatable').on('change', '.listed', function() {
                    var checked = $(this).prop('checked');
                    var url = $(this).attr('data-url');
                    var refractory = $(this).attr('data-refractory');
                    if (refractory === 'true') {
                        //エラーにより元に戻すとき
                    } else {
                        var payload = {unlisted: checked ? false : true};
                        manageJsonStore(payload, {method: 'PATCH', endpointUrl: url, caller: $(this),
                            callbackFail: function(jqxhr, textStatus, error, options) {
                                if (options.caller) {
                                    $(options.caller).attr('data-refractory', true);
                                    showAlert($(options.caller).parent().parent(), 'danger', error || ((lng !== 'ja') ? 'Error' : 'エラー'), 1000, 'datatable_error');
                                    setTimeout(function() {
                                        $(options.caller).bootstrapToggle('toggle');
                                        $(options.caller).attr('data-refractory', false);
                                    }, 1000);
                                }
                            }
                        });
                    }
                });
                $('#datatable').on('click', '.userdocs_delete', function() {
                    var url = $(this).attr('data-url');
                    manageJsonStore(null, {method: 'DELETE', endpointUrl: url, caller: $(this),
                        callback: function(jqxhr, options) {
                            if (options.caller) {
                                dataTable.row($(options.caller).parents('tr')).remove().draw();
                            }
                        },
                        callbackFail: function(jqxhr, textStatus, error, options) {
                            if (options.caller) {
                                showAlert($(options.caller).parent(), 'danger', error || ((lng !== 'ja') ? 'Error' : 'エラー'), 1000, 'datatable_error');
                            }
                        }
                    });
                });
            }
            if (dataTable) {
                dataTable.clear();
                dataTable.rows.add(userdocsList);
                dataTable.columns.adjust().draw();
            }
        } else {
            err = new Error(); showError(0, err.lineNumber); //json異常
        }
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

        //ガイド表示
        $('#guide_message').text((lng !== 'ja') ? 'Login to manage your curations' : 'キュレーション管理（要ログイン）');

        //DataTables
        $('#userdocs_container').hide();

        setupNavigations();
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
    function onLoggedIn() {
        //匿名ユーザについては、ユーザドキュメント一覧は返さない仕様になっているため、
        //ログオンをトリガーとして、ユーザドキュメント一覧を取得する。
        processUserdocsList();
    }
    function onLoggedOut() {
        //匿名ユーザ状態になれば、ユーザドキュメント一覧表示をクリアする。
        $('#userdocs_container').hide();
        if (dataTable) {
            dataTable.clear().draw();
        }
        $('#guide_container').show();
    }

    //----------------------------------------------------------------------
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
    function showAlert($appendTo, context, text, duration, alertId) {
        if ($appendTo && $appendTo.length === 1) {
            var modifierClass = 'alert-' + context;
            $('#' + alertId).remove();
            $('<div>').addClass('alert').addClass(modifierClass).attr('role', 'alert').attr('id', alertId).text(text).appendTo($appendTo);
            setTimeout(function() {
                $('#' + alertId).alert('close').remove();
            }, duration);
        }
    }

    //----------------------------------------------------------------------
    function manageJsonStore(json, options) {
        var jsonExport = getCurationJsonExport(); //function or url
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

    //getter/setter
    function getName() {
        return APP_NAME;
    }
    function getLang() {
        return lng;
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
        getName: getName,
        getLang: getLang, //'en' or 'ja'
        getCurationJsonExportUrl: getCurationJsonExportUrl,
        setCurationJsonExport: setCurationJsonExport,
        onLoggedIn: onLoggedIn, //ログオンしたとき
        onLoggedOut: onLoggedOut //ログアウトしたとき
    };
};