<script>
	import { counter, increment } from './counter.remote.js';
</script>

<p id="count">{await counter()}</p>
<form {...increment}>
	<button>increment</button>
</form>
