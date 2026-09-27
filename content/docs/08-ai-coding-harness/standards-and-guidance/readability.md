---
created: 2026-09-23
---
https://github.com/cursor/plugins/blob/main/pstack/skills/principle-minimize-reader-load/SKILL.md

- code should be as close to english sentences as possible
- if at anypoint you feel a need to add comment in your comment, reflect and find out how can you write code that explains itself. e.g.
```tsx
// send shipment email only if it’s fully loaded, error free and valid
if(!inFlight && !error && !invalid) {
	// do something
}

const sendShipmentEmail = !inFlight && !error && !invalid;
if(sendShipmentEmail) {
	// do something
}
```

OR 

```tsx
const MIN_AMOUNT_FOR_EXPEDITED_ORDER = {
	USA: 35,
	UK: 20,
};

function order(cart, user) {
	const { amount, isPaidToExpedite } = cart;
	const { isPrimeMember, isActive, homeCountry } = user;
	const expediteOrder = [
		isPaidToExpedite,
		amount > MIN_AMOUNT_FOR_EXPEDITED_ORDER[homeCountry] && Number.isFinite(amount) && isPrimeMember && isActive
	];
	
	if(expediteOrder.includes(true)) {
		// process expedited order
	}
	
	// process regular order
}


const MIN_AMOUNT_FOR_EXPEDITED_ORDER = {
	USA: 35,
	UK: 20,
};

function isRushOrder(cart, user) {
	const { amount, isPaidToExpedite } = cart;
	const { isPrimeMember, isActive, homeCountry } = user;
	
	const isPrimeOrderAboveMinTotalAmt = amount > MIN_AMOUNT_FOR_EXPEDITED_ORDER[homeCountry] && Number.isFinite(amount) && isPrimeMember;
	
	const rushConditions = [
		isPaidToExpedite,
		isPrimeOrderAboveMinTotalAmt && isActive
	];
	
	return rushConditions.includes(true);
}

function order(cart, user) {
	if(isRushOrder(cart, user)) {
		// process expedited order
	}
	
	// process regular order
}
```