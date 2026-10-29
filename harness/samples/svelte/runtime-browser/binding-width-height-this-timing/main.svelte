<script>
  import { log } from './log.js';

	let w = $state(0);
	let h = $state(0);

  /** @type {HTMLElement} */
	let div = $state();

	$effect.pre(() => {
		log.push([!!div, w, h]);
	});
</script>

<div bind:this={div} bind:clientWidth={w} bind:clientHeight={h} class="box"></div>

<style>
	.box {
		width: 100px;
		height: 100px;
		background: #ff3e00;
	}
</style>
