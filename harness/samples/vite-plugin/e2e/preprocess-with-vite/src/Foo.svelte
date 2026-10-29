<script lang="ts">
	const foo: string = 'stylus';
	let { bla = 'blub' }: { bla?: string } = $props();
	console.log('pure test 1', new Date());
	console.log('pure test 2');
</script>

<h1 id="foo-title">Styles with {foo} {bla}</h1>
<p class="note">cool, huh?</p>

<style lang="stylus">
  /* prettier-ignore */
  .note
    color #ff3e00
  h1
    color magenta
</style>
