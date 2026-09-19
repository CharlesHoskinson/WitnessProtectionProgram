# Sign in with Google Branding Guidelines Stay organized with collections Save and categorize content based on your preferences.

Source: https://developers.google.com/identity/branding-guidelines

Retrieved: 2026-09-19T16:29:14.711169+00:00

Portions of this page are modifications based on work created and shared by Google and used according to terms described in the [Creative Commons 4.0 Attribution License](https://creativecommons.org/licenses/by/4.0/). Code samples are subject to the original page's Apache 2.0 notice where stated. Trademarks and separately licensed material remain excluded. Extraction removes site navigation and converts article HTML to Markdown.

---

![Spark icon](/_static/images/icons/spark.svg)

## Page Summary

* Following these guidelines on displaying the Sign in with Google button is required for app verification.
* The recommended way to display the button is using Google Identity Services SDKs, but you can also render an HTML button, download assets, or create a custom button.
* Pre-approved brand icons are available for download in various styles, themes, and shapes.
* If creating a custom button, adhere to specific guidelines regarding size, text, color, font, padding, and the Google logo.
* The Sign in with Google button should be displayed at least as prominently as other third-party sign-in options.

This document provides guidelines on how to display a Sign in with Google button on your
website or app. Your website or app must follow these guidelines to complete the app
verification process.

Our
[Google Identity Services SDKs](https://developers.google.com/identity/authentication)
render a Sign in with Google button that always adheres to the most recent Google branding
guidelines. They are the recommended way to display the Sign in with Google button on your
website or app. For cases where you are not able to use the Google-rendered button option, you
can [render an HTML button element](https://developers.google.com/identity/branding-guidelines#render-html-button),
[download](https://developers.google.com/identity/branding-guidelines#download-brand-icons) our pre-approved branding assets or optionally
[create a custom Sign in with Google button](https://developers.google.com/identity/branding-guidelines#custom-button).

### Render HTML Button Element

We provide an HTML configurator that allows you to customize the appearance of the
Sign in with Google button, featuring the current button design. You can then download an HTML and CSS snippet that will render the
button on your website.

#### Generate HTML Button Element

```

```

### Download Pre-Approved Brand Icons

As an alternative to using a custom image button, you can
[download](https://developers.google.com/static/identity/images/signin-assets.zip)
our pre-approved Sign in with Google buttons provided in PNG and SVG formats for all
platforms.

The provided images buttons are available in standard and icon modes and include the below
style options:

* Theme : *Light, Neutral, Dark*
* Shape : *Rectangular, Pill*

Below are two examples:

| Theme | Buttons | Description |
| --- | --- | --- |
| Light | Standard light themed rectangular Sign in with Google button example | Standard large light themed rectangular Sign in with Google button |
| Dark | Standard dark themed pill shaped Sign in with Google button example | Standard dark themed pill shaped Sign in with Google button |

[Download Pre-Approved Brand Icons](https://developers.google.com/static/identity/images/signin-assets.zip)

#### Supported Button Modes

|  |  |  |
| --- | --- | --- |
| Light | light themed round shaped Sign in with Google button  light themed square shaped Sign in with Google button | light themed pill shaped Sign in with Google button  light themed rectangle shaped Sign in with Google button |
| Dark | dark themed round shaped Sign in with Google button  dark themed square shaped Sign in with Google button | dark themed pill shaped Sign in with Google button  dark themed rectangle shaped Sign in with Google button |
| Neutral | neutral themed round shaped Sign in with Google button  neutral themed square shaped Sign in with Google button | neutral themed pill shaped Sign in with Google button  neutral themed rectangle shaped Sign in with Google button |

**Note:** The SVG files require the Google Sans
[font](https://developers.google.com/identity/branding-guidelines#font). The SVG
format also makes it possible for you to edit the Sign in with Google text to the language
of your app or website.

### Create a custom Sign in with Google Button

Using our
[Google Identity Services SDKs](https://developers.google.com/identity/authentication)
or any of the other options covered in [previous sections](https://developers.google.com/identity/branding-guidelines#render-html-button) is
strongly recommended as it enables Google users to more easily identify the Google brand. The
more easily users can identify an action button, the more likely they are to interact with it.

If you, however, need to adapt the button to match your app design, adhere to the following
guidelines.

#### Size

You can scale the button as needed for different devices and screen sizes, but you must
preserve the aspect ratio so that the Google logo is not stretched.

#### Text

To encourage users to click the button, we recommend the call-to-action text
"Sign in with Google", "Sign up with Google", or "Continue with Google". Localization of
this text to match the language of your app or website is permitted and encouraged to provide
a better user experience. It should be clear to the user that they are signing into your app
or signing up for your app with their Google credentials, not signing up or registering for a
Google Account on your app.

#### Color

The default state of the buttons are shown below. The button must always include the standard
color for the Google "G".

| Theme | Example |  |
| --- | --- | --- |
| Light | light themed pill shaped Sign in with Google button | Fill: #FFFFFF   Stroke: #747775 | 1px | inside   Font: #1F1F1F | Google Sans Medium | 14/20 |
| Dark | dark themed pill shaped Sign in with Google button | Fill: #131314   Stroke: #8E918F | 1px | inside   Font: #E3E3E3 | Google Sans Medium | 14/20 |
| Neutral | neutral themed pill shaped Sign in with Google button | Fill: #F2F2F2   Stroke: No stroke   Font: #1F1F1F | Google Sans Medium | 14/20 |

#### Font

The button font is Google Sans Medium. To install, first
[download the Google Sans font](https://fonts.google.com/specimen/Google+Sans)
and extract the download bundle. On Mac, just double-click **GoogleSans-VariableFont.ttf**,
then click "Install Font". On Windows, drag the file to "My Computer" > "Windows" > "Fonts"
folder.

#### Padding

|  |  |
| --- | --- |
| Android & Web (mobile + desktop) | 12px left padding before the Google logo, 10px right padding after the Google logo and 12px right padding after the Sign in with Google text |
| iOS | 16px left padding before the Google logo, 12px right padding after the Google logo and 16px right padding after the Sign in with Google text |

#### Google logo in the "Sign in with Google" button

Regardless of the text, you can't change the size or color of the Google "G" logo. It must be
the standard color version (the standard color gradient super G logo) and appear on a white background. If you need to create your own
custom size Google logo, start with any of the logo sizes included in the download bundle.

![Google G icon](/static/identity/images/g-logo.png)

#### Incorrect button design

| branding granding dos and donts image sample Do Use the [Google Material](https://m3.material.io/) design guidelines for button boundary and color scheme. | branding granding dos and donts image sample Don't Use the Google icon or logo by itself without the button boundary and without text to indicate the user action. |
| branding granding dos and donts image sample Do Use the Google brand color for Google icon for dark, light, and neutral modes. | branding granding dos and donts image sample Don't Use monochrome versions of the Google "G" for the button. |
| branding granding dos and donts image sample Do Choose the button in the right color mode for accessibility and equal prominence. | branding granding dos and donts image sample Don't Put the standard color Google "G" icon on a colored background other than light, dark, or neutral. |
| branding granding dos and donts image sample Do Stick with the Google "G" with fixed padding and size. | branding granding dos and donts image sample Don't Create your own icon for the button or use an outdated Google "G" for the button. |
| branding granding dos and donts image sample Do Use the Google "G" by itself for action button if needed. | branding granding dos and donts image sample Don't Use the term "Google" by itself in the button to represent the action of Sign in with Google. |

### Sign in with Google Branding Best Practices

#### Sign in with Google and other third party sign-in options

The Sign in with Google button should be displayed at least as prominently as other third
party sign-in options. For example, buttons should be approximately the same size and have
similar visual weight.

### Other Guidelines

If you request additional scopes, do so with incremental authorization ([Android](https://developers.google.com/identity/sign-in/android/additional-scopes), [iOS](https://developers.google.com/identity/sign-in/ios/additional-scopes),
[web](https://developers.google.com/identity/sign-in/web/incremental-auth)), only prompting the user for
authorization as they begin to interact with a feature that requires API access.

If you request YouTube scopes, use a
[YouTube button](https://developers.google.com/youtube/branding_guidelines).

If you use Google Play games services, also see the
[Google Play games services branding guidelines](https://developers.google.com/games/services/branding-guidelines).

Use of Google brands in ways not expressly covered by this document is not allowed without
prior written consent from Google (see the
[Guidelines for Third Party Use of Google Brand Features](http://www.google.com/intl/en/permissions/)
for more information).
