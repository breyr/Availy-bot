const { App, LogLevel } = require('@slack/bolt');
const orgAuth = require('./database/auth/store_user_org_install');
const workspaceAuth = require('./database/auth/store_user_workspace_install');
const db = require('./database/db');
const dbQuery = require('./database/find_user');
const nodemailer = require('nodemailer');
require('dotenv').config();

const AVAILY_POST_CHANNEL = 'availy-posts';

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
app.command('/requestoff', async ({ ack, payload, context }) => {
  // acknowledge request
  ack();

  const user = payload.user_name;
  if (payload.channel_name === 'directmessage') {
    const d = new Date()
      .toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
      })
      .split('/');

    try {
      const result = await app.client.chat.postMessage({
        token: context.botToken,
        channel: payload.channel_id,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: 'Fill out this form please 🙂',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Shift date:*',
            },
            accessory: {
              type: 'datepicker',
              initial_date: `${d[2]}-${d[0]}-${d[1]}`,
              placeholder: {
                type: 'plain_text',
                text: 'Select time',
                emoji: true,
              },
              action_id: 'datepicker-action',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Shift start time:*',
            },
            accessory: {
              type: 'timepicker',
              initial_time: '00:00',
              placeholder: {
                type: 'plain_text',
                text: 'Select time',
                emoji: true,
              },
              action_id: 'timepicker-action',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Shift end time:*',
            },
            accessory: {
              type: 'timepicker',
              initial_time: '00:00',
              placeholder: {
                type: 'plain_text',
                text: 'Select time',
                emoji: true,
              },
              action_id: 'timepicker-action',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Confirm',
                  emoji: true,
                },
                style: 'primary',
                value: 'click_me_123',
                action_id: 'actionId-0',
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Cancel',
                  emoji: true,
                },
                style: 'danger',
                value: 'click_me_123',
                action_id: 'actionId-1',
              },
            ],
          },
        ],
        text: 'request form posted',
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

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log(`⚡️Slack Bolt app is running`);
  db.connect();
  console.log('DB is connected.');
})();
