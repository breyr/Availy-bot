const { App } = require('@slack/bolt');
require('dotenv').config();

// initialize app with bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// Clear All Command
// delete all messages in dm from bot
app.command('/clearall', async ({ command, ack }) => {
  // channel is the user id
  const channel = command.channel_id;
  let conversationHistory;
  const result = await app.client.conversations.history({
    channel: channel,
  });
  conversationHistory = result.messages;
  await ack(
    conversationHistory.forEach((message) => {
      app.client.chat.delete({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel,
        ts: message.ts,
      });
    })
  );
});

// Request Off Command
app.command('/requestoff', async ({ body, ack, say }) => {
  await ack();

  await say({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Please Select Your Request',
          emoji: true,
        },
      },
      {
        type: 'input',
        element: {
          type: 'datepicker',
          initial_date: '2022-01-01',
          placeholder: {
            type: 'plain_text',
            text: 'Select a date',
            emoji: true,
          },
          action_id: 'datepicker-action',
        },
        label: {
          type: 'plain_text',
          text: 'Shift Date',
          emoji: true,
        },
      },
      {
        type: 'input',
        element: {
          type: 'timepicker',
          initial_time: '00:00',
          placeholder: {
            type: 'plain_text',
            text: 'Select time',
            emoji: true,
          },
          action_id: 'time-start-action',
        },
        label: {
          type: 'plain_text',
          text: 'Start Shift Time',
          emoji: true,
        },
      },
      {
        type: 'input',
        element: {
          type: 'timepicker',
          initial_time: '00:00',
          placeholder: {
            type: 'plain_text',
            text: 'Select time',
            emoji: true,
          },
          action_id: 'time-end-action',
        },
        label: {
          type: 'plain_text',
          text: 'End Shift Time',
          emoji: true,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Confirm',
            },
            style: 'primary',
            action_id: 'confirm_click',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              emoji: true,
              text: 'Cancel',
            },
            style: 'danger',
            action_id: 'cancel_click',
          },
        ],
      },
    ],
    text: 'Please select your request for time off.',
  });
});

let startTime;
app.action('time-start-action', async ({ body }) => {
  // have to convert from 24 hour to 12 hour time
  let selectedStartTime = body.actions[0].selected_time;
  const startTimeHours = parseInt(
    selectedStartTime.substring(0, selectedStartTime.length - 3)
  );
  amOrPmStart = startTimeHours >= 12 ? 'pm' : 'am';
  let startTimeHoursConverted;
  if (startTimeHours == 12 || startTimeHours == 00) {
    startTimeHoursConverted = 12;
  } else {
    startTimeHoursConverted = startTimeHours % 12;
  }
  startTime =
    String(startTimeHoursConverted) +
    selectedStartTime.slice(2) +
    ' ' +
    amOrPmStart;
});

let endTime;
app.action('time-end-action', async ({ body }) => {
  // have to convert from 24 hour to 12 hour time
  let selectedEndTime = body.actions[0].selected_time;
  const endTimeHours = parseInt(
    selectedEndTime.substring(0, selectedEndTime.length - 3)
  );
  amOrPmEnd = endTimeHours >= 12 ? 'pm' : 'am';
  let endTimeHoursConverted;
  if (endTimeHours == 12 || endTimeHours == 00) {
    endTimeHoursConverted = 12;
  } else {
    endTimeHoursConverted = endTimeHours % 12;
  }
  endTime =
    String(endTimeHoursConverted) + selectedEndTime.slice(2) + ' ' + amOrPmEnd;
});

let date;
// FIXME: convert date
// these actions have to occur or else confirm never sees the updated variable
app.action('datepicker-action', async ({ body }) => {
  date = body.actions[0].selected_date;
});

app.action('confirm_click', async ({ body, ack, say }) => {
  // TODO: say is going to be in another channel so that people can cover that shift
  // needs to take the date, start and end time from the form and post it as another form in a different channel
  // await ack();
  // await say();
  console.log(`Date: ${date} \n Start: ${startTime} \n End: ${endTime}`);
});

app.action('cancel_click', async ({ body, ack }) => {
  const messageID = body.message.ts;
  const channel = body.channel.id;

  await ack(
    app.client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
      ts: messageID,
    })
  );
});

(async () => {
  const port = 3000;
  // Start your app
  await app.start(process.env.PORT || port);
  console.log(`⚡️Slack Bolt app is running on port ${port}`);
})();

// SEND AN INTRODUCTION TO THE USERS
// const result = await app.client.users.list({
//   token: process.env.SLACK_BOT_TOKEN,
// });
// users = result['members'];
// users.forEach((user) => {
//   // if the user isn't a bot, then message them with an introduction message
//   // everytime the app starts this message will be sent
//   if (!user['is_bot'] && user['id'] !== 'USLACKBOT') {
//     console.log(user['id']);
//     app.client.chat.postMessage({
//       token: process.env.SLACK_BOT_TOKEN,
//       channel: user['id'],
//       text: 'hello from Availy!',
//     });
//   }
// });
