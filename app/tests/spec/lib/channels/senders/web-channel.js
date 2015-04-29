/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';


define([
  'chai',
  'sinon',
  'lib/channels/senders/web-channel',
  '../../../../mocks/window'
],
function (chai, sinon, WebChannelSender, WindowMock) {
  var windowMock;
  var sender;

  var assert = chai.assert;

  describe('lib/channels/senders/web-channel', function () {
    beforeEach(function () {
      windowMock = new WindowMock();
      sender = new WebChannelSender();
      sender.init({
        window: windowMock,
        webChannelId: 'channel_id'
      });
    });

    afterEach(function () {
      sender.teardown();
    });

    describe('send', function () {
      it('dispatches a CustomEvent to the window', function () {
        sinon.spy(windowMock, 'dispatchEvent');
        sinon.spy(windowMock, 'CustomEvent');

        var messageId = Date.now();
        return sender.send('ping', { key: 'value' }, messageId)
          .then(function () {
            assert.isTrue(windowMock.dispatchEvent.called);

            var eventType = windowMock.CustomEvent.args[0][0];
            assert.equal(eventType, 'WebChannelMessageToChrome');

            var eventData = windowMock.CustomEvent.args[0][1].detail;
            assert.equal(eventData.id, 'channel_id');
            assert.equal(eventData.message.messageId, messageId);
            assert.equal(eventData.message.command, 'ping');
            assert.equal(eventData.message.data.key, 'value');
          });
      });
    });
  });
});
