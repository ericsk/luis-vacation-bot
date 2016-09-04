var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create bot and bind to console
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
var model = process.env.LUIS_MODEL_URL;
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', dialog);

// Add intent handlers
dialog.matches('查詢假期', [
    function (session, args, next) {
        var typeEntity = builder.EntityRecognizer.findEntity(args.entities, "類別");
        console.log(typeEntity);
        var vacationType = session.dialogData.vacationType = typeEntity ? typeEntity.entity : null;

        if (vacationType === null) {
            builder.Prompts.text(session, "請問您要查詢哪種假？");
        } else {
            next();
        }
    },
    function (session, results) {
        var vacationType = session.dialogData.vacationType;
        if (results.response) {
            vacationType = results.response;
        }

        session.send("瞭解，您的 %s 還有 %d 小時", vacationType, vacations[vacationType]);
    }
]);

dialog.matches('請假', [
    function (session, args, next) {
        session.beginDialog('/ensureApplication', args);
    },
    function (session, results) {
        var vacationInfo = results.response;
        var vDate = parseDate(vacationInfo.date);
        var vCount = parseHours(vacationInfo.length);
        session.send('你想在 %s 請 %d 小時的 %s', vDate.toString(), vCount, vacationInfo.type);
    }
]);

dialog.onDefault(builder.DialogAction.send("很抱歉我不確定您想做什麼？試試「我的假還剩多少?」或「我想在下週三請兩個小時的假」"));

bot.dialog('/ensureApplication', [
    function (session, args, next) {
        var dateEntity = builder.EntityRecognizer.findEntity(args.entities, "日期");
        var lengthEntity = builder.EntityRecognizer.findEntity(args.entities, "時數");
        var typeEntity = builder.EntityRecognizer.findEntity(args.entities, "類別");

        var vacationInfo = session.dialogData.vacationInfo = {
            'date': dateEntity ? dateEntity.entity : null,
            'length': lengthEntity ? lengthEntity.entity : null,
            'type': typeEntity ? typeEntity.entity : null            
        };

        if (vacationInfo.date === null) {
            builder.Prompts.time(session, "請問要在哪一天請假？");
        } else {
            next();
        }

    },
    function (session, results, next) {
        // check date field
        var vacationInfo = session.dialogData.vacationInfo;
        if (results.response) {
            session.dialogData.vacationInfo.date = results.response;
        }

        if (vacationInfo.length === null) {
            builder.Prompts.number(session, "請問要請幾個小時？");
        } else {
            next();
        }
    },
    function (session, results, next) {
        // check length field
        var vacationInfo = session.dialogData.vacationInfo;
        if (results.response) {
            session.dialogData.vacationInfo.length = results.response;
        }

        if (vacationInfo.type === null) {
            builder.Prompts.choice(session, "請問您要請哪種假？", ["特休", "事假", "病假"]);
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.vacationInfo.type = results.response.entity;
        }
        session.endDialogWithResult({ response: session.dialogData.vacationInfo  });
    }
]);

var vacations = {
    '特休': 7 * 8,
    '事假': 6 * 8,
    '病假': 5 * 8
};

/**
 * 分析請假日期的語句，並將之轉換成 JavaScript 的 Date 資料型態的資料
 * @param {string} vacationDate 請假日期的語句
 * @returns {Date} 請假的確切日期
 */
var parseDate = function(vacationDate) {
    var today = new Date();
    var theDate;

    // 9/6, 10/5
    theDate = Date.parse(vacationDate);
    if (!isNaN(theDate)) {
        theDate = new Date(theDate);
        theDate.setYear(today.getFullYear());
        return theDate;
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

        var newMonth = today.getMonth();
        var newDate = today.getDate() + dist;

        if (newMonth == 0 || newMonth == 2 || newMonth == 4 || newMonth == 6 ||
            newMonth == 7 || newMonth == 9 || newMonth == 11) {
            if (newDate > 31) {
                newMonth = (newMonth + 1 ) % 12;
                newDate = newDate - 31;
            }
        } else if (newMonth == 3 || newMonth == 5 ||
                   newMonth == 8 || newMonth == 10) {
            if (newDate > 30 ) {
                newMonth++;
                newDate = newDate - 30;
            }
        } else {    // 2 月
            var thisYear = today.getFullYear();
            if (thisYear % 400 == 0 || (thisYear % 4 == 0 && thisYear % 100 != 0) ) {
                if (newDate > 29) {
                    newMonth++;
                    newDate -= 29;
                }
            } else {
                if (newDate > 28) {
                    newMonth++;
                    newDate -= 28;
                }
            }
        }

        return new Date(today.getFullYear(), newMonth, newDate);
    }

    return theDate;
};

/**
 * 分析請假時數可能的語句，轉換成純數字的小時數。
 * @param {string} vacationLength 請假時數的原句
 * @returns {number} 請假時數的數值
 */
var parseHours = function(vacationLength) {
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