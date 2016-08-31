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
        session.send('你想在 %s 請 %s 小時的 %s', vacationInfo.date, vacationInfo.length, vacationInfo.type);
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