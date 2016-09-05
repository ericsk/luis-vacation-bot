// 轉換星期文字到數字的表
var chntbl = {
    '天': 0,
    '日': 0,
    '一': 1,
    '二': 2,
    '兩': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
    '十': 10
};

var wordtbl = {
    today: '(?:今|今天|今日)',
    tomorrow: '(?:明|明天|明日)',
    acquired:'(?:後天|後日)'
};

/**
 * 分析請假日期的語句，並將之轉換成 JavaScript 的 Date 資料型態的資料
 * @param {string} vacationDate 請假日期的語句
 * @returns {Date} 請假的確切日期
 */
function parseDate(vacationDate) {
    var today = new Date();
    var theDate;

    // 9/6, 10/5
    theDate = Date.parse(vacationDate);
    if (!isNaN(theDate)) {
        theDate = new Date(theDate);
        theDate.setYear(today.getFullYear());
        return theDate;
    }

     //今天，明天，後天
    if(vacationDate.match(new RegExp(wordtbl.today))){
        return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }else if(vacationDate.match(new RegExp(wordtbl.tomorrow))){
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }else if(vacationDate.match(new RegExp(wordtbl.acquired))){
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    }

    // x月x日、x月x號
    var regex = new RegExp(/(.*)?月(.*)?[日,號]/);
    var mat = vacationDate.match(regex);
    if (mat !== null) {
        var month = mat[1];
        var date = mat[2];

        if (!/\d/.test(month)) {
            var m = 0;
            for (var i = 0; i < month.length; ++i) {
                m = m * 10 + chntbl[month[i]];
            }
            month = m;
        }

        if (!/\d/.test(date)) {
            var d = 0;
            for (var i = 0; i < date.length; ++i) {
                d = d * 10 + chntbl[date[i]];
            }
            date = d;
        }

        return new Date(today.getFullYear(), month - 1, date);
    }

    // 這週三, 下星期五
    regex = new RegExp(/([天日一二三四五六七八九十\d])/);
    mat = vacationDate.match(regex);
    if (mat !== null) {
        var day = mat[1];
        var dist = 0;
        var thisDay = today.getDay();

        if (!/\d/.test(day)) {
            day = chntbl[day];
        }

        if (vacationDate.indexOf('下') > -1) {
            dist = 7 - thisDay + day;
        } else  {
            dist = day - thisDay;
        }

        return new Date(today.getTime() + dist * 86400000);
    }

    return theDate;
}
exports.parseDate = parseDate;

/**
 * 分析請假時數可能的語句，轉換成純數字的小時數。
 * @param {string} vacationLength 請假時數的原句
 * @returns {number} 請假時數的數值
 */
function parseHours(vacationLength) {
    var num = 0;

    // 2.5 個小時、4個小時
    num = parseFloat(vacationLength);
    if (!isNaN(num)) {
        return num;
    }

    // 兩個半小時、四個小時
    var regex = new RegExp(/([一二兩三四五六七八九十])/);
    var mat = vacationLength.match(regex);
    if (mat !== null) {
        num = chntbl[mat[1]];
        if (vacationLength.indexOf('半') > -1) {
            num += 0.5;
        }
    }
    if (num > 0) {
        return num;
    }

    // 半天, 整天
    if (vacationLength.indexOf('天') > -1) {
        if (vacationLength.indexOf('半') > -1) {
            num = 4;
        } else if (vacationLength.indexOf('全') > -1 ||
                   vacationLength.indexOf('整') > -1) {
            num = 8;
        }
    }

    return num;
};
exports.parseHours = parseHours;
