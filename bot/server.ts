// Bot Framework
import * as restify from 'restify';
import * as builder from 'botbuilder';

// package
import * as timeResolver from './time-resolver';

// vacation info 
class VacationInfo {
    date: string;
    length: string;
    type: string;

    constructor(date, length, type) {
        this.date = date;
        this.length = length;
        this.type = type;
    }
}

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
const server: restify.Server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create bot and bind to console
let connector: builder.ChatConnector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
const bot: builder.UniversalBot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
let model: string = process.env.LUIS_MODEL_URL;
let recognizer: builder.LuisRecognizer = new builder.LuisRecognizer(model);
let dialog: builder.IntentDialog = new builder.IntentDialog({ recognizers: [recognizer] });

bot.dialog('/', dialog);

// Add intent handlers
dialog.matches('查詢假期', [
    (session: builder.Session, args, next) => {
        let typeEntity: builder.IEntity = builder.EntityRecognizer.findEntity(args.entities, "類別");
        let vacationType: string = session.dialogData.vacationType = typeEntity ? typeEntity.entity : null;

        if (vacationType === null) {
            builder.Prompts.choice(session, "請問您要查詢哪種假？", ["特休", "事假", "病假"]);
        } else {
            next();
        }
    },
    (session: builder.Session, results: builder.IPromptChoiceResult) => {
        let vacationType: string = session.dialogData.vacationType;
        if (results.response) {
            vacationType = results.response.entity;
        }

        session.send("瞭解，您的 %s 還有 %d 小時", vacationType, vacations[vacationType]);
    }
]);

dialog.matches('請假', [
    (session: builder.Session, args, next) => {
        session.beginDialog('/ensureApplication', args);
    },
    (session: builder.Session, results: builder.IDialogResult<VacationInfo>) => {
        let vacationInfo: VacationInfo = results.response;
        let vDate: Date = timeResolver.parseDate(vacationInfo.date);
        let vCount: number = timeResolver.parseHours(vacationInfo.length);
        session.send('你想在 %d 月 %d 日請 %d 小時的 %s', 
            vDate.getMonth() + 1, vDate.getDate(), vCount, vacationInfo.type);
    }
]);

dialog.onDefault(builder.DialogAction.send("很抱歉我不確定您想做什麼？試試「我的假還剩多少?」或「我想在下週三請兩個小時的假」"));

bot.dialog('/ensureApplication', [
    (session: builder.Session, args, next) => {
        let dateEntity: builder.IEntity = builder.EntityRecognizer.findEntity(args.entities, "日期");
        let lengthEntity: builder.IEntity = builder.EntityRecognizer.findEntity(args.entities, "時數");
        let typeEntity: builder.IEntity = builder.EntityRecognizer.findEntity(args.entities, "類別");

        let vacationInfo: VacationInfo = new VacationInfo(
            dateEntity ? dateEntity.entity : null,
            lengthEntity ? lengthEntity.entity : null,
            typeEntity ? typeEntity.entity : null);
        session.dialogData.vacationInfo = vacationInfo;

        if (vacationInfo.date === null) {
            builder.Prompts.text(session, "請問要在哪一天請假？");
        } else {
            next();
        }

    },
    (session: builder.Session, results: builder.IPromptTextResult, next) => {
        // check date field
        let vacationInfo: VacationInfo = session.dialogData.vacationInfo;
        if (results.response) {
            session.dialogData.vacationInfo.date = results.response;
        }

        if (vacationInfo.length === null) {
            builder.Prompts.number(session, "請問要請幾個小時？");
        } else {
            next();
        }
    },
    (session: builder.Session, results: builder.IPromptNumberResult, next) => {
        // check length field
        let vacationInfo: VacationInfo = session.dialogData.vacationInfo;
        if (results.response) {
            session.dialogData.vacationInfo.length = results.response;
        }

        if (vacationInfo.type === null) {
            builder.Prompts.choice(session, "請問您要請哪種假？", ["特休", "事假", "病假"]);
        } else {
            next();
        }
    },
    (session: builder.Session, results: builder.IPromptChoiceResult) => {
        if (results.response) {
            session.dialogData.vacationInfo.type = results.response.entity;
        }
        session.endDialogWithResult({ response: session.dialogData.vacationInfo  });
    }
]);

let vacations = {
    '特休': 7 * 8,
    '事假': 6 * 8,
    '病假': 5 * 8
};