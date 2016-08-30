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
    function (session, results) {
        session.send("OK, 不好");
    }
]);

dialog.onDefault(builder.DialogAction.send("很抱歉我不確定您想做什麼？試試「我的假還剩多少?」或「我想在下週三請兩個小時的假」"));

var vacations = {
    '特休': 7 * 8,
    '事假': 6 * 8,
    '病假': 5 * 8
};