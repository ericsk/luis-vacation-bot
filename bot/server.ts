// Bot Framework
import * as restify from 'restify';
import * as builder from 'botbuilder';

// package
import * as dialogs from './dialogs';
import * as timeResolver from './time-resolver';

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
let intentDialog: builder.IntentDialog = new builder.IntentDialog({ recognizers: [recognizer] });

// 當使用者加入對話時，送出歡迎訊息 (例如提示如何操作 bot)
bot.on('conversationUpdate', (message: builder.IConversationUpdate) => {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/');
            }
        });
    }
});

bot.dialog('/', intentDialog);
bot.dialog('/ensureApplication', dialogs.ensureApplicationDialog);

intentDialog.onDefault(dialogs.defaultDialog);

// Add intent handlers
intentDialog.matches('查詢假期', dialogs.queryDialog);

intentDialog.matches('請假', dialogs.applyDialog);