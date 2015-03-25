/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * An AuthenticationBroker mixin that allows
 * the mixin to send messages to a channel.
 *
 * A default channel can be used (useful for testing), if
 * the broker contains this._channel, that will be used, otherwise
 * the this.ChannelConstructor will be used to create a new
 * instance
 */
'use strict';

define([
  'underscore',
  'lib/promise'
], function (_, p) {
  function doIt(strategy, channel, message, data) {
    var boundStrategy = strategy.bind(channel);
    // new channels are already set up to return promises. If so,
    // no need to denodeify.
    if (strategy.length === 3) {
      return p.denodeify(boundStrategy)(message, data);
    }

    return boundStrategy(message, data);
  }

  var ChannelMixin = {
    _messagePrefix: '',

    _transformMessage: function (message) {
      return this._messagePrefix + message;
    },

    /**
     * Send a message to the remote listener, expect no response
     *
     * @param {string} message
     * @param {object} [data]
     * @returns {Promise}
     *        The promise will resolve if the value was successfully sent.
     */
    send: function (message, data) {
      var channel = this.getChannel();
      var send = channel.send;

      return doIt(send, channel, this._transformMessage(message), data);
    },

    /**
     * Request information from the remote listener
     *
     * @param {string} message
     * @param {object} [data]
     * @returns {Promise}
     *        The promise will resolve with the value returned by the remote
     *        listener, or reject if there was an error.
     */
    request: function (message, data) {
      var channel = this.getChannel();
      // only new channels have a request. If not, fall back to send.
      var request = (channel.request || channel.send);

      return doIt(request, channel, this._transformMessage(message), data);
    }
  };

  return ChannelMixin;
});

