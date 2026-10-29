<script>
	let { clientWidth = 1, clientHeight = 2, offsetHeight = 3, offsetWidth = 4, audioDuration = 5, audioBuffered = 6, audioSeekable = 7, audioPlayed = 8, videoDuration = 9, videoBuffered = 10, videoSeekable = 11, videoPlayed = 12, value = '/some/file' } = $props();
</script>

<div
	bind:clientWidth
	bind:clientHeight
	bind:offsetWidth
	bind:offsetHeight
></div>

<audio
	bind:duration="{audioDuration}"
	bind:buffered="{audioBuffered}"
	bind:seekable="{audioSeekable}"
	bind:played="{audioPlayed}"
></audio>

<video
	bind:duration="{videoDuration}"
	bind:buffered="{videoBuffered}"
	bind:seekable="{videoSeekable}"
	bind:played="{videoPlayed}"
></video>

<input
  type="file"
	bind:value
/>
