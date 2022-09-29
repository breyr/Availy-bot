const { App, LogLevel } = require('@slack/bolt');
const orgAuth = require('./database/auth/store_user_org_install');
const workspaceAuth = require('./database/auth/store_user_workspace_install');
const db = require('./database/db');
const dbQuery = require('./database/find_user');
const nodemailer = require('nodemailer');
require('dotenv').config();

const AVAILY_POSTS_CHANNEL = 'availy-posts';

class Shift {
  constructor(
    user,
    messageTS = '',
    date = '01/01/2022',
    startTime = '12:00 am',
    endTime = '12:00 am'
  ) {
    (this.user = user),
      (this.messageTS = messageTS),
      (this.date = date),
      (this.startTime = startTime),
      (this.endTime = endTime);
  }
}

let shifts = [];

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

  console.log(`Request Off Payload: \n ${JSON.stringify(payload)}`);
  const user = payload.user_name;

  const d = new Date()
    .toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
    })
    .split('/');

  if (payload.channel_name === 'directmessage') {
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
              type: 'plain_text',
              text: 'Shift Date:',
              emoji: true,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'datepicker',
                initial_date: `${d[2]}-${d[0]}-${d[1]}`,
                placeholder: {
                  type: 'plain_text',
                  text: 'Select a date',
                  emoji: true,
                },
                action_id: 'datepickeraction',
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: 'Shift Start & End Times:',
              emoji: true,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'timepicker',
                initial_time: '00:00',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select time',
                  emoji: true,
                },
                action_id: 'starttimeaction',
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'timepicker',
                initial_time: '00:00',
                placeholder: {
                  type: 'plain_text',
                  text: 'Select time',
                  emoji: true,
                },
                action_id: 'endtimeaction',
              },
            ],
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
                action_id: 'confirmaction',
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
                action_id: 'cancelaction',
              },
            ],
          },
        ],
        text: 'request form posted',
      });
      console.log(`New request form posted: ${result}`);
      let newShift = new Shift(user, result.message.ts);
      shifts.push(newShift);
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

app.action('datepickeraction', async ({ ack, body, context }) => {
  ack();
  // retrieve date from picker
  const split_date = body.actions[0].selected_date.split('-');
  const date = split_date[1] + '/' + split_date[2] + '/' + split_date[0];

  // check if there is an object with message ID
  if (shifts.length != 0) {
    const shiftExist = shifts.filter((shift) => {
      return (
        shift.messageTS === body.message.ts && shift.user == body.user.name
      );
    });
    if (shiftExist) {
      // update the date properties
      shifts.forEach((shift) => {
        if (
          shift.messageTS === body.message.ts &&
          shift.user == body.user.name
        ) {
          // update the date property
          shift.date = date;
        }
      });
    } else {
      // add the object
      let newShift = new Shift(body.message.ts, date);
      shifts.push(newShift);
    }
  } else {
    // add the object
    let newShift = new Shift(body.message.ts, date);
    shifts.push(newShift);
  }
});

app.action('starttimeaction', async ({ ack, body }) => {
  ack();
  // retrieve start time from picker
  const selectedStartTime = body.actions[0].selected_time;
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
  const startTime =
    String(startTimeHoursConverted) +
    selectedStartTime.slice(2) +
    ' ' +
    amOrPmStart;

  // check if there is an object with message ID
  if (shifts.length != 0) {
    const shiftExist = shifts.filter((shift) => {
      return (
        shift.messageTS === body.message.ts && shift.user == body.user.name
      );
    });
    if (shiftExist) {
      // update the date properties
      shifts.forEach((shift) => {
        if (
          shift.messageTS === body.message.ts &&
          shift.user === body.user.name
        ) {
          // update the date property
          shift.startTime = startTime;
        }
      });
    } else {
      // add the object
      let newShift = new Shift(body.message.ts, startTime);
      shifts.push(newShift);
    }
  } else {
    // add the object
    let newShift = new Shift(body.message.ts, startTime);
    shifts.push(newShift);
  }
});

