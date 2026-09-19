# Work with events from Google Drive Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/workspace/drive/api/guides/events-overview

Retrieved: 2026-09-19T16:30:06.306757+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

This page explains how to receive Google Drive events from [Google Cloud
Pub/Sub](https://developers.google.com/pubsub/docs/overview).

A *Drive event* represents an activity or change to a
Drive resource, such as a new file in a folder. You can use
events to understand what happened and then take action, or to respond in a
meaningful way for your users.

Here are some examples of how you can use events:

* Observe and respond to changes in a file, folder, or shared drive, such as
  when a file is edited or a new revision is uploaded.
* Monitor changes to files to improve the performance of your app.
* Audit activities like file sharing, file moves, and deletions to help detect
  potential data leaks and unauthorized access.
* Offer insights into how users are managing their files, helping to identify
  areas where content management could be improved.
* Track file changes to verify compliance with regulatory requirements or
  security policies.
* Analyze Drive activity using other Google Cloud
  products such as [Eventarc](https://cloud.google.com/eventarc/docs),
  [Workflows](https://cloud.google.com/eventarc/standard/docs/workflows/quickstart-pubsub),
  and [BigQuery](https://developers.google.com/bigquery/docs/introduction).

## How events work

Whenever something happens in Drive, a Google Drive API resource is
created, updated, or deleted. Drive uses events to deliver
information to your app about the type of activity that occurred, and the
Drive API resource that was affected.

Drive categorizes events by type. Event types help you filter and
receive only the type of information you need, and let you handle similar
activities in the same way.

The following table shows how an example activity in Drive
affects a related Drive API resource, and the type of event that your
Drive app receives:

| Activity | Drive API resource | Event type |
| --- | --- | --- |
| A user creates an access proposal on a file. | An [`AccessProposal`](https://developers.google.com/workspace/drive/api/reference/rest/v3/accessproposals) resource is created. | New access proposal |
| A user creates an approval on a file. | An [`Approval`](https://developers.google.com/workspace/drive/api/reference/rest/v3/approvals) resource is created. | New approval |
| A user posts a comment in a Google Docs, Sheets, or Slides file. | A [`Comment`](https://developers.google.com/workspace/drive/api/reference/rest/v3/comments) resource is created. | New comment |
| A user adds a file to a folder or shared drive. | A [`File`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files) resource is created. | New file |
| A user creates permissions on a file. | A [`Permission`](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions) resource is created. | New permission |
| A user replies to a comment. | A [`Reply`](https://developers.google.com/workspace/drive/api/reference/rest/v3/replies) resource is created. | New reply |

## Receive events from Google Drive

Traditionally, your Drive app could locate events through either
the Drive API or the Google Drive Activity API. With the addition of
Drive events in Google Workspace Events API, there's now a third
method receive events:

* Subscribe to events using the [Google Workspace Events API](https://developers.google.com/workspace/events)
  to receive events as they occur. For more information, see [Subscribe to
  Google Drive events](https://developers.google.com/workspace/events/guides/events-drive).
* Subscribe to events using the Drive API. Get user change events
  with the [`changes.watch`](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch) method or file
  change events using the [`files.watch`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/watch)
  method.
* Query for recent events by calling the
  [Google Drive Activity API](https://developers.google.com/workspace/drive/activity/v2).

The following table explains the difference and reasons for subscribing to
events versus querying for them:

|  | Subscribe to Google Workspace events | Subscribe to Drive API watch events | Query for Drive Activity API events |
| --- | --- | --- | --- |
| Use cases | * Process or respond to events in real time. * Monitor changes in resources to improve the performance of your app. * Receive structured event data through Pub/Sub and use Google Cloud products like Cloud Run. | * Detect changes to file metadata and efficiently monitor changes to specific items with real-time notifications. * Supports a webhook callback URL to avoid repeatedly polling the API endpoints. | * Fetch a detailed history of all activities, including granular information about each event. * Retrieve precise activities that include `ActionDetail`, `Actor`, and `Target` information for specific tasks like audits. |
| API | Google Workspace Events API | Google Drive API | Google Drive Activity API |
| Source of events | Files, folders, and shared drives | `changes.watch` and `files.watch` | `DriveActivity` |
| Supported events | * `AccessProposal` * `Approval` * `Comment` * `File` * `Permission` * `Reply`  For a list of supported event types, see [Event types for creating subscriptions](https://developers.google.com/workspace/events/guides/events-drive#event-types) in the Google Workspace Events API documentation. | `Channel`    For a list of supported event types, see the [Understand Google Drive API notification events](https://developers.google.com/workspace/drive/api/guides/push#understand-google-drive-api-notification-events) in the Drive API documentation. | `Action`    For a list of supported fields, see the [`Action` resource](https://developers.google.com/workspace/drive/activity/v2/reference/rest/v2/activity/action) in the Drive Activity API reference documentation. |
| Event format | A Pub/Sub message, formatted according to the CloudEvent specification. For details, see [Structure of Google Workspace events](https://developers.google.com/workspace/events#structure). | A Drive API resource (`Channel`) | An Drive Activity API resource (`Action`) |
| Event data | Base64-encoded string with or without resource data. For example payloads, see [Event data](https://developers.google.com/workspace/events/guides/events-drive#event-data). | JSON payload that contains resource data. For an example payload, see the [`Channel` resource](https://developers.google.com/workspace/drive/api/reference/rest/v3/channels) in the reference documentation. | JSON payload that contains resource data. For an example payload, see the [`activity.query` response body](https://developers.google.com/workspace/drive/activity/v2/reference/rest/v2/activity/query#response-body) in the reference documentation. |

## Get started with Drive events

This guide explains how to create and manage a Google Workspace events
subscription on a Drive resource. This lets your app receive
events over Google Cloud Pub/Sub.

### Create a Google Cloud project

To generate a Google Cloud project, see [Create a Google Cloud
project](https://developers.google.com/workspace/guides/create-project).

### Enable the Google Workspace Events API, Google Cloud Pub/Sub API, and Google Drive API

Before using Google APIs, you need to turn them on in a Google Cloud project.
You can turn on one or more APIs in a single Google Cloud project.

### Google Cloud console

1. In the Google Cloud console, open the Google Cloud project for your app and
   enable the Google Workspace Events API, Pub/Sub API, and
   Drive API:

   [Enable the
   APIs](https://console.cloud.google.com/flows/enableapi?apiid=workspaceevents.googleapis.com,pubsub.googleapis.com,drive.googleapis.com)
2. Confirm that you're enabling the APIs in the correct
   Cloud project, then click **Next**.
3. Confirm that you're enabling the correct APIs, then click **Enable**.

### gcloud

1. In your working directory, sign in to your Google Account:

   ```
   gcloud auth login
   ```
2. Set your project to the Cloud project for your app:

   ```
   gcloud config set project PROJECT_ID
   ```

   Replace `PROJECT_ID` with the [project
   ID](https://cloud.google.com/resource-manager/docs/creating-managing-projects#before_you_begin)
   for the Cloud project for your app.
3. Enable the Google Workspace Events API, Pub/Sub API, and
   Drive API:

   ```
   gcloud services enable workspaceevents.googleapis.com \
   pubsub.googleapis.com \
   drive.googleapis.com
   ```

### Set up a client ID

To generate an OAuth 2.0 client ID, see [Create OAuth client ID
credentials](https://developers.google.com/workspace/events/guides/create-subscription#create-oauth).

### Create a Pub/Sub topic

Before creating a subscription, you must create a Google Cloud Pub/Sub
topic that receives relevant events your application is interested in. To create
the Pub/Sub topic, see [Create and subscribe to a Pub/Sub
topic](https://developers.google.com/workspace/events/guides/create-subscription#pubsub).

Make sure to reference the Drive service account
(`drive-api-event-push@system.gserviceaccount.com`) for your requests.

### Create a Drive subscription

Cloud events are dispatched when the subscription subject (or any other file
underneath the subject's hierarchy) changes. For example, if you create a
subscription on a shared drive and a file changes that's nested within several
subfolders in that shared drive, it generates an event. For supported resources
and Drive event types, see [Event types for creating
subscriptions](https://developers.google.com/workspace/events/guides/events-drive#event-types).

The following Node.js application creates a Drive events
subscription on a file or folder to listen for content change events. For more
information, see [Create a Google Workspace
subscription](https://developers.google.com/workspace/events/guides/create-subscription#create-subscription).

To run this example, make sure you have both [Node.js & npm
installed](https://docs.npmjs.com/getting-started/installing-node#1-install-nodejs--npm).
You also need to make sure you have the required dependencies installed to run
this example.

```
# Install needed dependencies
$ npm install googleapis @google-cloud/local-auth axios
```

To create a Drive subscription you use the
Google Workspace Events API's `subscriptions.create` method to create a
[`Subscription`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions) resource:

```
// app.js

const fs = require('fs').promises;
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const axios = require('axios');

// Scopes for Google Drive API access.
const SCOPES = ['SCOPES'];

/**
 * Authenticates the user running the script.
 * @return {Promise<OAuth2Client>} The authorized client.
 */
async function authorize() {
  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: 'credentials.json',
  });
  if (client.credentials) {
    const content = await fs.readFile('credentials.json');
    const keys = JSON.parse(content);
    const {client_id, client_secret} = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id,
      client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile('token.json', payload);
    return client;
  } else {
    throw new Exception(
        'credentials.json did not have the Oauth client secret or it was not properly formatted');
  }
  }

/**
 * Creates a subscription to Google Drive events.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function createSubscription(authClient) {
  const url = 'https://workspaceevents.googleapis.com/v1/subscriptions';
  const data = {
    targetResource: 'TARGET_RESOURCE',
    eventTypes: ['EVENT_TYPES'],
    payload_options: {
      include_resource: {
        {
          'RESOURCE_DATA'
        }
      }
    },
    drive_options: {
      include_descendants: {
        {
          'INCLUDE_DESCENDANTS'
        }
      }
    },
    notification_endpoint: {pubsub_topic: 'TOPIC_NAME'}
  };
  try {
    const {token} = await authClient.getAccessToken();
    const response = await axios.post(
        url, data, {headers: {'Authorization': `Bearer ${token}`}});
    console.log('Subscription created:', response.data);
  } catch (error) {
    const message = error.response ? error.response.data : error.message;
    console.error('Error creating subscription:', message);
  }
}

authorize().then(createSubscription).catch(console.error);
```

Replace the following:

* `SCOPES`: One or more [OAuth
  scopes](https://developers.google.com/workspace/events/guides/auth) that support each event type for the
  subscription. Formatted as an array of strings. To list multiple scopes,
  separate by commas. As a best practice, you should use the most restrictive
  scope that still allows your app to function. For example,
  `'https://www.googleapis.com/auth/drive.file'`.
* `TARGET_RESOURCE`: The [Google Workspace resource](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#Subscription.FIELDS.target_resource)
  that you're subscribing to, formatted as its full resource name. For
  example, to subscribe to a Drive file or folder, use
  `//drive.googleapis.com/files/FileID`.
* `EVENT_TYPES`: One or more [event types](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#Subscription.FIELDS.event_types)
  that you want to subscribe to in the target resource. Format as an array of
  strings, such as `'google.workspace.drive.file.v3.contentChanged'`.
* `RESOURCE_DATA`: A boolean that specifies whether the
  subscription includes resource data in the event payload. This property
  affects the duration of your subscription. To learn more, see [Event
  data](https://developers.google.com/workspace/events/guides#data).

  + `True`: Includes all resource data. To limit which fields are included,
    add the
    [`fieldMask`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#PayloadOptions.FIELDS.field_mask)
    and specify at least one field for the changed resource. Only subscriptions
    to Chat and Drive resource support including
    resource data.
  + `False`: Excludes resource data.
* `INCLUDE_DESCENDANTS`: A boolean field that's part of
  [`DriveOptions`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#driveoptions).
  Only available when the `targetResource` is either a Drive
  file or a shared drive that has the MIME type set to
  `application/vnd.google-apps.folder`. Cannot be set on the root folder of My
  Drive or shared drives.

  + `True`: The subscription includes all descendant Drive
    files in the list of events.
  + `False`: The subscription is created for the single file or shared drive
    that's specified as the `targetResource`.
* `TOPIC_NAME`: The full name of the Pub/Sub topic that you
  created in your Cloud project. This Pub/Sub topic receives events
  for the subscription. Formatted as
  `projects/PROJECT_ID/topics/TOPIC_ID`. The
  [`notificationEndpoint`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#Subscription.FIELDS.notification_endpoint)
  field is used to specify the Pub/Sub topic and it's where the subscription
  delivers events.

### Test your Drive subscription

To test that you're receiving Drive events, you can trigger an
event and pull messages to the Pub/Sub subscription. For more information, see
[Test your Google Workspace
subscription](https://developers.google.com/workspace/events/guides/create-subscription#test-subscription).

### Process Drive events using Cloud Functions

Drive events are sent to the Pub/Sub topic in the subscription
you create. Make sure when creating the trigger that the Pub/Sub topic for the
trigger matches the Pub/Sub topic in your event subscription. You can then
[deploy your Cloud Run
function](https://cloud.google.com/run/docs/deploy-functions) and make edits to
the file to see event changes in the logs.

Before you create the function, update the `package.json` for the dependencies:

```
{
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "cloudevents": "^8.0.0"
  }
}
```

Next, create the source code for the function:

```
const functions = require('@google-cloud/functions-framework');
const { HTTP } = require("cloudevents");

/**
 * A Cloud Function triggered by Pub/Sub messages containing Google Drive activity events.
 * This function processes different types of Drive events.
 *
 * @param {object} cloudEvent The CloudEvent object.
 * @param {object} cloudEvent.data The data payload from the event source.
 */
functions.cloudEvent('helloFromDrive', async (cloudEvent) => {
  try {
    // Verify the Pub/Sub message exists
    if (!cloudEvent.data || !cloudEvent.data.message) {
      console.warn("Event is missing the Pub/Sub message payload.");
      return;
    }

    // Extract the Pub/Sub message details
    const { message } = cloudEvent.data;
    const { attributes, data } = message;

    // The original Drive CloudEvent is reconstructed from the Pub/Sub message attributes
    const driveEvent = HTTP.toEvent({ headers: attributes });
    const { type } = driveEvent;

    // The Drive event's payload is a base64 encoded JSON string
    const payload = JSON.parse(Buffer.from(data, "base64").toString());

    console.log(`Processing Drive event type: ${type}`);

    // Use a switch statement to handle different event types
    switch (type) {
      case 'google.workspace.drive.file.v3.contentChanged':
        console.log('File Content Changed:', payload);
        break;
      case 'google.workspace.drive.accessproposal.v3.created':
        console.log('Access Proposal Created:', payload);
        break;
      default:
        console.log(`Received unhandled event type: ${type}`);
        break;
    }
  } catch (error) {
    console.error("An error occurred while processing the Drive event:", error);
  }
});
```

## Limitations

* When the [`includeDescendants`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#DriveOptions.FIELDS.include_descendants)
  boolean field in
  [`DriveOptions`](https://developers.google.com/workspace/events/reference/rest/v1/subscriptions#driveoptions)
  is `true`, Drive subscriptions on shared drives and folders
  always dispatch an event, even if the file that triggered the event is nested many layers below
  the folder used for the Drive subscription.
* Even though you may have created a subscription on a folder, you may not receive all events
  within the file hierarchy as the user or application may not be granted access to them. In this
  case, the subscription remains active but you won't receive any events for resources you don't
  have access to.
* Subscriptions are supported for events on all files and folders but not on the root folder of
  shared drives. Subscriptions are only supported for files and folders *inside* shared
  drives. Changes made directly to the root folder of a shared drive won't trigger events.
* The user that authorizes the subscription must have permission on the file corresponding to the
  events that they subscribe to.
* The subscription only receives events for resources where the user has access through
  their Google Workspace account or Google Account.

## Related topics

* [Google Workspace Events API overview](https://developers.google.com/workspace/events)
* [Create a Google Workspace subscription](https://developers.google.com/workspace/events/guides/create-subscription)
* [Subscribe to Google Drive events](https://developers.google.com/workspace/events/guides/events-drive)
