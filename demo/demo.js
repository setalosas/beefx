/* eslint-disable */


document.addEventListener('DOMContentLoaded', function () {
	var mediaElement = document.querySelectorAll('video')[0];

	new MediaElementPlayer(mediaElement, {
		stretching: 'auto',
		success: function (media, a, b) {
      console.log({media, a, b})
   }})
});