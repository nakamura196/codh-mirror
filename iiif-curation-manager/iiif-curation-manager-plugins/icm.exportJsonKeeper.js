/*
 * IIIF Curation Manager - JSONkeeper export plugin
 * http://codh.rois.ac.jp/software/iiif-curation-manager/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 */
var ICMExportJsonKeeper = function(config) {
    'use strict';
    var pluginHost = typeof iiifManager !== 'undefined' ? iiifManager : void 0;
    var err;

    //オプション設定
    var accessControlEnum = ['', 'firebase'];
    var defaultConfig = {
        accessControl: accessControlEnum[0], //string
        allowAnonymousPost: true, //boolean
        redirectUrl: location.protocol + '//' + location.host + location.pathname, //string
        unlisted: false //boolean
    };
    var conf = configure(config, defaultConfig);

    //依存関係の確認
    if (!pluginHost) {
        err = new Error(); logError('Plugin host not found.', err.lineNumber, true);
        return;
    }
    if (!pluginHost.getCurationJsonExportUrl()) {
        err = new Error(); logError('Invalid service.curationJsonExportUrl.', err.lineNumber, true);
        return;
    }
    if (conf.accessControl === 'firebase' && (typeof firebase === 'undefined' || !firebase)) {
        //ブラウザによるドメインごとのJavaScript実行許可／ブロック設定により、
        //ユーザによってはFirebase JavaScript SDKが読み込めていないことがありうる。
        var lang = pluginHost.getLang();
        var msg = (lang !== 'ja') ? 'Firebase not found.' : 'エラー： 動作に必要なJavaScript（Firebase）が読み込まれていないため、投稿できません。';
        err = new Error(); logError(msg, err.lineNumber, true);
        return;
    }

    //----------------------------------------------------------------------
    if (conf.accessControl === 'firebase') {
        updateCurationJsonExport(firebase.auth().currentUser);
        firebase.auth().onAuthStateChanged(function(user) {
            updateCurationJsonExport(user);
        });
    } else {
        updateCurationJsonExport(null);
    }

    function updateCurationJsonExport(user) {
        if (user || conf.allowAnonymousPost) {
            pluginHost.setCurationJsonExport(function(curation, options) {
                if (conf.accessControl === 'firebase') {
                    if (firebase) {
                        var currentUser = firebase.auth().currentUser;
                        if (currentUser) {
                            currentUser.getIdToken(true).then(function(idToken) {
                                _exportCurationJson(curation, idToken, options);
                            }).catch(function(error) {
                                err = new Error(); logError(error.message, err.lineNumber);
                            });
                            return;
                        }
                    }
                }
                if (conf.allowAnonymousPost) {
                    _exportCurationJson(curation, null, options);
                }
            });
        } else {
            pluginHost.setCurationJsonExport(null);
        }
    }

    function _exportCurationJson(curation, idToken, options) {
        var curationString = JSON.stringify(curation, null, '\t');
        var lang = pluginHost.getLang();
        var exportUrl = pluginHost.getCurationJsonExportUrl();
        var method = 'POST';
        var preferredMethod;
        var forceRedirect = false;
        if (options) {
            if (options.method && $.type(options.method) === 'string') {
                preferredMethod = options.method.toUpperCase();
                if (preferredMethod === 'PUT' || preferredMethod === 'DELETE' || preferredMethod === 'PATCH') {
                    if (options.endpointUrl && options.endpointUrl.indexOf(exportUrl) === 0) {
                        method = preferredMethod;
                        exportUrl = options.endpointUrl;
                    }
                } else if (preferredMethod === 'GET') {
                    method = preferredMethod;
                    exportUrl = options.endpointUrl;
                }
            }
            if ('forceRedirect' in options) {
                forceRedirect = options.forceRedirect;
            }
        }
        var settings = {
            method: method,
            url: exportUrl
        };
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            settings.data = curationString;
            settings.contentType = 'application/ld+json';
            settings.dataType = 'json';
        }
        if (idToken !== null) {
            if (conf.accessControl === 'firebase') {
                settings.headers = { 'X-Firebase-ID-Token': idToken };
            } else {
                settings.headers = { 'X-Access-Token': idToken };
            }
            if (method === 'POST') {
                //X-Unlistedヘッダ指定は、access token付きのPOSTで有効
                settings.headers['X-Unlisted'] = conf.unlisted;
            }
        }
        $.ajax(settings).done(function(data, textStatus, jqxhr) {
            if (jqxhr) {
                var resLocation = jqxhr.getResponseHeader('Location');
                if (forceRedirect && !resLocation) {
                    resLocation = exportUrl;
                }
                if (resLocation) {
                    var redirectUrl = conf.redirectUrl + '?curation=' + resLocation + '&lang=' + lang;
                    window.open(redirectUrl, '_self');
                }
                if (options.callback) {
                    options.callback(jqxhr, options);
                }
            }
        }).fail(function(jqxhr, textStatus, error) {
            err = new Error(); logError(textStatus + ', ' + error, err.lineNumber);
            if (options.callbackFail) {
                options.callbackFail(jqxhr, textStatus, error, options);
            }
        }).always(function() {
            //
        });
    }

    //----------------------------------------------------------------------
    function configure(config, defaultConfig) {
        function helper(conf, input, paramName, paramType) {
            if ($.type(input[paramName]) === paramType) {
                conf[paramName] = input[paramName];
            }
        }
        var conf_ = defaultConfig;
        if ($.isPlainObject(config)) {
            if ($.type(config.accessControl) === 'string') {
                if ($.inArray(config.accessControl, accessControlEnum) !== -1) {
                    conf_.accessControl = config.accessControl;
                }
            }
            helper(conf_, config, 'allowAnonymousPost', 'boolean');
            helper(conf_, config, 'redirectUrl', 'string');
            helper(conf_, config, 'unlisted', 'boolean');
        }
        return conf_;
    }

    function logError(message, lineNumber, onScreen) {
        if (onScreen && message) {
            var $container = $('.export_container');
            if ($container.length === 1) {
                var alertId = 'export_json_keeper_alert'; //cssファイルにスタイル指定あり
                var modifierClass = 'alert-danger';
                $('#' + alertId).remove();
                $('<div>').addClass('alert').addClass(modifierClass).attr('role', 'alert').attr('id', alertId).text(message).appendTo($container);
                $container.find('.btn-icv-export').prop('disabled', true).toggleClass('disabled', true);
            }
        }
        if (window.console) {
            var pluginName = 'JSONkeeper export plugin';
            var msg = (pluginHost ? pluginHost.getName() : 'IIIF Curation Platform') + ' (' + pluginName + '): ';
            var details = [];
            if (message) {
                details.push(message);
            }
            if (lineNumber) {
                details.push('line: ' + lineNumber);
            }
            if (details.length > 0) {
                msg += details.join(', ');
            }
            console.log(msg); // eslint-disable-line no-console
        }
    }
};