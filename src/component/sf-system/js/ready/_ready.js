let stack = [];
export let isReady = false;

export default function ready(handler = function(){})
{
	switch (document.readyState)
	{
		case 'loading':
			stack.push(handler);
			break;
		case 'interactive':
		case 'complete':
			if (typeof(handler) == 'function')
			{
				handler();
			}
			isReady = true;
			break;
		default:
			break;
	}
}

document.addEventListener('readystatechange', () => {
	if (!isReady)
	{
		stack.forEach(ready);
		stack = [];
	}
});

SF.ready = ready;