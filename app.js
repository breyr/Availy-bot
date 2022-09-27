/* TODO: 
  1. For documentation we need to have a channel created in slack called 'availy-posts'
  2. You need to wait a period of time after joining the channel before sending a request off form post to availy-posts
*/
const { App } = require('@slack/bolt');
const { FileInstallationStore } = require('@slack/oauth');
const nodemailer = require('nodemailer');
require('dotenv').config();

const AVAILY_POSTS_CHANNEL = 'availy-posts';

// initialize nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USR,
    pass: process.env.EMAIL_PWD,
  },
});

// initialize app with bot token and signing secret
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: 'my-state-secret',
  scopes: [
    'channels:history',
    'channels:manage',
    'channels:read',
    'chat:write',
    'commands',
    'groups:history',
    'groups:read',
    'im:history',
    'im:read',
    'im:write',
    'mpim:history',
    'mpim:read',
    'mpim:write',
    'users:read',
  ],
  installationStore: new FileInstallationStore(),
});

// Clear All Command

// delete all messages in dm from bot and in availy-posts, but that's jsut for testing
// app.command('/clearall', async ({ command, ack }) => {
//   await ack();
//   const channel = command.channel_id;
//   if (command.channel_name == 'directmessage') {
//     let conversationHistory;
//     const result = await app.client.conversations.history({
//       channel: channel,
//     });
//     conversationHistory = result.messages;
//     conversationHistory.forEach((message) => {
//       // only delete the message if it is a bot message
//       if (message.hasOwnProperty('bot_id')) {
//         app.client.chat.delete({
//           token: process.env.SLACK_BOT_TOKEN,
//           channel: channel,
//           ts: message.ts,
//         });
//       }
//     });
//   } else {
//     // post a message only visible to user who called the command
//     app.client.chat.postEphemeral({
//       channel: command.channel_id,
//       user: command.user_id,
//       text: '*/clearall* can only be called in your direct message with Availy',
//     });
//   }
// });

// Request Off Command
// change to setemail
let user_name = 'user';
app.command('/requestoff', async ({ body, ack, say }) => {
  await ack(console.log(body));

  // current date format
  const d = new Date().toLocaleDateString().split('/');

  user_name = body.user_name;
  if (body.channel_name == 'directmessage') {
    console.log(body.channel_name);
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
            initial_date: `${d[2]}-${d[0]}-${d[1]}`,
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
  } else {
    // post a message only visible to user who called the command
    app.client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: '*/requestoff* can only be called in your direct message with Availy',
    });
  }
});

let startTime = '12:00 am'; // default time
app.action('time-start-action', async ({ body }) => {
  // have to convert from 24 hour to 12 hour time
  let selectedStartTime = body.actions[0].selected_time;
  const startTimeHours = parseInt(
    selectedStartTime.substring(0, selectedStartTime.length - 3)
  );
  const amOrPmStart = startTimeHours >= 12 ? 'pm' : 'am';
  let startTimeHoursConverted;
  if (startTimeHours == 12 || startTimeHours == 0o0) {
    // this is some octal literal stuff idk whats going on
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

let endTime = '12:00 am'; // default time
app.action('time-end-action', async ({ body }) => {
  // have to convert from 24 hour to 12 hour time
  let selectedEndTime = body.actions[0].selected_time;
  const endTimeHours = parseInt(
    selectedEndTime.substring(0, selectedEndTime.length - 3)
  );
  const amOrPmEnd = endTimeHours >= 12 ? 'pm' : 'am';
  let endTimeHoursConverted;
  if (endTimeHours == 12 || endTimeHours == 0o0) {
    // this is some octal literal stuff idk whats going on
    endTimeHoursConverted = 12;
  } else {
    endTimeHoursConverted = endTimeHours % 12;
  }
  endTime =
    String(endTimeHoursConverted) + selectedEndTime.slice(2) + ' ' + amOrPmEnd;
});

// these actions have to occur or else confirm never sees the updated variable
let date = new Date().toLocaleDateString(); // defualt date is the current date
app.action('datepicker-action', async ({ body }) => {
  // split selected date by '-'
  const split_date = body.actions[0].selected_date.split('-');
  date = split_date[1] + '/' + split_date[2] + '/' + split_date[0];
});

app.action('confirm_click', async ({ body, ack, say }) => {
  // needs to take the date, start and end time from the form and post it as another form in a different channel
  const messageID = body.message.ts;
  const channel = body.channel.id;

  await ack(
    app.client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
      ts: messageID,
    })
  );

  await say(
    `_*request sent* at ${new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
    })}_`
  );

  app.client.chat.postMessage({
    token: process.env.SLACK_BOT_TOKEN,
    channel: AVAILY_POSTS_CHANNEL, // this sucks because it is hardcoded, but has to be that way
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<@${user_name}> is requesting off on \n *Date*: ${date} \n *Time*: ${startTime} - ${endTime}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Cover Shift',
              emoji: true,
            },
            style: 'primary',
            value: 'click_me_123',
            action_id: 'cover_shift_click',
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `_clicking cover shift will delete this message and email ITSS_`,
        },
      },
    ],
    text: 'new shift needed coverage posted',
  });
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

app.action('cover_shift_click', async ({ body, ack, say }) => {
  const messageID = body.message.ts;
  const channel = body.channel.id;
  const person_covering = body.user.name;

  await ack(
    app.client.chat.delete({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel,
      ts: messageID,
    })
  );

  await say(
    `<@${person_covering}> is covering <@${user_name}> on \n *Date*: ${date} \n *Time*: ${startTime} - ${endTime}`
  );

  // send email
  var mailOptions = {
    from: process.env.EMAIL_USR,
    to: process.env.SEND_TO_EMAIL,
    subject: `Shift Cover Alert - ${new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
    })}`,
    html: `<h4>${person_covering} is covering ${user_name} on</h4>
           <h4>Date: ${date}</h4>
           <h4>Time: ${startTime} - ${endTime}</h4>`,
  };

  // takes a while to send the email
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log(`⚡️Slack Bolt app is running`);
})();