app.action('endtimeaction', async ({ ack, body }) => {
  ack();
  // retrieve end time from picker
  // have to convert from 24 hour to 12 hour time
  const selectedEndTime = body.actions[0].selected_time;
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
  const endTime =
    String(endTimeHoursConverted) + selectedEndTime.slice(2) + ' ' + amOrPmEnd;

  // check if there is an object with message ID
  if (shifts.length != 0) {
    const shiftExist = shifts.filter((shift) => {
      return (
        shift.messageTS === body.message.ts && shift.user === body.user.name
      );
    });
    if (shiftExist) {
      // update the date properties
      shifts.forEach((shift) => {
        if (
          shift.messageTS === body.message.ts &&
          shift.user === body.user.name
        ) {
          // update the date property
          shift.endTime = endTime;
        }
      });
    } else {
      // add the object
      let newShift = new Shift(body.messageID, endTime);
      shifts.push(newShift);
    }
  } else {
    // add the object
    let newShift = new Shift(body.messageID, endTime);
    shifts.push(newShift);
  }
});

app.action('confirmaction', async ({ ack, body, context }) => {
  ack();
  // try posting to availy-posts

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

  // find the correct shift to post
  let userName;
  let shiftDate;
  let shiftStartTime;
  let shiftEndTime;

  shifts.forEach((shift) => {
    if (shift.messageTS === body.message.ts && shift.user === body.user.name) {
      userName = shift.user;
      shiftDate = shift.date;
      shiftStartTime = shift.startTime;
      shiftEndTime = shift.endTime;
    }
  });

  try {
    const result = await app.client.chat.postMessage({
      token: context.botToken,
      channel: AVAILY_POSTS_CHANNEL,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${userName}> is requesting off on \n *Date*: ${shiftDate} \n *Time*: ${shiftStartTime} - ${shiftEndTime}`,
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
      text: `<@${userName}> is requesting off on \n *Date*: ${shiftDate} \n *Time*: ${shiftStartTime} - ${shiftEndTime}`,
    });
    console.log(result);
  } catch (error) {
    console.log(error);
  }
});

app.action('cancelaction', async ({ ack, body, context }) => {
  ack();
  // delete message
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

  try {
    shifts = shifts.filter((shift) => {
      shift.messageTS != body.message.ts && shift.user != body.user.name;
    });
  } catch (error) {
    console.log(error);
  }
});

// cover shift click needs to be updated to use the shift objects

app.action('cover_shift_click', async ({ ack, body, context }) => {
  const person_covering = body.user.name;

  // get the correct shift
  // check to see if the person covering is not the person in the shiftlet userName;

  await ack();
  shift_properties_list = body.message.text.split(' ');

  // this value is <@userID>
  let userID = shift_properties_list[0].substring(
    1,
    shift_properties_list[0].length - 1
  );

  let userName;

  try {
    // Call the users.list method using the WebClient
    const result = await app.client.users.list({
      token: context.botToken,
    });

    result.members.forEach((member) => {
      // if (member['id'] == userID) {
      //   userName = member['name'];
      // }
      console.log(`Searching for this UID: ${userID}`);
      console.log(member['id'] + ' ' + member['name']);
    });
  } catch (error) {
    console.error(error);
  }

  let shiftDate = shift_properties_list[8];
  let shiftStartTime = shift_properties_list[12] + shift_properties_list[13];
  let shiftEndTime = shift_properties_list[15] + shift_properties_list[16];

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
            text: `<@${person_covering}> is covering <@${userName}> on \n *Date*: ${shiftDate} \n *Time*: ${shiftStartTime} - ${shiftEndTime}`,
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
    html: `<h4>${person_covering} is covering ${userName} on</h4>
           <h4>Date: ${shiftDate}</h4>
           <h4>Time: ${shiftStartTime} - ${shiftEndTime}</h4>`,
  };

  // takes a while to send the email
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });

  try {
    shifts = shifts.filter((shift) => {
      shift.messageTS != body.message.ts;
    });
  } catch (error) {
    console.log(error);
  }
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

  try {
    shifts = shifts.filter((shift) => {
      shift.messageTS != body.message.ts && shift.user != body.user.name;
    });
  } catch (error) {
    console.log(error);
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);
  console.log(`⚡️Slack Bolt app is running`);
  db.connect();
  console.log('DB is connected.');
})();
