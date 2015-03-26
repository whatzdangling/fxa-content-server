/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/**
 * A channel that takes care of the IFRAME'd OAuth flow.
 *
 * An RPs origin must match the origin registered for the client_id
 * on the URL.
 *
 * When the channel is initialized, it sends a `ping` message
 * to the parent window. The parent window should respond with
 * a `ping` message. We do this to get a trusted origin for the
 * parent window, otherwise all we would have to use the `referrer`
 * header, which can be faked.
 *
 * When the `ping` response is received, the origin of the message is
 * checked against the origin registered for the client_id. If the origins
 * do not match, an ILLEGAL_IFRAME_PARENT error is thrown.
 */

define([
  'underscore',
  'lib/promise',
  'lib/channels/base',
  'lib/channels/mixins/postmessage_receiver'
], function (_, p, BaseChannel, PostMessageReceiverMixin) {
  function IFrameChannel() {
    // constructor, nothing to do.
  }

  _.extend(IFrameChannel.prototype, new BaseChannel(), {
    parseMessage: function (message) {
      try {
        return IFrameChannel.parse(message);
      } catch(e) {
        // drop the message on the ground
      }
    },

    dispatchCommand: function (command, data) {
      var msg = IFrameChannel.stringify(command, data);
      this.window.parent.postMessage(msg, this.getOrigin());
    },

    /**
     * A `ping` is sent out to the expected relier. The relier must respond.
     * No response will be received if the parent is either:
     * 1. not set up to respond correctly
     * 2. not the expected origin
     *
     * either case is an error. If a response is not received
     * from the expected origin, show a blank screen.
     */
    checkParentOrigin: function () {
      var self = this;
      var send = p.denodeify(self.send.bind(self));
      // if a response from the expected origin is received, then we
      // are good to go.
      return send('ping', {});
    }
  }, PostMessageReceiverMixin);

  IFrameChannel.stringify = function (command, data) {
    return JSON.stringify({
      command: command,
      data: data || {}
    });
  };

  IFrameChannel.parse = function (msg) {
    return JSON.parse(msg);
  };

  return IFrameChannel;
});

