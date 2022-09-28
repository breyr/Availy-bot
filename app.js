const { App, LogLevel } = require('@slack/bolt');
const orgAuth = require('./database/auth/store_user_org_install');
const workspaceAuth = require('./database/auth/store_user_workspace_install');
const db = require('./database/db');
const dbQuery = require('./database/find_user');
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
  logLevel: LogLevel.DEBUG,
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
  installationStore: {
    storeInstallation: async (installation) => {
      console.log('installation: ' + installation);
      console.log(installation);
      if (
        installation.isEnterpriseInstall &&
        installation.enterprise !== undefined
      ) {
        return orgAuth.saveUserOrgInstall(installation);
      }
      if (installation.team !== undefined) {
        return workspaceAuth.saveUserWorkspaceInstall(installation);
      }
      throw new Error('Failed saving installation data to installationStore');
    },
    fetchInstallation: async (installQuery) => {
      console.log('installQuery: ' + installQuery);
      console.log(installQuery);
      if (
        installQuery.isEnterpriseInstall &&
        installQuery.enterpriseId !== undefined
      ) {
        return dbQuery.findUser(installQuery.enterpriseId);
      }
      if (installQuery.teamId !== undefined) {
        return dbQuery.findUser(installQuery.teamId);
      }
      throw new Error('Failed fetching installation');
    },
  },
});

// Request Off Command
// change to setemail
let user = 'user';
app.command('/requestoff', async ({ ack, payload, context }) => {
  // acknowledge request
  ack();

  user = payload.user_name;
  if (payload.channel_name === 'directmessage') {
    const d = new Date()
      .toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
      })
      .split('/');

    try {
      const result = await app.client.chat.postMessage({
        token: context.botToken,
        // Channel to send message to
        channel: payload.channel_id,
        // Include a button in the message (or whatever blocks you want!)
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
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  } else {
    // post a message only visible to user who called the command
    try {
      const result = await app.client.chat.postEphemeral({
        token: context.botToken,
        channel: payload.channel_id,
        user: payload.user_id,
        text: '*/requestoff* can only be called in your direct message with Availy',
      });
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  }
});

let startTime = '12:00 am'; // default time
app.action('time-start-action', async ({ ack, body }) => {
  // have to convert from 24 hour to 12 hour time

  ack();

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
app.action('time-end-action', async ({ ack, body }) => {
  // have to convert from 24 hour to 12 hour time

  ack();

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
app.action('datepicker-action', async ({ ack, body }) => {
  ack();

  // split selected date by '-'
  const split_date = body.actions[0].selected_date.split('-');
  date = split_date[1] + '/' + split_date[2] + '/' + split_date[0];
});

app.action('confirm_click', async ({ ack, body, context }) => {
  // needs to take the date, start and end time from the form and post it as another form in a different channel

  ack();

  try {
    // update message
    const result = await app.client.chat.update({
      token: context.botToken,
      // ts of message to update
      ts: body.message.ts,
      channel: body.channel.id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_*request sent* at ${new Date().toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
            })}_`,
          },
        },
      ],
    });
    console.log(result);
  } catch (error) {
    console.log(error);
  }

  try {
    const result = await app.client.chat.postMessage({
      token: context.botToken,
      channel: AVAILY_POSTS_CHANNEL,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${user}> is requesting off on \n *Date*: ${date} \n *Time*: ${startTime} - ${endTime}`,
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
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Delete',
                emoji: true,
              },
              style: 'danger',
              value: 'click_me_123',
              action_id: 'cover_shift_delete',
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_only the user who sent the request can delete this message_\n_clicking cover shift will delete this message and email ITSS_`,
          },
        },
      ],
      text: `<@${user}> sent a request to have a shift covered`,
    });
    console.log(result);
  } catch (error) {
    console.log(error);
  }
});

app.action('cancel_click', async ({ ack, body, context }) => {
  ack();

  try {
    const result = await app.client.chat.delete({
      token: context.botToken,
      channel: body.channel.id,
      ts: body.message.ts,
    });
    console.log(result);
  } catch (error) {
    console.log(error);
  }
});

app.action('cover_shift_click', async ({ ack, body, context }) => {
  const person_covering = body.user.name;

  await ack();

  try {
    // update message
    const result = await app.client.chat.update({
      token: context.botToken,
      // ts of message to update
      ts: body.message.ts,
      channel: body.channel.id,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${person_covering}> is covering <@${user}> on \n *Date*: ${date} \n *Time*: ${startTime} - ${endTime}`,
          },
        },
      ],
    });
    console.log(result);
  } catch (error) {
    console.log(error);
  }

  // send email
  var mailOptions = {
    from: process.env.EMAIL_USR,
    to: process.env.SEND_TO_EMAIL,
    subject: `Shift Cover Alert - ${new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
    })}`,
    html: `<h4>${person_covering} is covering ${user} on</h4>
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

app.action('cover_shift_delete', async ({ ack, body, context }) => {
  ack();
  // only delete the message if the user who clicked it is the user who requested it
  if (body.message.text.includes(body.user.id)) {
    try {
      // Delete the message
      const result = await app.client.chat.delete({
        token: context.botToken,
        ts: body.message.ts,
        channel: body.channel.id,
      });
      console.log(result);
    } catch (error) {
      console.log(error);
    }
  }
});

app.command('/test', async ({ ack, payload, context }) => {
  ack();

  console.log('test command');
  console.log(payload.text);
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log(`⚡️Slack Bolt app is running`);
  db.connect();
  console.log('DB is connected.');
})();
