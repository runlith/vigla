import { expect, test } from 'vitest';
import { crawl, decode } from './crawl.ts';
import { Queue } from './queue.ts';

test('the prerender crawler resolves real HTML links, ids, metadata and comma-bearing srcset URLs', () => {
	const html = `<base href="/base/"><style><a href="fake"></style><script src="ignored.js"><a href="fake"></script><a id="title-%E2%9C%A8" href="next?x=1&amp;y=2">next</a><a rel="external" href="ignored">other</a><img src="image.png" srcset="https://cdn.test/w_200,q_100/image.png 200w, /large.png 2x"><meta property="og:image" content="social.png"><a href="http://[">bad</a>`;
	expect(crawl(html, '/')).toEqual({
		ids: ['title-✨'],
		hrefs: [
			'/base/next?x=1&y=2',
			'/base/image.png',
			'https://cdn.test/w_200,q_100/image.png',
			'/large.png',
			'/base/social.png'
		],
		invalid: ['http://[']
	});
});

test('HTML text decoding is single-pass and follows legacy named-reference rules', () => {
	expect(decode('&amp;amp; &#128512; &timesbar &#deaf;')).toBe('&amp; 😀 ×bar &#deaf;');
});

test('the prerender queue limits concurrency and seals after draining', async () => {
	const queue = new Queue(2);
	const first = Promise.withResolvers<number>();
	const second = Promise.withResolvers<number>();
	const started: number[] = [];
	const a = queue.add(() => {
		started.push(1);
		return first.promise;
	});
	const b = queue.add(() => {
		started.push(2);
		return second.promise;
	});
	const c = queue.add(() => {
		started.push(3);
		return 3;
	});
	expect(started).toEqual([1, 2]);
	first.resolve(1);
	expect(await a).toBe(1);
	second.resolve(2);
	expect(await Promise.all([b, c])).toEqual([2, 3]);
	await queue.done();
	expect(started).toEqual([1, 2, 3]);
	expect(() => queue.add(() => 4)).toThrow('Cannot add tasks to a queue that has ended');
});

test('a failed prerender job rejects both its result and the queue completion', async () => {
	const queue = new Queue(1);
	const error = new Error('request failed');
	await expect(
		queue.add(() => {
			throw error;
		})
	).rejects.toBe(error);
	await expect(queue.done()).rejects.toBe(error);
});
