<div>
	{const first = 1, second = await Promise.resolve(first + 1), third = await Promise.resolve(second + 1)}
	<p>{first}/{second}/{third}</p>
</div>
