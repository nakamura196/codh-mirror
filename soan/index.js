/*
 * Soan: Library for rendering modern Japanese using old movable type
 * http://codh.rois.ac.jp/software/soan/
 *
 * Copyright 2023 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 */
var soan = (function() {
    var configExample = {
        generic: {
            withUI: true,
            datasets: [{'url': 'dataset/001.json'}],
            charsPerLine: 20, //字詰数（0は自動的に行を折り返さない）
            scale: 0.5, //生成画像サイズ倍率
            fontColor: '#454D43', //古活字画像が登録されていない文字も許容する場合に利用されるフォント色
            sampleTexts: ['山月記\n　\n　ろう西の李ちょうは博学才えい、天宝の末年、若くして名をこぼうに連ね、ついで江南いに補せられたが、性、狷介、自らたのむところ頗る厚く、せんりに甘んずるをいさぎよしとしなかった。いくばくもなく官を退いた後は、故山、かく略に帰臥［之］、人と交を絶って、ひたすら詩作にふけった。', 'こころ\n　\n　私はその人を常に先生と呼んでいた。だからここでもただ先生と書くだけで本名は打ち明けない。これは世間をはばかる遠慮というよりも、その方が私にとって自然だからである。私はその人の記憶を呼び起すごとに、すぐ「先生」といいたくなる。筆を執っても心持は同じ事である。よそよそしい頭文字などはとても使う気にならない。', '草枕\n　\n　山路を登りながら、こう考えた。\n　智に働けば角が立つ。情に棹させば流される。意地を通せば窮屈だ。とかくに人の世は住みにくい。\n　住みにくさが高じると、安い所へ引き越したくなる。どこへ越しても住みにくいと悟った時、詩が生れて、えが出来る。'] //出典：青空文庫（一部、漢字をかなに開く改変を行った）
        }
    };
    return Soan(configExample.generic);
})();