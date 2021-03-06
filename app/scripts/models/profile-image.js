/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This model abstracts profile images

'use strict';

define([
  'backbone',
  'lib/promise',
  'lib/image-loader',
  'lib/profile-errors'
], function (Backbone, p, ImageLoader, ProfileErrors) {
  var ProfileImage = Backbone.Model.extend({
    defaults: {
      url: undefined,
      id: undefined,
      img: undefined
    },

    fetch: function () {
      var self = this;
      if (! self.has('url')) {
        return p();
      }
      return ImageLoader.load(self.get('url'))
        .then(function (img) {
          self.set('img', img);
        }, function () {
          var err = ProfileErrors.toError('IMAGE_LOAD_ERROR');
          // Set the context to the image's URL. This will be logged.
          err.context = self.get('url');
          return p.reject(err);
        });
    },

    isDefault: function () {
      return ! (this.has('url') && this.has('id') && this.has('img'));
    }
  });

  return ProfileImage;
});
