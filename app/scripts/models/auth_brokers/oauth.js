/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A broker that knows how to finish an OAuth flow. Should be subclassed
 * to override `sendOAuthResultToRelier`
 */

'use strict';

define([
  'underscore',
  'lib/url',
  'lib/oauth-errors',
  'lib/auth-errors',
  'lib/promise',
  'lib/validate',
  'models/auth_brokers/base'
], function (_, Url, OAuthErrors, AuthErrors, p, Validate, BaseAuthenticationBroker) {

  /**
   * Formats the OAuth "result.redirect" url into a {code, state} object
   *
   * @param {Object} result
   * @returns {Object}
   */
  function _formatOAuthResult(result) {

    // get code and state from redirect params
    if (! result) {
      return p.reject(OAuthErrors.toError('INVALID_RESULT'));
    } else if (! result.redirect) {
      return p.reject(OAuthErrors.toError('INVALID_RESULT_REDIRECT'));
    }

    var redirectParams = result.redirect.split('?')[1];

    result.state = Url.searchParam('state', redirectParams);
    result.code = Url.searchParam('code', redirectParams);

    if (! Validate.isOAuthCodeValid(result.code)) {
      return p.reject(OAuthErrors.toError('INVALID_RESULT_CODE'));
    }

    return p(result);
  }

  var OAuthAuthenticationBroker = BaseAuthenticationBroker.extend({
    initialize: function (options) {
      options = options || {};

      this.session = options.session;
      this._assertionLibrary = options.assertionLibrary;
      this._oAuthClient = options.oAuthClient;

      return BaseAuthenticationBroker.prototype.initialize.call(
                  this, options);
    },

    getOAuthResult: function (account) {
      var self = this;
      if (! account || ! account.get('sessionToken')) {
        return p.reject(AuthErrors.toError('INVALID_TOKEN'));
      }

      return self._assertionLibrary.generate(account.get('sessionToken'))
        .then(function (assertion) {
          var relier = self.relier;
          var oauthParams = {
            assertion: assertion,
            //jshint camelcase: false
            client_id: relier.get('clientId'),
            scope: relier.get('scope'),
            state: relier.get('state')
          };
          return self._oAuthClient.getCode(oauthParams);
        })
        .then(_formatOAuthResult);
    },

    /**
     * Overridden by subclasses to provide a strategy to finish the OAuth flow.
     *
     * @param {string} result.state - state sent by OAuth RP
     * @param {string} result.code - OAuth code generated by the OAuth server
     * @param {string} result.redirect - URL that can be used to redirect to
     * the RP.
     */
    sendOAuthResultToRelier: function (/*result*/) {
      return p.reject(new Error('subclasses must override sendOAuthResultToRelier'));
    },

    finishOAuthFlow: function (account, additionalResultData) {
      var self = this;
      self.session.clear('oauth');
      return self.getOAuthResult(account)
        .then(function (result) {
          if (additionalResultData) {
            result = _.extend(result, additionalResultData);
          }
          return self.sendOAuthResultToRelier(result);
        });
    },

    persist: function () {
      var self = this;
      return p().then(function () {
        var relier = self.relier;
        self.session.set('oauth', {
          webChannelId: self.get('webChannelId'),
          //jshint camelcase: false
          client_id: relier.get('clientId'),
          state: relier.get('state'),
          scope: relier.get('scope'),
          action: relier.get('action')
        });
      });
    },

    afterSignIn: function (account, additionalResultData) {
      // Signal to the RP that this was an existing account sign-in.
      additionalResultData.action = 'signin';
      return this.finishOAuthFlow(account, additionalResultData)
        .then(function () {
          // the RP will take over from here, no need for a screen transition.
          return { halt: true };
        });
    },

    afterSignUpConfirmationPoll: function (account) {
      var additionalResultData = { action: 'signup' };
      // The original tab always finishes the OAuth flow if it is still open.
      return this.finishOAuthFlow(account, additionalResultData);
    },

    afterResetPasswordConfirmationPoll: function (account) {
      var additionalResultData = { action: 'signin' };
      // The original tab always finishes the OAuth flow if it is still open.
      return this.finishOAuthFlow(account, additionalResultData);
    },

    transformLink: function (link) {
      return '/oauth' + link;
    }
  });

  return OAuthAuthenticationBroker;
});
