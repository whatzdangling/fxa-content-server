/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Receive a message from the browser over a WebChannel. See
 * https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/WebChannel.jsm
 */


'use strict';

define([
  'backbone',
  'underscore'
], function (Backbone, _) {

  function WebChannelReceiver() {
    // nothing to do
  }
  _.extend(WebChannelReceiver.prototype, Backbone.Events, {
    init: function (options) {
      options = options || {};

      this._window = options.window;
      this._boundReceiveMessage = this.receiveMessage.bind(this);
      this._window.addEventListener('WebChannelMessageToContent', this._boundReceiveMessage, true);
      this._webChannelId = options.webChannelId;
    },

    receiveMessage: function (event) {
      var detail = event.detail;

      if (! (detail && detail.id && detail.message)) {
        // malformed message
        this._window.console.error('malformed WebChannelMessageToContent event', JSON.stringify(detail));
        return;
      }

      if (detail.id !== this._webChannelId) {
        // not from the expected WebChannel, silently ignore.
        return;
      }

      var message = detail.message;
      if (message) {
        this.trigger('message', message);
      }
    },

    teardown: function () {
      this._window.removeEventListener('WebChannelMessageToContent', this._boundReceiveMessage, true);
    }
  });

  return WebChannelReceiver;
});

