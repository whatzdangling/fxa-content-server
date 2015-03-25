/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A broker that knows how to communicate with Firefox when used for Sync.
 */

'use strict';

define([
  'cocktail',
  'underscore',
  'models/auth_brokers/base',
  'models/auth_brokers/mixins/channel',
  'lib/promise',
  'lib/auth-errors',
  'lib/url',
  'lib/constants',
  'lib/channels/fx-desktop',
  'lib/channels/web'
], function (Cocktail, _, BaseAuthenticationBroker, ChannelMixin, p,
    AuthErrors, Url, Constants, FxDesktopChannel, WebChannel) {

  function createFxDesktopChannel(win, metrics) {
    var channel = new FxDesktopChannel();

    channel.init({
      window: win,
      // Fx Desktop browser will send messages with an origin of the string
      // `null`. These messages are trusted by the channel by default.
      //
      // 1) Fx on iOS and functional tests will send messages from the
      // content server itself. Accept messages from the content
      // server to handle these cases.
      // 2) Fx 18 (& FxOS 1.*) do not support location.origin. Build the origin from location.href
      origin: win.location.origin || Url.getOrigin(win.location.href),
      metrics: metrics
    });

    return channel;
  }

  function createWebChannel(win, webChannelId) {
    var channel = new WebChannel(webChannelId);
    channel.init({
      window: win
    });
    return channel;
  }

  var FxDesktopAuthenticationBroker = BaseAuthenticationBroker.extend({
    /**
     * Whether the view should halt after a `login` message is sent. Can be
     * overridden by passing in `haltAfterLogin: false` on instantiation
     */
    _haltAfterLogin: true,

    /**
     * The type of channel to create. Can be either `fx-desktop` or
     * `web-channel`
     */
    _channelType: 'fx-desktop',

    /**
     * Initialize the broker
     *
     * @param {Object} [options]
     * @param {Boolean} [options.haltAfterLogin]
     *        If `true`, views that cause a `login` command to be sent will
     *        halt afterwards.
     * @param {String} [options.messagePrefix]
     *        Prefix to attach to messages.
     * @param {String} [options.channelType]
     *        Type of channel to use. Can be either `fx-desktop` or
     *        `web-channel`. defaults to `fx-desktop`.
     */
    initialize: function (options) {
      options = options || {};

      // channel can be passed in for testing.
      this._channel = options.channel;
      this._metrics = options.metrics;

      if ('haltAfterLogin' in options) {
        this._haltAfterLogin = options.haltAfterLogin;
      }

      if ('messagePrefix' in options) {
        this._messagePrefix = options.messagePrefix;
      }

      if ('channelType' in options) {
        this._channelType = options.channelType;
      }

      return BaseAuthenticationBroker.prototype.initialize.call(
          this, options);
    },

    afterLoaded: function () {
      return this.send('loaded');
    },

    beforeSignIn: function (email) {
      var self = this;
      // This will send a message over the channel to determine whether
      // we should cancel the login to sync or not based on Desktop
      // specific checks and dialogs. It throws an error with
      // message='USER_CANCELED_LOGIN' and errno=1001 if that's the case.
      return self.request('can_link_account', { email: email })
        .then(function (response) {
          if (response && response.data && ! response.data.ok) {
            throw AuthErrors.toError('USER_CANCELED_LOGIN');
          }

          self._verifiedCanLinkAccount = true;
        }, function (err) {
          console.error('beforeSignIn failed with', err);
          // If the browser doesn't implement this command, then it will
          // handle prompting the relink warning after sign in completes.
          // This can likely be changed to 'reject' after Fx31 hits nightly,
          // because all browsers will likely support 'can_link_account'
        });
    },

    afterSignIn: function (account) {
      return this._notifyRelierOfLogin(account);
    },

    beforeSignUpConfirmationPoll: function (account) {
      // The Sync broker notifies the browser of an unverified login
      // before the user has verified her email. This allows the user
      // to close the original tab or open the verification link in
      // the about:accounts tab and have Sync still successfully start.
      return this._notifyRelierOfLogin(account);
    },

    afterResetPasswordConfirmationPoll: function (account) {
      return this._notifyRelierOfLogin(account);
    },

    afterChangePassword: function (account) {
      var loginData = this._getLoginData(account, this._verifiedCanLinkAccount);
      return this.send('change_password', loginData);
    },

    afterDeleteAccount: function (account) {
      // no response is expected, so do not wait for one
      return this.send('delete_account', {
        email: account.get('email'),
        uid: account.get('uid')
      });
    },

    // used by the ChannelMixin to get a channel.
    getChannel: function () {
      if (! this._channel) {
        this._channel = this.createChannel(this._channelType);
      }

      return this._channel;
    },

    createChannel: function (channelType) {
      switch (channelType) {
        case 'fx-desktop':
          return createFxDesktopChannel(this.window, this._metrics);
        case 'web-channel':
          var webChannelId = Constants.ACCOUNT_UPDATES_WEBCHANNEL_ID;
          return createWebChannel(this.window, webChannelId);
        default:
          throw new Error('Unknown channelType: ' + this._channelType);
      }
    },

    _getLoginData: function (account, verifiedCanLinkAccount) {
      var ALLOWED_FIELDS = [
        'email',
        'uid',
        'sessionToken',
        'sessionTokenContext',
        'unwrapBKey',
        'keyFetchToken',
        'customizeSync',
        'verified'
      ];

      var loginData = {};
      _.each(ALLOWED_FIELDS, function (field) {
        loginData[field] = account.get(field);
      });

      loginData.verified = !! loginData.verified;
      loginData.verifiedCanLinkAccount = !! verifiedCanLinkAccount;
      return loginData;
    },

    _notifyRelierOfLogin: function (account) {
      var self = this;
      var loginData = self._getLoginData(account, self._verifiedCanLinkAccount);
      return self.send('login', loginData)
        .then(function () {
          // the browser will take over from here,
          // don't let the screen transition.
          return { halt: self._haltAfterLogin };
        });
    }
  });

  Cocktail.mixin(
    FxDesktopAuthenticationBroker,
    ChannelMixin
  );

  return FxDesktopAuthenticationBroker;
});

