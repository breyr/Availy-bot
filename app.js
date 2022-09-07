// TODO: For documentation we need to have a channel created in slack called 'availy-posts'
const { App } = require('@slack/bolt');
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
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  port: process.env.PORT || 3000,
});

// Clear All Command
// delete all messages in dm from bot and in availy-posts, but that's jsut for testing
app.command('/clearall', async ({ command, ack }) => {
  await ack();
  const channel = command.channel_id;
  if (channel.channel_name === 'directmessage') {
    let conversationHistory;
    const result = await app.client.conversations.history({
      channel: channel,
    });
    conversationHistory = result.messages;
    conversationHistory.forEach((message) => {
      // only delete the message if it is a bot message
      if (message.hasOwnProperty('bot_id')) {
        app.client.chat.delete({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channel,
          ts: message.ts,
        });
      }
    });
  } else {
    // post a message only visible to user who called the command
    app.client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '*/clearall* can only be called in your direct message with Availy',
    });
  }
});

// Request Off Command
let user_name = 'user';
app.command('/requestoff', async ({ body, ack, say }) => {
  await ack();

  user_name = body.user_name;
  if (body.channel_name == 'directmessage') {
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
  amOrPmStart = startTimeHours >= 12 ? 'pm' : 'am';
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
  amOrPmEnd = endTimeHours >= 12 ? 'pm' : 'am';
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
let date = '01/01/2000'; // defualt date
app.action('datepicker-action', async ({ body }) => {
  // split selected date by '-'
  split_date = body.actions[0].selected_date.split('-');
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

  await say('_*request sent*_');

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
          text: `_clicking cover shift will delete this message and send a confirmation message to the requester and emails ITSS_`,
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
    to: 'breyr2021@gmail.com',
    subject: `Shift Cover Alert - ${new Date().toLocaleTimeString()}`,
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
